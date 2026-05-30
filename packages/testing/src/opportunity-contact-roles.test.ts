import { createSessionToken } from "@crm/auth";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../../../apps/api/src/index";

describe("Opportunity Contact Roles API Tests", () => {
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

  it("should support CRUD for opportunity contact roles and manage the primary flag", async () => {
    let oppId = "";
    let contactId1 = "";
    let contactId2 = "";

    // Set up database records for Tenant A
    await withTenant(orgA, mockDb, async () => {
      await dbStore.webhooks.insert({
        orgId: orgA,
        targetUrl: "https://receiver-a.com/webhook",
        secret: "my-signing-secret",
        status: "active",
      });

      const opportunity = await dbStore.opportunities.insert({
        orgId: orgA,
        ownerId: "user-a",
        name: "Enterprise Software Opportunity",
        stage: "Prospecting",
        amount: "50000.00",
        closeDate: null,
        custom: null,
      });
      oppId = opportunity.id;

      const contact1 = await dbStore.contacts.insert({
        orgId: orgA,
        ownerId: "user-a",
        accountId: null,
        firstName: "Alice",
        lastName: "Smith",
        email: "alice@acme.com",
        custom: null,
      });
      contactId1 = contact1.id;

      const contact2 = await dbStore.contacts.insert({
        orgId: orgA,
        ownerId: "user-a",
        accountId: null,
        firstName: "Bob",
        lastName: "Jones",
        email: "bob@acme.com",
        custom: null,
      });
      contactId2 = contact2.id;
    });

    // 1. GET: Query roles (should be empty initially)
    const resGetEmpty = await app.request(
      `/api/opportunities/${oppId}/contact-roles`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${tokenTenantA}` },
      },
    );
    expect(resGetEmpty.status).toBe(200);
    const bodyGetEmpty = await resGetEmpty.json();
    expect(bodyGetEmpty.success).toBe(true);
    expect(bodyGetEmpty.data).toHaveLength(0);

    // 2. POST: Assign Contact 1 as Decision Maker (Primary = true)
    const resPost1 = await app.request(
      `/api/opportunities/${oppId}/contact-roles`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contactId: contactId1,
          role: "Decision Maker",
          isPrimary: true,
        }),
      },
    );
    expect(resPost1.status).toBe(200);
    const bodyPost1 = await resPost1.json();
    expect(bodyPost1.success).toBe(true);
    expect(bodyPost1.data.contactId).toBe(contactId1);
    expect(bodyPost1.data.role).toBe("Decision Maker");
    expect(bodyPost1.data.isPrimary).toBe(true);
    const roleId1 = bodyPost1.data.id;

    // 3. POST: Assign Contact 2 as Influencer (Primary = false)
    const resPost2 = await app.request(
      `/api/opportunities/${oppId}/contact-roles`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contactId: contactId2,
          role: "Influencer",
          isPrimary: false,
        }),
      },
    );
    expect(resPost2.status).toBe(200);
    const bodyPost2 = await resPost2.json();
    expect(bodyPost2.success).toBe(true);
    expect(bodyPost2.data.contactId).toBe(contactId2);
    expect(bodyPost2.data.isPrimary).toBe(false);
    const roleId2 = bodyPost2.data.id;

    // 4. GET: Query roles (should have both)
    const resGetList = await app.request(
      `/api/opportunities/${oppId}/contact-roles`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${tokenTenantA}` },
      },
    );
    expect(resGetList.status).toBe(200);
    const bodyGetList = await resGetList.json();
    expect(bodyGetList.data).toHaveLength(2);

    // Verify webhook deliveries have captured events
    await new Promise((resolve) => setTimeout(resolve, 50));

    await withTenant(orgA, mockDb, async () => {
      const deliveries = await dbStore.webhookDeliveries.findMany();
      expect(
        deliveries.some((e) => e.event === "opportunity.contact_role.created"),
      ).toBe(true);
      const audit = await dbStore.auditLogs.findMany();
      expect(audit.some((a) => a.action === "add_contact_role")).toBe(true);
    });

    // 5. POST: Try to assign duplicate contact to same opportunity -> should fail
    const resPostDup = await app.request(
      `/api/opportunities/${oppId}/contact-roles`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contactId: contactId1,
          role: "Technical Buyer",
        }),
      },
    );
    expect(resPostDup.status).toBe(400);

    // 6. PUT: Update Contact 2 to be primary -> Contact 1 should be demoted
    const resPut = await app.request(
      `/api/opportunities/${oppId}/contact-roles/${roleId2}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          isPrimary: true,
          role: "Primary Decision Maker",
        }),
      },
    );
    expect(resPut.status).toBe(200);

    // Check demotion
    const c1 = await withTenant(orgA, mockDb, async () =>
      dbStore.opportunityContactRoles.findOne(roleId1),
    );
    const c2 = await withTenant(orgA, mockDb, async () =>
      dbStore.opportunityContactRoles.findOne(roleId2),
    );
    expect(c1?.isPrimary).toBe(false);
    expect(c2?.isPrimary).toBe(true);
    expect(c2?.role).toBe("Primary Decision Maker");

    // 7. DELETE: Remove role 1
    const resDel = await app.request(
      `/api/opportunities/${oppId}/contact-roles/${roleId1}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${tokenTenantA}` },
      },
    );
    expect(resDel.status).toBe(200);

    const afterDel = await withTenant(orgA, mockDb, async () =>
      dbStore.opportunityContactRoles.findForOpportunity(oppId),
    );
    expect(afterDel).toHaveLength(1);
    expect(afterDel[0].contactId).toBe(contactId2);
  });

  it("should enforce Row-Level Security (RLS) and prevent cross-tenant operations", async () => {
    let oppAId = "";
    let contactAId = "";
    let roleAId = "";

    let _oppBId = "";
    let contactBId = "";

    await withTenant(orgA, mockDb, async () => {
      const opportunity = await dbStore.opportunities.insert({
        orgId: orgA,
        ownerId: "user-a",
        name: "Tenant A Opp",
        stage: "Qualification",
        amount: "100.00",
        closeDate: null,
        custom: null,
      });
      oppAId = opportunity.id;

      const contact = await dbStore.contacts.insert({
        orgId: orgA,
        ownerId: "user-a",
        accountId: null,
        firstName: "Alice",
        lastName: "TenantA",
        email: "alice@tenant-a.com",
        custom: null,
      });
      contactAId = contact.id;

      const role = await dbStore.opportunityContactRoles.insert({
        orgId: orgA,
        opportunityId: oppAId,
        contactId: contactAId,
        role: "Evaluator",
        isPrimary: true,
      });
      roleAId = role.id;
    });

    await withTenant(orgB, mockDb, async () => {
      const opportunity = await dbStore.opportunities.insert({
        orgId: orgB,
        ownerId: "user-b",
        name: "Tenant B Opp",
        stage: "Qualification",
        amount: "200.00",
        closeDate: null,
        custom: null,
      });
      _oppBId = opportunity.id;

      const contact = await dbStore.contacts.insert({
        orgId: orgB,
        ownerId: "user-b",
        accountId: null,
        firstName: "Bob",
        lastName: "TenantB",
        email: "bob@tenant-b.com",
        custom: null,
      });
      contactBId = contact.id;
    });

    // 1. Tenant B tries to query Tenant A's contact roles -> should return 404 (or throws error)
    const resGet = await app.request(
      `/api/opportunities/${oppAId}/contact-roles`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${tokenTenantB}` },
      },
    );
    expect(resGet.status).toBe(404);

    // 2. Tenant B tries to post role to Tenant A's opportunity -> should return 404
    const resPost = await app.request(
      `/api/opportunities/${oppAId}/contact-roles`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contactId: contactBId,
          role: "Influencer",
        }),
      },
    );
    expect(resPost.status).toBe(404);

    // 3. Tenant B tries to update Tenant A's contact role -> should return 404
    const resPut = await app.request(
      `/api/opportunities/${oppAId}/contact-roles/${roleAId}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          role: "Hacker",
        }),
      },
    );
    expect(resPut.status).toBe(404);

    // 4. Tenant B tries to delete Tenant A's contact role -> should return 404
    const resDel = await app.request(
      `/api/opportunities/${oppAId}/contact-roles/${roleAId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${tokenTenantB}` },
      },
    );
    expect(resDel.status).toBe(404);
  });

  it("should validate referential integrity when inserting contact roles", async () => {
    let oppId = "";

    await withTenant(orgA, mockDb, async () => {
      const opportunity = await dbStore.opportunities.insert({
        orgId: orgA,
        ownerId: "user-a",
        name: "Enterprise Software Opportunity",
        stage: "Prospecting",
        amount: "50000.00",
        closeDate: null,
        custom: null,
      });
      oppId = opportunity.id;
    });

    // Try to post with a non-existent contact ID -> should return 404
    const resPost = await app.request(
      `/api/opportunities/${oppId}/contact-roles`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contactId: "non-existent-contact-id",
          role: "Influencer",
        }),
      },
    );
    expect(resPost.status).toBe(404);
  });
});
