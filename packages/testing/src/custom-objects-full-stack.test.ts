import { createSessionToken } from "@crm/auth";
import { dbStore, mockDb, pgDb, withTenant } from "@crm/db";
import { createMcpServer, InMemoryTransport } from "@crm/mcp";
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
)("Dynamic Custom Objects Full-Stack & MCP on $name backend", ({ setup }) => {
  let tokenTenantA: string;
  let tokenTenantB: string;

  const orgA = "org-tenant-a";
  const orgB = "org-tenant-b";

  beforeEach(async () => {
    await setup();
    await dbStore.clear();

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

  it("should support end-to-end CRUD for Custom Objects via Hono REST endpoints with strict tenant RLS isolation", async () => {
    const activeDb = process.env.DB_DRIVER === "pg" ? pgDb : mockDb;

    // 1. Insert Custom Entity Type 'Project' for Tenant A
    let customType: any;
    await withTenant(orgA, activeDb, async () => {
      customType = await dbStore.customEntityTypes.insert({
        orgId: orgA,
        name: "Project",
        fieldsJson: [
          { apiName: "title", type: "string", required: true },
          { apiName: "budget", type: "number", required: false },
          {
            apiName: "status",
            type: "picklist",
            required: true,
            options: ["Active", "Completed"],
          },
        ],
      });
    });

    expect(customType.id).toBeDefined();

    // 2. Tenant A creates a Project record via REST API
    const createRes = await app.request("/api/custom/Project", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: "Alpha Gravity CRM",
        budget: 100000,
        status: "Active",
      }),
    });

    expect(createRes.status).toBe(200);
    const createBody = await createRes.json();
    expect(createBody.success).toBe(true);
    expect(createBody.data.id).toBeDefined();
    expect(createBody.data.data.title).toBe("Alpha Gravity CRM");

    const recordId = createBody.data.id;

    // 3. Verify bad payload is rejected with validation error
    const badCreateRes = await app.request("/api/custom/Project", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: "Missing status",
      }),
    });
    expect(badCreateRes.status).toBe(400);

    // 4. Tenant A lists records
    const listRes = await app.request("/api/custom/Project", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
      },
    });
    expect(listRes.status).toBe(200);
    const listBody = await listRes.json();
    expect(listBody.data.length).toBe(1);
    expect(listBody.data[0].id).toBe(recordId);

    // 5. Tenant A retrieves single record
    const getRes = await app.request(`/api/custom/Project/${recordId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
      },
    });
    expect(getRes.status).toBe(200);
    const getBody = await getRes.json();
    expect(getBody.data.id).toBe(recordId);

    // 6. Tenant A patches the record
    const patchRes = await app.request(`/api/custom/Project/${recordId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        budget: 120000,
      }),
    });
    expect(patchRes.status).toBe(200);
    const patchBody = await patchRes.json();
    expect(patchBody.data.data.budget).toBe(120000);
    expect(patchBody.data.data.title).toBe("Alpha Gravity CRM"); // preserved!

    // 7. Strict RLS isolation checks
    // Tenant B tries to query 'Project' -> 404 type not found because Tenant B doesn't have 'Project' custom type
    const bGetRes = await app.request(`/api/custom/Project/${recordId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantB}`,
      },
    });
    expect(bGetRes.status).toBe(404);

    // 8. Tenant A deletes the record
    const deleteRes = await app.request(`/api/custom/Project/${recordId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
      },
    });
    expect(deleteRes.status).toBe(200);

    // Verify it's gone
    const checkRes = await app.request(`/api/custom/Project/${recordId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
      },
    });
    expect(checkRes.status).toBe(404);
  });

  it("should dynamically register and execute custom entity MCP tools under strict tenant RLS isolation", async () => {
    const activeDb = process.env.DB_DRIVER === "pg" ? pgDb : mockDb;

    // 1. Insert Custom Entity Type 'ProductLine' for Tenant A
    let customType: any;
    await withTenant(orgA, activeDb, async () => {
      customType = await dbStore.customEntityTypes.insert({
        orgId: orgA,
        name: "ProductLine",
        fieldsJson: [
          { apiName: "code", type: "string", required: true },
          { apiName: "margin", type: "number", required: true },
        ],
      });
    });

    expect(customType.id).toBeDefined();

    // 2. Initialize MCP server for Tenant A
    const serverA = createMcpServer({
      tenantContext: { orgId: orgA, userId: "user-a" },
      dbStore,
    });
    const transportA = new InMemoryTransport();
    await serverA.connect(transportA);

    // 3. Verify tool listing dynamically exposes productline tools
    const toolsRes = await transportA.sendRequest({
      id: 1,
      method: "tools/list",
    });

    if ("error" in toolsRes) {
      throw new Error(`Tools list failed: ${JSON.stringify(toolsRes.error)}`);
    }

    const toolsList = toolsRes.result.tools as any[];
    const productLineTools = toolsList.filter((t) =>
      t.name.includes("productline"),
    );
    expect(productLineTools.length).toBe(5); // get, list, create, update, delete
    expect(productLineTools.map((t) => t.name)).toContain(
      "crm_create_productline",
    );

    // 4. Execute creation tool
    const callRes = await transportA.sendRequest({
      id: 2,
      method: "tools/call",
      params: {
        name: "crm_create_productline",
        arguments: {
          code: "PL-001",
          margin: 0.45,
        },
      },
    });

    if ("error" in callRes) {
      throw new Error(`Tool call failed: ${JSON.stringify(callRes.error)}`);
    }

    const createdRecord = JSON.parse((callRes.result.content as any)[0].text);
    expect(createdRecord.id).toBeDefined();
    expect(createdRecord.data.code).toBe("PL-001");
    expect(createdRecord.data.margin).toBe(0.45);

    const recordId = createdRecord.id;

    // 5. Initialize MCP server for Tenant B and check isolation
    const serverB = createMcpServer({
      tenantContext: { orgId: orgB, userId: "user-b" },
      dbStore,
    });
    const transportB = new InMemoryTransport();
    await serverB.connect(transportB);

    // Verify Tenant B list does NOT contain productline tools
    const toolsResB = await transportB.sendRequest({
      id: 3,
      method: "tools/list",
    });
    if ("error" in toolsResB) {
      throw new Error(`Tools list failed: ${JSON.stringify(toolsResB.error)}`);
    }
    const toolsListB = toolsResB.result.tools as any[];
    const productLineToolsB = toolsListB.filter((t) =>
      t.name.includes("productline"),
    );
    expect(productLineToolsB.length).toBe(0); // none!

    // Verify Tenant B calling get_productline on the record fails / returns "Record not found" or throws error
    const callResB = await transportB.sendRequest({
      id: 4,
      method: "tools/call",
      params: {
        name: "crm_get_productline",
        arguments: { id: recordId },
      },
    });
    // Should either throw unknown tool call (because productline tools are not registered for Tenant B) or fail
    expect(callResB.error || callResB.result?.isError).toBeDefined();
  });
});
