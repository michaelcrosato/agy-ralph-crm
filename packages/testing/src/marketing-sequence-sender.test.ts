import { createSessionToken } from "@crm/auth";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../../../apps/api/src/index";

describe("Marketing Sequence Dynamic Sender Assignment Tests (Task 0195)", () => {
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

    // Populate tenant memberships
    await withTenant(orgA, mockDb, async () => {
      await dbStore.memberships.insert({
        orgId: orgA,
        userId: "user-a",
        roleId: "role-a",
      });
      await dbStore.memberships.insert({
        orgId: orgA,
        userId: "specific-user-a",
        roleId: "role-a",
      });
    });

    await withTenant(orgB, mockDb, async () => {
      await dbStore.memberships.insert({
        orgId: orgB,
        userId: "user-b",
        roleId: "role-b",
      });
    });
  });

  it("should validate sender configuration on POST /api/sequences", async () => {
    // 1. Invalid senderType
    const res1 = await app.request("/api/sequences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Test Seq 1",
        senderType: "invalid-type",
      }),
    });
    expect(res1.status).toBe(400);

    // 2. Specific senderType but missing senderUserId
    const res2 = await app.request("/api/sequences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Test Seq 2",
        senderType: "specific",
      }),
    });
    expect(res2.status).toBe(400);

    // 3. Valid specific senderType and senderUserId
    const res3 = await app.request("/api/sequences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Test Seq 3",
        senderType: "specific",
        senderUserId: "specific-user-a",
      }),
    });
    expect(res3.status).toBe(200);
    const body3 = await res3.json();
    expect(body3.sequence.senderType).toBe("specific");
    expect(body3.sequence.senderUserId).toBe("specific-user-a");

    // 4. Cross-tenant specific user validation (Tenant A cannot assign Tenant B user)
    const res4 = await app.request("/api/sequences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Test Seq 4",
        senderType: "specific",
        senderUserId: "user-b", // belongs to Tenant B
      }),
    });
    expect(res4.status).toBe(400);
  });

  it("should validate sequence updates on PATCH /api/sequences/:id", async () => {
    let seqId = "";
    await withTenant(orgA, mockDb, async () => {
      const seq = await dbStore.marketingSequences.insert({
        orgId: orgA,
        name: "Initial Sequence",
        description: "",
        status: "draft",
        senderType: "system",
        senderUserId: null,
      });
      seqId = seq.id;
    });

    // Update to specific sender
    const res1 = await app.request(`/api/sequences/${seqId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        senderType: "specific",
        senderUserId: "specific-user-a",
      }),
    });
    expect(res1.status).toBe(200);
    const body1 = await res1.json();
    expect(body1.sequence.senderType).toBe("specific");
    expect(body1.sequence.senderUserId).toBe("specific-user-a");

    // Cross-tenant patch attempt (Tenant B cannot patch Tenant A sequence)
    const res2 = await app.request(`/api/sequences/${seqId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${tokenTenantB}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Hacked",
      }),
    });
    // FindOne returns null, so Hono route throws 404
    expect(res2.status).toBe(404);
  });

  it("should execute step sending with dynamic creatorId assignment based on senderType", async () => {
    let leadId = "";
    let _contactId = "";
    let templateId = "";
    let seqSystemId = "";
    let seqOwnerId = "";
    let seqSpecificId = "";

    await withTenant(orgA, mockDb, async () => {
      // Create recipient lead (owned by user-a)
      const lead = await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "specific-user-a", // Dynamic sender target
        status: "New",
        email: "lead@test.com",
        company: "Acme",
        convertedAccountId: null,
        convertedContactId: null,
        custom: null,
      });
      leadId = lead.id;

      // Create recipient contact (owned by user-a)
      const contact = await dbStore.contacts.insert({
        orgId: orgA,
        accountId: "acc-id",
        ownerId: "specific-user-a",
        firstName: "Jane",
        lastName: "Doe",
        email: "jane@test.com",
        custom: null,
      });
      _contactId = contact.id;

      // Create template
      const template = await dbStore.emailTemplates.insert({
        orgId: orgA,
        name: "Welcome",
        subject: "Hello",
        body: "Body",
      });
      templateId = template.id;

      // Create sequences
      const seqSys = await dbStore.marketingSequences.insert({
        orgId: orgA,
        name: "System Seq",
        senderType: "system",
        senderUserId: null,
      });
      seqSystemId = seqSys.id;

      const seqOwn = await dbStore.marketingSequences.insert({
        orgId: orgA,
        name: "Owner Seq",
        senderType: "owner",
        senderUserId: null,
      });
      seqOwnerId = seqOwn.id;

      const seqSpec = await dbStore.marketingSequences.insert({
        orgId: orgA,
        name: "Specific Seq",
        senderType: "specific",
        senderUserId: "user-a",
      });
      seqSpecificId = seqSpec.id;

      // Create steps for each sequence
      await dbStore.marketingSequenceSteps.insert({
        orgId: orgA,
        sequenceId: seqSystemId,
        stepNumber: 1,
        delayDays: 0,
        templateId,
      });

      await dbStore.marketingSequenceSteps.insert({
        orgId: orgA,
        sequenceId: seqOwnerId,
        stepNumber: 1,
        delayDays: 0,
        templateId,
      });

      await dbStore.marketingSequenceSteps.insert({
        orgId: orgA,
        sequenceId: seqSpecificId,
        stepNumber: 1,
        delayDays: 0,
        templateId,
      });
    });

    // 1. Run dynamic system sender execution
    let _membershipSysId = "";
    await withTenant(orgA, mockDb, async () => {
      const m = await dbStore.marketingSequenceMemberships.insert({
        orgId: orgA,
        sequenceId: seqSystemId,
        recordType: "lead",
        recordId: leadId,
        status: "active",
        currentStepNumber: 0,
        nextExecutionAt: new Date(),
      });
      _membershipSysId = m.id;
    });

    const triggerExecRes = await app.request("/api/sequences/execute", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
    });
    expect(triggerExecRes.status).toBe(200);

    // Verify creatorId is system default zero UUID
    await withTenant(orgA, mockDb, async () => {
      const acts = (await dbStore.activities.findMany?.()) || [];
      expect(acts.length).toBe(1);
      expect(acts[0].creatorId).toBe("00000000-0000-0000-0000-000000000000");
    });

    // 2. Run dynamic owner sender execution
    dbStore.clear(); // Clear so we check fresh activity
    // Re-setup needed because we cleared mock DB
    await withTenant(orgA, mockDb, async () => {
      const lead = await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "specific-user-a",
        status: "New",
        email: "lead@test.com",
        company: "Acme",
        convertedAccountId: null,
        convertedContactId: null,
        custom: null,
      });
      leadId = lead.id;

      const template = await dbStore.emailTemplates.insert({
        orgId: orgA,
        name: "Welcome",
        subject: "Hello",
        body: "Body",
      });
      templateId = template.id;

      const seqOwn = await dbStore.marketingSequences.insert({
        orgId: orgA,
        name: "Owner Seq",
        senderType: "owner",
        senderUserId: null,
      });
      seqOwnerId = seqOwn.id;

      await dbStore.marketingSequenceSteps.insert({
        orgId: orgA,
        sequenceId: seqOwnerId,
        stepNumber: 1,
        delayDays: 0,
        templateId,
      });

      await dbStore.marketingSequenceMemberships.insert({
        orgId: orgA,
        sequenceId: seqOwnerId,
        recordType: "lead",
        recordId: leadId,
        status: "active",
        currentStepNumber: 0,
        nextExecutionAt: new Date(),
      });
    });

    const triggerExecRes2 = await app.request("/api/sequences/execute", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
    });
    expect(triggerExecRes2.status).toBe(200);

    // Verify creatorId is specific-user-a (lead owner)
    await withTenant(orgA, mockDb, async () => {
      const acts = (await dbStore.activities.findMany?.()) || [];
      expect(acts.length).toBe(1);
      expect(acts[0].creatorId).toBe("specific-user-a");
    });

    // 3. Run specific sender execution
    dbStore.clear(); // Clear
    await withTenant(orgA, mockDb, async () => {
      const lead = await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "specific-user-a",
        status: "New",
        email: "lead@test.com",
        company: "Acme",
        convertedAccountId: null,
        convertedContactId: null,
        custom: null,
      });
      leadId = lead.id;

      const template = await dbStore.emailTemplates.insert({
        orgId: orgA,
        name: "Welcome",
        subject: "Hello",
        body: "Body",
      });
      templateId = template.id;

      const seqSpec = await dbStore.marketingSequences.insert({
        orgId: orgA,
        name: "Specific Seq",
        senderType: "specific",
        senderUserId: "user-a",
      });
      seqSpecificId = seqSpec.id;

      await dbStore.marketingSequenceSteps.insert({
        orgId: orgA,
        sequenceId: seqSpecificId,
        stepNumber: 1,
        delayDays: 0,
        templateId,
      });

      await dbStore.marketingSequenceMemberships.insert({
        orgId: orgA,
        sequenceId: seqSpecificId,
        recordType: "lead",
        recordId: leadId,
        status: "active",
        currentStepNumber: 0,
        nextExecutionAt: new Date(),
      });
    });

    const triggerExecRes3 = await app.request("/api/sequences/execute", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
    });
    expect(triggerExecRes3.status).toBe(200);

    // Verify creatorId is user-a (specific assigned sender)
    await withTenant(orgA, mockDb, async () => {
      const acts = (await dbStore.activities.findMany?.()) || [];
      expect(acts.length).toBe(1);
      expect(acts[0].creatorId).toBe("user-a");
    });
  });
});
