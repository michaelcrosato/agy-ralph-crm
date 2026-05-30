import { createSessionToken } from "@crm/auth";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestApp } from "./_harness";

const app = createTestApp();

describe("Marketing Sequence Bounce & Spam Protection / Handling Tests (Task 0188)", () => {
  let tokenTenantA: string;
  let _tokenTenantB: string;

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

    _tokenTenantB = await createSessionToken({
      userId: "user-b",
      orgId: orgB,
      roleId: "role-b",
      permissionsMask: 7,
    });
  });

  it("should process bounce webhooks and suppress active/snoozed sequence memberships under RLS tenant isolation", async () => {
    let leadId = "";
    let contactId = "";
    let _sequenceId = "";
    let activeMembershipId = "";
    let snoozedMembershipId = "";

    // 1. Setup Tenant A Records
    await withTenant(orgA, mockDb, async () => {
      // Create lead and contact
      const lead = await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "user-a",
        email: "target@tenant-a.com",
        status: "New",
        custom: {},
      });
      leadId = lead.id;

      const contact = await dbStore.contacts.insert({
        orgId: orgA,
        ownerId: "user-a",
        firstName: "Alice",
        lastName: "Smith",
        email: "target@tenant-a.com",
        custom: {},
      });
      contactId = contact.id;

      // Create sequence
      const seq = await dbStore.marketingSequences.insert({
        orgId: orgA,
        name: "Acme High Value Sequence",
        description: "B2B Marketing sequence",
        status: "active",
      });
      _sequenceId = seq.id;

      // Enroll Lead (Active)
      const m1 = await dbStore.marketingSequenceMemberships.insert({
        orgId: orgA,
        sequenceId: seq.id,
        recordType: "lead",
        recordId: lead.id,
        status: "active",
        currentStepNumber: 1,
        nextExecutionAt: new Date(Date.now() + 86400000),
      });
      activeMembershipId = m1.id;

      // Enroll Contact (Snoozed)
      const m2 = await dbStore.marketingSequenceMemberships.insert({
        orgId: orgA,
        sequenceId: seq.id,
        recordType: "contact",
        recordId: contact.id,
        status: "snoozed",
        currentStepNumber: 1,
        nextExecutionAt: new Date(Date.now() + 86400000),
        snoozeUntil: new Date(Date.now() + 86400000),
        snoozeReason: "temporary",
      });
      snoozedMembershipId = m2.id;
    });

    // 2. Setup Tenant B Records to verify Tenant separation
    let leadTenantBId = "";
    let activeMembershipBId = "";
    await withTenant(orgB, mockDb, async () => {
      const leadB = await dbStore.leads.insert({
        orgId: orgB,
        ownerId: "user-b",
        email: "target@tenant-a.com", // same email address, but different tenant org!
        status: "New",
        custom: {},
      });
      leadTenantBId = leadB.id;

      const seqB = await dbStore.marketingSequences.insert({
        orgId: orgB,
        name: "Tenant B Sequence",
        status: "active",
      });

      const mB = await dbStore.marketingSequenceMemberships.insert({
        orgId: orgB,
        sequenceId: seqB.id,
        recordType: "lead",
        recordId: leadB.id,
        status: "active",
        currentStepNumber: 1,
        nextExecutionAt: new Date(Date.now() + 86400000),
      });
      activeMembershipBId = mB.id;
    });

    // 3. Post a bounce event as Tenant A
    const res = await app.request("/api/sequences/email-event", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "target@tenant-a.com",
        event: "bounce",
        reason: "550 5.1.1 User Unknown",
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.suppressionsCreated).toBe(2); // Lead and Contact
    expect(data.data.membershipsExited).toBe(2); // Active and Snoozed memberships in Tenant A

    // 4. Verify updates in Tenant A
    await withTenant(orgA, mockDb, async () => {
      // Verify suppressions created
      const suppressions =
        await dbStore.marketingSequenceSuppressions.findMany();
      expect(suppressions.length).toBe(2);
      expect(
        suppressions.every(
          (s) =>
            s.orgId === orgA &&
            s.pattern === "target@tenant-a.com" &&
            s.reason === "bounce",
        ),
      ).toBe(true);

      // Verify Lead updated
      const lead = await dbStore.leads.findOne(leadId);
      expect(lead?.custom?.email_status).toBe("bounced");
      expect(lead?.custom?.email_status_reason).toBe("550 5.1.1 User Unknown");

      // Verify Contact updated
      const contact = await dbStore.contacts.findOne(contactId);
      expect(contact?.custom?.email_status).toBe("bounced");
      expect(contact?.custom?.email_status_reason).toBe(
        "550 5.1.1 User Unknown",
      );

      // Verify memberships are exited and cleared
      const m1 =
        await dbStore.marketingSequenceMemberships.findOne(activeMembershipId);
      expect(m1?.status).toBe("exited");
      expect(m1?.nextExecutionAt).toBeNull();
      expect(m1?.snoozeUntil).toBeNull();

      const m2 =
        await dbStore.marketingSequenceMemberships.findOne(snoozedMembershipId);
      expect(m2?.status).toBe("exited");
      expect(m2?.nextExecutionAt).toBeNull();
      expect(m2?.snoozeUntil).toBeNull();

      // Verify audit logs
      const logs = await dbStore.auditLogs.findMany();
      const bounceLogs = logs.filter(
        (l) => l.action === "membership_exit_bounce",
      );
      expect(bounceLogs.length).toBe(2);
      expect(
        bounceLogs.every(
          (l) => l.recordType === "marketing_sequence_memberships",
        ),
      ).toBe(true);
    });

    // 5. Verify Tenant B records remain completely untouched! (Absolute RLS validation)
    await withTenant(orgB, mockDb, async () => {
      // No suppressions created for Tenant B
      const suppressionsB =
        await dbStore.marketingSequenceSuppressions.findMany();
      expect(suppressionsB.length).toBe(0);

      // Lead Custom email_status remains unmodified
      const leadB = await dbStore.leads.findOne(leadTenantBId);
      expect(leadB?.custom?.email_status).toBeUndefined();

      // Sequence membership remains active
      const mB =
        await dbStore.marketingSequenceMemberships.findOne(activeMembershipBId);
      expect(mB?.status).toBe("active");
      expect(mB?.nextExecutionAt).not.toBeNull();
    });
  });

  it("should process spam complaint webhooks and log complaint suppressions", async () => {
    let leadId = "";

    await withTenant(orgA, mockDb, async () => {
      const lead = await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "user-a",
        email: "spammy@tenant-a.com",
        status: "New",
        custom: {},
      });
      leadId = lead.id;
    });

    const res = await app.request("/api/sequences/email-event", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "spammy@tenant-a.com",
        event: "complaint",
        reason: "Marked as spam by user",
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);

    await withTenant(orgA, mockDb, async () => {
      const suppressions =
        await dbStore.marketingSequenceSuppressions.findMany();
      const complaintSup = suppressions.find((s) => s.reason === "complaint");
      expect(complaintSup).toBeDefined();
      expect(complaintSup?.pattern).toBe("spammy@tenant-a.com");

      const lead = await dbStore.leads.findOne(leadId);
      expect(lead?.custom?.email_status).toBe("complained");
      expect(lead?.custom?.email_status_reason).toBe("Marked as spam by user");
    });
  });
});
