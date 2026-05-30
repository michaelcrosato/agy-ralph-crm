import { dbStore, mockDb, withTenant } from "@crm/db";
import { createMcpServer, InMemoryTransport } from "@crm/mcp";
import { beforeEach, describe, expect, it } from "vitest";

describe("Model Context Protocol (MCP) Package Integration Tests", () => {
  const orgA = "org-tenant-a";
  const orgB = "org-tenant-b";

  beforeEach(() => {
    dbStore.clear();
  });

  it("should successfully execute tools end-to-end against the packages/mcp server", async () => {
    const serverA = createMcpServer({
      tenantContext: { orgId: orgA, userId: "user-a" },
      dbStore,
    });

    const transportA = new InMemoryTransport();
    await serverA.connect(transportA);

    // 1. Create an account
    const createRes = await transportA.sendRequest({
      id: 1,
      method: "tools/call",
      params: {
        name: "crm_create_account",
        arguments: {
          name: "Acme Corp",
          domain: "acme.com",
        },
      },
    });

    expect(createRes).toBeDefined();
    if ("error" in createRes) {
      throw new Error(`Tool call failed: ${JSON.stringify(createRes.error)}`);
    }

    const createdAccount = JSON.parse(
      (createRes.result.content as any)[0].text,
    );
    expect(createdAccount.id).toBeDefined();
    expect(createdAccount.name).toBe("Acme Corp");
    expect(createdAccount.domain).toBe("acme.com");

    const accountId = createdAccount.id;

    // 2. Get the account
    const getRes = await transportA.sendRequest({
      id: 2,
      method: "tools/call",
      params: {
        name: "crm_get_account",
        arguments: { accountId },
      },
    });

    if ("error" in getRes) {
      throw new Error(`Tool call failed: ${JSON.stringify(getRes.error)}`);
    }

    const fetchedAccount = JSON.parse((getRes.result.content as any)[0].text);
    expect(fetchedAccount.id).toBe(accountId);
    expect(fetchedAccount.name).toBe("Acme Corp");

    // 3. List accounts
    const listRes = await transportA.sendRequest({
      id: 3,
      method: "tools/call",
      params: {
        name: "crm_list_accounts",
        arguments: {},
      },
    });

    if ("error" in listRes) {
      throw new Error(`Tool call failed: ${JSON.stringify(listRes.error)}`);
    }

    const accountsList = JSON.parse((listRes.result.content as any)[0].text);
    expect(accountsList.length).toBe(1);
    expect(accountsList[0].id).toBe(accountId);

    // 4. Strict RLS enforcement: Tenant B tries to query Tenant A's account -> returns null
    const serverB = createMcpServer({
      tenantContext: { orgId: orgB, userId: "user-b" },
      dbStore,
    });

    const transportB = new InMemoryTransport();
    await serverB.connect(transportB);

    const getResB = await transportB.sendRequest({
      id: 4,
      method: "tools/call",
      params: {
        name: "crm_get_account",
        arguments: { accountId },
      },
    });

    if ("error" in getResB) {
      throw new Error(`Tool call failed: ${JSON.stringify(getResB.error)}`);
    }

    const fetchedAccountB = JSON.parse((getResB.result.content as any)[0].text);
    expect(fetchedAccountB).toBeNull(); // isolated!
  });

  it("should support resources and prompts", async () => {
    const server = createMcpServer({
      tenantContext: { orgId: orgA, userId: "user-a" },
      dbStore,
    });

    const transport = new InMemoryTransport();
    await server.connect(transport);

    // 1. List resources
    const resourcesRes = await transport.sendRequest({
      id: 1,
      method: "resources/list",
    });

    if ("error" in resourcesRes) {
      throw new Error(
        `Resources list failed: ${JSON.stringify(resourcesRes.error)}`,
      );
    }

    expect((resourcesRes.result.resources as any).length).toBeGreaterThan(0);

    // 2. List prompts
    const promptsRes = await transport.sendRequest({
      id: 2,
      method: "prompts/list",
    });

    if ("error" in promptsRes) {
      throw new Error(
        `Prompts list failed: ${JSON.stringify(promptsRes.error)}`,
      );
    }

    expect((promptsRes.result.prompts as any).length).toBe(3);
  });
});
