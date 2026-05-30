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

describe.each(
  backends,
)("Cross-Encoder Reranking on $name backend (spec 065)", ({ setup }) => {
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
      // Travel concept account
      await dbStore.accounts.insert({
        orgId: orgA,
        ownerId: "user-a",
        name: "Voyage Travel Advisors",
        domain: "travelvoyage.com",
      });

      // Finance concept account
      await dbStore.accounts.insert({
        orgId: orgA,
        ownerId: "user-a",
        name: "Voyage Finance Advisors",
        domain: "financevoyage.com",
      });
    });

    // Seed Tenant B accounts to verify RLS tenant isolation
    await withTenant(orgB, activeDb, async () => {
      await dbStore.accounts.insert({
        orgId: orgB,
        ownerId: "user-b",
        name: "Voyage Secret Tenant B Advisors",
        domain: "tenantb.com",
      });
    });

    // Process background queue
    let iterations = 0;
    while (EmbedderService.getQueueLength() > 0 && iterations < 100) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      iterations++;
    }
  }, 60000);

  afterEach(async () => {
    EmbedderService.clearQueue();
  });

  it("should successfully rearrange results based on Cross-Encoder semantic relevance", async () => {
    const activeDb = process.env.DB_DRIVER === "pg" ? pgDb : mockDb;
    await withTenant(orgA, activeDb, async () => {
      // 1. Without reranking, both share the "Voyage" and "Advisors" words equally.
      const unreranked = await globalHybridSearch("vacation advisors", {
        types: ["Account"],
        rerank: false,
        dbStore,
      });

      expect(unreranked.length).toBe(2);

      // 2. With reranking, "Voyage Travel Advisors" should be placed first
      // because "vacation" is conceptually similar to "Travel" (both map to TRAVEL concept)
      const reranked = await globalHybridSearch("vacation advisors", {
        types: ["Account"],
        rerank: true,
        rerankLimit: 5,
        dbStore,
      });

      expect(reranked.length).toBe(2);
      expect(reranked[0].record.name).toBe("Voyage Travel Advisors");
    });
  });

  it("should enforce strict organization-level RLS tenant isolation (no leaks)", async () => {
    const activeDb = process.env.DB_DRIVER === "pg" ? pgDb : mockDb;
    await withTenant(orgA, activeDb, async () => {
      const results = await globalHybridSearch("vacation advisors", {
        types: ["Account"],
        rerank: true,
        dbStore,
      });

      // Tenant B record must be completely omitted
      const bAccount = results.find(
        (r) => r.record.name === "Voyage Secret Tenant B Advisors",
      );
      expect(bAccount).toBeUndefined();
    });
  });

  it("should fall back gracefully to standard RRF when the reranking provider fails", async () => {
    const activeDb = process.env.DB_DRIVER === "pg" ? pgDb : mockDb;
    const originalFetch = globalThis.fetch;

    // Simulate complete API failure by throwing inside fetch
    globalThis.fetch = async () => {
      throw new Error("Simulated network failure");
    };

    process.env.RERANK_PROVIDER = "cohere";
    process.env.COHERE_API_KEY = "fake-key";

    try {
      await withTenant(orgA, activeDb, async () => {
        const results = await globalHybridSearch("vacation advisors", {
          types: ["Account"],
          rerank: true,
          dbStore,
        });

        // Even with API failure, results must still be returned (fallback to standard RRF)
        expect(results.length).toBe(2);
      });
    } finally {
      globalThis.fetch = originalFetch;
      delete process.env.RERANK_PROVIDER;
      delete process.env.COHERE_API_KEY;
    }
  });

  it("should parse rerank and rerankLimit query parameters from Hono REST API hybrid search endpoint", async () => {
    const res = await app.request(
      "/api/search/hybrid?q=vacation advisors&types=Account&rerank=true&rerankLimit=5",
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
    expect(body.data.length).toBe(2);
    // Should be reranked, putting Voyage Travel Advisors first
    expect(body.data[0].record.name).toBe("Voyage Travel Advisors");
  });
});
