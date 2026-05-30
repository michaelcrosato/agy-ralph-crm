import { createSessionToken } from "@crm/auth";
import { EmbedderService } from "@crm/core";
import { dbStore, mockDb, pgDb, withTenant } from "@crm/db";
import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
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
)("pgvector Semantic Search Full-Stack on $name backend", ({ setup }) => {
  let tokenTenantA: string;
  let tokenTenantB: string;

  const orgA = "org-tenant-a";
  const orgB = "org-tenant-b";

  beforeEach(async () => {
    await setup();
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

    tokenTenantB = await createSessionToken({
      userId: "user-b",
      orgId: orgB,
      roleId: "role-b",
      permissionsMask: 7,
    });
  }, 60000);

  it("should generate embeddings asynchronously and support RLS-isolated semantic searches", async () => {
    const activeDb = process.env.DB_DRIVER === "pg" ? pgDb : mockDb;

    // 1. Tenant A inserts Accounts and Contacts
    let _googleAcc: any;
    let _acmeAcc: any;
    let _elonContact: any;

    await withTenant(orgA, activeDb, async () => {
      _googleAcc = await dbStore.accounts.insert({
        orgId: orgA,
        ownerId: "user-a",
        name: "Google AI Search",
        domain: "google.com",
      });

      _acmeAcc = await dbStore.accounts.insert({
        orgId: orgA,
        ownerId: "user-a",
        name: "Acme Corp",
        domain: "acme.com",
      });

      _elonContact = await dbStore.contacts.insert({
        orgId: orgA,
        ownerId: "user-a",
        lastName: "Musk",
        firstName: "Elon",
        email: "elon@tesla.com",
      });
    });

    // 2. Tenant B inserts Accounts and Contacts (to test isolation)
    let _independentAcc: any;
    await withTenant(orgB, activeDb, async () => {
      _independentAcc = await dbStore.accounts.insert({
        orgId: orgB,
        ownerId: "user-b",
        name: "Independent AI Tech",
        domain: "independent.com",
      });
    });

    // 3. Await background embedding queue processing
    let iterations = 0;
    while (EmbedderService.getQueueLength() > 0 && iterations < 100) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      iterations++;
    }

    // Check that embeddings exist
    let embeddings: any[] = [];
    await withTenant(orgA, activeDb, async () => {
      embeddings = await dbStore.embeddings.findMany();
    });
    expect(embeddings.length).toBeGreaterThan(0);

    // 4. Test Semantic search endpoint for Tenant A
    const searchAIRes = await app.request(
      "/api/search/semantic?q=artificial intelligence search engine",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      },
    );

    expect(searchAIRes.status).toBe(200);
    const searchAIBody = await searchAIRes.json();
    expect(searchAIBody.success).toBe(true);
    expect(searchAIBody.data.length).toBeGreaterThan(0);

    // 'Google AI Search' must be ranked first because of 'search engine' + 'AI' trigrams or semantic similarity
    expect(searchAIBody.data[0].recordType).toBe("Account");
    expect(searchAIBody.data[0].record.name).toBe("Google AI Search");

    // 5. Test Contact filtering
    const searchContactRes = await app.request(
      "/api/search/semantic?q=elon musk tesla&entity=Contact",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      },
    );
    expect(searchContactRes.status).toBe(200);
    const searchContactBody = await searchContactRes.json();
    expect(searchContactBody.data.length).toBe(1);
    expect(searchContactBody.data[0].recordType).toBe("Contact");
    expect(searchContactBody.data[0].record.lastName).toBe("Musk");

    // 6. Test strict multi-tenant RLS isolation
    // Tenant B searches -> should only find Tenant B's results, NOT Tenant A's
    const searchBRes = await app.request(
      "/api/search/semantic?q=artificial intelligence search engine",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
        },
      },
    );
    expect(searchBRes.status).toBe(200);
    const searchBBody = await searchBRes.json();
    expect(
      searchBBody.data.some((h: any) => h.record.name === "Google AI Search"),
    ).toBe(false); // Isolated!
  });
});
