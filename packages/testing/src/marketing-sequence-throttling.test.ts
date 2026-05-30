import { createSessionToken } from "@crm/auth";
import { executePendingSequenceSteps } from "@crm/core";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestApp } from "./_harness";

const app = createTestApp();

describe("Marketing Sequence Domain Throttling & Recipient Frequency Capping Tests (Task 0194)", () => {
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

  describe("Throttling & Capping Configuration API", () => {
    it("should support fetching defaults and updating tenant rules with RLS boundaries", async () => {
      // 1. GET returns default cap values when none exist
      const getRes1 = await app.request("/api/sequences/settings/caps", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      });
      expect(getRes1.status).toBe(200);
      const getBody1 = await getRes1.json();
      expect(getBody1.success).toBe(true);
      expect(getBody1.data.domainThrottleLimit).toBe(5);
      expect(getBody1.data.recipientFrequencyCap).toBe(3);

      // 2. POST updates capping configuration for Tenant A
      const postRes1 = await app.request("/api/sequences/settings/caps", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          domainThrottleLimit: 2,
          recipientFrequencyCap: 1,
        }),
      });
      expect(postRes1.status).toBe(200);
      const postBody1 = await postRes1.json();
      expect(postBody1.success).toBe(true);
      expect(postBody1.data.domainThrottleLimit).toBe(2);
      expect(postBody1.data.recipientFrequencyCap).toBe(1);

      // 3. Verify Tenant B is isolated and still sees default rules
      const getResB = await app.request("/api/sequences/settings/caps", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
        },
      });
      expect(getResB.status).toBe(200);
      const getBodyB = await getResB.json();
      expect(getBodyB.success).toBe(true);
      expect(getBodyB.data.domainThrottleLimit).toBe(5); // Default!
      expect(getBodyB.data.recipientFrequencyCap).toBe(3); // Default!

      // 4. Test validation limits (reject negative or zero)
      const invalidRes1 = await app.request("/api/sequences/settings/caps", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          domainThrottleLimit: 0,
        }),
      });
      expect(invalidRes1.status).toBe(400);

      const invalidRes2 = await app.request("/api/sequences/settings/caps", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipientFrequencyCap: -5,
        }),
      });
      expect(invalidRes2.status).toBe(400);
    });
  });

  describe("Core Execution Engine Constraints", () => {
    it("should enforce domain throttling limits by deferring execution and logging audit trails", async () => {
      let leadId1 = "";
      let leadId2 = "";
      let seqId = "";
      let _stepId = "";
      let templateId = "";

      // 1. Setup metadata, sequence, step, and two leads with the same domain (e.g. corp.com)
      await withTenant(orgA, mockDb, async () => {
        const t1 = await dbStore.emailTemplates.insert({
          orgId: orgA,
          name: "Template 1",
          subject: "Hi {{lead.company}}",
          body: "Hello",
        });
        templateId = t1.id;

        const seq = await dbStore.marketingSequences.insert({
          orgId: orgA,
          name: "Domain Throttle Drip",
          description: "Testing domain throttle caps",
          status: "active",
        });
        seqId = seq.id;

        const step = await dbStore.marketingSequenceSteps.insert({
          orgId: orgA,
          sequenceId: seqId,
          stepNumber: 1,
          delayDays: 0,
          templateId,
        });
        _stepId = step.id;

        // Set Domain Limit to 1 for Tenant A
        await dbStore.marketingSequenceCaps.insert({
          orgId: orgA,
          domainThrottleLimit: 1,
          recipientFrequencyCap: 5,
        });

        // Insert Lead 1 and Lead 2 with same domain
        const l1 = await dbStore.leads.insert({
          orgId: orgA,
          ownerId: "user-a",
          status: "New",
          email: "alpha@corp.com",
          company: "Corp Alpha",
          convertedAccountId: null,
          convertedContactId: null,
          custom: null,
        });
        leadId1 = l1.id;

        const l2 = await dbStore.leads.insert({
          orgId: orgA,
          ownerId: "user-a",
          status: "New",
          email: "beta@corp.com",
          company: "Corp Beta",
          convertedAccountId: null,
          convertedContactId: null,
          custom: null,
        });
        leadId2 = l2.id;

        // Enroll both leads
        await dbStore.marketingSequenceMemberships.insert({
          orgId: orgA,
          sequenceId: seqId,
          recordType: "lead",
          recordId: leadId1,
          status: "active",
          currentStepNumber: 0,
          nextExecutionAt: new Date("2026-05-01T00:00:00Z"),
        });

        await dbStore.marketingSequenceMemberships.insert({
          orgId: orgA,
          sequenceId: seqId,
          recordType: "lead",
          recordId: leadId2,
          status: "active",
          currentStepNumber: 0,
          nextExecutionAt: new Date("2026-05-01T00:00:00Z"),
        });
      });

      // 2. Run engine at 2026-05-01T00:00:00Z
      const baseTime = new Date("2026-05-01T00:00:00Z");
      let processed = 0;
      await withTenant(orgA, mockDb, async () => {
        processed = await executePendingSequenceSteps(dbStore, baseTime);
      });
      // One lead will be processed successfully, the second lead will be deferred (since domain limit = 1)
      expect(processed).toBe(1);

      await withTenant(orgA, mockDb, async () => {
        const activities = await dbStore.activities.findMany();
        expect(activities.length).toBe(1); // Only 1 email activity sent!

        const memberships =
          await dbStore.marketingSequenceMemberships.findMany();
        const mAlpha = memberships.find((m) => m.recordId === leadId1);
        const mBeta = memberships.find((m) => m.recordId === leadId2);

        const executed = [mAlpha, mBeta].find(
          (m) => m?.currentStepNumber === 1,
        );
        const deferred = [mAlpha, mBeta].find(
          (m) => m?.currentStepNumber === 0,
        );

        expect(executed).toBeDefined();
        expect(deferred).toBeDefined();
        expect(deferred?.status).toBe("active");

        // Deferred nextExecutionAt should be exactly +24 hours
        const expectedNextExec = new Date(
          baseTime.getTime() + 24 * 60 * 60 * 1000,
        );
        expect(new Date(deferred?.nextExecutionAt).getTime()).toBe(
          expectedNextExec.getTime(),
        );

        // Verify audit log entry
        const logs = await dbStore.auditLogs.findMany();
        const deferralLog = logs.find(
          (log) =>
            log.recordId === deferred?.id &&
            log.action === "deferred_domain_throttle",
        );
        expect(deferralLog).toBeDefined();
        expect(deferralLog?.changes.domain.after).toBe("corp.com");
        expect(deferralLog?.changes.sentCount.after).toBe(1);
        expect(deferralLog?.changes.limit.after).toBe(1);
      });
    });

    it("should enforce recipient frequency capping limits by deferring execution and logging audit trails", async () => {
      let contactId = "";
      let seqId = "";
      let _stepId1 = "";
      let _stepId2 = "";
      let templateId1 = "";
      let templateId2 = "";

      // 1. Setup contact, sequence, and two steps (delayDays = 0)
      await withTenant(orgA, mockDb, async () => {
        const t1 = await dbStore.emailTemplates.insert({
          orgId: orgA,
          name: "Template 1",
          subject: "Step 1",
          body: "Hello 1",
        });
        templateId1 = t1.id;

        const t2 = await dbStore.emailTemplates.insert({
          orgId: orgA,
          name: "Template 2",
          subject: "Step 2",
          body: "Hello 2",
        });
        templateId2 = t2.id;

        const seq = await dbStore.marketingSequences.insert({
          orgId: orgA,
          name: "Frequency Cap Drip",
          description: "Testing recipient frequency cap limits",
          status: "active",
        });
        seqId = seq.id;

        _stepId1 = (
          await dbStore.marketingSequenceSteps.insert({
            orgId: orgA,
            sequenceId: seqId,
            stepNumber: 1,
            delayDays: 0,
            templateId: templateId1,
          })
        ).id;

        _stepId2 = (
          await dbStore.marketingSequenceSteps.insert({
            orgId: orgA,
            sequenceId: seqId,
            stepNumber: 2,
            delayDays: 0,
            templateId: templateId2,
          })
        ).id;

        // Set Recipient Frequency Cap to 1 (Max 1 email per recipient per week)
        await dbStore.marketingSequenceCaps.insert({
          orgId: orgA,
          domainThrottleLimit: 10,
          recipientFrequencyCap: 1,
        });

        const contact = await dbStore.contacts.insert({
          orgId: orgA,
          ownerId: "user-a",
          accountId: "acc-123",
          firstName: "John",
          lastName: "Doe",
          email: "john.doe@gmail.com",
          custom: null,
        });
        contactId = contact.id;

        // Enroll Contact at Step 1
        await dbStore.marketingSequenceMemberships.insert({
          orgId: orgA,
          sequenceId: seqId,
          recordType: "contact",
          recordId: contactId,
          status: "active",
          currentStepNumber: 0,
          nextExecutionAt: new Date("2026-05-01T00:00:00Z"),
        });
      });

      // 2. Execute Step 1 at 2026-05-01T00:00:00Z
      const time1 = new Date("2026-05-01T00:00:00Z");
      await withTenant(orgA, mockDb, async () => {
        await executePendingSequenceSteps(dbStore, time1);
      });

      // Verify step 1 executed successfully and contact is on step 2
      await withTenant(orgA, mockDb, async () => {
        const activities = await dbStore.activities.findMany();
        expect(activities.length).toBe(1); // 1 email sent!

        const memberships =
          await dbStore.marketingSequenceMemberships.findMany();
        expect(memberships[0].currentStepNumber).toBe(1);
        expect(memberships[0].status).toBe("active");

        // Artificially reset nextExecutionAt to time1 so it runs step 2 immediately
        await dbStore.marketingSequenceMemberships.update(memberships[0].id, {
          nextExecutionAt: time1,
        });
      });

      // 3. Execute Step 2 at time1. Since they already received 1 email today, recipient cap limit = 1 is violated.
      await withTenant(orgA, mockDb, async () => {
        await executePendingSequenceSteps(dbStore, time1);
      });

      // Assert Step 2 was deferred
      await withTenant(orgA, mockDb, async () => {
        const activities = await dbStore.activities.findMany();
        expect(activities.length).toBe(1); // Still only 1 email activity exists!

        const memberships =
          await dbStore.marketingSequenceMemberships.findMany();
        expect(memberships[0].currentStepNumber).toBe(1); // Stays at 1 (deferred)

        const expectedNextExec = new Date(
          time1.getTime() + 24 * 60 * 60 * 1000,
        );
        expect(new Date(memberships[0].nextExecutionAt).getTime()).toBe(
          expectedNextExec.getTime(),
        );

        // Verify audit log entry
        const logs = await dbStore.auditLogs.findMany();
        const deferralLog = logs.find(
          (log) =>
            log.recordId === memberships[0].id &&
            log.action === "deferred_frequency_cap",
        );
        expect(deferralLog).toBeDefined();
        expect(deferralLog?.changes.recipient.after).toBe("john.doe@gmail.com");
        expect(deferralLog?.changes.sentCount.after).toBe(1);
        expect(deferralLog?.changes.limit.after).toBe(1);
      });
    });
  });
});
