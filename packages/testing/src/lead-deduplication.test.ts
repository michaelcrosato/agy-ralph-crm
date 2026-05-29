import { createSessionToken } from "@crm/auth";
import { dbStore, mockDb, store, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../../../apps/api/src/index";

describe("Lead De-duplication and Merging API Tests", () => {
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

  it("should identify duplicate leads based on email and company matching rules, respecting RLS", async () => {
    let sourceLeadId = "";
    let duplicateEmailLeadId = "";
    let duplicateCompanyDomainLeadId = "";
    let nonDuplicatePublicDomainLeadId = "";
    let crossTenantLeadId = "";

    // Setup leads for Tenant A
    await withTenant(orgA, mockDb, async () => {
      // 1. Source Lead
      const source = await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "user-a",
        status: "New",
        email: "alice@acme.com",
        company: "Acme Corp",
        convertedAccountId: null,
        convertedContactId: null,
        custom: null,
      });
      sourceLeadId = source.id;

      // 2. Duplicate with exact email match
      const dup1 = await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "user-a",
        status: "New",
        email: "alice@acme.com",
        company: "Acme Incorporated",
        convertedAccountId: null,
        convertedContactId: null,
        custom: null,
      });
      duplicateEmailLeadId = dup1.id;

      // 3. Duplicate with exact company match AND same corporate email domain
      const dup2 = await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "user-a",
        status: "New",
        email: "bob@acme.com",
        company: "Acme Corp",
        convertedAccountId: null,
        convertedContactId: null,
        custom: null,
      });
      duplicateCompanyDomainLeadId = dup2.id;

      // 4. Non-duplicate: same company match BUT public domain email (gmail) -> should be ignored to prevent false positives
      const nonDup = await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "user-a",
        status: "New",
        email: "alice@gmail.com",
        company: "Acme Corp",
        convertedAccountId: null,
        convertedContactId: null,
        custom: null,
      });
      nonDuplicatePublicDomainLeadId = nonDup.id;
    });

    // Setup lead for Tenant B (identical email to Tenant A source lead) -> RLS must isolate
    await withTenant(orgB, mockDb, async () => {
      const cross = await dbStore.leads.insert({
        orgId: orgB,
        ownerId: "user-b",
        status: "New",
        email: "alice@acme.com",
        company: "Acme Corp",
        convertedAccountId: null,
        convertedContactId: null,
        custom: null,
      });
      crossTenantLeadId = cross.id;
    });

    // Call GET /api/leads/:id/duplicates for Tenant A
    const resA = await app.request(`/api/leads/${sourceLeadId}/duplicates`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
      },
    });

    expect(resA.status).toBe(200);
    const bodyA = await resA.json();
    expect(bodyA.success).toBe(true);

    const dupIds = bodyA.data.map((l: { id: string }) => l.id);
    expect(dupIds.length).toBe(2);
    expect(dupIds).toContain(duplicateEmailLeadId);
    expect(dupIds).toContain(duplicateCompanyDomainLeadId);
    expect(dupIds).not.toContain(nonDuplicatePublicDomainLeadId);
    expect(dupIds).not.toContain(crossTenantLeadId);

    // Call GET /api/leads/:id/duplicates for Tenant B (attempting to fetch Tenant A's lead duplicates)
    const resB = await app.request(`/api/leads/${sourceLeadId}/duplicates`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantB}`,
      },
    });
    expect(resB.status).toBe(404); // Tenant B cannot see Tenant A's lead
  });

  it("should merge a duplicate lead into a master lead, consolidating field resolutions, activities and campaign memberships", async () => {
    let masterId = "";
    let duplicateId = "";
    let campaignId = "";

    await withTenant(orgA, mockDb, async () => {
      // 1. Create campaign
      const campaign = await dbStore.campaigns.insert({
        orgId: orgA,
        name: "Q3 Campaign",
        status: "Active",
        type: "Email",
        isActive: 1,
        startDate: null,
        endDate: null,
        budgetedCost: "100.00",
        actualCost: "50.00",
        expectedRevenue: "500.00",
        createdAt: new Date(),
      });
      campaignId = campaign.id;

      // 2. Master Lead with custom field configurations
      const master = await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "user-a",
        status: "New",
        email: "master@enterprise.com",
        company: "Enterprise Ltd",
        convertedAccountId: null,
        convertedContactId: null,
        custom: {
          industry: "Software",
          employees: 150,
          tier: "Enterprise",
        },
      });
      masterId = master.id;

      // 3. Duplicate Lead with some missing and conflicting fields
      const duplicate = await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "user-a",
        status: "Contacted",
        email: "dup@enterprise.com",
        company: "Enterprise Corp",
        convertedAccountId: null,
        convertedContactId: null,
        custom: {
          industry: "Technology",
          employees: null,
          revenue: "50M",
        },
      });
      duplicateId = duplicate.id;

      // 4. Create an activity linked to the duplicate lead
      const act = await dbStore.activities.insert({
        orgId: orgA,
        creatorId: "user-a",
        type: "note",
        subject: "Discussed pricing tiers",
        body: "Interested in enterprise layout options",
        dueDate: null,
      });

      await dbStore.activityLinks.insert({
        orgId: orgA,
        activityId: act.id,
        targetType: "Lead",
        targetId: duplicateId,
      });

      // 5. Add duplicate lead to the campaign
      store.campaignMembers.push({
        id: "member-dup",
        orgId: orgA,
        campaignId,
        leadId: duplicateId,
        contactId: null,
        status: "Sent",
        createdAt: new Date(),
      });
    });

    // Execute Merge call via POST /api/leads/:id/merge
    const mergeRes = await app.request(`/api/leads/${masterId}/merge`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        duplicateId,
        fieldResolution: {
          email: "master",
          company: "duplicate",
          status: "duplicate",
          "custom.industry": "duplicate",
          "custom.revenue": "duplicate",
        },
      }),
    });

    expect(mergeRes.status).toBe(200);
    const mergeBody = await mergeRes.json();
    expect(mergeBody.success).toBe(true);

    // Verify Master Lead field consolidation
    const finalMaster = mergeBody.data;
    expect(finalMaster.email).toBe("master@enterprise.com"); // Retained master
    expect(finalMaster.company).toBe("Enterprise Corp"); // Overwritten by duplicate
    expect(finalMaster.status).toBe("Contacted"); // Overwritten by duplicate

    // Custom fields merging verification
    expect(finalMaster.custom.industry).toBe("Technology"); // Overwritten specifically
    expect(finalMaster.custom.employees).toBe(150); // Kept master only key
    expect(finalMaster.custom.tier).toBe("Enterprise"); // Kept master only key
    expect(finalMaster.custom.revenue).toBe("50M"); // Merged duplicate key

    // Verify duplicate lead is deleted
    await withTenant(orgA, mockDb, async () => {
      const dupLookup = await dbStore.leads.findOne(duplicateId);
      expect(dupLookup).toBeNull();
    });

    // Verify activity link was updated to target master lead
    const links = store.activityLinks.filter(
      (l) => l.orgId === orgA && l.targetId === masterId,
    );
    expect(links.length).toBe(1);
    expect(links[0].targetType).toBe("Lead");

    // Verify campaign member was consolidated
    const campaignMembers = store.campaignMembers.filter(
      (m) => m.orgId === orgA && m.leadId === masterId,
    );
    expect(campaignMembers.length).toBe(1);
    expect(campaignMembers[0].campaignId).toBe(campaignId);

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

  it("should block cross-tenant merge attempts", async () => {
    let leadTenantA = "";
    let leadTenantB = "";

    await withTenant(orgA, mockDb, async () => {
      const l = await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "user-a",
        status: "New",
        email: "a@a.com",
        company: "Org A",
        convertedAccountId: null,
        convertedContactId: null,
        custom: null,
      });
      leadTenantA = l.id;
    });

    await withTenant(orgB, mockDb, async () => {
      const l = await dbStore.leads.insert({
        orgId: orgB,
        ownerId: "user-b",
        status: "New",
        email: "b@b.com",
        company: "Org B",
        convertedAccountId: null,
        convertedContactId: null,
        custom: null,
      });
      leadTenantB = l.id;
    });

    // Tenant B trying to merge Tenant A's lead -> should fail with 404 since Tenant B cannot resolve Tenant A's lead ID
    const mergeRes = await app.request(`/api/leads/${leadTenantB}/merge`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantB}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        duplicateId: leadTenantA,
        fieldResolution: {
          email: "master",
        },
      }),
    });

    expect(mergeRes.status).toBe(404); // Master or duplicate lead not found
  });
});
