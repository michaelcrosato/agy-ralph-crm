import { createSessionToken } from "@crm/auth";
import { evaluateLeadAssignment } from "@crm/core";
import { dbStore, mockDb, store, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../../../apps/api/src/index";

describe("Lead Assignment Rules & Auto-Routing API Tests", () => {
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
    it("should match direct routing rule by standard field criteria", () => {
      const mockLead = {
        company: "Google",
        email: "test@google.com",
        custom: null,
      };

      const entries = [
        {
          id: "entry-1",
          sortOrder: 1,
          routingMethod: "direct",
          routingUserIds: ["user-rep-1"],
          lastAssignedIndex: -1,
          criteria: [
            { field: "company", operator: "equals" as const, value: "Google" },
          ],
        },
      ];

      const match = evaluateLeadAssignment(mockLead, entries);
      expect(match).toBeDefined();
      expect(match?.matchedEntryId).toBe("entry-1");
      expect(match?.newOwnerId).toBe("user-rep-1");
    });

    it("should evaluate criteria operators properly (contains, greater_than, less_than)", () => {
      const mockLead = {
        company: "Microsoft Corporation",
        custom: { employeeCount: 150 },
      };

      const entries = [
        {
          id: "entry-1",
          sortOrder: 1,
          routingMethod: "direct",
          routingUserIds: ["user-rep-1"],
          lastAssignedIndex: -1,
          criteria: [
            {
              field: "company",
              operator: "contains" as const,
              value: "microsoft",
            },
            {
              field: "custom.employeeCount",
              operator: "greater_than" as const,
              value: "100",
            },
          ],
        },
      ];

      const match = evaluateLeadAssignment(mockLead, entries);
      expect(match).toBeDefined();
      expect(match?.matchedEntryId).toBe("entry-1");
    });

    it("should execute round-robin assignment circular circular queue routing", () => {
      const mockLead = {
        company: "Apple",
        custom: null,
      };

      const entry = {
        id: "entry-rr",
        sortOrder: 1,
        routingMethod: "round_robin",
        routingUserIds: ["rep-a", "rep-b", "rep-c"],
        lastAssignedIndex: -1,
        criteria: [],
      };

      // 1st assignment -> index 0 (rep-a)
      const match1 = evaluateLeadAssignment(mockLead, [entry]);
      expect(match1?.newOwnerId).toBe("rep-a");
      expect(match1?.newLastAssignedIndex).toBe(0);

      // 2nd assignment -> index 1 (rep-b)
      entry.lastAssignedIndex = 0;
      const match2 = evaluateLeadAssignment(mockLead, [entry]);
      expect(match2?.newOwnerId).toBe("rep-b");
      expect(match2?.newLastAssignedIndex).toBe(1);

      // 3rd assignment -> index 2 (rep-c)
      entry.lastAssignedIndex = 1;
      const match3 = evaluateLeadAssignment(mockLead, [entry]);
      expect(match3?.newOwnerId).toBe("rep-c");
      expect(match3?.newLastAssignedIndex).toBe(2);

      // 4th assignment -> index 0 (rep-a) - circular overflow
      entry.lastAssignedIndex = 2;
      const match4 = evaluateLeadAssignment(mockLead, [entry]);
      expect(match4?.newOwnerId).toBe("rep-a");
      expect(match4?.newLastAssignedIndex).toBe(0);
    });
  });

  describe("API Integration & RLS Isolation Tests", () => {
    it("should create, list, and RLS isolate lead assignment rules and entries", async () => {
      // 1. Create rule under Tenant A
      const createRes = await app.request("/api/lead-assignment-rules", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Standard Routing Rule",
          isActive: 1,
          entries: [
            {
              sortOrder: 1,
              routingMethod: "direct",
              routingUserIds: ["rep-1"],
              criteria: [
                { field: "company", operator: "equals", value: "Salesforce" },
              ],
            },
          ],
        }),
      });

      expect(createRes.status).toBe(200);
      const resBody = await createRes.json();
      expect(resBody.success).toBe(true);
      expect(resBody.data.name).toBe("Standard Routing Rule");
      expect(resBody.data.entries.length).toBe(1);
      expect(resBody.data.entries[0].routingMethod).toBe("direct");

      const ruleId = resBody.data.id;

      // 2. Tenant A lists rules -> returns 1
      const listA = await app.request("/api/lead-assignment-rules", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      });
      const listABody = await listA.json();
      expect(listABody.data.length).toBe(1);
      expect(listABody.data[0].id).toBe(ruleId);
      expect(listABody.data[0].entries[0].routingMethod).toBe("direct");

      // 3. Tenant B lists rules -> returns 0 (isolated RLS)
      const listB = await app.request("/api/lead-assignment-rules", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
        },
      });
      const listBBody = await listB.json();
      expect(listBBody.data.length).toBe(0);
    });

    it("should evaluate active routing rules and execute auto-assignment", async () => {
      // 1. Create Lead under Tenant A
      let leadId = "";
      await withTenant(orgA, mockDb, async () => {
        const lead = await dbStore.leads.insert({
          orgId: orgA,
          ownerId: "original-owner",
          status: "New",
          email: "target@salesforce.com",
          company: "Salesforce",
          convertedAccountId: null,
          convertedContactId: null,
          custom: { region: "West" },
        });
        leadId = lead.id;
      });

      // 2. Create active routing rule under Tenant A
      await app.request("/api/lead-assignment-rules", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Salesforce Direct Routing Rule",
          isActive: 1,
          entries: [
            {
              sortOrder: 1,
              routingMethod: "direct",
              routingUserIds: ["rep-salesforce"],
              criteria: [
                { field: "company", operator: "equals", value: "Salesforce" },
                { field: "custom.region", operator: "equals", value: "West" },
              ],
            },
          ],
        }),
      });

      // 3. Execute assignment route as Tenant A
      const assignRes = await app.request(`/api/leads/${leadId}/assign`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      });

      expect(assignRes.status).toBe(200);
      const assignBody = await assignRes.json();
      expect(assignBody.success).toBe(true);
      expect(assignBody.data.ownerId).toBe("rep-salesforce");

      // 4. Verify audit log entry was created for Tenant A's lead routing ownership update
      const auditLogs = store.auditLogs.filter((log) => log.orgId === orgA);
      expect(
        auditLogs.some(
          (log) =>
            log.recordId === leadId &&
            log.recordType === "leads" &&
            log.action === "assign" &&
            log.changes?.ownerId?.after === "rep-salesforce",
        ),
      ).toBe(true);
    });

    it("should prevent cross-tenant assignment triggering (strict RLS)", async () => {
      // 1. Create Lead under Tenant A
      let leadId = "";
      await withTenant(orgA, mockDb, async () => {
        const lead = await dbStore.leads.insert({
          orgId: orgA,
          ownerId: "original-owner",
          status: "New",
          email: "target@salesforce.com",
          company: "Salesforce",
          convertedAccountId: null,
          convertedContactId: null,
          custom: null,
        });
        leadId = lead.id;
      });

      // 2. Tenant B attempts to trigger auto-assignment on Tenant A's lead -> 404 lead not found under Tenant B's RLS context
      const badAssignRes = await app.request(`/api/leads/${leadId}/assign`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
        },
      });

      expect(badAssignRes.status).toBe(404);
    });
  });
});
