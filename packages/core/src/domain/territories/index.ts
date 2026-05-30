import type {
  TerritoryInput,
  TerritoryMatchResult,
  TerritoryMemberInput,
} from "../../types";

export function evaluateTerritoryRouting(
  account: Record<string, unknown>,
  territories: TerritoryInput[],
  members: TerritoryMemberInput[],
): TerritoryMatchResult | null {
  const activeTerritories = territories.filter((t) => t.isActive === 1);

  for (const territory of activeTerritories) {
    let match = true;
    for (const cond of territory.criteria) {
      let val: unknown;
      if (cond.field.startsWith("custom.")) {
        const customField = cond.field.substring("custom.".length);
        val = (account.custom as Record<string, unknown> | null)?.[customField];
      } else {
        val = account[cond.field];
      }

      if (val === undefined || val === null) {
        match = false;
        break;
      }

      const valStr = String(val).toLowerCase();
      const condStr = String(cond.value).toLowerCase();

      if (cond.operator === "equals") {
        if (valStr !== condStr) {
          match = false;
          break;
        }
      } else if (cond.operator === "contains") {
        if (!valStr.includes(condStr)) {
          match = false;
          break;
        }
      } else if (cond.operator === "greater_than") {
        const vNum = Number.parseFloat(valStr);
        const cNum = Number.parseFloat(condStr);
        if (Number.isNaN(vNum) || Number.isNaN(cNum) || vNum <= cNum) {
          match = false;
          break;
        }
      } else if (cond.operator === "less_than") {
        const vNum = Number.parseFloat(valStr);
        const cNum = Number.parseFloat(condStr);
        if (Number.isNaN(vNum) || Number.isNaN(cNum) || vNum >= cNum) {
          match = false;
          break;
        }
      } else {
        match = false;
        break;
      }
    }

    if (match) {
      const primaryMembers = members.filter(
        (m) => m.territoryId === territory.id && m.role === "Primary",
      );

      if (primaryMembers.length === 0) {
        return {
          matchedTerritoryId: territory.id,
          newOwnerId: null,
          newLastAssignedIndex: -1,
        };
      }

      if (territory.routingMethod === "direct") {
        return {
          matchedTerritoryId: territory.id,
          newOwnerId: primaryMembers[0].userId,
          newLastAssignedIndex: -1,
        };
      }

      if (territory.routingMethod === "round_robin") {
        const nextIndex =
          (territory.lastAssignedIndex + 1) % primaryMembers.length;
        return {
          matchedTerritoryId: territory.id,
          newOwnerId: primaryMembers[nextIndex].userId,
          newLastAssignedIndex: nextIndex,
        };
      }
    }
  }

  return null;
}
