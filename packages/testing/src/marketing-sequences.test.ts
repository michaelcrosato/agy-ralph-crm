import { createSessionToken } from "@crm/auth";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestApp } from "./_harness";

const app = createTestApp();

describe("Marketing Sequences & Drip Journeys API Tests", () => {
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

  it("should successfully orchestrate multi-step sequences, enroll, compile placeholders, and transition step states under RLS isolation", async () => {
    let leadId = "";
    let templateId1 = "";
    let templateId2 = "";
    let sequenceId = "";

    // 1. Setup email templates and a lead for Tenant A
    await withTenant(orgA, mockDb, async () => {
      const lead = await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "user-a",
        status: "New",
        email: "john.doe@acme.com",
        company: "Acme Corp",
        convertedAccountId: null,
        convertedContactId: null,
        custom: null,
      });
      leadId = lead.id;

      const t1 = await dbStore.emailTemplates.insert({
        orgId: orgA,
        name: "Welcome Drip 1",
        subject: "Welcome to Acme, {{lead.company}}!",
        body: "Hi, your email is {{lead.email}} at {{lead.company}}.",
      });
      templateId1 = t1.id;

      const t2 = await dbStore.emailTemplates.insert({
        orgId: orgA,
        name: "Nurture Drip 2",
        subject: "Hey! Let's talk about {{lead.company}}",
        body: "Hi, is {{lead.email}} still active?",
      });
      templateId2 = t2.id;
    });

    // 2. Create Sequence for Tenant A
    const createSeqRes = await app.request("/api/sequences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "New Lead Nurture Flow",
        description: "Automated sequence for incoming leads",
        status: "active",
      }),
    });
    expect(createSeqRes.status).toBe(200);
    const createSeqBody = await createSeqRes.json();
    sequenceId = createSeqBody.sequence.id;
    expect(sequenceId).toBeDefined();

    // 3. Add Step 1 (immediate, delayDays = 0) and Step 2 (delayDays = 3)
    const addStep1Res = await app.request(
      `/api/sequences/${sequenceId}/steps`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          stepNumber: 1,
          delayDays: 0,
          templateId: templateId1,
        }),
      },
    );
    expect(addStep1Res.status).toBe(200);

    const addStep2Res = await app.request(
      `/api/sequences/${sequenceId}/steps`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          stepNumber: 2,
          delayDays: 3,
          templateId: templateId2,
        }),
      },
    );
    expect(addStep2Res.status).toBe(200);

    // 4. Enroll Lead in Sequence
    const enrollRes = await app.request(`/api/sequences/${sequenceId}/enroll`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recordType: "lead",
        recordId: leadId,
      }),
    });
    expect(enrollRes.status).toBe(200);
    const enrollBody = await enrollRes.json();
    const membershipId = enrollBody.membership.id;
    expect(membershipId).toBeDefined();
    expect(enrollBody.membership.currentStepNumber).toBe(0);
    expect(enrollBody.membership.status).toBe("active");

    // 5. Execute sequence (simulated cron run)
    const execRes1 = await app.request("/api/sequences/execute", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
      },
    });
    expect(execRes1.status).toBe(200);
    const execBody1 = await execRes1.json();
    expect(execBody1.processedCount).toBe(1);

    // 6. Assert that Step 1 ran: Outbound email activity created and placeholders resolved correctly
    await withTenant(orgA, mockDb, async () => {
      const activities = await dbStore.activities.findMany();
      expect(activities.length).toBe(1);
      expect(activities[0].subject).toBe("Welcome to Acme, Acme Corp!");
      expect(activities[0].body).toBe(
        "Hi, your email is john.doe@acme.com at Acme Corp.",
      );

      const links = await dbStore.activityLinks.findMany();
      expect(links.length).toBe(1);
      expect(links[0].activityId).toBe(activities[0].id);
      expect(links[0].targetId).toBe(leadId);

      const memb =
        await dbStore.marketingSequenceMemberships.findOne(membershipId);
      expect(memb?.currentStepNumber).toBe(1);
      expect(memb?.status).toBe("active");
    });

    // 7. Verify RLS tenant isolation: Tenant B cannot see enrolled members or trigger Tenant A's memberships
    const queryMembersB = await app.request(
      `/api/sequences/${sequenceId}/members`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
        },
      },
    );
    expect(queryMembersB.status).toBe(404); // Returns 404 (due to RLS checking ownership of sequenceId)
  });

  it("should enforce GDPR opt-out, skip dispatch, mark unsubscribed, and record audit log", async () => {
    let leadId = "";
    let templateId = "";
    let sequenceId = "";
    let membershipId = "";

    await withTenant(orgA, mockDb, async () => {
      const lead = await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "user-a",
        status: "New",
        email: "optout@acme.com",
        company: "OptOut Corp",
        convertedAccountId: null,
        convertedContactId: null,
        custom: null,
      });
      leadId = lead.id;

      // Add GDPR opt-out consent preference for email channel
      await dbStore.contactConsentPreferences.upsert({
        orgId: orgA,
        recordType: "lead",
        recordId: leadId,
        channel: "email",
        status: "opt_out",
        source: "gdpr_compliance",
        updatedById: "user-a",
      });

      const t1 = await dbStore.emailTemplates.insert({
        orgId: orgA,
        name: "Welcome Drip 1",
        subject: "Welcome!",
        body: "Glad to have you.",
      });
      templateId = t1.id;

      const seq = await dbStore.marketingSequences.insert({
        orgId: orgA,
        name: "Nurture Sequence",
        description: "Drip Flow",
        status: "active",
      });
      sequenceId = seq.id;

      await dbStore.marketingSequenceSteps.insert({
        orgId: orgA,
        sequenceId: sequenceId,
        stepNumber: 1,
        delayDays: 0,
        templateId: templateId,
      });

      const memb = await dbStore.marketingSequenceMemberships.insert({
        orgId: orgA,
        sequenceId: sequenceId,
        recordType: "lead",
        recordId: leadId,
        status: "active",
        currentStepNumber: 0,
        lastExecutedAt: null,
        nextExecutionAt: new Date(),
      });
      membershipId = memb.id;
    });

    // Execute sequences execution trigger
    const execRes = await app.request("/api/sequences/execute", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
      },
    });
    expect(execRes.status).toBe(200);

    // Verify recipient was unsubscribed and no email was sent
    await withTenant(orgA, mockDb, async () => {
      const activities = await dbStore.activities.findMany();
      expect(activities.length).toBe(0); // Email was skipped

      const memb =
        await dbStore.marketingSequenceMemberships.findOne(membershipId);
      expect(memb?.status).toBe("unsubscribed");

      const auditLogs = await dbStore.auditLogs.findMany();
      const skipLog = auditLogs.find(
        (log) => log.action === "unsubscribe_skip",
      );
      expect(skipLog).toBeDefined();
      expect(skipLog?.recordId).toBe(leadId);
    });
  });
});
