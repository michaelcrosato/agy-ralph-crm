import { createSessionToken } from "@crm/auth";
import { evaluateTicketEscalation } from "@crm/core";
import { dbStore, mockDb, store, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../../../apps/api/src/index";

describe("Support Ticket SLA Alerts & Breaches Escalation Engine Tests", () => {
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
    it("should evaluate milestone breached escalations correctly", () => {
      const rules = [
        {
          id: "rule-1",
          name: "Breach Escalation Rule",
          triggerType: "milestone_breached",
          timeThresholdMinutes: 0,
          escalateToId: "manager-1",
          newPriority: "Urgent",
          isActive: 1,
        },
      ];

      // 1. Milestone is actually marked breached
      const ticket = { priority: "Medium", assignedToId: "agent-1" };
      const milestones1 = [
        {
          id: "ms-1",
          milestoneType: "first_response",
          targetTime: new Date(Date.now() + 60 * 60 * 1000), // future
          status: "breached",
          completedAt: null,
        },
      ];

      const res1 = evaluateTicketEscalation(ticket, milestones1, rules);
      expect(res1).not.toBeNull();
      expect(res1?.ruleId).toBe("rule-1");
      expect(res1?.escalateToId).toBe("manager-1");
      expect(res1?.newPriority).toBe("Urgent");
      expect(res1?.reason).toContain("breached");

      // 2. Milestone target time is in the past
      const milestones2 = [
        {
          id: "ms-2",
          milestoneType: "resolution",
          targetTime: new Date(Date.now() - 5 * 60 * 1000), // 5 mins ago
          status: "pending",
          completedAt: null,
        },
      ];

      const res2 = evaluateTicketEscalation(ticket, milestones2, rules);
      expect(res2).not.toBeNull();
      expect(res2?.ruleId).toBe("rule-1");
      expect(res2?.escalateToId).toBe("manager-1");

      // 3. Milestone is pending but target time is in future -> should not escalate
      const milestones3 = [
        {
          id: "ms-3",
          milestoneType: "resolution",
          targetTime: new Date(Date.now() + 15 * 60 * 1000), // 15 mins from now
          status: "pending",
          completedAt: null,
        },
      ];
      const res3 = evaluateTicketEscalation(ticket, milestones3, rules);
      expect(res3).toBeNull();
    });

    it("should evaluate milestone approaching escalations correctly", () => {
      const rules = [
        {
          id: "rule-2",
          name: "Approaching Breach Rule",
          triggerType: "milestone_approaching",
          timeThresholdMinutes: 30, // escalate if within 30 minutes
          escalateToId: "manager-2",
          newPriority: "High",
          isActive: 1,
        },
      ];

      const ticket = { priority: "Low", assignedToId: "agent-2" };

      // 1. Milestone approaching inside threshold (20 mins away)
      const milestones1 = [
        {
          id: "ms-1",
          milestoneType: "first_response",
          targetTime: new Date(Date.now() + 20 * 60 * 1000),
          status: "pending",
          completedAt: null,
        },
      ];

      const res1 = evaluateTicketEscalation(ticket, milestones1, rules);
      expect(res1).not.toBeNull();
      expect(res1?.ruleId).toBe("rule-2");
      expect(res1?.escalateToId).toBe("manager-2");
      expect(res1?.newPriority).toBe("High");
      expect(res1?.reason).toContain("approaching breach");

      // 2. Milestone far outside threshold (45 mins away)
      const milestones2 = [
        {
          id: "ms-2",
          milestoneType: "first_response",
          targetTime: new Date(Date.now() + 45 * 60 * 1000),
          status: "pending",
          completedAt: null,
        },
      ];

      const res2 = evaluateTicketEscalation(ticket, milestones2, rules);
      expect(res2).toBeNull();
    });
  });

  describe("Ticket Escalation REST API Integration", () => {
    it("should support managing rules, automatic evaluation, history logging, and RLS", async () => {
      // 1. Create a Contact for Tenant A (required for Ticket creation)
      let contactId = "";
      await withTenant(orgA, mockDb, async () => {
        const contact = await dbStore.contacts.insert({
          orgId: orgA,
          ownerId: "user-a",
          firstName: "Jane",
          lastName: "Doe",
          email: "jane.doe@example.com",
          custom: null,
        });
        contactId = contact.id;
      });

      // 2. Create Escalation Rules for Tenant A
      const ruleRes1 = await app.request(
        "/api/service/tickets/escalation-rules",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenTenantA}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: "Milestone Breach Escalation",
            triggerType: "milestone_breached",
            escalateToId: "escalation-manager-alpha",
            newPriority: "Urgent",
            isActive: 1,
          }),
        },
      );

      expect(ruleRes1.status).toBe(201);
      const ruleBody1 = await ruleRes1.json();
      expect(ruleBody1.success).toBe(true);
      expect(ruleBody1.data.name).toBe("Milestone Breach Escalation");

      const ruleRes2 = await app.request(
        "/api/service/tickets/escalation-rules",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenTenantA}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: "Milestone Approaching Escalation",
            triggerType: "milestone_approaching",
            timeThresholdMinutes: 15,
            escalateToId: "escalation-manager-beta",
            newPriority: "High",
            isActive: 1,
          }),
        },
      );
      expect(ruleRes2.status).toBe(201);

      // 3. RLS Check: Tenant B queries rules -> should see 0 rules
      const listResB = await app.request(
        "/api/service/tickets/escalation-rules",
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${tokenTenantB}`,
          },
        },
      );
      expect(listResB.status).toBe(200);
      const listBodyB = await listResB.json();
      expect(listBodyB.data.length).toBe(0);

      // 4. Create Ticket for Tenant A
      let ticketIdA = "";
      await withTenant(orgA, mockDb, async () => {
        const ticket = await dbStore.tickets.insert({
          orgId: orgA,
          contactId,
          subject: "Database Down",
          status: "Open",
          priority: "Medium",
          assignedToId: "agent-regular",
        });
        ticketIdA = ticket.id;
      });

      // 5. Create Milestones for the Ticket
      // Setup a breached milestone (targetTime in past)
      await withTenant(orgA, mockDb, async () => {
        await dbStore.ticketMilestones.insert({
          orgId: orgA,
          ticketId: ticketIdA,
          milestoneType: "first_response",
          targetTime: new Date(Date.now() - 10 * 60 * 1000), // 10 mins ago
          status: "pending",
          completedAt: null,
        });
      });

      // 6. RLS Check: Tenant B tries to evaluate escalation on Tenant A's ticket -> should return 404
      const escalateResB = await app.request(
        `/api/service/tickets/${ticketIdA}/escalate`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenTenantB}`,
          },
        },
      );
      expect(escalateResB.status).toBe(404);

      // 7. Tenant A evaluates escalation -> should trigger Milestone Breach rule
      const escalateResA = await app.request(
        `/api/service/tickets/${ticketIdA}/escalate`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenTenantA}`,
          },
        },
      );

      expect(escalateResA.status).toBe(200);
      const escalateBodyA = await escalateResA.json();
      expect(escalateBodyA.success).toBe(true);
      expect(escalateBodyA.escalated).toBe(true);
      expect(escalateBodyA.data.assignedToId).toBe("escalation-manager-alpha");
      expect(escalateBodyA.data.priority).toBe("Urgent");
      expect(escalateBodyA.escalation).toBeDefined();
      expect(escalateBodyA.escalation.reason).toContain("breached");

      // 8. Retrieve Escalation history for Ticket A
      const escalationsResA = await app.request(
        `/api/service/tickets/${ticketIdA}/escalations`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${tokenTenantA}`,
          },
        },
      );

      expect(escalationsResA.status).toBe(200);
      const escalationsBodyA = await escalationsResA.json();
      expect(escalationsBodyA.success).toBe(true);
      expect(escalationsBodyA.data.length).toBe(1);
      expect(escalationsBodyA.data[0].escalatedToId).toBe(
        "escalation-manager-alpha",
      );
      expect(escalationsBodyA.data[0].previousPriority).toBe("Medium");
      expect(escalationsBodyA.data[0].newPriority).toBe("Urgent");

      // RLS Check: Tenant B queries escalations for Tenant A's ticket -> should return 404
      const escalationsResB = await app.request(
        `/api/service/tickets/${ticketIdA}/escalations`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${tokenTenantB}`,
          },
        },
      );
      expect(escalationsResB.status).toBe(404);

      // 9. Verify Audit logs were created
      await withTenant(orgA, mockDb, async () => {
        const logs = await dbStore.auditLogs.findMany();
        const ticketLogs = logs.filter(
          (l) =>
            l.recordId === ticketIdA &&
            l.recordType === "Ticket" &&
            l.action === "escalate",
        );
        expect(ticketLogs.length).toBe(1);
        expect(ticketLogs[0].changes.assignedToId.after).toBe(
          "escalation-manager-alpha",
        );
        expect(ticketLogs[0].changes.priority.after).toBe("Urgent");
      });
    });
  });
});
