import type { ValidationRuleInput } from "../../types";
import { getFieldValue } from "../shared";

export function validateCustomValidationRules(
  fields: Record<string, unknown>,
  rules: ValidationRuleInput[],
): { success: boolean; error?: string } {
  for (const rule of rules) {
    if (rule.isActive !== 1) continue;

    let match = true;
    for (const cond of rule.criteria) {
      const recordValue = getFieldValue(fields, cond.field);

      if (recordValue === undefined || recordValue === null) {
        match = false;
        break;
      }

      const lStr = String(recordValue).toLowerCase();
      const cStr = String(cond.value).toLowerCase();

      if (cond.operator === "equals") {
        if (lStr !== cStr) {
          match = false;
          break;
        }
      } else if (cond.operator === "not_equal") {
        if (lStr === cStr) {
          match = false;
          break;
        }
      } else if (cond.operator === "contains") {
        if (!lStr.includes(cStr)) {
          match = false;
          break;
        }
      } else if (cond.operator === "greater_than") {
        const lNum = Number.parseFloat(lStr);
        const cNum = Number.parseFloat(cStr);
        if (Number.isNaN(lNum) || Number.isNaN(cNum) || lNum <= cNum) {
          match = false;
          break;
        }
      } else if (cond.operator === "less_than") {
        const lNum = Number.parseFloat(lStr);
        const cNum = Number.parseFloat(cStr);
        if (Number.isNaN(lNum) || Number.isNaN(cNum) || lNum >= cNum) {
          match = false;
          break;
        }
      } else {
        match = false;
        break;
      }
    }

    if (match && rule.criteria.length > 0) {
      return {
        success: false,
        error: rule.errorMessage,
      };
    }
  }

  return { success: true };
}
