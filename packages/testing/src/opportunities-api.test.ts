import { createSessionToken } from "@crm/auth";
import { dbStore, mockDb, pgDb, withTenant } from "@crm/db";
import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../../../apps/api/src/index";
import { getTestPgContainer, isDockerAvailable } from "./pg-container";

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

describe.each(backends)("Opportunities REST API Tests on $name backend", ({
  setup,
}) => {
  let tokenTenantA: string;
  let tokenTenantB: string;

  const orgA = "org-tenant-a";
  const orgB = "org-tenant-b";

  beforeEach(async () => {
    await setup();
    await dbStore.clear();

    // Insert organizations and users to satisfy PostgreSQL foreign key constraints
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

  it("should support creating, listing, and retrieving opportunities isolated by tenant RLS", async () => {
    // 1. Create a mock Account for Tenant A to associate the Opportunity with
    let accountIdA = "";
    const activeDb = process.env.DB_DRIVER === "pg" ? pgDb : mockDb;
    await withTenant(orgA, activeDb, async () => {
      const acc = await dbStore.accounts.insert({
        orgId: orgA,
        ownerId: "user-a",
        name: "Enterprise Inc",
        domain: "enterprise.com",
        custom: null,
      });
      accountIdA = acc.id;
    });

    // 2. POST /api/opportunities for Tenant A
    const createRes = await app.request("/api/opportunities", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "500 Licenses Deal",
        stage: "Prospecting",
        accountId: accountIdA,
        amount: 50000,
      }),
    });

    expect(createRes.status).toBe(200);
    const createBody = await createRes.json();
    expect(createBody.success).toBe(true);
    expect(createBody.data.id).toBeDefined();
    expect(createBody.data.name).toBe("500 Licenses Deal");
    expect(createBody.data.stage).toBe("Prospecting");
    expect(createBody.data.amount).toBe("50000");

    const oppId = createBody.data.id;

    // 3. GET /api/opportunities for Tenant A -> returns the newly created opportunity
    const listResA = await app.request("/api/opportunities", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
      },
    });
    expect(listResA.status).toBe(200);
    const listBodyA = await listResA.json();
    expect(listBodyA.data.length).toBe(1);
    expect(listBodyA.data[0].id).toBe(oppId);

    // 4. GET /api/opportunities for Tenant B -> returns empty list
    const listResB = await app.request("/api/opportunities", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantB}`,
      },
    });
    expect(listResB.status).toBe(200);
    const listBodyB = await listResB.json();
    expect(listBodyB.data.length).toBe(0);

    // 5. GET /api/opportunities/:id for Tenant A -> returns correct details
    const getResA = await app.request(`/api/opportunities/${oppId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
      },
    });
    expect(getResA.status).toBe(200);
    const getBodyA = await getResA.json();
    expect(getBodyA.success).toBe(true);
    expect(getBodyA.data.name).toBe("500 Licenses Deal");

    // 6. GET /api/opportunities/:id for Tenant B -> returns 404 (mismatched tenant context)
    const getResB = await app.request(`/api/opportunities/${oppId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantB}`,
      },
    });
    expect(getResB.status).toBe(404);
  });

  it("should trigger workflows automatically on PATCH stage transition", async () => {
    // 1. Setup mock account and opportunity for Tenant A
    let accountIdA = "";
    let oppId = "";
    const activeDb = process.env.DB_DRIVER === "pg" ? pgDb : mockDb;
    await withTenant(orgA, activeDb, async () => {
      const acc = await dbStore.accounts.insert({
        orgId: orgA,
        ownerId: "user-a",
        name: "Wayne Enterprises",
        domain: "wayne.com",
        custom: null,
      });
      accountIdA = acc.id;

      const opp = await dbStore.opportunities.insert({
        orgId: orgA,
        ownerId: "user-a",
        accountId: accountIdA,
        name: "Batmobile R&D Deal",
        stage: "Prospecting",
        amount: "5000000",
        closeDate: null,
        custom: null,
      });
      oppId = opp.id;
    });

    // 2. Register a workflow trigger for Tenant A for when stage becomes 'Qualification'
    await app.request("/api/workflows", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Wayne Opp Qualified",
        triggerEvent: "opportunity.stage_changed",
        conditions: {
          field: "stage",
          operator: "equals",
          value: "Qualification",
        },
        actions: [
          {
            type: "notification",
            target:
              "Wayne Enterprises Opportunity reached Qualification stage!",
          },
        ],
      }),
    });

    // 3. PATCH /api/opportunities/:id to change stage to 'Qualification'
    const patchRes = await app.request(`/api/opportunities/${oppId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        stage: "Qualification",
        amount: 5500000,
      }),
    });

    expect(patchRes.status).toBe(200);
    const patchBody = await patchRes.json();
    expect(patchBody.success).toBe(true);
    expect(patchBody.data.stage).toBe("Qualification");
    expect(patchBody.data.amount).toBe("5500000");

    // 4. Verify that workflow actions executed successfully
    expect(patchBody.workflow).toBeDefined();
    expect(patchBody.workflow.notificationsCreated.length).toBe(1);
    expect(patchBody.workflow.notificationsCreated[0]).toContain(
      "Wayne Enterprises Opportunity reached Qualification stage!",
    );

    // 5. PATCH /api/opportunities/:id by Tenant B should fail with 404
    const patchResB = await app.request(`/api/opportunities/${oppId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${tokenTenantB}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        stage: "Closed Won",
      }),
    });
    expect(patchResB.status).toBe(404);
  });
});
