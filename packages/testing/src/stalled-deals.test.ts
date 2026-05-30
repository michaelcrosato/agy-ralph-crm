import { createSessionToken } from "@crm/auth";
import { calculateStalledOpportunities } from "@crm/core";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestApp } from "./_harness";

const app = createTestApp();

describe("Sales Pipeline Stalled Alerts - Core Unit Tests", () => {
  it("should identify opportunities that exceed default stage thresholds", () => {
    const opportunities = [
      {
        id: "opp-1",
        name: "Prospecting Deal",
        stage: "Prospecting",
        amount: "10000",
      },
      {
        id: "opp-2",
        name: "Fresh Qualification",
        stage: "Qualification",
        amount: "5000",
      },
      {
        id: "opp-3",
        name: "Old Qualification",
        stage: "Qualification",
        amount: "15000",
      },
      {
        id: "opp-4",
        name: "Negotiation Deal",
        stage: "Negotiation/Review",
        amount: "20000",
      },
    ];

    const today = new Date("2026-05-28T12:00:00Z");

    const stageHistory = [
      {
        opportunityId: "opp-1",
        toStage: "Prospecting",
        createdAt: new Date("2026-04-20T12:00:00Z"), // 38 days ago (Threshold = 30) -> Stalled
      },
      {
        opportunityId: "opp-2",
        toStage: "Qualification",
        createdAt: new Date("2026-05-27T12:00:00Z"), // 1 day ago (Threshold = 20) -> Safe
      },
      {
        opportunityId: "opp-3",
        toStage: "Qualification",
        createdAt: new Date("2026-05-02T12:00:00Z"), // 26 days ago (Threshold = 20) -> Stalled
      },
      {
        opportunityId: "opp-4",
        toStage: "Negotiation/Review",
        createdAt: new Date("2026-05-20T12:00:00Z"), // 8 days ago (Threshold = 5) -> Stalled
      },
    ];

    const stalled = calculateStalledOpportunities(
      opportunities,
      stageHistory,
      [],
      today,
    );

    expect(stalled.length).toBe(3);

    const stalledIds = stalled.map((s) => s.opportunityId);
    expect(stalledIds).toContain("opp-1");
    expect(stalledIds).not.toContain("opp-2");
    expect(stalledIds).toContain("opp-3");
    expect(stalledIds).toContain("opp-4");

    const opp1Result = stalled.find((s) => s.opportunityId === "opp-1");
    expect(opp1Result).toBeDefined();
    expect(opp1Result?.elapsedDays).toBe(38);
    expect(opp1Result?.maxDaysAllowed).toBe(30);
  });

  it("should respect custom stage duration rules when configured", () => {
    const opportunities = [
      {
        id: "opp-1",
        name: "Custom Proposal",
        stage: "Proposal/Price Quote",
        amount: "12000",
      },
    ];

    const today = new Date("2026-05-28T12:00:00Z");

    const stageHistory = [
      {
        opportunityId: "opp-1",
        toStage: "Proposal/Price Quote",
        createdAt: new Date("2026-05-24T12:00:00Z"), // 4 days ago
      },
    ];

    // Default threshold is 7 days, so 4 days is safe by default
    const stalledDefault = calculateStalledOpportunities(
      opportunities,
      stageHistory,
      [],
      today,
    );
    expect(stalledDefault.length).toBe(0);

    // Apply a custom rule setting Proposal threshold to 3 days -> 4 days should now be stalled
    const rules = [
      {
        stage: "Proposal/Price Quote",
        maxDaysAllowed: 3,
      },
    ];

    const stalledCustom = calculateStalledOpportunities(
      opportunities,
      stageHistory,
      rules,
      today,
    );
    expect(stalledCustom.length).toBe(1);
    expect(stalledCustom[0].opportunityId).toBe("opp-1");
    expect(stalledCustom[0].maxDaysAllowed).toBe(3);
    expect(stalledCustom[0].elapsedDays).toBe(4);
  });
});

