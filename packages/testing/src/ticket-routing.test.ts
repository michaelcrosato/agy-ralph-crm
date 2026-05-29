import { createSessionToken } from "@crm/auth";
import { evaluateTicketAssignment } from "@crm/core";
import { dbStore, mockDb, store, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../../../apps/api/src/index";

describe("Support Ticket Routing & Assignment Rules Engine Tests", () => {
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

  describe("Core Pure Logic Unit Tests", () => {
    it("should evaluate ticket assignment conditions correctly", () => {
      const entries = [
        {
          id: "entry-1",
          sortOrder: 1,
          routingMethod: "direct",
          routingUserIds: ["agent-1"],
          lastAssignedIndex: -1,
          criteria: [
            {
              field: "subject",
              operator: "contains" as const,
              value: "billing",
            },
          ],
        },
        {
          id: "entry-2",
          sortOrder: 2,
          routingMethod: "round_robin",
          routingUserIds: ["agent-2", "agent-3"],
          lastAssignedIndex: 0,
          criteria: [
            { field: "status", operator: "equals" as const, value: "Open" },
          ],
        },
      ];

      // 1. Matches first entry (contains "billing")
      const ticket1 = {
        subject: "Problem with billing and payment",
        status: "Open",
      };
      const res1 = evaluateTicketAssignment(ticket1, entries);
      expect(res1).not.toBeNull();
      expect(res1?.matchedEntryId).toBe("entry-1");
      expect(res1?.newAssignedToId).toBe("agent-1");
      expect(res1?.newLastAssignedIndex).toBe(-1);

      // 2. Skips first (doesn't contain "billing") and matches second (status equals Open)
      const ticket2 = {
        subject: "Broken button",
        status: "Open",
      };
      const res2 = evaluateTicketAssignment(ticket2, entries);
      expect(res2).not.toBeNull();
      expect(res2?.matchedEntryId).toBe("entry-2");
      // Rotates from index 0 -> index 1 -> agent-3
      expect(res2?.newAssignedToId).toBe("agent-3");
      expect(res2?.newLastAssignedIndex).toBe(1);

      // 3. Match fails if neither is met
      const ticket3 = {
        subject: "Help",
        status: "Resolved",
      };
      const res3 = evaluateTicketAssignment(ticket3, entries);
      expect(res3).toBeNull();
    });
  });

  describe("Ticket Routing REST API Integration", () => {
    it("should support managing routing rules and automatic routing", async () => {
      // 1. Create a routing rule for Tenant A
      const ruleRes = await app.request("/api/service/tickets/routing-rules", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Standard Routing Rule",
          isActive: 1,
        }),
      });

      expect(ruleRes.status).toBe(201);
      const ruleBody = await ruleRes.json();
      expect(ruleBody.success).toBe(true);
      const ruleId = ruleBody.data.id;
      expect(ruleId).toBeDefined();

      // Verify second rule creation deactivates first if new is active
      const ruleRes2 = await app.request("/api/service/tickets/routing-rules", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "New Routing Rule",
          isActive: 1,
        }),
      });
      expect(ruleRes2.status).toBe(201);
      const ruleBody2 = await ruleRes2.json();
      expect(ruleBody2.data.isActive).toBe(1);

      const oldRule = await withTenant(orgA, mockDb, async () => {
        return await dbStore.ticketAssignmentRules.findOne(ruleId);
      });
      expect(oldRule?.isActive).toBe(0);

      const activeRuleId = ruleBody2.data.id;

      // 2. Add rule entries (one direct, one round_robin)
      const entry1Res = await app.request(
        `/api/service/tickets/routing-rules/${activeRuleId}/entries`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenTenantA}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sortOrder: 1,
            routingMethod: "direct",
            routingUserIds: ["agent-alpha"],
            criteria: [
              { field: "subject", operator: "contains", value: "urgent" },
            ],
          }),
        },
      );
      expect(entry1Res.status).toBe(201);

      const entry2Res = await app.request(
        `/api/service/tickets/routing-rules/${activeRuleId}/entries`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenTenantA}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sortOrder: 2,
            routingMethod: "round_robin",
            routingUserIds: ["agent-beta", "agent-gamma"],
            criteria: [{ field: "status", operator: "equals", value: "Open" }],
          }),
        },
      );
      expect(entry2Res.status).toBe(201);

      // 3. Seed contact and ticket for Tenant A
      let contactId = "";
      let ticketId1 = "";
      let ticketId2 = "";

      await withTenant(orgA, mockDb, async () => {
        const contact = await dbStore.contacts.insert({
          orgId: orgA,
          ownerId: "user-a",
          firstName: "Alice",
          lastName: "Smith",
          email: "alice@company.com",
          custom: null,
        });
        contactId = contact.id;

        const ticket1 = await dbStore.tickets.insert({
          orgId: orgA,
          contactId,
          subject: "Urgent issue with login",
          status: "Open",
        });
        ticketId1 = ticket1.id;

        const ticket2 = await dbStore.tickets.insert({
          orgId: orgA,
          contactId,
          subject: "General feedback",
          status: "Open",
        });
        ticketId2 = ticket2.id;
      });

      // 4. Run automatic routing for Ticket 1 -> matches Entry 1 (direct to agent-alpha)
      const routeRes1 = await app.request(
        `/api/service/tickets/${ticketId1}/route`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenTenantA}`,
          },
        },
      );
      expect(routeRes1.status).toBe(200);
      const routeBody1 = await routeRes1.json();
      expect(routeBody1.data.assignedToId).toBe("agent-alpha");

      // 5. Run automatic routing for Ticket 2 -> matches Entry 2 (round robin rotation)
      // First call -> assigns to first user (index 0 -> agent-beta)
      const routeRes2 = await app.request(
        `/api/service/tickets/${ticketId2}/route`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenTenantA}`,
          },
        },
      );
      expect(routeRes2.status).toBe(200);
      const routeBody2 = await routeRes2.json();
      expect(routeBody2.data.assignedToId).toBe("agent-beta");

      // Verify audit logs
      const auditLogs = store.auditLogs.filter((log) => log.orgId === orgA);
      expect(
        auditLogs.some(
          (log) =>
            log.recordId === ticketId1 &&
            log.recordType === "Ticket" &&
            log.action === "assign" &&
            log.changes?.assignedToId?.after === "agent-alpha",
        ),
      ).toBe(true);
    });

    it("should enforce active tenant RLS isolation", async () => {
      let ruleIdA = "";
      let ticketIdA = "";

      // Seed A's rule and ticket
      await withTenant(orgA, mockDb, async () => {
        const rule = await dbStore.ticketAssignmentRules.insert({
          orgId: orgA,
          name: "Tenant A Rule",
          isActive: 1,
        });
        ruleIdA = rule.id;

        const contact = await dbStore.contacts.insert({
          orgId: orgA,
          ownerId: "user-a",
          firstName: "John",
          lastName: "Doe",
          email: "john.doe@org.com",
          custom: null,
        });

        const ticket = await dbStore.tickets.insert({
          orgId: orgA,
          contactId: contact.id,
          subject: "Test Ticket Tenant A",
          status: "Open",
        });
        ticketIdA = ticket.id;
      });

      // Tenant B trying to add entry to Tenant A's rule -> should return 404
      const entryResB = await app.request(
        `/api/service/tickets/routing-rules/${ruleIdA}/entries`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenTenantB}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sortOrder: 1,
            routingMethod: "direct",
            routingUserIds: ["agent-beta"],
            criteria: [],
          }),
        },
      );
      expect(entryResB.status).toBe(404);

      // Tenant B trying to route Tenant A's ticket -> should return 404
      const routeResB = await app.request(
        `/api/service/tickets/${ticketIdA}/route`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenTenantB}`,
          },
        },
      );
      expect(routeResB.status).toBe(404);
    });

    it("should support manual assignment override", async () => {
      let ticketIdA = "";

      await withTenant(orgA, mockDb, async () => {
        const contact = await dbStore.contacts.insert({
          orgId: orgA,
          ownerId: "user-a",
          firstName: "John",
          lastName: "Doe",
          email: "john.doe@org.com",
          custom: null,
        });

        const ticket = await dbStore.tickets.insert({
          orgId: orgA,
          contactId: contact.id,
          subject: "Manual Assignment Ticket",
          status: "Open",
        });
        ticketIdA = ticket.id;
      });

      const assignRes = await app.request(
        `/api/service/tickets/${ticketIdA}/assign`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${tokenTenantA}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            assignedToId: "agent-manual",
          }),
        },
      );

      expect(assignRes.status).toBe(200);
      const assignBody = await assignRes.json();
      expect(assignBody.data.assignedToId).toBe("agent-manual");

      // Verify audit trail for manual assignment override
      const auditLogs = store.auditLogs.filter((log) => log.orgId === orgA);
      expect(
        auditLogs.some(
          (log) =>
            log.recordId === ticketIdA &&
            log.recordType === "Ticket" &&
            log.action === "assign" &&
            log.changes?.assignedToId?.after === "agent-manual",
        ),
      ).toBe(true);
    });
  });
});
