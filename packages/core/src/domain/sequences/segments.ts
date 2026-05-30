import type { CoreSequenceMembership } from "../../types";
import { enrollInSequence } from "./enrollment";

export function evaluateSegmentCriteria(
  record: Record<string, unknown>,
  criteria: { field: string; operator: string; value: string }[],
): boolean {
  for (const cond of criteria) {
    let val: unknown;
    if (cond.field.startsWith("custom.")) {
      const customField = cond.field.substring("custom.".length);
      val = (record.custom as Record<string, unknown> | null)?.[customField];
    } else {
      val = record[cond.field];
    }

    if (val === undefined || val === null) {
      return false;
    }

    const valStr = String(val).toLowerCase();
    const condStr = String(cond.value).toLowerCase();

    if (cond.operator === "equals") {
      if (valStr !== condStr) return false;
    } else if (cond.operator === "not_equal") {
      if (valStr === condStr) return false;
    } else if (cond.operator === "contains") {
      if (!valStr.includes(condStr)) return false;
    } else if (cond.operator === "greater_than") {
      const vNum = Number.parseFloat(valStr);
      const cNum = Number.parseFloat(condStr);
      if (Number.isNaN(vNum) || Number.isNaN(cNum) || vNum <= cNum)
        return false;
    } else if (cond.operator === "less_than") {
      const vNum = Number.parseFloat(valStr);
      const cNum = Number.parseFloat(condStr);
      if (Number.isNaN(vNum) || Number.isNaN(cNum) || vNum >= cNum)
        return false;
    } else {
      return false;
    }
  }
  return true;
}

export async function resolveSegmentMembers(
  // biome-ignore lint/suspicious/noExplicitAny: dbStore dynamic reference
  db: any,
  _tenantOrgId: string,
  segmentId: string,
  // biome-ignore lint/suspicious/noExplicitAny: dynamic return
): Promise<any[]> {
  const segment = await db.marketingSegments.findOne(segmentId);
  if (!segment) {
    throw new Error("Segment not found");
  }

  if (segment.objectType === "lead") {
    const leads = await db.leads.findMany();
    // biome-ignore lint/suspicious/noExplicitAny: lead typecast
    return leads.filter((l: any) =>
      evaluateSegmentCriteria(l, segment.criteria),
    );
  }

  const contacts = await db.contacts.findMany();
  // biome-ignore lint/suspicious/noExplicitAny: contact typecast
  return contacts.filter((c: any) =>
    evaluateSegmentCriteria(c, segment.criteria),
  );
}

export async function enrollSegmentInSequence(
  // biome-ignore lint/suspicious/noExplicitAny: dbStore dynamic reference
  dbStore: any,
  orgId: string,
  segmentId: string,
  sequenceId: string,
): Promise<{
  enrolledCount: number;
  skippedCount: number;
  // biome-ignore lint/suspicious/noExplicitAny: dynamic return
  memberships: any[];
}> {
  const segment = await dbStore.marketingSegments.findOne(segmentId);
  if (!segment) {
    throw new Error("Segment not found");
  }

  const sequence = await dbStore.marketingSequences.findOne(sequenceId);
  if (!sequence) {
    throw new Error("Sequence not found");
  }

  // 1. Resolve segment members
  const members = await resolveSegmentMembers(dbStore, orgId, segmentId);

  // 2. Fetch existing active memberships in target sequence
  const existingMemberships =
    await dbStore.marketingSequenceMemberships.findForSequence(sequenceId);
  const activeRecordIds = new Set(
    existingMemberships
      .filter((m: CoreSequenceMembership) => m.status === "active")
      .map((m: CoreSequenceMembership) => m.recordId),
  );

  // 3. Enroll non-duplicate members
  const newlyEnrolled: CoreSequenceMembership[] = [];
  let skipped = 0;

  for (const member of members) {
    if (activeRecordIds.has(member.id)) {
      skipped++;
      continue;
    }

    const membership = await enrollInSequence(
      dbStore,
      orgId,
      sequenceId,
      segment.objectType as "lead" | "contact",
      member.id,
    );
    newlyEnrolled.push(membership);
  }

  return {
    enrolledCount: newlyEnrolled.length,
    skippedCount: skipped,
    memberships: newlyEnrolled,
  };
}
