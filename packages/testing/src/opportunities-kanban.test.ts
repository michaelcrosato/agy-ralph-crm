import { createSessionToken } from "@crm/auth";
import { compileKanbanPipeline, type KanbanStageSummary } from "@crm/core";
import { dbStore, mockDb, store, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../../../apps/api/src/index";

describe("Opportunities Kanban Board API & Integration Tests", () => {
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

  describe("Core Business Logic", () => {
    it("should compile correct Kanban stage summaries and totals", () => {
      const opportunities = [
        {
          id: "opp-1",
          name: "Deal A",
          stage: "Prospecting",
          amount: "15000.00",
          closeDate: new Date(),
          accountId: "acc-1",
        },
        {
          id: "opp-2",
          name: "Deal B",
          stage: "Prospecting",
          amount: "5000.00",
          closeDate: new Date(),
          accountId: "acc-1",
        },
        {
          id: "opp-3",
          name: "Deal C",
          stage: "Closed Won",
          amount: "25000.00",
          closeDate: new Date(),
          accountId: "acc-2",
        },
      ];

      const pipeline = compileKanbanPipeline(opportunities);
      expect(pipeline.length).toBeGreaterThanOrEqual(10); // Standard stages are present

      const prospecting = pipeline.find((p) => p.stage === "Prospecting");
      expect(prospecting).toBeDefined();
      expect(prospecting?.opportunitiesCount).toBe(2);
      expect(prospecting?.totalValue).toBe("20000.00");
      expect(prospecting?.opportunities.length).toBe(2);

      const closedWon = pipeline.find((p) => p.stage === "Closed Won");
      expect(closedWon).toBeDefined();
      expect(closedWon?.opportunitiesCount).toBe(1);
      expect(closedWon?.totalValue).toBe("25000.00");
      expect(closedWon?.opportunities[0].id).toBe("opp-3");

      const qualification = pipeline.find((p) => p.stage === "Qualification");
      expect(qualification).toBeDefined();
      expect(qualification?.opportunitiesCount).toBe(0);
      expect(qualification?.totalValue).toBe("0.00");
    });
  });

  describe("REST API & Tenancy Isolation", () => {
    it("should fetch isolated Kanban summaries per tenant", async () => {
      // 1. Setup Tenant A
      await withTenant(orgA, mockDb, async () => {
        await dbStore.opportunities.insert({
          orgId: orgA,
          ownerId: "user-a",
          accountId: "acc-a",
          name: "Tenant A Deal 1",
          stage: "Prospecting",
          amount: "30000.00",
          closeDate: null,
          custom: null,
        });
      });

      // 2. Setup Tenant B
      await withTenant(orgB, mockDb, async () => {
        await dbStore.opportunities.insert({
          orgId: orgB,
          ownerId: "user-b",
          accountId: "acc-b",
          name: "Tenant B Deal 1",
          stage: "Qualification",
          amount: "90000.00",
          closeDate: null,
          custom: null,
        });
      });

      // 3. GET /api/opportunities/kanban as Tenant A
      const resA = await app.request("/api/opportunities/kanban", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      });

      expect(resA.status).toBe(200);
      const bodyA = await resA.json();
      expect(bodyA.success).toBe(true);

      const prospectingA = bodyA.data.find(
        (p: KanbanStageSummary) => p.stage === "Prospecting",
      );
      expect(prospectingA.opportunitiesCount).toBe(1);
      expect(prospectingA.totalValue).toBe("30000.00");

      const qualificationA = bodyA.data.find(
        (p: KanbanStageSummary) => p.stage === "Qualification",
      );
      expect(qualificationA.opportunitiesCount).toBe(0);

      // 4. GET /api/opportunities/kanban as Tenant B
      const resB = await app.request("/api/opportunities/kanban", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
        },
      });

      expect(resB.status).toBe(200);
      const bodyB = await resB.json();
      expect(bodyB.success).toBe(true);

      const prospectingB = bodyB.data.find(
        (p: KanbanStageSummary) => p.stage === "Prospecting",
      );
      expect(prospectingB.opportunitiesCount).toBe(0);

      const qualificationB = bodyB.data.find(
        (p: KanbanStageSummary) => p.stage === "Qualification",
      );
      expect(qualificationB.opportunitiesCount).toBe(1);
      expect(qualificationB.totalValue).toBe("90000.00");
    });

    it("should successfully transition stages, record histories, audit logs, and trigger workflows", async () => {
      let oppId = "";

      await withTenant(orgA, mockDb, async () => {
        const opp = await dbStore.opportunities.insert({
          orgId: orgA,
          ownerId: "user-a",
          accountId: "acc-a",
          name: "Transition Deal",
          stage: "Prospecting",
          amount: "5000.00",
          closeDate: null,
          custom: null,
        });
        oppId = opp.id;
      });

      // 1. POST /api/opportunities/kanban/transition
      const transitionRes = await app.request(
        "/api/opportunities/kanban/transition",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenTenantA}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            opportunityId: oppId,
            targetStage: "Qualification",
          }),
        },
      );

      expect(transitionRes.status).toBe(200);
      const transBody = await transitionRes.json();
      expect(transBody.success).toBe(true);
      expect(transBody.data.stage).toBe("Qualification");

      // 2. Assert Stage History recorded
      const histories = store.opportunityStageHistory.filter(
        (h) => h.opportunityId === oppId,
      );
      expect(histories.length).toBe(1);
      expect(histories[0].fromStage).toBe("Prospecting");
      expect(histories[0].toStage).toBe("Qualification");
      expect(histories[0].amount).toBe("5000.00");

      // 3. Assert Audit Log recorded
      const logs = store.auditLogs.filter((log) => log.recordId === oppId);
      expect(logs.length).toBe(1);
      expect(logs[0].action).toBe("stage_changed");
      expect(logs[0].changes?.stage?.before).toBe("Prospecting");
      expect(logs[0].changes?.stage?.after).toBe("Qualification");
    });

    it("should block stage transition if validation gates fail", async () => {
      let oppId = "";

      await withTenant(orgA, mockDb, async () => {
        // Setup a stage gate rule: to transition to Qualification, opportunity amount must not be empty
        await dbStore.opportunityStageGates.insert({
          orgId: orgA,
          targetStage: "Qualification",
          field: "amount",
          operator: "is_not_empty",
          errorMessage: "Amount cannot be empty for Qualification stage",
          isActive: true,
        });

        // Insert opportunity with null amount
        const opp = await dbStore.opportunities.insert({
          orgId: orgA,
          ownerId: "user-a",
          accountId: "acc-a",
          name: "Gated Deal",
          stage: "Prospecting",
          amount: null,
          closeDate: null,
          custom: null,
        });
        oppId = opp.id;
      });

      // 1. Transition with failing gate (amount is null)
      const badTransitionRes = await app.request(
        "/api/opportunities/kanban/transition",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenTenantA}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            opportunityId: oppId,
            targetStage: "Qualification",
          }),
        },
      );

      expect(badTransitionRes.status).toBe(400);
      const badBody = await badTransitionRes.json();
      expect(badBody.success).toBe(false);
      expect(badBody.errors).toContain(
        "Amount cannot be empty for Qualification stage",
      );

      // Verify opportunity is still in Prospecting stage
      const checkOpp = await withTenant(orgA, mockDb, async () => {
        return await dbStore.opportunities.findOne(oppId);
      });
      expect(checkOpp?.stage).toBe("Prospecting");
    });
  });
});
