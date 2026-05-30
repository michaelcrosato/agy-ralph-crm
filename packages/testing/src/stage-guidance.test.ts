import { createSessionToken } from "@crm/auth";
import { validateStageGuidanceKeyFields } from "@crm/core";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestApp } from "./_harness";

const app = createTestApp();

describe("Sales Path Stage Guidance API & Validation Tests", () => {
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
    it("should pass key fields validation when all fields are populated", () => {
      const opp = {
        amount: "5000.00",
        closeDate: "2026-12-31",
        custom: {
          budget: "6000",
        },
      };

      const result = validateStageGuidanceKeyFields(opp, [
        "amount",
        "closeDate",
        "custom.budget",
      ]);
      expect(result.isClean).toBe(true);
      expect(result.missingFields.length).toBe(0);
    });

    it("should identify missing key fields", () => {
      const opp = {
        amount: "",
        closeDate: null,
        custom: {
          budget: undefined,
        },
      };

      const result = validateStageGuidanceKeyFields(opp, [
        "amount",
        "closeDate",
        "custom.budget",
      ]);
      expect(result.isClean).toBe(false);
      expect(result.missingFields).toContain("amount");
      expect(result.missingFields).toContain("closeDate");
      expect(result.missingFields).toContain("custom.budget");
    });
  });

  describe("REST API Endpoints & RLS Isolation", () => {
    it("should manage stage guidance configurations and enforce tenant isolation", async () => {
      // 1. Create a stage guidance as Tenant A
      const postRes = await app.request("/api/stage-guidance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenTenantA}`,
        },
        body: JSON.stringify({
          objectType: "opportunities",
          stage: "Qualification",
          keyFields: ["amount", "custom.budget"],
          guidanceText: "Ask the client about their budget allocation.",
          isActive: true,
        }),
      });

      expect(postRes.status).toBe(201);
      const postBody = await postRes.json();
      expect(postBody.success).toBe(true);
      expect(postBody.data.stage).toBe("Qualification");
      expect(postBody.data.keyFields).toContain("amount");

      const entryId = postBody.data.id;

      // 2. Tenant B reads -> should get empty list (RLS isolation)
      const getBRes = await app.request("/api/stage-guidance", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
        },
      });
      expect(getBRes.status).toBe(200);
      const getBBody = await getBRes.json();
      expect(getBBody.data.length).toBe(0);

      // 3. GET active rule by objectType and stage - Tenant A
      const getActiveRes = await app.request(
        "/api/stage-guidance/opportunities/Qualification",
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${tokenTenantA}`,
          },
        },
      );
      expect(getActiveRes.status).toBe(200);
      const getActiveBody = await getActiveRes.json();
      expect(getActiveBody.success).toBe(true);
      expect(getActiveBody.data.guidanceText).toBe(
        "Ask the client about their budget allocation.",
      );

      // 4. Update stage guidance as Tenant A
      const updateRes = await app.request("/api/stage-guidance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenTenantA}`,
        },
        body: JSON.stringify({
          id: entryId,
          objectType: "opportunities",
          stage: "Qualification",
          keyFields: ["amount"],
          guidanceText: "Ask the client about their main decision makers.",
          isActive: true,
        }),
      });

      expect(updateRes.status).toBe(200);
      const updateBody = await updateRes.json();
      expect(updateBody.success).toBe(true);
      expect(updateBody.data.keyFields).not.toContain("custom.budget");
      expect(updateBody.data.guidanceText).toBe(
        "Ask the client about their main decision makers.",
      );

      // 5. Verify audit logs are created correctly
      const logs = await withTenant(orgA, mockDb, async () => {
        return await dbStore.auditLogs.findMany();
      });
      const guidanceLogs = logs.filter(
        (l) => l.recordType === "stage_guidance",
      );
      expect(guidanceLogs.length).toBe(2);
      expect(guidanceLogs[0].action).toBe("create");
      expect(guidanceLogs[1].action).toBe("update");
    });

    it("should return null gracefully when no guidance configuration is active", async () => {
      const getRes = await app.request(
        "/api/stage-guidance/leads/NonExistent",
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${tokenTenantA}`,
          },
        },
      );
      expect(getRes.status).toBe(200);
      const body = await getRes.json();
      expect(body.success).toBe(true);
      expect(body.data).toBeNull();
    });
  });
});
