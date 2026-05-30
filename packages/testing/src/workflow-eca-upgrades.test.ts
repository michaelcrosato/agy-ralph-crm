import { createSessionToken } from "@crm/auth";
import { dbStore, mockDb, withTenant } from "@crm/db";
import {
  executeWorkflows,
  type WorkflowEvent,
  type WorkflowRule,
} from "@crm/workflow";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../../../apps/api/src/index";

describe("Workflow ECA Upgrades - Unit & Integration Tests", () => {
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

  describe("Unit: Nested Logical Conditions (AND/OR) & Operators", () => {
    it("should correctly evaluate nested logical conditions", async () => {
      const ruleAll: WorkflowRule = {
        id: "rule-all",
        triggerEvent: "opportunity.stage_changed",
        conditions: {
          all: [
            { field: "stage", operator: "equals", value: "Closed Won" },
            { field: "amount", operator: "greater_than", value: "100000" },
          ],
        },
        actions: [
          {
            type: "notification",
            target: "Big Deal Won!",
          },
        ],
      };

      const ruleAny: WorkflowRule = {
        id: "rule-any",
        triggerEvent: "opportunity.stage_changed",
        conditions: {
          any: [
            { field: "stage", operator: "equals", value: "Negotiation" },
            { field: "stage", operator: "equals", value: "Proposal" },
          ],
        },
        actions: [
          {
            type: "notification",
            target: "Pipeline active",
          },
        ],
      };

      const rules = [ruleAll, ruleAny];

      // Test case 1: Matching all conditions
      const ev1: WorkflowEvent = {
        name: "opportunity.stage_changed",
        payload: { stage: "Closed Won", amount: 150000 },
      };
      const res1 = await executeWorkflows(ev1, rules);
      expect(res1.notificationsCreated).toContain(
        "Logged notification alert: Big Deal Won!",
      );
      expect(res1.notificationsCreated.length).toBe(1);

      // Test case 2: Mismatching one of the 'all' conditions
      const ev2: WorkflowEvent = {
        name: "opportunity.stage_changed",
        payload: { stage: "Closed Won", amount: 50000 },
      };
      const res2 = await executeWorkflows(ev2, rules);
      expect(res2.notificationsCreated.length).toBe(0);

      // Test case 3: Matching one of the 'any' conditions
      const ev3: WorkflowEvent = {
        name: "opportunity.stage_changed",
        payload: { stage: "Negotiation", amount: 10000 },
      };
      const res3 = await executeWorkflows(ev3, rules);
      expect(res3.notificationsCreated).toContain(
        "Logged notification alert: Pipeline active",
      );

      // Test case 4: Other operators (less_than, contains)
      const ruleOps: WorkflowRule = {
        id: "rule-ops",
        triggerEvent: "opportunity.stage_changed",
        conditions: {
          all: [
            { field: "amount", operator: "less_than", value: "5000" },
            { field: "name", operator: "contains", value: "Test" },
          ],
        },
        actions: [{ type: "notification", target: "Small test deal" }],
      };

      const ev4: WorkflowEvent = {
        name: "opportunity.stage_changed",
        payload: { name: "A Test Opportunity", amount: 2500 },
      };
      const res4 = await executeWorkflows(ev4, [ruleOps]);
      expect(res4.notificationsCreated).toContain(
        "Logged notification alert: Small test deal",
      );
    });
  });

  describe("Integration: Automated Task Creation & Linkage via API", () => {
    it("should automatically create and link tasks when Opportunity stage transitions", async () => {
      // 1. Create a workflow rule for Tenant A specifying automated task creation
      const workflowRes = await app.request("/api/workflows", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Closed Won Followup",
          triggerEvent: "opportunity.stage_changed",
          conditions: {
            field: "stage",
            operator: "equals",
            value: "Closed Won",
          },
          actions: [
            {
              type: "task",
              target: "Standard Task Target",
              config: {
                subject: "Onboard Client",
                body: "Send onboarding package immediately.",
                dueDateOffsetDays: 7,
              },
            },
          ],
        }),
      });
      expect(workflowRes.status).toBe(200);

      // 2. Insert opportunity for Tenant A
      let oppId = "";
      await withTenant(orgA, mockDb, async () => {
        const opp = await dbStore.opportunities.insert({
          orgId: orgA,
          ownerId: "user-a",
          accountId: "acc-123",
          name: "Acme Big Deal",
          stage: "Prospecting",
          amount: "500000",
          closeDate: null,
          custom: null,
        });
        oppId = opp.id;
      });

      // 3. Patch opportunity to Closed Won (triggering the workflow ruleset!)
      const patchRes = await app.request(`/api/opportunities/${oppId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          stage: "Closed Won",
        }),
      });

      expect(patchRes.status).toBe(200);
      const patchBody = await patchRes.json();
      expect(patchBody.success).toBe(true);

      // 4. Assert that the automated task is created in the database and linked!
      await withTenant(orgA, mockDb, async () => {
        const activities = await dbStore.activities.findMany();
        expect(activities.length).toBe(1);
        expect(activities[0].subject).toBe("Onboard Client");
        expect(activities[0].body).toBe("Send onboarding package immediately.");
        expect(activities[0].type).toBe("task");
        expect(activities[0].orgId).toBe(orgA);

        const activityLinks = await dbStore.activityLinks.findMany();
        expect(activityLinks.length).toBe(1);
        expect(activityLinks[0].activityId).toBe(activities[0].id);
        expect(activityLinks[0].targetType).toBe("Opportunity");
        expect(activityLinks[0].targetId).toBe(oppId);
        expect(activityLinks[0].orgId).toBe(orgA);
      });
    });
  });

  describe("Integration: Picklist Field Updates via API", () => {
    it("should execute automated field updates successfully", async () => {
      // 1. Create a workflow rule for Tenant A specifying automatic field update of amount to "777777" when stage is "Closed Won"
      await app.request("/api/workflows", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Auto-set Amount on Close",
          triggerEvent: "opportunity.stage_changed",
          conditions: {
            field: "stage",
            operator: "equals",
            value: "Closed Won",
          },
          actions: [
            {
              type: "field_update",
              target: "Standard Target",
              config: {
                field: "amount",
                value: "777777",
              },
            },
          ],
        }),
      });

      // 2. Insert opportunity for Tenant A
      let oppId = "";
      await withTenant(orgA, mockDb, async () => {
        const opp = await dbStore.opportunities.insert({
          orgId: orgA,
          ownerId: "user-a",
          accountId: "acc-123",
          name: "Acme Mid Deal",
          stage: "Prospecting",
          amount: "1000",
          closeDate: null,
          custom: null,
        });
        oppId = opp.id;
      });

      // 3. Patch opportunity to Closed Won
      const patchRes = await app.request(`/api/opportunities/${oppId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          stage: "Closed Won",
        }),
      });

      expect(patchRes.status).toBe(200);

      // 4. Assert that the opportunity's amount was automatically mutated to "777777" inside the active tenant's context
      await withTenant(orgA, mockDb, async () => {
        const opp = await dbStore.opportunities.findOne(oppId);
        expect(opp).toBeDefined();
        expect(opp?.amount).toBe("777777");
        expect(opp?.stage).toBe("Closed Won");
      });
    });
  });

  describe("Unit: Slack-like Webhook and Notification Templates", () => {
    it("should substitute curly bracket placeholders with actual payload properties", async () => {
      const rule: WorkflowRule = {
        id: "rule-slack",
        triggerEvent: "opportunity.stage_changed",
        conditions: null,
        actions: [
          {
            type: "webhook",
            target: "https://hooks.slack.com/services/123",
            config: {
              template:
                "Opportunity {id} updated: Stage is {stage} and Amount is {amount}",
            },
          },
          {
            type: "notification",
            target: "Standard Target",
            config: {
              template: "Deal {name} is won!",
            },
          },
        ],
      };

      const event: WorkflowEvent = {
        name: "opportunity.stage_changed",
        payload: {
          id: "opp-999",
          name: "Iron Man Suit",
          stage: "Closed Won",
          amount: 5000000,
        },
      };

      const res = await executeWorkflows(event, [rule]);
      expect(res.dispatchedWebhooks.length).toBe(1);
      expect(res.dispatchedWebhooks[0]).toBe(
        "Dispatched webhook payload to: https://hooks.slack.com/services/123?payload=Opportunity%20opp-999%20updated%3A%20Stage%20is%20Closed%20Won%20and%20Amount%20is%205000000",
      );

      expect(res.notificationsCreated.length).toBe(1);
      expect(res.notificationsCreated[0]).toBe(
        "Logged notification alert: Deal Iron Man Suit is won!",
      );
    });
  });

  describe("Security: Multi-Tenant RLS Boundaries", () => {
    it("should completely prevent workflow execution side-effects leaking across tenant boundaries", async () => {
      // 1. Create a workflow rule for Tenant A specifying automatic task creation
      await app.request("/api/workflows", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Tenant A Close Alert",
          triggerEvent: "opportunity.stage_changed",
          conditions: {
            field: "stage",
            operator: "equals",
            value: "Closed Won",
          },
          actions: [
            {
              type: "task",
              target: "Tenant A Task",
              config: {
                subject: "Tenant A Automated Task",
              },
            },
          ],
        }),
      });

      // 2. Create opportunity for Tenant B
      let oppIdB = "";
      await withTenant(orgB, mockDb, async () => {
        const opp = await dbStore.opportunities.insert({
          orgId: orgB,
          ownerId: "user-b",
          accountId: "acc-456",
          name: "Tenant B Deal",
          stage: "Prospecting",
          amount: "5000",
          closeDate: null,
          custom: null,
        });
        oppIdB = opp.id;
      });

      // 3. Patch Tenant B's opportunity to Closed Won using Tenant B's session token
      const patchRes = await app.request(`/api/opportunities/${oppIdB}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          stage: "Closed Won",
        }),
      });

      expect(patchRes.status).toBe(200);

      // 4. Assert that NO automated tasks were created under Tenant B's context
      await withTenant(orgB, mockDb, async () => {
        const activities = await dbStore.activities.findMany();
        expect(activities.length).toBe(0);
      });

      // 5. Assert that Tenant A's workflow did not run or execute actions
      await withTenant(orgA, mockDb, async () => {
        const activities = await dbStore.activities.findMany();
        expect(activities.length).toBe(0);
      });
    });

    it("should reject cross-tenant mutations if direct payload injection is attempted with foreign IDs", async () => {
      // 1. Register Tenant A workflow ruleset to update field
      await app.request("/api/workflows", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Hack Field",
          triggerEvent: "opportunity.stage_changed",
          conditions: null,
          actions: [
            {
              type: "field_update",
              target: "hack",
              config: {
                field: "amount",
                value: "9999",
              },
            },
          ],
        }),
      });

      // 2. Create opportunity for Tenant B
      let oppIdB = "";
      await withTenant(orgB, mockDb, async () => {
        const opp = await dbStore.opportunities.insert({
          orgId: orgB,
          ownerId: "user-b",
          accountId: "acc-456",
          name: "Tenant B Sec Deal",
          stage: "Prospecting",
          amount: "5000",
          closeDate: null,
          custom: null,
        });
        oppIdB = opp.id;
      });

      // 3. Directly invoke executeWorkflows in Tenant A's context, but inject Tenant B's opportunity ID
      const rules = await withTenant(orgA, mockDb, async () => {
        return await dbStore.workflows.findMany();
      });

      // Attempting to execute in Tenant A's context targeting Tenant B's opportunity ID must fail due to RLS Isolation
      await expect(
        withTenant(orgA, mockDb, async () => {
          await executeWorkflows(
            {
              name: "opportunity.stage_changed",
              payload: { id: oppIdB, stage: "Closed Won" },
            },
            rules,
            {
              dbStore,
              userId: "user-a",
              orgId: orgA,
            },
          );
        }),
      ).rejects.toThrow("RLS Isolation Violation: Tenant mismatch.");

      // Assert that Tenant B's opportunity amount was NOT mutated and remains "5000"
      await withTenant(orgB, mockDb, async () => {
        const opp = await dbStore.opportunities.findOne(oppIdB);
        expect(opp?.amount).toBe("5000");
      });
    });
  });
});
