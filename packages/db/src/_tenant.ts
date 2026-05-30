import { AsyncLocalStorage } from "node:async_hooks";
import { sql } from "drizzle-orm";

/** Minimal interface the mock DB / real Postgres client must satisfy. */
export interface MockDatabase {
  execute: (query: unknown) => Promise<unknown>;
  transaction: <T>(run: (tx: MockDatabase) => Promise<T>) => Promise<T>;
}

/** In-memory mock that satisfies MockDatabase. Replaced by real pg client per spec 013. */
export const mockDb: MockDatabase = {
  execute: async (_query) => {
    return { rows: [] };
  },
  transaction: async (run) => {
    return await run(mockDb);
  },
};

/** AsyncLocalStorage holding the active tenant context. */
export const tenantStorage = new AsyncLocalStorage<{ orgId: string }>();

/**
 * Run `run` inside a tenant-scoped transaction. The Postgres SET LOCAL
 * call binds `app.current_org_id` for RLS policies (spec 014).
 */
export async function withTenant<T>(
  orgId: string,
  db: MockDatabase,
  run: (tx: MockDatabase) => Promise<T>,
): Promise<T> {
  return await tenantStorage.run({ orgId }, async () => {
    return await db.transaction(async (tx) => {
      await tx.execute(sql`SET LOCAL app.current_org_id = ${orgId}`);
      return await run(tx);
    });
  });
}

/** Returns the active tenant org id; throws if RLS context is unset. */
export function getActiveOrgId(): string {
  const context = tenantStorage.getStore();
  if (!context?.orgId) {
    throw new Error("RLS Isolation Violation: Tenant context not set.");
  }
  return context.orgId;
}

/** Asserts the active tenant matches `orgId`; throws on mismatch. */
export function assertSessionTenant(orgId: string): void {
  const activeOrgId = getActiveOrgId();
  if (activeOrgId !== orgId) {
    throw new Error("RLS Isolation Violation: Tenant mismatch.");
  }
}
