import { createSessionToken } from "@crm/auth";
import { EmbedderService } from "@crm/core";
import { dbStore, mockDb, pgDb, withTenant } from "@crm/db";
import { globalHybridSearch } from "@crm/search";
import { sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestApp } from "./_harness";
import { getTestPgContainer, isDockerAvailable } from "./pg-container";

const app = createTestApp();

const backends = [
  {
    name: "mock",
    setup: async () => {
      process.env.DB_DRIVER = "mock";
    },
  },
];

if (isDockerAvailable()) {
  backends.push({
    name: "postgres",
    setup: async () => {
      const { connectionString } = await getTestPgContainer();
      process.env.DB_DRIVER = "pg";
      process.env.DB_URL = connectionString;
    },
  });
}

describe.each(backends)("RRF Hybrid Search on $name backend (spec 064)", ({
  setup,
}) => {
  let tokenTenantA: string;

  const orgA = "org-tenant-a";
  const orgB = "org-tenant-b";

  beforeEach(async () => {
    await setup();
    const activeDb = process.env.DB_DRIVER === "pg" ? pgDb : mockDb;

    // Reset stores and embedder queue
    await dbStore.clear();
    EmbedderService.clearQueue();
    EmbedderService.initialize();

    if (process.env.DB_DRIVER === "pg") {
      await pgDb.execute(
        sql.raw(
          `INSERT INTO "organizations" ("id", "name", "status") VALUES ('${orgA}', 'Tenant A', 'active'), ('${orgB}', 'Tenant B', 'active') ON CONFLICT DO NOTHING`,
        ),
      );
      await pgDb.execute(
        sql.raw(
          `INSERT INTO "users" ("id", "email", "password_hash", "status") VALUES ('user-a', 'user-a@example.com', 'hash', 'active'), ('user-b', 'user-b@example.com', 'hash', 'active') ON CONFLICT DO NOTHING`,
        ),
      );
    }

    tokenTenantA = await createSessionToken({
      userId: "user-a",
      orgId: orgA,
      roleId: "role-a",
      permissionsMask: 7,
    });

    // Seed Tenant A accounts
    await withTenant(orgA, activeDb, async () => {
      // Lexical + Semantic match: "BigTrip Enterprise travel agency"
      await dbStore.accounts.insert({
        orgId: orgA,
        ownerId: "user-a",
        name: "BigTrip Enterprise Travel Agency",
        domain: "bigtrip.com",
      });

      // Lexical-only match: "BigTrip Food Supply"
      await dbStore.accounts.insert({
        orgId: orgA,
        ownerId: "user-a",
        name: "BigTrip Food Supply Ltd",
        domain: "bigfood.com",
      });

      // Semantic-only match: "Voyage Tourism Explorers" (concept: travel agency)
      await dbStore.accounts.insert({
        orgId: orgA,
        ownerId: "user-a",
        name: "Voyage Tourism Explorers",
        domain: "explorers.com",
      });
    });

    // Seed Tenant B accounts (to test strict RLS isolation)
    await withTenant(orgB, activeDb, async () => {
      await dbStore.accounts.insert({
        orgId: orgB,
        ownerId: "user-b",
        name: "BigTrip Tenant B Partners",
        domain: "tenantb.com",
      });
    });

    // Process all embeddings in background queue
    let iterations = 0;
    while (EmbedderService.getQueueLength() > 0 && iterations < 100) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      iterations++;
    }
  }, 60000);

  afterEach(async () => {
    EmbedderService.clearQueue();
  });

  it("should successfully return RRF-fused results via programmatic globalHybridSearch under Tenant A context", async () => {
    const activeDb = process.env.DB_DRIVER === "pg" ? pgDb : mockDb;
    await withTenant(orgA, activeDb, async () => {
      // Search for "BigTrip travel"
      const results = await globalHybridSearch("BigTrip travel", {
        types: ["Account"],
        dbStore,
      });

      expect(results.length).toBeGreaterThanOrEqual(2);

      // Fused rank 1 should be the high-consensus match (both BigTrip name and travel concept)
      const topResult = results[0];
      expect(topResult.record.name).toBe("BigTrip Enterprise Travel Agency");
      expect(topResult.rrfScore).toBeGreaterThan(0.01);

      // Tenant B account must be strictly omitted
      const bAccount = results.find(
        (r) => r.record.name === "BigTrip Tenant B Partners",
      );
      expect(bAccount).toBeUndefined();
    });
  });

  it("should expose unified hybrid search endpoint and enforce strict tenant isolation", async () => {
    const res = await app.request(
      "/api/search/hybrid?q=BigTrip travel&types=Account",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    const records = body.data;
    expect(records.length).toBeGreaterThanOrEqual(2);

    // Verify top record is the hybrid match
    expect(records[0].record.name).toBe("BigTrip Enterprise Travel Agency");

    // Verify strict isolation: Tenant B's BigTrip account is omitted
    const names = records.map((r: any) => r.record.name);
    expect(names).not.toContain("BigTrip Tenant B Partners");
  });

  it("should reject unauthenticated or missing tenant context requests with 401", async () => {
    const res = await app.request("/api/search/hybrid?q=travel", {
      method: "GET",
    });
    expect(res.status).toBe(401);
  });
});
