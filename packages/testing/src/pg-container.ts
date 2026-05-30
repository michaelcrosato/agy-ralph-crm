import { resolve } from "node:path";
import { createDbClient } from "@crm/db/src/client";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/node-postgres/migrator";

let container: StartedPostgreSqlContainer | null = null;
let connectionString: string | null = null;

export async function getTestPgContainer() {
  if (container && connectionString) {
    return { container, connectionString };
  }

  // Spin up a hermetic PostgreSQL container
  container = await new PostgreSqlContainer("postgres:15-alpine")
    .withDatabase("crm_test")
    .withUsername("postgres")
    .withPassword("postgres")
    .start();

  const host = container.getHost();
  const port = container.getMappedPort(5432);
  const database = container.getDatabase();
  const username = container.getUsername();
  const password = container.getPassword();
  connectionString = `postgres://${username}:${password}@${host}:${port}/${database}`;

  // Run the Drizzle migrations against the running container
  const db = createDbClient(connectionString);
  const migrationsFolder = resolve(__dirname, "../../db/drizzle");

  await migrate(db, { migrationsFolder });

  return { container, connectionString };
}
