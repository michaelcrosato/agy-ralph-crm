import type {
  AccountRecord,
  MergeAccountsInput,
  SimpleAccountRelation,
} from "../../types";
import { SUPPORTED_TEAM_ROLES } from "../shared";

export function detectCircularAccountRelation(
  accountsList: SimpleAccountRelation[],
  targetId: string,
  proposedParentId: string,
): boolean {
  if (targetId === proposedParentId) return true;

  // Build a lookup map of id -> parentAccountId
  const parentMap = new Map<string, string | null>();
  for (const acct of accountsList) {
    parentMap.set(acct.id, acct.parentAccountId || null);
  }

  // Set the proposed relation in our local lookup map
  parentMap.set(targetId, proposedParentId);

  // Traverse upwards from proposedParentId to see if we ever hit targetId
  let currentId: string | null = proposedParentId;
  const visited = new Set<string>();

  while (currentId) {
    if (visited.has(currentId)) {
      // Internal cycle detected (infinite loop protection)
      return true;
    }
    visited.add(currentId);

    if (currentId === targetId) {
      return true;
    }

    currentId = parentMap.get(currentId) || null;
  }

  return false;
}

export function validateAccountTeamMember(
  accountId: string,
  userId: string,
  role: string,
): { success: boolean; error?: string } {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const mockRegex = /^(account|user|team)-[a-z0-9-]+$/i;

  if (
    !accountId ||
    (!uuidRegex.test(accountId) && !mockRegex.test(accountId))
  ) {
    return { success: false, error: "Invalid Account ID format." };
  }
  if (!userId || (!uuidRegex.test(userId) && !mockRegex.test(userId))) {
    return { success: false, error: "Invalid User ID format." };
  }
  if (!SUPPORTED_TEAM_ROLES.includes(role)) {
    return {
      success: false,
      error: `Invalid role. Supported roles are: ${SUPPORTED_TEAM_ROLES.join(", ")}`,
    };
  }
  return { success: true };
}

export function calculateAccountDuplicates(
  sourceAccount: AccountRecord,
  allAccounts: AccountRecord[],
): AccountRecord[] {
  if (!sourceAccount.orgId) return [];

  const cleanString = (val: string | null): string => {
    return val ? val.trim().toLowerCase() : "";
  };

  const sourceName = cleanString(sourceAccount.name);
  const sourceDomain = cleanString(sourceAccount.domain);

  return allAccounts.filter((acc) => {
    if (acc.orgId !== sourceAccount.orgId) return false;
    if (acc.id === sourceAccount.id) return false;

    const accName = cleanString(acc.name);
    const accDomain = cleanString(acc.domain);

    // Rule A: Exact name match
    if (sourceName && accName && sourceName === accName) {
      return true;
    }

    // Rule B: Exact domain match (if not empty/null)
    if (sourceDomain && accDomain && sourceDomain === accDomain) {
      return true;
    }

    return false;
  });
}

export function mergeAccounts(input: MergeAccountsInput): AccountRecord {
  const { master, duplicate, fieldResolution } = input;

  if (master.orgId !== duplicate.orgId) {
    throw new Error("Cannot merge accounts from different organizations.");
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

  const name = resolveField("name", master.name, duplicate.name);
  const domain = resolveField("domain", master.domain, duplicate.domain);

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
    name,
    domain,
    parentAccountId: master.parentAccountId || null,
    custom: Object.keys(custom).length > 0 ? custom : null,
  };
}
