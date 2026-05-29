import { createSessionToken } from "@crm/auth";
import { enrollInSequence, executePendingSequenceSteps } from "@crm/core";
import { dbStore, mockDb, store, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../../../apps/api/src/index";

describe("Marketing Sequence Suppression Lists & Exclusion Rules Engine API & Logic Tests (Task 0185)", () => {
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

  it("should support CRUD on global suppressions and sequence exclusions with strict tenant RLS isolation", async () => {
    let seqId = "";

    await withTenant(orgA, mockDb, async () => {
      const seq = await dbStore.marketingSequences.insert({
        orgId: orgA,
        name: "Enterprise Nurturing",
        description: "B2B sequence",
        status: "active",
      });
      seqId = seq.id;
    });

    // 1. Create a global suppression via POST
    const createSuppRes = await app.request("/api/sequences/suppressions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recordType: "email_domain",
        pattern: "competitor.com",
        reason: "competitor",
      }),
    });
    expect(createSuppRes.status).toBe(200);
    const createSuppData = await createSuppRes.json();
    expect(createSuppData.success).toBe(true);
    expect(createSuppData.data.pattern).toBe("competitor.com");
    expect(createSuppData.data.reason).toBe("competitor");

    // 2. Fetch global suppressions via GET
    const getSuppRes = await app.request("/api/sequences/suppressions", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
      },
    });
    expect(getSuppRes.status).toBe(200);
    const getSuppData = await getSuppRes.json();
    expect(getSuppData.success).toBe(true);
    expect(getSuppData.data).toHaveLength(1);
    expect(getSuppData.data[0].pattern).toBe("competitor.com");

    // 3. Verify Tenant RLS for global suppressions (Tenant B sees empty suppression list)
    const getSuppTenantB = await app.request("/api/sequences/suppressions", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantB}`,
      },
    });
    expect(getSuppTenantB.status).toBe(200);
    const getSuppDataB = await getSuppTenantB.json();
    expect(getSuppDataB.success).toBe(true);
    expect(getSuppDataB.data).toHaveLength(0);

    // 4. Create sequence-specific exclusion rule via POST
    const createExclRes = await app.request(
      `/api/sequences/${seqId}/exclusions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          exclusionType: "domain",
          exclusionValue: "internal.com",
        }),
      },
    );
    expect(createExclRes.status).toBe(200);
    const createExclData = await createExclRes.json();
    expect(createExclData.success).toBe(true);
    expect(createExclData.data.exclusionType).toBe("domain");
    expect(createExclData.data.exclusionValue).toBe("internal.com");

    // 5. Fetch sequence-specific exclusions via GET
    const getExclRes = await app.request(`/api/sequences/${seqId}/exclusions`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
      },
    });
    expect(getExclRes.status).toBe(200);
    const getExclData = await getExclRes.json();
    expect(getExclData.success).toBe(true);
    expect(getExclData.data).toHaveLength(1);
    expect(getExclData.data[0].exclusionValue).toBe("internal.com");

    // 6. Verify Tenant RLS for sequence exclusions (Tenant B gets 404 sequence not found)
    const getExclTenantB = await app.request(
      `/api/sequences/${seqId}/exclusions`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
        },
      },
    );
    expect(getExclTenantB.status).toBe(404);
  });

  it("should intercept enrollment if contact/lead email matches global suppressions or sequence exclusions", async () => {
    let seqId = "";
    let cleanLeadId = "";
    let suppressedLeadId = "";
    let excludedLeadId = "";

    await withTenant(orgA, mockDb, async () => {
      const seq = await dbStore.marketingSequences.insert({
        orgId: orgA,
        name: "Acquisition Sequence",
        description: "B2B sequence",
        status: "active",
      });
      seqId = seq.id;

      await dbStore.marketingSequenceSteps.insert({
        orgId: orgA,
        sequenceId: seqId,
        stepNumber: 1,
        delayDays: 0,
        templateId: "tpl-1",
      });

      // Insert global suppression for competitor.com domain
      await dbStore.marketingSequenceSuppressions.insert({
        orgId: orgA,
        recordType: "email_domain",
        pattern: "competitor.com",
        reason: "competitor",
        recordId: null,
      });

      // Insert sequence exclusion rule for internal.com domain
      await dbStore.marketingSequenceExclusions.insert({
        orgId: orgA,
        sequenceId: seqId,
        exclusionType: "domain",
        exclusionValue: "internal.com",
      });

      // Create a clean lead
      const cleanLead = await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "user-a",
        status: "Open",
        email: "prospect@clean.com",
        company: "Clean Corp",
        convertedAccountId: null,
        convertedContactId: null,
        custom: null,
      });
      cleanLeadId = cleanLead.id;

      // Create a lead that matches global suppression domain
      const suppLead = await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "user-a",
        status: "Open",
        email: "spy@competitor.com",
        company: "Competitor Corp",
        convertedAccountId: null,
        convertedContactId: null,
        custom: null,
      });
      suppressedLeadId = suppLead.id;

      // Create a lead that matches sequence exclusion domain
      const exclLead = await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "user-a",
        status: "Open",
        email: "employee@internal.com",
        company: "Internal Corp",
        convertedAccountId: null,
        convertedContactId: null,
        custom: null,
      });
      excludedLeadId = exclLead.id;
    });

    // Enroll clean lead
    let cleanMemb: Record<string, unknown> | null | undefined;
    await withTenant(orgA, mockDb, async () => {
      cleanMemb = await enrollInSequence(
        dbStore,
        orgA,
        seqId,
        "lead",
        cleanLeadId,
      );
    });
    expect(cleanMemb?.status).toBe("active");

    // Enroll globally suppressed lead
    let suppMemb: Record<string, unknown> | null | undefined;
    await withTenant(orgA, mockDb, async () => {
      suppMemb = await enrollInSequence(
        dbStore,
        orgA,
        seqId,
        "lead",
        suppressedLeadId,
      );
    });
    expect(suppMemb?.status).toBe("suppressed");

    // Enroll sequence-excluded lead
    let exclMemb: Record<string, unknown> | null | undefined;
    await withTenant(orgA, mockDb, async () => {
      exclMemb = await enrollInSequence(
        dbStore,
        orgA,
        seqId,
        "lead",
        excludedLeadId,
      );
    });
    expect(exclMemb?.status).toBe("suppressed");
  });

  it("should bypass step delivery and update membership status to suppressed if added to suppression list later", async () => {
    let seqId = "";
    let leadId = "";
    let membershipId = "";
    let templateId = "";

    await withTenant(orgA, mockDb, async () => {
      const template = await dbStore.emailTemplates.insert({
        orgId: orgA,
        name: "Nurture Email",
        subject: "Warm welcome",
        body: "Hello!",
      });
      templateId = template.id;

      const seq = await dbStore.marketingSequences.insert({
        orgId: orgA,
        name: "Acquisition Sequence",
        description: "B2B sequence",
        status: "active",
      });
      seqId = seq.id;

      await dbStore.marketingSequenceSteps.insert({
        orgId: orgA,
        sequenceId: seqId,
        stepNumber: 1,
        delayDays: 0,
        templateId,
      });

      const lead = await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "user-a",
        status: "Open",
        email: "churned@client.com",
        company: "Client Corp",
        convertedAccountId: null,
        convertedContactId: null,
        custom: null,
      });
      leadId = lead.id;

      // Enroll initially clean record
      const membership = await enrollInSequence(
        dbStore,
        orgA,
        seqId,
        "lead",
        leadId,
      );
      membershipId = membership.id;
      expect(membership.status).toBe("active");

      // Now, retroactively add to global suppression list (e.g. they opted out, or bounced)
      await dbStore.marketingSequenceSuppressions.insert({
        orgId: orgA,
        recordType: "lead",
        recordId: leadId,
        pattern: null,
        reason: "opt_out",
      });
    });

    // Run pending sequence steps loop
    let processed = 0;
    await withTenant(orgA, mockDb, async () => {
      processed = await executePendingSequenceSteps(
        dbStore,
        new Date(Date.now() + 1000),
      );
    });
    expect(processed).toBe(1);

    // Verify membership was updated to suppressed and NO email activity was logged
    await withTenant(orgA, mockDb, async () => {
      const memb =
        await dbStore.marketingSequenceMemberships.findOne(membershipId);
      expect(memb?.status).toBe("suppressed");

      // Verify no activities were inserted
      const activities = await dbStore.activities.findMany();
      const emailActivities = activities.filter((a) => a.type === "email");
      expect(emailActivities).toHaveLength(0);

      // Verify audit logs
      const auditLogs = await dbStore.auditLogs.findMany();
      const suppressionLog = auditLogs.find(
        (l) => l.action === "membership_suppressed",
      );
      expect(suppressionLog).toBeDefined();
      expect(suppressionLog?.recordId).toBe(membershipId);
    });
  });
});
