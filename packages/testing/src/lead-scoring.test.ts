import { createSessionToken } from "@crm/auth";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../../../apps/api/src/index";

describe("Lead Scoring Rules API & Integration Tests", () => {
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

  it("should support CRUD on lead scoring rules under strict tenant context", async () => {
    // 1. Create a lead scoring rule for Tenant A
    const resCreate = await app.request("/api/lead-scoring-rules", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Enterprise Target Rule",
        scoreValue: 50,
        isActive: 1,
        criteria: [
          {
            field: "custom.tier",
            operator: "equals",
            value: "Enterprise",
          },
        ],
      }),
    });
    expect(resCreate.status).toBe(201);
    const bodyCreate = await resCreate.json();
    expect(bodyCreate.success).toBe(true);
    expect(bodyCreate.data.name).toBe("Enterprise Target Rule");
    expect(bodyCreate.data.scoreValue).toBe(50);
    expect(bodyCreate.data.orgId).toBe(orgA);

    // 2. Fetch all rules for Tenant A
    const resList = await app.request("/api/lead-scoring-rules", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
      },
    });
    expect(resList.status).toBe(200);
    const bodyList = await resList.json();
    expect(bodyList.data).toHaveLength(1);
    expect(bodyList.data[0].name).toBe("Enterprise Target Rule");

    // 3. Verify Tenant B sees 0 rules
    const resListB = await app.request("/api/lead-scoring-rules", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantB}`,
      },
    });
    expect(resListB.status).toBe(200);
    const bodyListB = await resListB.json();
    expect(bodyListB.data).toHaveLength(0);
  });

  it("should calculate and recalculate dynamic lead scores based on rules", async () => {
    let leadId = "";

    // 1. Setup lead scoring rules and a lead under Tenant A
    await withTenant(orgA, mockDb, async () => {
      // Rule 1: Custom Tier Enterprise (+50)
      await dbStore.leadScoringRules.insert({
        orgId: orgA,
        name: "Enterprise Bonus",
        scoreValue: 50,
        isActive: 1,
        criteria: [
          {
            field: "custom.tier",
            operator: "equals",
            value: "Enterprise",
          },
        ],
      });

      // Rule 2: Company contains Google (+30)
      await dbStore.leadScoringRules.insert({
        orgId: orgA,
        name: "Google Target",
        scoreValue: 30,
        isActive: 1,
        criteria: [
          {
            field: "company",
            operator: "contains",
            value: "Google",
          },
        ],
      });

      // Rule 3: Employees greater than 100 (+20)
      await dbStore.leadScoringRules.insert({
        orgId: orgA,
        name: "Large Company",
        scoreValue: 20,
        isActive: 1,
        criteria: [
          {
            field: "custom.employees",
            operator: "greater_than",
            value: "100",
          },
        ],
      });

      // Rule 4: Inactive Rule (should be ignored)
      await dbStore.leadScoringRules.insert({
        orgId: orgA,
        name: "Inactive Rule",
        scoreValue: 100,
        isActive: 0,
        criteria: [
          {
            field: "status",
            operator: "equals",
            value: "New",
          },
        ],
      });

      const lead = await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "user-a",
        status: "New",
        email: "vp@google.com",
        company: "Google LLC",
        convertedAccountId: null,
        convertedContactId: null,
        custom: {
          tier: "Enterprise",
          employees: 150,
        },
      });
      leadId = lead.id;
    });

    // 2. Fetch score dynamically (Rule 1, 2, 3 should match: 50 + 30 + 20 = 100)
    const resScore = await app.request(`/api/leads/${leadId}/score`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
      },
    });
    expect(resScore.status).toBe(200);
    const bodyScore = await resScore.json();
    expect(bodyScore.score).toBe(100);

    // 3. Recalculate and persist score
    const resRecalc = await app.request(
      `/api/leads/${leadId}/score/recalculate`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      },
    );
    expect(resRecalc.status).toBe(200);
    const bodyRecalc = await resRecalc.json();
    expect(bodyRecalc.success).toBe(true);
    expect(bodyRecalc.data.custom.score).toBe(100);

    // 4. Assert Audit Log entry was generated
    await withTenant(orgA, mockDb, async () => {
      const logs = await dbStore.auditLogs.findMany();
      const recalcLog = logs.find((l) => l.action === "recalculate_score");
      expect(recalcLog).toBeDefined();
      expect(recalcLog?.recordId).toBe(leadId);
      expect(recalcLog?.changes?.score?.after).toBe(100);
    });
  });

  it("should enforce strict RLS isolation boundaries for scoring rules and score calculation", async () => {
    let leadAId = "";

    // 1. Create a lead and a rule for Tenant A
    await withTenant(orgA, mockDb, async () => {
      await dbStore.leadScoringRules.insert({
        orgId: orgA,
        name: "Enterprise Bonus",
        scoreValue: 50,
        isActive: 1,
        criteria: [
          {
            field: "custom.tier",
            operator: "equals",
            value: "Enterprise",
          },
        ],
      });

      const lead = await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "user-a",
        status: "New",
        email: "alice@enterprise.com",
        company: "Acme Enterprise",
        convertedAccountId: null,
        convertedContactId: null,
        custom: {
          tier: "Enterprise",
        },
      });
      leadAId = lead.id;
    });

    // 2. Tenant B attempts to fetch Tenant A's lead score (should fail with 404 lead not found due to RLS)
    const resScoreB = await app.request(`/api/leads/${leadAId}/score`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantB}`,
      },
    });
    expect(resScoreB.status).toBe(404);

    // 3. Tenant B attempts to trigger a recalculation on Tenant A's lead (should fail with 404 lead not found due to RLS)
    const resRecalcB = await app.request(
      `/api/leads/${leadAId}/score/recalculate`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
        },
      },
    );
    expect(resRecalcB.status).toBe(404);

    // 4. Verify that Tenant B inserting a rule targeting Tenant A throws an error in the store due to Tenant mismatch
    await expect(
      withTenant(orgB, mockDb, async () => {
        await dbStore.leadScoringRules.insert({
          orgId: orgA, // Mismatch!
          name: "Malicious Rule",
          scoreValue: 100,
          isActive: 1,
          criteria: [],
        });
      }),
    ).rejects.toThrow("RLS Isolation Violation: Tenant mismatch.");
  });
});
