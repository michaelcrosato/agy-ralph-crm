import { createSessionToken } from "@crm/auth";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../../../apps/api/src/index";

describe("Opportunity Products, Products & Pricebooks REST API Tests", () => {
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

  it("should successfully manage product catalogs, pricebooks, entries, and roll up opportunity amounts isolated by RLS", async () => {
    // 1. Create a Product for Tenant A
    const prodRes = await app.request("/api/products", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Enterprise License",
        sku: "LIC-ENT-001",
        description: "Yearly SaaS Enterprise subscription license",
        isActive: true,
      }),
    });

    expect(prodRes.status).toBe(200);
    const prodBody = await prodRes.json();
    expect(prodBody.success).toBe(true);
    const productId = prodBody.data.id;
    expect(productId).toBeDefined();

    // 2. Tenant B lists products -> returns empty list
    const prodListB = await app.request("/api/products", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantB}`,
      },
    });
    expect(prodListB.status).toBe(200);
    const prodListBBody = await prodListB.json();
    expect(prodListBBody.data.length).toBe(0);

    // 3. Create a Pricebook for Tenant A
    const pbRes = await app.request("/api/pricebooks", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Q2 Enterprise Pricebook",
        description: "Special pricing for Q2 strategic accounts",
        isActive: true,
      }),
    });
    expect(pbRes.status).toBe(200);
    const pbBody = await pbRes.json();
    expect(pbBody.success).toBe(true);
    const pricebookId = pbBody.data.id;

    // 4. Create a Pricebook Entry linking Product to Pricebook
    const pbeRes = await app.request("/api/pricebooks/entries", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        pricebookId,
        productId,
        unitPrice: 1200,
      }),
    });
    expect(pbeRes.status).toBe(200);
    const pbeBody = await pbeRes.json();
    expect(pbeBody.success).toBe(true);
    const entryId = pbeBody.data.id;

    // 5. Setup standard Account & Opportunity for Tenant A
    let accountIdA = "";
    let oppIdA = "";
    await withTenant(orgA, mockDb, async () => {
      const acc = await dbStore.accounts.insert({
        orgId: orgA,
        ownerId: "user-a",
        name: "Hooli Inc",
        domain: "hooli.xyz",
        custom: null,
      });
      accountIdA = acc.id;

      const opp = await dbStore.opportunities.insert({
        orgId: orgA,
        ownerId: "user-a",
        accountId: accountIdA,
        name: "Hooli Enterprise Deal",
        stage: "Prospecting",
        amount: "0",
        closeDate: null,
        custom: null,
      });
      oppIdA = opp.id;
    });

    // 6. Add Opportunity Product line item (10 units of Enterprise License)
    const addLineRes1 = await app.request(
      `/api/opportunities/${oppIdA}/products`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pricebookEntryId: entryId,
          quantity: 10,
        }),
      },
    );
    expect(addLineRes1.status).toBe(200);
    const addLineBody1 = await addLineRes1.json();
    expect(addLineBody1.success).toBe(true);
    expect(addLineBody1.data.totalPrice).toBe("12000"); // 10 * 1200
    expect(addLineBody1.opportunityAmount).toBe("12000");

    const lineItemId = addLineBody1.data.id;

    // Verify parent opportunity amount updated in store
    await withTenant(orgA, mockDb, async () => {
      const opp = await dbStore.opportunities.findOne(oppIdA);
      expect(opp?.amount).toBe("12000");
    });

    // 7. Add a second Opportunity Product line item with customized unitPrice (5 units at $1000 each)
    const addLineRes2 = await app.request(
      `/api/opportunities/${oppIdA}/products`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pricebookEntryId: entryId,
          quantity: 5,
          unitPrice: 1000,
        }),
      },
    );
    expect(addLineRes2.status).toBe(200);
    const addLineBody2 = await addLineRes2.json();
    expect(addLineBody2.success).toBe(true);
    expect(addLineBody2.data.totalPrice).toBe("5000"); // 5 * 1000
    expect(addLineBody2.opportunityAmount).toBe("17000"); // 12000 + 5000

    const lineItemId2 = addLineBody2.data.id;

    // Verify amount update rolled up to database
    await withTenant(orgA, mockDb, async () => {
      const opp = await dbStore.opportunities.findOne(oppIdA);
      expect(opp?.amount).toBe("17000");
    });

    // 8. Tenant B attempts to retrieve Tenant A's opportunity products -> gets 404
    const getLinesB = await app.request(
      `/api/opportunities/${oppIdA}/products`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
        },
      },
    );
    expect(getLinesB.status).toBe(404);

    // 9. PATCH opportunity product (change quantity of line item 1 from 10 to 12)
    const patchRes = await app.request(
      `/api/opportunities/${oppIdA}/products/${lineItemId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          quantity: 12,
        }),
      },
    );
    expect(patchRes.status).toBe(200);
    const patchBody = await patchRes.json();
    expect(patchBody.success).toBe(true);
    expect(patchBody.data.totalPrice).toBe("14400"); // 12 * 1200
    expect(patchBody.opportunityAmount).toBe("19400"); // 14400 + 5000

    // 10. DELETE second line item
    const deleteRes = await app.request(
      `/api/opportunities/${oppIdA}/products/${lineItemId2}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      },
    );
    expect(deleteRes.status).toBe(200);
    const deleteBody = await deleteRes.json();
    expect(deleteBody.success).toBe(true);
    expect(deleteBody.opportunityAmount).toBe("14400"); // 19400 - 5000

    // 11. DELETE first line item -> amount rolls up to "0"
    const deleteRes2 = await app.request(
      `/api/opportunities/${oppIdA}/products/${lineItemId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      },
    );
    expect(deleteRes2.status).toBe(200);
    const deleteBody2 = await deleteRes2.json();
    expect(deleteBody2.success).toBe(true);
    expect(deleteBody2.opportunityAmount).toBe("0");
  });
});