describe("Sales Pipeline Stalled Alerts - Integration REST API Tests", () => {
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

  it("should support creating custom rules and listing stalled deals under tenant RLS isolation", async () => {
    // 1. Post a custom stage duration rule for Tenant A
    const postRuleRes = await app.request("/api/opportunities/stalled/rules", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        stage: "Needs Analysis",
        maxDaysAllowed: 5,
      }),
    });

    expect(postRuleRes.status).toBe(200);
    const ruleBody = await postRuleRes.json();
    expect(ruleBody.success).toBe(true);
    expect(ruleBody.data.stage).toBe("Needs Analysis");
    expect(ruleBody.data.maxDaysAllowed).toBe(5);

    // 2. Set up opportunities and stage history for both Tenant A and Tenant B
    await withTenant(orgA, mockDb, async () => {
      // Opp A: Needs Analysis, active, stage history is 8 days old -> Stalled under custom 5-day rule
      const oppA = await dbStore.opportunities.insert({
        orgId: orgA,
        ownerId: "user-a",
        accountId: null,
        name: "Opp Tenant A",
        stage: "Needs Analysis",
        amount: "50000",
        closeDate: null,
        custom: null,
      });

      // Insert stage history
      const eightDaysAgo = new Date();
      eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);

      await dbStore.opportunityStageHistory.insert({
        orgId: orgA,
        opportunityId: oppA.id,
        fromStage: null,
        toStage: "Needs Analysis",
        amount: "50000",
        changedById: "user-a",
      });

      // Modify the created date in memory to represent 8 days ago
      const historyItems =
        await dbStore.opportunityStageHistory.findForOpportunity(oppA.id);
      if (historyItems.length > 0) {
        historyItems[0].createdAt = eightDaysAgo;
      }
    });

    await withTenant(orgB, mockDb, async () => {
      // Opp B: Needs Analysis, active, stage history is 8 days old -> Safe under default 14-day rule (no custom rule for B)
      const oppB = await dbStore.opportunities.insert({
        orgId: orgB,
        ownerId: "user-b",
        accountId: null,
        name: "Opp Tenant B",
        stage: "Needs Analysis",
        amount: "40000",
        closeDate: null,
        custom: null,
      });

      const eightDaysAgo = new Date();
      eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);

      await dbStore.opportunityStageHistory.insert({
        orgId: orgB,
        opportunityId: oppB.id,
        fromStage: null,
        toStage: "Needs Analysis",
        amount: "40000",
        changedById: "user-b",
      });

      const historyItems =
        await dbStore.opportunityStageHistory.findForOpportunity(oppB.id);
      if (historyItems.length > 0) {
        historyItems[0].createdAt = eightDaysAgo;
      }
    });

    // 3. GET /api/opportunities/stalled for Tenant A -> Returns 1 stalled opportunity
    const getStalledA = await app.request("/api/opportunities/stalled", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
      },
    });

    expect(getStalledA.status).toBe(200);
    const bodyStalledA = await getStalledA.json();
    expect(bodyStalledA.success).toBe(true);
    expect(bodyStalledA.data.length).toBe(1);
    expect(bodyStalledA.data[0].opportunityName).toBe("Opp Tenant A");
    expect(bodyStalledA.data[0].elapsedDays).toBe(8);
    expect(bodyStalledA.data[0].maxDaysAllowed).toBe(5);

    // 4. GET /api/opportunities/stalled for Tenant B -> Returns 0 stalled (isolated + default 14-day rule)
    const getStalledB = await app.request("/api/opportunities/stalled", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantB}`,
      },
    });

    expect(getStalledB.status).toBe(200);
    const bodyStalledB = await getStalledB.json();
    expect(bodyStalledB.success).toBe(true);
    expect(bodyStalledB.data.length).toBe(0);

    // 5. GET /api/opportunities/stalled/rules for Tenant A -> Returns 1 rule
    const getRulesA = await app.request("/api/opportunities/stalled/rules", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
      },
    });

    expect(getRulesA.status).toBe(200);
    const bodyRulesA = await getRulesA.json();
    expect(bodyRulesA.success).toBe(true);
    expect(bodyRulesA.data.length).toBe(1);
    expect(bodyRulesA.data[0].stage).toBe("Needs Analysis");

    // 6. GET /api/opportunities/stalled/rules for Tenant B -> Returns 0 rules (isolated!)
    const getRulesB = await app.request("/api/opportunities/stalled/rules", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantB}`,
      },
    });

    expect(getRulesB.status).toBe(200);
    const bodyRulesB = await getRulesB.json();
    expect(bodyRulesB.success).toBe(true);
    expect(bodyRulesB.data.length).toBe(0);
  });

  it("should reject rules with invalid values", async () => {
    const postRes1 = await app.request("/api/opportunities/stalled/rules", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        stage: "",
        maxDaysAllowed: 5,
      }),
    });
    expect(postRes1.status).toBe(400);

    const postRes2 = await app.request("/api/opportunities/stalled/rules", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        stage: "Needs Analysis",
        maxDaysAllowed: -1,
      }),
    });
    expect(postRes2.status).toBe(400);
  });
});
