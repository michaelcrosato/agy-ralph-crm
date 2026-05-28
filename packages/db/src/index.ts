import { sql } from "drizzle-orm";
import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export * from "./schema";

export const DB_VERSION = "0.1.0";

// Mock pgDatabase connection interface for RLS
export interface MockDatabase {
  execute: (query: unknown) => Promise<unknown>;
  transaction: <T>(run: (tx: MockDatabase) => Promise<T>) => Promise<T>;
}

// In-memory or dummy DB connection for testing and local verification
export const mockDb: MockDatabase = {
  execute: async (query) => {
    return { rows: [] };
  },
  transaction: async (run) => {
    return await run(mockDb);
  },
};

// withTenant executes a callback in a database transaction with app.current_org_id set for RLS isolation
export async function withTenant<T>(
  orgId: string,
  db: MockDatabase,
  run: (tx: MockDatabase) => Promise<T>,
): Promise<T> {
  return await db.transaction(async (tx) => {
    // Set the PostgreSQL local transaction variable
    await tx.execute(sql`SET LOCAL app.current_org_id = ${orgId}`);
    return await run(tx);
  });
}
