import { createSessionToken } from "@crm/auth";
import { dbStore, mockDb, store, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestApp } from "./_harness";

const app = createTestApp();

describe("Account De-duplication and Merging API Tests", () => {
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

  it("should identify duplicate accounts based on name and domain matching rules, respecting RLS", async () => {
    let sourceAccountId = "";
    let duplicateNameAccountId = "";
    let duplicateDomainAccountId = "";
    let nonDuplicateAccountId = "";
    let crossTenantAccountId = "";

    // Setup accounts for Tenant A
    await withTenant(orgA, mockDb, async () => {
      // 1. Source Account
      const source = await dbStore.accounts.insert({
        orgId: orgA,
        ownerId: "user-a",
        name: "Acme Corp",
        domain: "acme.com",
        custom: null,
      });
      sourceAccountId = source.id;

      // 2. Duplicate with exact name match (different domain)
      const dup1 = await dbStore.accounts.insert({
        orgId: orgA,
        ownerId: "user-a",
        name: "Acme Corp",
        domain: "acmeco.com",
        custom: null,
      });
      duplicateNameAccountId = dup1.id;

      // 3. Duplicate with exact domain match (different name)
      const dup2 = await dbStore.accounts.insert({
        orgId: orgA,
        ownerId: "user-a",
        name: "Acme Global",
        domain: "acme.com",
        custom: null,
      });
      duplicateDomainAccountId = dup2.id;

      // 4. Non-duplicate account
      const nonDup = await dbStore.accounts.insert({
        orgId: orgA,
        ownerId: "user-a",
        name: "Google LLC",
        domain: "google.com",
        custom: null,
      });
      nonDuplicateAccountId = nonDup.id;
    });

    // Setup account for Tenant B (identical name & domain to Tenant A source) -> RLS must isolate
    await withTenant(orgB, mockDb, async () => {
      const cross = await dbStore.accounts.insert({
        orgId: orgB,
        ownerId: "user-b",
        name: "Acme Corp",
        domain: "acme.com",
        custom: null,
      });
      crossTenantAccountId = cross.id;
    });

    // Call GET /api/accounts/:id/duplicates for Tenant A
    const resA = await app.request(
      `/api/accounts/${sourceAccountId}/duplicates`,
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

    const dupIds = bodyA.data.map((a: { id: string }) => a.id);
    expect(dupIds.length).toBe(2);
    expect(dupIds).toContain(duplicateNameAccountId);
    expect(dupIds).toContain(duplicateDomainAccountId);
    expect(dupIds).not.toContain(nonDuplicateAccountId);
    expect(dupIds).not.toContain(crossTenantAccountId);

    // Call GET /api/accounts/:id/duplicates for Tenant B (attempting to fetch Tenant A's account duplicates)
    const resB = await app.request(
      `/api/accounts/${sourceAccountId}/duplicates`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
        },
      },
    );
    expect(resB.status).toBe(404); // Tenant B cannot see Tenant A's account
  });

  it("should merge a duplicate account into a master account, consolidating field resolutions, child contacts, opportunities, contracts, team memberships and activities", async () => {
    let masterId = "";
    let duplicateId = "";
    let contactId = "";
    let oppId = "";
    let contractId = "";
    let activityId = "";

    await withTenant(orgA, mockDb, async () => {
      // 1. Master Account
      const master = await dbStore.accounts.insert({
        orgId: orgA,
        ownerId: "user-a",
        name: "Acme Group",
        domain: "acme.com",
        custom: {
          industry: "Software",
          employees: 200,
          tier: "Platinum",
        },
      });
      masterId = master.id;

      // 2. Duplicate Account
      const duplicate = await dbStore.accounts.insert({
        orgId: orgA,
        ownerId: "user-a",
        name: "Acme Corp",
        domain: "acmecorp.com",
        custom: {
          industry: "Technology",
          employees: null,
          revenue: "100M",
        },
      });
      duplicateId = duplicate.id;

      // 3. Child contact
      const contact = await dbStore.contacts.insert({
        orgId: orgA,
        ownerId: "user-a",
        accountId: duplicateId,
        firstName: "Alice",
        lastName: "Smith",
        email: "alice@acme.com",
        custom: null,
      });
      contactId = contact.id;

      // 4. Child opportunity
      const opportunity = await dbStore.opportunities.insert({
        orgId: orgA,
        ownerId: "user-a",
        accountId: duplicateId,
        name: "Q4 Expansion",
        stage: "Qualification",
        amount: "50000.00",
        closeDate: null,
        custom: null,
      });
      oppId = opportunity.id;

      // 5. Child contract
      const contractRecord = await dbStore.contracts.insert({
        orgId: orgA,
        accountId: duplicateId,
        opportunityId: oppId,
        contractAmount: "50000.00",
        startDate: new Date(),
        endDate: new Date(),
        status: "Draft",
      });
      contractId = contractRecord.id;

      // 6. Child activity
      const activity = await dbStore.activities.insert({
        orgId: orgA,
        creatorId: "user-a",
        type: "note",
        subject: "Merged notes",
        body: "Pre-merge notes discussion",
        dueDate: null,
      });
      activityId = activity.id;

      await dbStore.activityLinks.insert({
        orgId: orgA,
        activityId: activityId,
        targetType: "Account",
        targetId: duplicateId,
      });

      // 7. Team memberships
      // Add team member to master account
      await dbStore.accountTeams.insert({
        orgId: orgA,
        accountId: masterId,
        userId: "user-a",
        role: "Account Manager",
      });

      // Add team member to duplicate account (will be merged/cleaned up since user-a already in master)
      await dbStore.accountTeams.insert({
        orgId: orgA,
        accountId: duplicateId,
        userId: "user-a",
        role: "Sales Engineer",
      });

      // Add unique team member to duplicate account (will be re-parented)
      await dbStore.accountTeams.insert({
        orgId: orgA,
        accountId: duplicateId,
        userId: "user-unique",
        role: "Customer Success Manager",
      });
    });

    // Execute Merge call via POST /api/accounts/:id/merge
    const mergeRes = await app.request(`/api/accounts/${masterId}/merge`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        duplicateId,
        fieldResolution: {
          name: "master",
          domain: "duplicate",
          "custom.industry": "duplicate",
          "custom.revenue": "duplicate",
        },
      }),
    });

    expect(mergeRes.status).toBe(200);
    const mergeBody = await mergeRes.json();
    expect(mergeBody.success).toBe(true);

    // Verify Master Account field consolidation
    const finalMaster = mergeBody.data;
    expect(finalMaster.name).toBe("Acme Group"); // Retained master
    expect(finalMaster.domain).toBe("acmecorp.com"); // Overwritten by duplicate

    // Custom fields merging verification
    expect(finalMaster.custom.industry).toBe("Technology"); // Overwritten specifically
    expect(finalMaster.custom.employees).toBe(200); // Kept master only key
    expect(finalMaster.custom.tier).toBe("Platinum"); // Kept master only key
    expect(finalMaster.custom.revenue).toBe("100M"); // Merged duplicate key

    // Verify duplicate account is deleted
    await withTenant(orgA, mockDb, async () => {
      const dupLookup = await dbStore.accounts.findOne(duplicateId);
      expect(dupLookup).toBeNull();
    });

    // Verify contacts, opportunities, and contracts were re-parented
    await withTenant(orgA, mockDb, async () => {
      const c = await dbStore.contacts.findOne(contactId);
      expect(c?.accountId).toBe(masterId);

      const o = await dbStore.opportunities.findOne(oppId);
      expect(o?.accountId).toBe(masterId);

      const contract = await dbStore.contracts.findOne(contractId);
      expect(contract?.accountId).toBe(masterId);
    });

    // Verify activity link was updated to target master account
    const links = store.activityLinks.filter(
      (l) => l.orgId === orgA && l.targetId === masterId,
    );
    expect(links.length).toBe(1);
    expect(links[0].targetType).toBe("Account");

    // Verify account team members were consolidated
    const teamMembers = store.accountTeams.filter(
      (m) => m.orgId === orgA && m.accountId === masterId,
    );
    expect(teamMembers.length).toBe(2); // user-a (Account Manager) and user-unique (CSM)
    const teamUserIds = teamMembers.map((m) => m.userId);
    expect(teamUserIds).toContain("user-a");
    expect(teamUserIds).toContain("user-unique");

    const duplicateTeamMembers = store.accountTeams.filter(
      (m) => m.orgId === orgA && m.accountId === duplicateId,
    );
    expect(duplicateTeamMembers.length).toBe(0);

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

  it("should block cross-tenant account merge attempts", async () => {
    let accountTenantA = "";
    let accountTenantB = "";

    await withTenant(orgA, mockDb, async () => {
      const a = await dbStore.accounts.insert({
        orgId: orgA,
        ownerId: "user-a",
        name: "Acme Tenant A",
        domain: "acme.com",
        custom: null,
      });
      accountTenantA = a.id;
    });

    await withTenant(orgB, mockDb, async () => {
      const a = await dbStore.accounts.insert({
        orgId: orgB,
        ownerId: "user-b",
        name: "Acme Tenant B",
        domain: "acme.com",
        custom: null,
      });
      accountTenantB = a.id;
    });

    // Tenant B trying to merge Tenant A's account -> should fail with 404 since Tenant B cannot resolve Tenant A's account ID
    const mergeRes = await app.request(
      `/api/accounts/${accountTenantB}/merge`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          duplicateId: accountTenantA,
          fieldResolution: {
            name: "master",
          },
        }),
      },
    );

    expect(mergeRes.status).toBe(404); // Master or duplicate account not found
  });
});
