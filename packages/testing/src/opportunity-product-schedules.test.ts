import { createSessionToken } from "@crm/auth";
import { dbStore, mockDb, store, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../../../apps/api/src/index";

describe("Opportunity Product Schedules API & RLS Integration Tests", () => {
  let tokenTenantA: string;
  let tokenTenantB: string;

  const orgA = "org-tenant-a";
  const orgB = "org-tenant-b";

  let opportunityAId: string;
  let opportunityBId: string;
  let lineItemAId: string;
  let lineItemBId: string;

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

    // Seed Data for Tenant A
    await withTenant(orgA, mockDb, async () => {
      const acc = await dbStore.accounts.insert({
        orgId: orgA,
        ownerId: "user-a",
        name: "Acme Corp A",
        domain: "acme.com",
        custom: null,
      });

      const opp = await dbStore.opportunities.insert({
        orgId: orgA,
        ownerId: "user-a",
        accountId: acc.id,
        name: "Enterprise Software Deal A",
        stage: "Prospecting",
        amount: "12000.00",
        closeDate: new Date(),
        custom: null,
      });
      opportunityAId = opp.id;

      const prod = await dbStore.products.insert({
        orgId: orgA,
        name: "CRM Software Subscription",
        sku: "CRM-SUB-100",
        isActive: 1,
      });

      const pb = await dbStore.pricebooks.insert({
        orgId: orgA,
        name: "Standard Price Book",
        isStandard: 1,
        isActive: 1,
      });

      const pbe = await dbStore.pricebookEntries.insert({
        orgId: orgA,
        pricebookId: pb.id,
        productId: prod.id,
        unitPrice: "1000.00",
        isActive: 1,
      });

      const oppProd = await dbStore.opportunityProducts.insert({
        orgId: orgA,
        opportunityId: opp.id,
        pricebookEntryId: pbe.id,
        quantity: 12,
        unitPrice: "1000.00",
        totalPrice: "12000.00",
      });
      lineItemAId = oppProd.id;
    });

    // Seed Data for Tenant B
    await withTenant(orgB, mockDb, async () => {
      const acc = await dbStore.accounts.insert({
        orgId: orgB,
        ownerId: "user-b",
        name: "BuyMore B",
        domain: "buymore.com",
        custom: null,
      });

      const opp = await dbStore.opportunities.insert({
        orgId: orgB,
        ownerId: "user-b",
        accountId: acc.id,
        name: "SaaS Expansion Deal B",
        stage: "Prospecting",
        amount: "5000.00",
        closeDate: new Date(),
        custom: null,
      });
      opportunityBId = opp.id;

      const prod = await dbStore.products.insert({
        orgId: orgB,
        name: "Cloud Storage Add-on",
        sku: "CS-ADD-50",
        isActive: 1,
      });

      const pb = await dbStore.pricebooks.insert({
        orgId: orgB,
        name: "Standard Price Book",
        isStandard: 1,
        isActive: 1,
      });

      const pbe = await dbStore.pricebookEntries.insert({
        orgId: orgB,
        pricebookId: pb.id,
        productId: prod.id,
        unitPrice: "50.00",
        isActive: 1,
      });

      const oppProd = await dbStore.opportunityProducts.insert({
        orgId: orgB,
        opportunityId: opp.id,
        pricebookEntryId: pbe.id,
        quantity: 100,
        unitPrice: "50.00",
        totalPrice: "5000.00",
      });
      lineItemBId = oppProd.id;
    });
  });

  it("should successfully add, fetch, and delete individual product schedules under Tenant A", async () => {
    const testDate = new Date("2026-06-01T00:00:00Z");

    // 1. Create a schedule
    const addRes = await app.request(
      `/api/opportunities/${opportunityAId}/products/${lineItemAId}/schedules`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          scheduleType: "revenue",
          scheduleDate: testDate.toISOString(),
          amount: "1000.00",
          description: "June 2026 Payment",
        }),
      },
    );
    expect(addRes.status).toBe(201);
    const addBody = await addRes.json();
    expect(addBody.success).toBe(true);
    expect(addBody.data.amount).toBe("1000.00");
    expect(addBody.data.scheduleType).toBe("revenue");
    expect(addBody.data.description).toBe("June 2026 Payment");

    const scheduleId = addBody.data.id;

    // 2. Fetch schedules
    const getRes = await app.request(
      `/api/opportunities/${opportunityAId}/products/${lineItemAId}/schedules`,
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
    expect(getBody.data[0].id).toBe(scheduleId);

    // 3. Verify audit log creation
    await withTenant(orgA, mockDb, async () => {
      const logs = await dbStore.auditLogs.findMany();
      const schedLogs = logs.filter(
        (l) =>
          l.recordId === scheduleId &&
          l.recordType === "opportunity_product_schedules",
      );
      expect(schedLogs.length).toBe(1);
      expect(schedLogs[0].action).toBe("create");
    });

    // 4. Delete the schedule
    const delRes = await app.request(
      `/api/opportunities/${opportunityAId}/products/${lineItemAId}/schedules/${scheduleId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      },
    );
    expect(delRes.status).toBe(200);

    // 5. Fetch schedules again to verify empty
    const getRes2 = await app.request(
      `/api/opportunities/${opportunityAId}/products/${lineItemAId}/schedules`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      },
    );
    const getBody2 = await getRes2.json();
    expect(getBody2.data.length).toBe(0);
  });

  it("should support automatic straight-line revenue schedule generation", async () => {
    const startDate = new Date("2026-06-01T00:00:00Z");

    const genRes = await app.request(
      `/api/opportunities/${opportunityAId}/products/${lineItemAId}/schedules/generate`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          periodsCount: 12,
          startDate: startDate.toISOString(),
          scheduleType: "revenue",
        }),
      },
    );

    expect(genRes.status).toBe(201);
    const genBody = await genRes.json();
    expect(genBody.success).toBe(true);
    expect(genBody.count).toBe(12);
    expect(genBody.data.length).toBe(12);

    // Verify straight-line mathematical correctness
    // Total price is $12,000.00. Over 12 periods, it should be $1,000.00 each.
    for (let i = 0; i < 12; i++) {
      expect(genBody.data[i].amount).toBe("1000.00");
      expect(genBody.data[i].scheduleType).toBe("revenue");
      const expectedDate = new Date(startDate.getTime());
      expectedDate.setMonth(expectedDate.getMonth() + i);
      expect(new Date(genBody.data[i].scheduleDate).getMonth()).toBe(
        expectedDate.getMonth(),
      );
    }

    // Verify audit logs captured the generation action
    await withTenant(orgA, mockDb, async () => {
      const logs = await dbStore.auditLogs.findMany();
      const rollupLog = logs.find(
        (l) => l.recordId === lineItemAId && l.action === "schedules_generated",
      );
      expect(rollupLog).toBeDefined();
    });
  });

  it("should support straight-line quantity schedule generation with remainder allocation", async () => {
    // lineItemAId quantity is 12. We generate over 5 periods to check remainder distribution.
    // 12 / 5 = quotient 2, remainder 2.
    // First 2 periods get 3, next 3 periods get 2.
    const startDate = new Date("2026-06-01T00:00:00Z");

    const genRes = await app.request(
      `/api/opportunities/${opportunityAId}/products/${lineItemAId}/schedules/generate`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          periodsCount: 5,
          startDate: startDate.toISOString(),
          scheduleType: "quantity",
        }),
      },
    );

    expect(genRes.status).toBe(201);
    const genBody = await genRes.json();
    expect(genBody.success).toBe(true);
    expect(genBody.count).toBe(5);

    expect(genBody.data[0].amount).toBe("3");
    expect(genBody.data[1].amount).toBe("3");
    expect(genBody.data[2].amount).toBe("2");
    expect(genBody.data[3].amount).toBe("2");
    expect(genBody.data[4].amount).toBe("2");
  });

  it("should enforce RLS boundaries and block cross-tenant schedule actions", async () => {
    // Tenant B attempts to fetch Tenant A's schedules
    const getRes = await app.request(
      `/api/opportunities/${opportunityAId}/products/${lineItemAId}/schedules`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
        },
      },
    );
    expect(getRes.status).toBe(404); // Not found due to RLS

    // Tenant B attempts to create a schedule on Tenant A's line item
    const addRes = await app.request(
      `/api/opportunities/${opportunityAId}/products/${lineItemAId}/schedules`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          scheduleType: "revenue",
          scheduleDate: new Date().toISOString(),
          amount: "500.00",
        }),
      },
    );
    expect(addRes.status).toBe(404); // Not found due to RLS

    // Tenant B attempts to generate schedules for Tenant A
    const genRes = await app.request(
      `/api/opportunities/${opportunityAId}/products/${lineItemAId}/schedules/generate`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          periodsCount: 3,
        }),
      },
    );
    expect(genRes.status).toBe(404);
  });

  it("should validate input constraints and reject malformed parameters", async () => {
    // 1. Rejected unsupported schedule type
    const addRes = await app.request(
      `/api/opportunities/${opportunityAId}/products/${lineItemAId}/schedules`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          scheduleType: "unsupported-type",
          scheduleDate: new Date().toISOString(),
          amount: "100.00",
        }),
      },
    );
    expect(addRes.status).toBe(400);

    // 2. Rejected invalid numeric amount
    const addRes2 = await app.request(
      `/api/opportunities/${opportunityAId}/products/${lineItemAId}/schedules`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          scheduleType: "revenue",
          scheduleDate: new Date().toISOString(),
          amount: "invalid-number",
        }),
      },
    );
    expect(addRes2.status).toBe(400);

    // 3. Rejected invalid date
    const addRes3 = await app.request(
      `/api/opportunities/${opportunityAId}/products/${lineItemAId}/schedules`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          scheduleType: "revenue",
          scheduleDate: "invalid-date-string",
          amount: "100.00",
        }),
      },
    );
    expect(addRes3.status).toBe(400);
  });
});
