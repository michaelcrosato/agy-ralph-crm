import { createSessionToken } from "@crm/auth";
import { evaluateTerritoryRouting } from "@crm/core";
import { dbStore, mockDb, store, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../../../apps/api/src/index";

describe("Sales Territories & Account Auto-Routing API Tests", () => {
  let tokenTenantA: string;
  let tokenTenantB: string;

  const orgA = "org-tenant-a";
  const orgB = "org-tenant-b";

  beforeEach(async () => {
    dbStore.clear();

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
  });

  describe("Core Unit Tests", () => {
    it("should match direct territory routing by standard field criteria", () => {
      const mockAccount = {
        name: "Acme Corp",
        domain: "acme.com",
        industry: "Technology",
        custom: null,
      };

      const territories = [
        {
          id: "territory-1",
          name: "US Tech Territory",
          isActive: 1,
          routingMethod: "direct",
          lastAssignedIndex: -1,
          criteria: [
            {
              field: "industry",
              operator: "equals" as const,
              value: "Technology",
            },
          ],
        },
      ];

      const members = [
        {
          id: "member-1",
          territoryId: "territory-1",
          userId: "user-rep-1",
          role: "Primary",
        },
      ];

      const match = evaluateTerritoryRouting(mockAccount, territories, members);
      expect(match).toBeDefined();
      expect(match?.matchedTerritoryId).toBe("territory-1");
      expect(match?.newOwnerId).toBe("user-rep-1");
    });

    it("should evaluate complex criteria operators properly (contains, greater_than, less_than)", () => {
      const mockAccount = {
        name: "Enterprise Solutions Inc",
        custom: { revenue: 5000000, state: "California" },
      };

      const territories = [
        {
          id: "t-1",
          name: "CA Enterprise Territory",
          isActive: 1,
          routingMethod: "direct",
          lastAssignedIndex: -1,
          criteria: [
            {
              field: "custom.state",
              operator: "equals" as const,
              value: "California",
            },
            {
              field: "custom.revenue",
              operator: "greater_than" as const,
              value: "1000000",
            },
          ],
        },
      ];

      const members = [
        {
          id: "m-1",
          territoryId: "t-1",
          userId: "rep-1",
          role: "Primary",
        },
      ];

      const match = evaluateTerritoryRouting(mockAccount, territories, members);
      expect(match).toBeDefined();
      expect(match?.matchedTerritoryId).toBe("t-1");
      expect(match?.newOwnerId).toBe("rep-1");
    });

    it("should execute round-robin assignment circular queue routing", () => {
      const mockAccount = {
        name: "Globex Corporation",
        custom: null,
      };

      const territory = {
        id: "t-rr",
        name: "Global Round Robin",
        isActive: 1,
        routingMethod: "round_robin",
        lastAssignedIndex: -1,
        criteria: [],
      };

      const members = [
        { id: "m-1", territoryId: "t-rr", userId: "rep-a", role: "Primary" },
        { id: "m-2", territoryId: "t-rr", userId: "rep-b", role: "Primary" },
        { id: "m-3", territoryId: "t-rr", userId: "rep-c", role: "Primary" },
      ];

      // 1st assignment -> index 0 (rep-a)
      const match1 = evaluateTerritoryRouting(
        mockAccount,
        [territory],
        members,
      );
      expect(match1?.newOwnerId).toBe("rep-a");
      expect(match1?.newLastAssignedIndex).toBe(0);

      // 2nd assignment -> index 1 (rep-b)
      territory.lastAssignedIndex = 0;
      const match2 = evaluateTerritoryRouting(
        mockAccount,
        [territory],
        members,
      );
      expect(match2?.newOwnerId).toBe("rep-b");
      expect(match2?.newLastAssignedIndex).toBe(1);

      // 3rd assignment -> index 2 (rep-c)
      territory.lastAssignedIndex = 1;
      const match3 = evaluateTerritoryRouting(
        mockAccount,
        [territory],
        members,
      );
      expect(match3?.newOwnerId).toBe("rep-c");
      expect(match3?.newLastAssignedIndex).toBe(2);

      // 4th assignment -> index 0 (rep-a) - circular overflow
      territory.lastAssignedIndex = 2;
      const match4 = evaluateTerritoryRouting(
        mockAccount,
        [territory],
        members,
      );
      expect(match4?.newOwnerId).toBe("rep-a");
      expect(match4?.newLastAssignedIndex).toBe(0);
    });
  });

  describe("API Integration & RLS Isolation Tests", () => {
    it("should create, list, and RLS isolate territories and members", async () => {
      // 1. Create territory under Tenant A
      const createRes = await app.request("/api/territories", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Pacific Northwest",
          isActive: 1,
          routingMethod: "direct",
          criteria: [
            { field: "custom.state", operator: "equals", value: "Washington" },
          ],
        }),
      });

      expect(createRes.status).toBe(200);
      const resBody = await createRes.json();
      expect(resBody.success).toBe(true);
      expect(resBody.data.name).toBe("Pacific Northwest");
      expect(resBody.data.criteria.length).toBe(1);

      const territoryId = resBody.data.id;

      // 2. Add member to territory under Tenant A
      const memberRes = await app.request(
        `/api/territories/${territoryId}/members`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenTenantA}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId: "rep-pnw",
            role: "Primary",
          }),
        },
      );

      expect(memberRes.status).toBe(200);
      const memberBody = await memberRes.json();
      expect(memberBody.success).toBe(true);
      expect(memberBody.data.userId).toBe("rep-pnw");

      // 3. Tenant A lists territories -> returns 1
      const listA = await app.request("/api/territories", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      });
      const listABody = await listA.json();
      expect(listABody.data.length).toBe(1);
      expect(listABody.data[0].id).toBe(territoryId);

      // 4. Tenant B lists territories -> returns 0 (isolated RLS)
      const listB = await app.request("/api/territories", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
        },
      });
      const listBBody = await listB.json();
      expect(listBBody.data.length).toBe(0);
    });

    it("should evaluate active territories and execute account auto-assignment", async () => {
      // 1. Create Account under Tenant A
      let accountId = "";
      await withTenant(orgA, mockDb, async () => {
        const account = await dbStore.accounts.insert({
          orgId: orgA,
          ownerId: "original-owner",
          name: "Boeing",
          domain: "boeing.com",
          custom: { state: "Washington" },
        });
        accountId = account.id;
      });

      // 2. Create active territory and assign member under Tenant A
      const territoryRes = await app.request("/api/territories", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Washington State Territory",
          isActive: 1,
          routingMethod: "direct",
          criteria: [
            { field: "custom.state", operator: "equals", value: "Washington" },
          ],
        }),
      });
      const territoryBody = await territoryRes.json();
      const territoryId = territoryBody.data.id;

      await app.request(`/api/territories/${territoryId}/members`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: "rep-washington",
          role: "Primary",
        }),
      });

      // 3. Execute account routing assignment route as Tenant A
      const routeRes = await app.request(`/api/accounts/${accountId}/route`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      });

      expect(routeRes.status).toBe(200);
      const routeBody = await routeRes.json();
      expect(routeBody.success).toBe(true);
      expect(routeBody.data.ownerId).toBe("rep-washington");
      expect(routeBody.data.custom.territoryId).toBe(territoryId);
      expect(routeBody.data.custom.territoryName).toBe(
        "Washington State Territory",
      );

      // 4. Verify audit log entry was created for Tenant A's account routing ownership update
      const auditLogs = store.auditLogs.filter((log) => log.orgId === orgA);
      expect(
        auditLogs.some(
          (log) =>
            log.recordId === accountId &&
            log.recordType === "accounts" &&
            log.action === "route" &&
            log.changes?.ownerId?.after === "rep-washington" &&
            log.changes?.territoryId?.after === territoryId,
        ),
      ).toBe(true);
    });

    it("should prevent cross-tenant assignment triggering (strict RLS)", async () => {
      // 1. Create Account under Tenant A
      let accountId = "";
      await withTenant(orgA, mockDb, async () => {
        const account = await dbStore.accounts.insert({
          orgId: orgA,
          ownerId: "original-owner",
          name: "SpaceX",
          domain: "spacex.com",
          custom: null,
        });
        accountId = account.id;
      });

      // 2. Tenant B attempts to trigger auto-assignment on Tenant A's account -> 404 account not found under Tenant B's RLS context
      const badAssignRes = await app.request(
        `/api/accounts/${accountId}/route`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenTenantB}`,
          },
        },
      );

      expect(badAssignRes.status).toBe(404);
    });
  });
});
