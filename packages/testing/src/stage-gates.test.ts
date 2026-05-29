import { createSessionToken } from "@crm/auth";
import { type StageGateRule, validateOpportunityStageGate } from "@crm/core";
import { dbStore, mockDb, store, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../../../apps/api/src/index";

describe("Opportunity Stage Gates & Validation Rules Tests", () => {
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

  describe("Core Business Logic Validation", () => {
    it("should pass when there are no stage gates configured", () => {
      const opp = { stage: "Prospecting", amount: "0.00" };
      const rules: StageGateRule[] = [];
      const result = validateOpportunityStageGate(opp, rules, "Closed Won");
      expect(result.isValid).toBe(true);
      expect(result.errorMessages.length).toBe(0);
    });

    it("should validate opportunity amount with greater_than operator", () => {
      const rule: StageGateRule = {
        targetStage: "Closed Won",
        field: "amount",
        operator: "greater_than",
        expectedValue: "0",
        errorMessage: "Amount must be greater than 0.",
        isActive: true,
      };

      const oppInvalid = { stage: "Prospecting", amount: "0.00" };
      const resultInvalid = validateOpportunityStageGate(
        oppInvalid,
        [rule],
        "Closed Won",
      );
      expect(resultInvalid.isValid).toBe(false);
      expect(resultInvalid.errorMessages).toContain(
        "Amount must be greater than 0.",
      );

      const oppValid = { stage: "Prospecting", amount: "150.00" };
      const resultValid = validateOpportunityStageGate(
        oppValid,
        [rule],
        "Closed Won",
      );
      expect(resultValid.isValid).toBe(true);
    });

    it("should validate presence of a field with is_not_empty operator", () => {
      const rule: StageGateRule = {
        targetStage: "Negotiation",
        field: "closeDate",
        operator: "is_not_empty",
        expectedValue: null,
        errorMessage: "Close Date is required.",
        isActive: true,
      };

      const oppInvalid = { stage: "Prospecting", closeDate: null };
      const resultInvalid = validateOpportunityStageGate(
        oppInvalid,
        [rule],
        "Negotiation",
      );
      expect(resultInvalid.isValid).toBe(false);
      expect(resultInvalid.errorMessages).toContain("Close Date is required.");

      const oppValid = { stage: "Prospecting", closeDate: new Date() };
      const resultValid = validateOpportunityStageGate(
        oppValid,
        [rule],
        "Negotiation",
      );
      expect(resultValid.isValid).toBe(true);
    });

    it("should support custom JSONB field validation", () => {
      const rule: StageGateRule = {
        targetStage: "Closed Won",
        field: "custom.contractSigned",
        operator: "equals",
        expectedValue: "true",
        errorMessage: "Contract must be signed.",
        isActive: true,
      };

      const oppInvalid = {
        stage: "Prospecting",
        custom: { contractSigned: "false" },
      };
      const resultInvalid = validateOpportunityStageGate(
        oppInvalid,
        [rule],
        "Closed Won",
      );
      expect(resultInvalid.isValid).toBe(false);

      const oppValid = {
        stage: "Prospecting",
        custom: { contractSigned: "true" },
      };
      const resultValid = validateOpportunityStageGate(
        oppValid,
        [rule],
        "Closed Won",
      );
      expect(resultValid.isValid).toBe(true);
    });
  });

  describe("REST API Endpoints", () => {
    it("should perform CRUD on stage gates and enforce active tenant RLS isolation", async () => {
      // 1. Create a stage gate as Tenant A
      const postRes = await app.request("/api/stage-gates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenTenantA}`,
        },
        body: JSON.stringify({
          targetStage: "Closed Won",
          field: "amount",
          operator: "greater_than",
          expectedValue: "1000",
          errorMessage: "Deals over 1000 can close won.",
          isActive: true,
        }),
      });

      expect(postRes.status).toBe(201);
      const postBody = await postRes.json();
      expect(postBody.success).toBe(true);
      expect(postBody.data.targetStage).toBe("Closed Won");
      expect(postBody.data.expectedValue).toBe("1000");

      // 2. RLS isolation - Tenant B reads Tenant A's stage gates -> should get empty list
      const getBRes = await app.request("/api/stage-gates", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
        },
      });
      expect(getBRes.status).toBe(200);
      const getBBody = await getBRes.json();
      expect(getBBody.data.length).toBe(0);

      // 3. GET - Tenant A reads its stage gates
      const getARes = await app.request("/api/stage-gates", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      });
      expect(getARes.status).toBe(200);
      const getABody = await getARes.json();
      expect(getABody.data.length).toBe(1);
      expect(getABody.data[0].errorMessage).toBe(
        "Deals over 1000 can close won.",
      );
    });

    it("should block opportunity stage changes when gate criteria is not met", async () => {
      // Setup - Create a gate for Tenant A: amount must be > 500 to move to "Closed Won"
      await app.request("/api/stage-gates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenTenantA}`,
        },
        body: JSON.stringify({
          targetStage: "Closed Won",
          field: "amount",
          operator: "greater_than",
          expectedValue: "500",
          errorMessage: "Closed won deals must have amount > 500.",
          isActive: true,
        }),
      });

      // Create accounts first (required for opportunities)
      const accountRes = await app.request("/api/accounts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenTenantA}`,
        },
        body: JSON.stringify({
          name: "Acme Corp",
          domain: "acme.com",
        }),
      });
      const account = (await accountRes.json()).data;

      // Create opportunity for Tenant A in default "Prospecting" stage with amount 100
      const oppRes = await app.request("/api/opportunities", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenTenantA}`,
        },
        body: JSON.stringify({
          name: "Big Acme Deal",
          stage: "Prospecting",
          accountId: account.id,
          amount: "100.00",
        }),
      });
      const opp = (await oppRes.json()).data;

      // Try to transition opportunity to "Closed Won" -> should be BLOCKED with HTTP 400
      const patchRes = await app.request(`/api/opportunities/${opp.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenTenantA}`,
        },
        body: JSON.stringify({
          stage: "Closed Won",
        }),
      });

      expect(patchRes.status).toBe(400);
      const patchBody = await patchRes.json();
      expect(patchBody.success).toBe(false);
      expect(patchBody.errors).toContain(
        "Closed won deals must have amount > 500.",
      );

      // Verify the opportunity stage has NOT changed
      const verifyRes = await app.request(`/api/opportunities/${opp.id}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      });
      const verifyOpp = (await verifyRes.json()).data;
      expect(verifyOpp.stage).toBe("Prospecting");

      // Now, update stage and amount simultaneously to meet the gate criteria -> should SUCCEED
      const successRes = await app.request(`/api/opportunities/${opp.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenTenantA}`,
        },
        body: JSON.stringify({
          stage: "Closed Won",
          amount: "600.00",
        }),
      });

      expect(successRes.status).toBe(200);
      const successBody = await successRes.json();
      expect(successBody.success).toBe(true);
      expect(successBody.data.stage).toBe("Closed Won");
      expect(successBody.data.amount).toBe("600.00");
    });

    it("should verify one tenant's stage gates do not block another tenant's opportunities", async () => {
      // Create a gate for Tenant A: amount must be > 500 to move to "Closed Won"
      await app.request("/api/stage-gates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenTenantA}`,
        },
        body: JSON.stringify({
          targetStage: "Closed Won",
          field: "amount",
          operator: "greater_than",
          expectedValue: "500",
          errorMessage: "Closed won deals must have amount > 500.",
          isActive: true,
        }),
      });

      // Setup - Create Account and Opportunity for Tenant B (should be completely unaffected by Tenant A's gate)
      const accountBRes = await app.request("/api/accounts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenTenantB}`,
        },
        body: JSON.stringify({
          name: "Beta Corp",
          domain: "beta.com",
        }),
      });
      const accountB = (await accountBRes.json()).data;

      const oppBRes = await app.request("/api/opportunities", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenTenantB}`,
        },
        body: JSON.stringify({
          name: "Small Beta Deal",
          stage: "Prospecting",
          accountId: accountB.id,
          amount: "50.00", // Clearly below Tenant A's gate restriction!
        }),
      });
      const oppB = (await oppBRes.json()).data;

      // Tenant B transitions to "Closed Won" -> should SUCCEED because Tenant A's rule shouldn't apply!
      const patchBRes = await app.request(`/api/opportunities/${oppB.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenTenantB}`,
        },
        body: JSON.stringify({
          stage: "Closed Won",
        }),
      });

      expect(patchBRes.status).toBe(200);
      const patchBBody = await patchBRes.json();
      expect(patchBBody.success).toBe(true);
      expect(patchBBody.data.stage).toBe("Closed Won");
    });
  });
});
