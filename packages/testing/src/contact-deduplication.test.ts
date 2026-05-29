import { createSessionToken } from "@crm/auth";
import { dbStore, mockDb, store, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../../../apps/api/src/index";

describe("Contact De-duplication and Merging API Tests", () => {
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

  it("should identify duplicate contacts based on email or name matching rules, respecting RLS", async () => {
    let sourceContactId = "";
    let duplicateEmailContactId = "";
    let duplicateNameContactId = "";
    let nonDuplicateContactId = "";
    let crossTenantContactId = "";

    // Setup contacts for Tenant A
    await withTenant(orgA, mockDb, async () => {
      // 1. Source Contact
      const source = await dbStore.contacts.insert({
        orgId: orgA,
        ownerId: "user-a",
        accountId: "account-a",
        firstName: "Alice",
        lastName: "Smith",
        email: "alice.smith@example.com",
        custom: null,
      });
      sourceContactId = source.id;

      // 2. Duplicate with exact email match (different name)
      const dup1 = await dbStore.contacts.insert({
        orgId: orgA,
        ownerId: "user-a",
        accountId: "account-a",
        firstName: "Ally",
        lastName: "Smith",
        email: "alice.smith@example.com",
        custom: null,
      });
      duplicateEmailContactId = dup1.id;

      // 3. Duplicate with exact firstName & lastName match (different email)
      const dup2 = await dbStore.contacts.insert({
        orgId: orgA,
        ownerId: "user-a",
        accountId: "account-a",
        firstName: "Alice",
        lastName: "Smith",
        email: "alice@company.com",
        custom: null,
      });
      duplicateNameContactId = dup2.id;

      // 4. Non-duplicate contact
      const nonDup = await dbStore.contacts.insert({
        orgId: orgA,
        ownerId: "user-a",
        accountId: "account-a",
        firstName: "Bob",
        lastName: "Jones",
        email: "bob.jones@example.com",
        custom: null,
      });
      nonDuplicateContactId = nonDup.id;
    });

    // Setup contact for Tenant B (identical email & name to Tenant A source) -> RLS must isolate
    await withTenant(orgB, mockDb, async () => {
      const cross = await dbStore.contacts.insert({
        orgId: orgB,
        ownerId: "user-b",
        accountId: "account-b",
        firstName: "Alice",
        lastName: "Smith",
        email: "alice.smith@example.com",
        custom: null,
      });
      crossTenantContactId = cross.id;
    });

    // Call GET /api/contacts/:id/duplicates for Tenant A
    const resA = await app.request(
      `/api/contacts/${sourceContactId}/duplicates`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      },
    );

    expect(resA.status).toBe(200);
    const bodyA = await resA.json();
    expect(bodyA.success).toBe(true);

    const dupIds = bodyA.data.map((c: { id: string }) => c.id);
    expect(dupIds.length).toBe(2);
    expect(dupIds).toContain(duplicateEmailContactId);
    expect(dupIds).toContain(duplicateNameContactId);
    expect(dupIds).not.toContain(nonDuplicateContactId);
    expect(dupIds).not.toContain(crossTenantContactId);

    // Call GET /api/contacts/:id/duplicates for Tenant B (should find 0 duplicates)
    const resB = await app.request(
      `/api/contacts/${crossTenantContactId}/duplicates`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
        },
      },
    );

    expect(resB.status).toBe(200);
    const bodyB = await resB.json();
    expect(bodyB.success).toBe(true);
    expect(bodyB.data.length).toBe(0);

    // Tenant B trying to query duplicates of Tenant A's contact -> should fail with 404
    const resCross = await app.request(
      `/api/contacts/${sourceContactId}/duplicates`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
        },
      },
    );
    expect(resCross.status).toBe(404);
  });

  it("should merge a duplicate contact into a master contact, consolidating field resolutions, custom fields, and child entities", async () => {
    let masterId = "";
    let duplicateId = "";
    let ticketId = "";
    let campaignMemberId = "";
    let roleId = "";
    let activityId = "";
    let childContactId = "";

    await withTenant(orgA, mockDb, async () => {
      // 1. Master Contact
      const master = await dbStore.contacts.insert({
        orgId: orgA,
        ownerId: "user-a",
        accountId: "account-a",
        firstName: "Alice",
        lastName: "Smith",
        email: "alice@master.com",
        custom: {
          title: "VP Sales",
          phone: "123-456-7890",
          tier: "A",
        },
      });
      masterId = master.id;

      // 2. Duplicate Contact
      const duplicate = await dbStore.contacts.insert({
        orgId: orgA,
        ownerId: "user-a",
        accountId: "account-dup",
        firstName: "Ally",
        lastName: "Smith",
        email: "alice@dup.com",
        custom: {
          title: "VP of Sales & Marketing",
          mobile: "987-654-3210",
        },
      });
      duplicateId = duplicate.id;

      // 3. Ticket
      const ticket = await dbStore.tickets.insert({
        orgId: orgA,
        contactId: duplicateId,
        subject: "Billing issue",
        status: "Open",
        createdAt: new Date(),
      });
      ticketId = ticket.id;

      // 4. Campaign Member
      const member = await dbStore.campaignMembers.insert({
        orgId: orgA,
        campaignId: "campaign-1",
        leadId: null,
        contactId: duplicateId,
        status: "Sent",
        createdAt: new Date(),
      });
      campaignMemberId = member.id;

      // 5. Opportunity Contact Role
      const role = await dbStore.opportunityContactRoles.insert({
        orgId: orgA,
        opportunityId: "opp-1",
        contactId: duplicateId,
        role: "Decision Maker",
        isPrimary: true,
        createdAt: new Date(),
      });
      roleId = role.id;

      // 6. Activity Link
      const activity = await dbStore.activities.insert({
        orgId: orgA,
        creatorId: "user-a",
        type: "note",
        subject: "Called contact",
        body: "Notes from call",
        dueDate: null,
      });
      activityId = activity.id;

      await dbStore.activityLinks.insert({
        orgId: orgA,
        activityId: activityId,
        targetType: "Contact",
        targetId: duplicateId,
      });

      // 7. Contact reporting to duplicate (will be updated to master)
      const child = await dbStore.contacts.insert({
        orgId: orgA,
        ownerId: "user-a",
        accountId: "account-a",
        firstName: "John",
        lastName: "Junior",
        email: "john@junior.com",
        reportsToId: duplicateId,
        custom: null,
      });
      childContactId = child.id;

      // Add a campaign member for master to same campaign to test duplicate removal
      await dbStore.campaignMembers.insert({
        orgId: orgA,
        campaignId: "campaign-1",
        leadId: null,
        contactId: masterId,
        status: "Responded",
        createdAt: new Date(),
      });
    });

    // Execute merge via API
    const mergeRes = await app.request(`/api/contacts/${masterId}/merge`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        duplicateId,
        fieldResolution: {
          firstName: "master",
          lastName: "master",
          email: "duplicate",
          accountId: "master",
          reportsToId: "master",
          "custom.title": "duplicate",
          "custom.mobile": "duplicate",
        },
      }),
    });

    expect(mergeRes.status).toBe(200);
    const mergeBody = await mergeRes.json();
    expect(mergeBody.success).toBe(true);

    const finalMaster = mergeBody.data;
    expect(finalMaster.firstName).toBe("Alice"); // master
    expect(finalMaster.email).toBe("alice@dup.com"); // duplicate
    expect(finalMaster.accountId).toBe("account-a"); // master

    // Custom JSONB verification
    expect(finalMaster.custom.title).toBe("VP of Sales & Marketing"); // duplicate overwritten
    expect(finalMaster.custom.phone).toBe("123-456-7890"); // master kept
    expect(finalMaster.custom.tier).toBe("A"); // master kept
    expect(finalMaster.custom.mobile).toBe("987-654-3210"); // duplicate merged

    // Verify duplicate contact is physically deleted
    await withTenant(orgA, mockDb, async () => {
      const dupLookup = await dbStore.contacts.findOne(duplicateId);
      expect(dupLookup).toBeNull();
    });

    // Verify related ticket re-parenting
    const ticket = store.tickets.find((t) => t.id === ticketId);
    expect(ticket?.contactId).toBe(masterId);

    // Verify campaign member duplicate cleanup (campaign-1 should only have master member, dup member should be deleted)
    const members = store.campaignMembers.filter(
      (m) => m.orgId === orgA && m.campaignId === "campaign-1",
    );
    expect(members.length).toBe(1);
    expect(members[0].contactId).toBe(masterId);

    // Verify opportunity contact role re-parenting
    const role = store.opportunityContactRoles.find((r) => r.id === roleId);
    expect(role?.contactId).toBe(masterId);

    // Verify activity link re-parenting
    const links = store.activityLinks.filter(
      (l) => l.orgId === orgA && l.targetId === masterId,
    );
    expect(links.length).toBe(1);
    expect(links[0].targetType).toBe("Contact");

    // Verify reporting manager update
    await withTenant(orgA, mockDb, async () => {
      const child = await dbStore.contacts.findOne(childContactId);
      expect(child?.reportsToId).toBe(masterId);
    });

    // Verify Audit Log entry
    await withTenant(orgA, mockDb, async () => {
      const logs = await dbStore.auditLogs.findMany();
      const mergeLog = logs.find(
        (log) => log.recordId === masterId && log.action === "update",
      );
      expect(mergeLog).toBeDefined();
      expect(mergeLog?.changes?.merge.after).toBe("merged_into_master");
    });
  });

  it("should block cross-tenant contact merge attempts", async () => {
    let contactTenantA = "";
    let contactTenantB = "";

    await withTenant(orgA, mockDb, async () => {
      const c = await dbStore.contacts.insert({
        orgId: orgA,
        ownerId: "user-a",
        accountId: "account-a",
        firstName: "Alice",
        lastName: "Smith",
        email: "alice@tenant-a.com",
        custom: null,
      });
      contactTenantA = c.id;
    });

    await withTenant(orgB, mockDb, async () => {
      const c = await dbStore.contacts.insert({
        orgId: orgB,
        ownerId: "user-b",
        accountId: "account-b",
        firstName: "Alice",
        lastName: "Smith",
        email: "alice@tenant-b.com",
        custom: null,
      });
      contactTenantB = c.id;
    });

    // Tenant B trying to merge Tenant A's contact -> should fail with 404
    const mergeRes = await app.request(
      `/api/contacts/${contactTenantB}/merge`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          duplicateId: contactTenantA,
          fieldResolution: {
            firstName: "master",
          },
        }),
      },
    );

    expect(mergeRes.status).toBe(404);
  });
});
