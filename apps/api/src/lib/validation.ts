import {
  validateCustomValidationRules,
  validatePicklistDependencies,
} from "@crm/core";
import { dbStore } from "@crm/db";

/** Looks up active picklist dependencies for an objectType and validates the payload. */
export async function enforcePicklistDependencies(
  objectType: string,
  fields: Record<string, unknown>,
): Promise<{ success: boolean; error?: string }> {
  const deps = await dbStore.picklistDependencies.findMany();
  const relevantDeps = deps.filter((d) => d.objectType === objectType);
  if (relevantDeps.length === 0) return { success: true };
  return validatePicklistDependencies(fields, relevantDeps);
}

/** Looks up active custom validation rules for an objectType and validates the payload. */
export async function enforceCustomValidationRules(
  objectType: string,
  fields: Record<string, unknown>,
): Promise<{ success: boolean; error?: string }> {
  const rules = await dbStore.validationRules.findMany();
  const relevantRules = rules.filter((r) => r.objectType === objectType);
  if (relevantRules.length === 0) return { success: true };
  return validateCustomValidationRules(fields, relevantRules);
}
