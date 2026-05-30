import {
  validateCustomValidationRules,
  validatePicklistDependencies,
} from "@crm/core";
import { dbStore, getActiveOrgId } from "@crm/db";

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const picklistCache = new Map<string, CacheEntry<any[]>>();
const rulesCache = new Map<string, CacheEntry<any[]>>();
const TTL_MS = 5000; // 5 seconds TTL

/** Exposes helper to clear validation caches. */
export function clearValidationCaches(): void {
  picklistCache.clear();
  rulesCache.clear();
}

// Dynamically register invalidation callback on globalThis
if (typeof globalThis !== "undefined") {
  (globalThis as any).__crm_onValidationMutation = (prop: string) => {
    if (prop === "picklistDependencies") {
      picklistCache.clear();
    } else if (prop === "validationRules") {
      rulesCache.clear();
    }
  };
}

/** Looks up active picklist dependencies for an objectType and validates the payload. */
export async function enforcePicklistDependencies(
  objectType: string,
  fields: Record<string, unknown>,
): Promise<{ success: boolean; error?: string }> {
  const orgId = getActiveOrgId() || "default";
  const now = Date.now();

  let deps: any[];
  const cached = picklistCache.get(orgId);
  if (cached && now - cached.timestamp < TTL_MS) {
    deps = cached.data;
  } else {
    deps = await dbStore.picklistDependencies.findMany();
    picklistCache.set(orgId, { data: deps, timestamp: now });
  }

  const relevantDeps = deps.filter((d) => d.objectType === objectType);
  if (relevantDeps.length === 0) return { success: true };
  return validatePicklistDependencies(fields, relevantDeps);
}

/** Looks up active custom validation rules for an objectType and validates the payload. */
export async function enforceCustomValidationRules(
  objectType: string,
  fields: Record<string, unknown>,
): Promise<{ success: boolean; error?: string }> {
  const orgId = getActiveOrgId() || "default";
  const now = Date.now();

  let rules: any[];
  const cached = rulesCache.get(orgId);
  if (cached && now - cached.timestamp < TTL_MS) {
    rules = cached.data;
  } else {
    rules = await dbStore.validationRules.findMany();
    rulesCache.set(orgId, { data: rules, timestamp: now });
  }

  const relevantRules = rules.filter((r) => r.objectType === objectType);
  if (relevantRules.length === 0) return { success: true };
  return validateCustomValidationRules(fields, relevantRules);
}
