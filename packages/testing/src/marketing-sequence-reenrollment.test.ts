import { createSessionToken } from "@crm/auth";
import { enrollInSequence, executePendingSequenceSteps } from "@crm/core";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";

describe("Marketing Sequence Automated Re-Enrollment & Frequency Capping Controls Tests (Task 0190)", () => {
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

  it("should prevent multiple active concurrent enrollments for the same recipient in a sequence", async () => {
    let leadId = "";
    let sequenceId = "";

    await withTenant(orgA, mockDb, async () => {
      // 1. Create a lead
      const lead = await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "user-a",
        email: "lead1@tenant-a.com",
        status: "New",
      });
      leadId = lead.id;

      // 2. Create a sequence
      const seq = await dbStore.marketingSequences.insert({
        orgId: orgA,
        name: "Onboarding Campaign",
        description: "Welcome to Acme",
        status: "active",
        allowReenrollment: true,
      });
      sequenceId = seq.id;

      // 3. Create a step
      const template = await dbStore.emailTemplates.insert({
        orgId: orgA,
        name: "Welcome",
        subject: "Hello!",
        body: "Acme onboarding",
      });
      await dbStore.marketingSequenceSteps.insert({
        orgId: orgA,
        sequenceId: seq.id,
        stepNumber: 1,
        delayDays: 0,
        templateId: template.id,
      });

      // 4. First enrollment (active)
      const m1 = await enrollInSequence(dbStore, orgA, seq.id, "lead", lead.id);
      expect(m1.status).toBe("active");

      // 5. Try to enroll again while active -> MUST fail
      await expect(
        enrollInSequence(dbStore, orgA, seq.id, "lead", lead.id),
      ).rejects.toThrow(
        "Recipient is already actively enrolled in this sequence",
      );
    });
  });

  it("should prevent re-enrollment if allowReenrollment is false", async () => {
    await withTenant(orgA, mockDb, async () => {
      const lead = await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "user-a",
        email: "lead2@tenant-a.com",
        status: "New",
      });

      const seq = await dbStore.marketingSequences.insert({
        orgId: orgA,
        name: "No-Reentry Sequence",
        description: "Once in, never again",
        status: "active",
        allowReenrollment: false, // Default is false, explicitly setting here
      });

      const template = await dbStore.emailTemplates.insert({
        orgId: orgA,
        name: "Welcome",
        subject: "Hello!",
        body: "Acme onboarding",
      });
      await dbStore.marketingSequenceSteps.insert({
        orgId: orgA,
        sequenceId: seq.id,
        stepNumber: 1,
        delayDays: 0,
        templateId: template.id,
      });

      // 1. Initial enrollment
      const m1 = await enrollInSequence(dbStore, orgA, seq.id, "lead", lead.id);
      expect(m1.status).toBe("active");

      // 2. Mock completion of initial membership
      await dbStore.marketingSequenceMemberships.update(m1.id, {
        status: "completed",
      });

      // 3. Attempt re-enrollment -> MUST fail
      await expect(
        enrollInSequence(dbStore, orgA, seq.id, "lead", lead.id),
      ).rejects.toThrow("Re-enrollment is not allowed for this sequence");
    });
  });

  it("should enforce frequency capping cooldown window", async () => {
    await withTenant(orgA, mockDb, async () => {
      const lead = await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "user-a",
        email: "lead3@tenant-a.com",
        status: "New",
      });

      const seq = await dbStore.marketingSequences.insert({
        orgId: orgA,
        name: "Cooldown Campaign",
        description: "Re-enrollable but with 30 days gap",
        status: "active",
        allowReenrollment: true,
        reenrollmentMinDays: 30,
      });

      const template = await dbStore.emailTemplates.insert({
        orgId: orgA,
        name: "Welcome",
        subject: "Hello!",
        body: "Acme onboarding",
      });
      await dbStore.marketingSequenceSteps.insert({
        orgId: orgA,
        sequenceId: seq.id,
        stepNumber: 1,
        delayDays: 0,
        templateId: template.id,
      });

      // 1. Initial enrollment
      const m1 = await enrollInSequence(dbStore, orgA, seq.id, "lead", lead.id);
      expect(m1.status).toBe("active");

      // 2. Complete the sequence membership
      await dbStore.marketingSequenceMemberships.update(m1.id, {
        status: "completed",
      });

      // 3. Attempt re-enrollment immediately (0 days elapsed) -> MUST breach frequency cap
      await expect(
        enrollInSequence(dbStore, orgA, seq.id, "lead", lead.id),
      ).rejects.toThrow(
        "Frequency cap breached: recipient was recently enrolled and must wait at least 30 days before re-enrolling",
      );

      // 4. Mock membership updatedAt to represent 31 days ago
      const thirtyOneDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);

      // Directly manipulate store to override dates
      const memberships = await dbStore.marketingSequenceMemberships.findMany();
      const match = memberships.find((m) => m.id === m1.id);
      if (match) {
        match.createdAt = thirtyOneDaysAgo;
        match.updatedAt = thirtyOneDaysAgo;
      }

      // 5. Attempt re-enrollment again -> MUST succeed
      const m2 = await enrollInSequence(dbStore, orgA, seq.id, "lead", lead.id);
      expect(m2.status).toBe("active");
      expect(m2.id).not.toBe(m1.id);
    });
  });

  it("should enforce RLS boundaries: Tenant B cannot query or interfere with Tenant A re-enrollment constraints", async () => {
    let leadIdTenantA = "";
    let sequenceIdTenantA = "";

    // 1. Setup Tenant A
    await withTenant(orgA, mockDb, async () => {
      const lead = await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "user-a",
        email: "rls@tenant-a.com",
        status: "New",
      });
      leadIdTenantA = lead.id;

      const seq = await dbStore.marketingSequences.insert({
        orgId: orgA,
        name: "Tenant A Sequence",
        description: "Tenancy RLS Test",
        status: "active",
        allowReenrollment: false, // Re-enrollment disabled
      });
      sequenceIdTenantA = seq.id;

      const template = await dbStore.emailTemplates.insert({
        orgId: orgA,
        name: "Welcome",
        subject: "Hello!",
        body: "Acme onboarding",
      });
      await dbStore.marketingSequenceSteps.insert({
        orgId: orgA,
        sequenceId: seq.id,
        stepNumber: 1,
        delayDays: 0,
        templateId: template.id,
      });

      // Enroll lead in Tenant A
      await enrollInSequence(dbStore, orgA, seq.id, "lead", lead.id);
    });

    // 2. Accessing from Tenant B context -> enrolling lead in Tenant A's sequence MUST fail due to RLS
    await withTenant(orgB, mockDb, async () => {
      // Trying to enroll Tenant A's lead into Tenant A's sequence under Tenant B context
      // should fail because Tenant A's sequence is not visible to Tenant B
      await expect(
        enrollInSequence(
          dbStore,
          orgB,
          sequenceIdTenantA,
          "lead",
          leadIdTenantA,
        ),
      ).rejects.toThrow();
    });
  });
});
