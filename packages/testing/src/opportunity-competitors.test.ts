import { createSessionToken } from "@crm/auth";
import { calculateOpportunityCompetitorStats } from "@crm/core";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../../../apps/api/src/index";

describe("Opportunity Competitors API & Logic Tests", () => {
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
    it("should accurately calculate opportunity competitor statistics", () => {
      const competitors = [
        { name: "Competitor A", winLossStatus: "Won" },
        { name: "Competitor B", winLossStatus: "Lost" },
        { name: "Competitor C", winLossStatus: "Pending" },
        { name: "Competitor D", winLossStatus: "Lost" },
      ];

      const stats = calculateOpportunityCompetitorStats(competitors);

      expect(stats.competitorCount).toBe(4);
      expect(stats.wonCount).toBe(1);
      expect(stats.lostCount).toBe(2);
      expect(stats.pendingCount).toBe(1);
      expect(stats.competitorList).toEqual([
        "Competitor A",
        "Competitor B",
        "Competitor C",
        "Competitor D",
      ]);
    });
  });

  describe("REST API Endpoints", () => {
    it("should successfully perform CRUD operations on competitors with RLS isolation", async () => {
      // 1. Setup mock opportunity for Tenant A
      let oppAId = "";
      await withTenant(orgA, mockDb, async () => {
        const opp = await dbStore.opportunities.insert({
          orgId: orgA,
          ownerId: "user-a",
          accountId: "account-a",
          name: "Tenant A Deal",
          stage: "Qualification",
          amount: "10000.00",
          closeDate: new Date(),
          custom: null,
        });
        oppAId = opp.id;
      });

      // 2. Setup mock opportunity for Tenant B
      let _oppBId = "";
      await withTenant(orgB, mockDb, async () => {
        const opp = await dbStore.opportunities.insert({
          orgId: orgB,
          ownerId: "user-b",
          accountId: "account-b",
          name: "Tenant B Deal",
          stage: "Qualification",
          amount: "5000.00",
          closeDate: new Date(),
          custom: null,
        });
        _oppBId = opp.id;
      });

      // 3. POST - Add a competitor as Tenant A
      const postRes = await app.request(
        `/api/opportunities/${oppAId}/competitors`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${tokenTenantA}`,
          },
          body: JSON.stringify({
            name: "Competitor X",
            strength: "High scale features",
            weakness: "Expensive subscription models",
            winLossStatus: "Pending",
            notes: "Spoke with client about X's trial",
          }),
        },
      );

      expect(postRes.status).toBe(201);
      const postBody = await postRes.json();
      expect(postBody.success).toBe(true);
      expect(postBody.data.id).toBeDefined();
      expect(postBody.data.name).toBe("Competitor X");

      const compId = postBody.data.id;

      // 4. RLS - Tenant B attempts to read Tenant A's opportunity competitors -> must fail
      const rlsGetRes = await app.request(
        `/api/opportunities/${oppAId}/competitors`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${tokenTenantB}`,
          },
        },
      );
      // Should throw/fail or return 404 because the findOne call for opportunity fails/violates RLS
      expect(rlsGetRes.status).toBe(404);

      // 5. GET - Retrieve opportunity competitors as Tenant A
      const getRes = await app.request(
        `/api/opportunities/${oppAId}/competitors`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${tokenTenantA}`,
          },
        },
      );

      expect(getRes.status).toBe(200);
      const getBody = await getRes.json();
      expect(getBody.success).toBe(true);
      expect(getBody.data.length).toBe(1);
      expect(getBody.data[0].name).toBe("Competitor X");

      // 6. PUT - Update competitor details as Tenant A
      const putRes = await app.request(
        `/api/opportunities/${oppAId}/competitors/${compId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${tokenTenantA}`,
          },
          body: JSON.stringify({
            winLossStatus: "Lost",
            notes: "Client decided to go with master pricing",
          }),
        },
      );

      expect(putRes.status).toBe(200);
      const putBody = await putRes.json();
      expect(putBody.success).toBe(true);
      expect(putBody.data.winLossStatus).toBe("Lost");
      expect(putBody.data.notes).toBe(
        "Client decided to go with master pricing",
      );

      // 7. RLS - Tenant B attempts to delete Tenant A's competitor -> must fail
      const rlsDelRes = await app.request(
        `/api/opportunities/${oppAId}/competitors/${compId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${tokenTenantB}`,
          },
        },
      );
      expect(rlsDelRes.status).toBe(404);

      // 8. DELETE - Delete competitor as Tenant A
      const delRes = await app.request(
        `/api/opportunities/${oppAId}/competitors/${compId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${tokenTenantA}`,
          },
        },
      );

      expect(delRes.status).toBe(200);
      const delBody = await delRes.json();
      expect(delBody.success).toBe(true);

      // 9. Verify deletion
      const getFinalRes = await app.request(
        `/api/opportunities/${oppAId}/competitors`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${tokenTenantA}`,
          },
        },
      );
      const getFinalBody = await getFinalRes.json();
      expect(getFinalBody.data.length).toBe(0);
    });
  });
});
