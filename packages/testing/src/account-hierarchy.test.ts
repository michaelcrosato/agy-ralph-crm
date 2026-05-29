import { createSessionToken } from "@crm/auth";
import { dbStore, mockDb, store, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../../../apps/api/src/index";

describe("Account Hierarchy & Consolidated Pipeline API & Integration Tests", () => {
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

  it("should support CRUD and hierarchy traversal under strict RLS context", async () => {
    let parentId = "";
    let childId = "";
    let grandchildId = "";

    // 1. Create a 3-tier hierarchy under Tenant A RLS context
    await withTenant(orgA, mockDb, async () => {
      const parent = await dbStore.accounts.insert({
        orgId: orgA,
        ownerId: "user-a",
        name: "Acme Corporate",
        domain: "acme.com",
        custom: null,
      });
      parentId = parent.id;

      const child = await dbStore.accounts.insert({
        orgId: orgA,
        ownerId: "user-a",
        name: "Acme North America",
        domain: "acme-na.com",
        custom: null,
        parentAccountId: parentId,
      });
      childId = child.id;

      const grandchild = await dbStore.accounts.insert({
        orgId: orgA,
        ownerId: "user-a",
        name: "Acme Canada",
        domain: "acme-ca.com",
        custom: null,
        parentAccountId: childId,
      });
      grandchildId = grandchild.id;
    });

    // 2. Fetch the hierarchy of the grandchild
    const resGrandchild = await app.request(
      `/api/accounts/${grandchildId}/hierarchy`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${tokenTenantA}` },
      },
    );
    expect(resGrandchild.status).toBe(200);
    const bodyGrandchild = await resGrandchild.json();
    expect(bodyGrandchild.success).toBe(true);

    // parentPath should go upwards: [child, parent]
    expect(bodyGrandchild.data.parentPath).toHaveLength(2);
    expect(bodyGrandchild.data.parentPath[0].id).toBe(childId);
    expect(bodyGrandchild.data.parentPath[1].id).toBe(parentId);
    expect(bodyGrandchild.data.children).toHaveLength(0);

    // 3. Fetch the hierarchy of the parent
    const resParent = await app.request(`/api/accounts/${parentId}/hierarchy`, {
      method: "GET",
      headers: { Authorization: `Bearer ${tokenTenantA}` },
    });
    expect(resParent.status).toBe(200);
    const bodyParent = await resParent.json();
    expect(bodyParent.success).toBe(true);
    expect(bodyParent.data.parentPath).toHaveLength(0);
    expect(bodyParent.data.children).toHaveLength(1);
    expect(bodyParent.data.children[0].id).toBe(childId);
  });

  it("should prevent circular dependencies during hierarchy updates", async () => {
    let parentId = "";
    let childId = "";
    let grandchildId = "";

    // Setup hierarchy under Tenant A
    await withTenant(orgA, mockDb, async () => {
      const parent = await dbStore.accounts.insert({
        orgId: orgA,
        ownerId: "user-a",
        name: "Enterprise Inc",
        domain: "enterprise.com",
        custom: null,
      });
      parentId = parent.id;

      const child = await dbStore.accounts.insert({
        orgId: orgA,
        ownerId: "user-a",
        name: "Enterprise APAC",
        domain: "enterprise-apac.com",
        custom: null,
        parentAccountId: parentId,
      });
      childId = child.id;

      const grandchild = await dbStore.accounts.insert({
        orgId: orgA,
        ownerId: "user-a",
        name: "Enterprise Tokyo",
        domain: "enterprise-tokyo.com",
        custom: null,
        parentAccountId: childId,
      });
      grandchildId = grandchild.id;
    });

    // 1. Attempt to set parent's parent to grandchild (circular!)
    const resCircular = await app.request(`/api/accounts/${parentId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        parentAccountId: grandchildId,
      }),
    });
    expect(resCircular.status).toBe(400);
    const bodyCircular = await resCircular.json();
    expect(bodyCircular.error).toContain("circular reference");

    // 2. Attempt to set an account as its own parent (circular!)
    const resSelf = await app.request(`/api/accounts/${childId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        parentAccountId: childId,
      }),
    });
    expect(resSelf.status).toBe(400);
  });

  it("should accurately rollup active and closed-won opportunity pipelines in a hierarchy branch", async () => {
    let parentId = "";
    let childId = "";
    let grandchildId = "";

    // 1. Create hierarchy and add Opportunities
    await withTenant(orgA, mockDb, async () => {
      const parent = await dbStore.accounts.insert({
        orgId: orgA,
        ownerId: "user-a",
        name: "Big Business",
        custom: null,
      });
      parentId = parent.id;

      const child = await dbStore.accounts.insert({
        orgId: orgA,
        ownerId: "user-a",
        name: "Big Business EU",
        parentAccountId: parentId,
        custom: null,
      });
      childId = child.id;

      const grandchild = await dbStore.accounts.insert({
        orgId: orgA,
        ownerId: "user-a",
        name: "Big Business Germany",
        parentAccountId: childId,
        custom: null,
      });
      grandchildId = grandchild.id;

      // Active Opportunities (Prospecting, Qualification, etc.)
      await dbStore.opportunities.insert({
        orgId: orgA,
        ownerId: "user-a",
        accountId: parentId,
        name: "Parent Opp - Active",
        stage: "Prospecting",
        amount: "15000.00",
        closeDate: null,
        custom: null,
      });

      // Closed Won Opportunity
      await dbStore.opportunities.insert({
        orgId: orgA,
        ownerId: "user-a",
        accountId: childId,
        name: "Child Opp - Closed Won",
        stage: "Closed Won",
        amount: "50000.00",
        closeDate: null,
        custom: null,
      });

      // Another Active Opportunity in grandchild
      await dbStore.opportunities.insert({
        orgId: orgA,
        ownerId: "user-a",
        accountId: grandchildId,
        name: "Grandchild Opp - Active",
        stage: "Qualification",
        amount: "12500.50",
        closeDate: null,
        custom: null,
      });

      // Closed Lost Opportunity (should be ignored in pipeline rollups)
      await dbStore.opportunities.insert({
        orgId: orgA,
        ownerId: "user-a",
        accountId: grandchildId,
        name: "Grandchild Opp - Closed Lost",
        stage: "Closed Lost",
        amount: "90000.00",
        closeDate: null,
        custom: null,
      });
    });

    // 2. Fetch rollup from parent level
    const resRollup = await app.request(
      `/api/accounts/${parentId}/consolidated-pipeline`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${tokenTenantA}` },
      },
    );
    expect(resRollup.status).toBe(200);
    const bodyRollup = await resRollup.json();
    expect(bodyRollup.success).toBe(true);

    // Active pipeline: Parent Opp (15000.00) + Grandchild Opp (12500.50) = 27500.50
    expect(bodyRollup.data.activePipeline).toBe("27500.50");
    // Closed Won pipeline: Child Opp (50000.00)
    expect(bodyRollup.data.closedWonPipeline).toBe("50000.00");
  });

  it("should enforce multi-tenant RLS isolation on hierarchies and rollups", async () => {
    let accountIdA = "";
    let accountIdB = "";

    // 1. Create account for Tenant A
    await withTenant(orgA, mockDb, async () => {
      const accountA = await dbStore.accounts.insert({
        orgId: orgA,
        ownerId: "user-a",
        name: "Tenant A Account",
        custom: null,
      });
      accountIdA = accountA.id;
    });

    // 2. Create account for Tenant B
    await withTenant(orgB, mockDb, async () => {
      const accountB = await dbStore.accounts.insert({
        orgId: orgB,
        ownerId: "user-b",
        name: "Tenant B Account",
        custom: null,
      });
      accountIdB = accountB.id;
    });

    // 3. Tenant B attempts to set Tenant A's account as its parent -> should return 400 (parent not found in Tenant B context)
    const resPatchLeak = await app.request(`/api/accounts/${accountIdB}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${tokenTenantB}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        parentAccountId: accountIdA,
      }),
    });
    expect(resPatchLeak.status).toBe(400);

    // 4. Tenant B attempts to fetch Tenant A's hierarchy -> should return 404
    const resGetLeak = await app.request(
      `/api/accounts/${accountIdA}/hierarchy`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${tokenTenantB}` },
      },
    );
    expect(resGetLeak.status).toBe(404);

    // 5. Tenant B attempts to run pipeline rollup on Tenant A's account -> should return 404
    const resPipelineLeak = await app.request(
      `/api/accounts/${accountIdA}/consolidated-pipeline`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${tokenTenantB}` },
      },
    );
    expect(resPipelineLeak.status).toBe(404);
  });
});
