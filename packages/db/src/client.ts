import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

export type DbClient = ReturnType<typeof createDbClient>;

export function createDbClient(connectionString: string) {
  const pool = new pg.Pool({
    connectionString,
    // Add reasonable connection settings
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  return drizzle(pool, { schema });
}
