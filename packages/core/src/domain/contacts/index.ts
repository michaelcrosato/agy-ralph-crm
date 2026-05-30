import type {
  ContactRecord,
  MergeContactsInput,
  SimpleContactRelation,
} from "../../types";

export function detectCircularContactRelation(
  contactsList: SimpleContactRelation[],
  targetId: string,
  proposedReportsToId: string,
): boolean {
  if (targetId === proposedReportsToId) return true;

  const reportsToMap = new Map<string, string | null>();
  for (const c of contactsList) {
    reportsToMap.set(c.id, c.reportsToId || null);
  }

  reportsToMap.set(targetId, proposedReportsToId);

  let currentId: string | null = proposedReportsToId;
  const visited = new Set<string>();

  while (currentId) {
    if (visited.has(currentId)) {
      return true;
    }
    visited.add(currentId);

    if (currentId === targetId) {
      return true;
    }

    currentId = reportsToMap.get(currentId) || null;
  }

  return false;
}

export function calculateContactDuplicates(
  sourceContact: ContactRecord,
  allContacts: ContactRecord[],
): ContactRecord[] {
  if (!sourceContact.orgId) return [];

  const cleanString = (val: string | null): string => {
    return val ? val.trim().toLowerCase() : "";
  };

  const sourceEmail = cleanString(sourceContact.email);
  const sourceFirst = cleanString(sourceContact.firstName);
  const sourceLast = cleanString(sourceContact.lastName);

  return allContacts.filter((c) => {
    if (c.orgId !== sourceContact.orgId) return false;
    if (c.id === sourceContact.id) return false;

    const cEmail = cleanString(c.email);
    const cFirst = cleanString(c.firstName);
    const cLast = cleanString(c.lastName);

    // Rule A: Exact email match (if not empty/null)
    if (sourceEmail && cEmail && sourceEmail === cEmail) {
      return true;
    }

    // Rule B: Exact combination of firstName AND lastName match (if both not empty/null)
    if (
      sourceFirst &&
      sourceLast &&
      cFirst &&
      cLast &&
      sourceFirst === cFirst &&
      sourceLast === cLast
    ) {
      return true;
    }

    return false;
  });
}

export function mergeContacts(input: MergeContactsInput): ContactRecord {
  const { master, duplicate, fieldResolution } = input;

  if (master.orgId !== duplicate.orgId) {
    throw new Error("Cannot merge contacts from different organizations.");
  }

  const resolveField = <T>(
    fieldName: string,
    masterValue: T,
    duplicateValue: T,
  ): T => {
    const source = fieldResolution[fieldName];
    if (source === "duplicate") {
      return duplicateValue;
    }
    return masterValue;
  };

  const firstName = resolveField(
    "firstName",
    master.firstName,
    duplicate.firstName,
  );
  const lastName = resolveField(
    "lastName",
    master.lastName,
    duplicate.lastName,
  );
  const email = resolveField("email", master.email, duplicate.email);
  const accountId = resolveField(
    "accountId",
    master.accountId,
    duplicate.accountId,
  );
  const reportsToId = resolveField(
    "reportsToId",
    master.reportsToId,
    duplicate.reportsToId,
  );

  // Merge custom JSONB attributes
  const custom: Record<string, unknown> = {};

  const masterCustom = master.custom || {};
  const duplicateCustom = duplicate.custom || {};

  const allCustomKeys = new Set([
    ...Object.keys(masterCustom),
    ...Object.keys(duplicateCustom),
  ]);

  for (const key of allCustomKeys) {
    const masterVal = masterCustom[key];
    const duplicateVal = duplicateCustom[key];

    if (key in masterCustom && !(key in duplicateCustom)) {
      custom[key] = masterVal;
    } else if (!(key in masterCustom) && key in duplicateCustom) {
      custom[key] = duplicateVal;
    } else {
      // Key is in both: resolve based on "custom.key" or generic master/duplicate resolution
      const resolutionKey = `custom.${key}`;
      const source =
        fieldResolution[resolutionKey] || fieldResolution.custom || "master";
      custom[key] = source === "duplicate" ? duplicateVal : masterVal;
    }
  }

  return {
    id: master.id,
    orgId: master.orgId,
    ownerId: master.ownerId,
    accountId,
    firstName,
    lastName,
    email,
    custom: Object.keys(custom).length > 0 ? custom : null,
    reportsToId,
  };
}
