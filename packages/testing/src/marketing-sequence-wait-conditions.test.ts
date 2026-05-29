import { createSessionToken } from "@crm/auth";
import {
  calculateNextStepExecutionTime,
  enrollInSequence,
  executePendingSequenceSteps,
} from "@crm/core";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";

describe("Marketing Sequence Step Wait Conditions Tests (Task 0191)", () => {
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

  describe("calculateNextStepExecutionTime Utility", () => {
    it("should fallback to static delay if waitCondition is undefined", () => {
      const now = new Date("2026-05-29T10:00:00Z"); // Thursday
      const target = calculateNextStepExecutionTime(now, 2);
      expect(target.toISOString()).toBe("2026-05-31T10:00:00.000Z"); // Saturday
    });

    it("should calculate correctly for day_of_week waitType", () => {
      const now = new Date("2026-05-29T10:00:00Z"); // Thursday (getDay = 4)
      // Wait for Monday (getDay = 1), with delayDays = 1.
      // now + 1 day = Friday (getDay = 5)
      // Next Monday after Friday is Monday, June 1st.
      const target = calculateNextStepExecutionTime(now, 1, {
        waitType: "day_of_week",
        daysOfWeek: [1],
      });
      expect(target.getDay()).toBe(1);
      expect(target.getDate()).toBe(1); // June 1st
    });

    it("should set timeOfDay correctly if provided", () => {
      const now = new Date("2026-05-29T10:00:00Z"); // Thursday
      const target = calculateNextStepExecutionTime(now, 1, {
        waitType: "day_of_week",
        daysOfWeek: [1], // Monday
        timeOfDay: "09:30",
      });
      expect(target.getDay()).toBe(1);
      expect(target.getHours()).toBe(9);
      expect(target.getMinutes()).toBe(30);
    });
  });

  describe("executePendingSequenceSteps Integration", () => {
    it("should dynamically calculate the next step's execution time using waitCondition during execution", async () => {
      await withTenant(orgA, mockDb, async () => {
        // 1. Create recipient
        const lead = await dbStore.leads.insert({
          orgId: orgA,
          ownerId: "user-a",
          email: "wait@tenant-a.com",
          status: "New",
        });

        // 2. Create sequence
        const seq = await dbStore.marketingSequences.insert({
          orgId: orgA,
          name: "Dynamic Waiting Journey",
          description: "Testing wait conditions",
          status: "active",
        });

        // 3. Create email templates
        const welcomeTemplate = await dbStore.emailTemplates.insert({
          orgId: orgA,
          name: "Welcome",
          subject: "Hello!",
          body: "Welcome email",
        });

        const followUpTemplate = await dbStore.emailTemplates.insert({
          orgId: orgA,
          name: "Follow-up",
          subject: "Let's connect!",
          body: "Follow up",
        });

        // 4. Create sequence steps
        await dbStore.marketingSequenceSteps.insert({
          orgId: orgA,
          sequenceId: seq.id,
          stepNumber: 1,
          delayDays: 0,
          templateId: welcomeTemplate.id,
        });

        await dbStore.marketingSequenceSteps.insert({
          orgId: orgA,
          sequenceId: seq.id,
          stepNumber: 2,
          delayDays: 2, // 2 days cooldown
          templateId: followUpTemplate.id,
          waitCondition: {
            waitType: "day_of_week",
            daysOfWeek: [1], // Wait until next Monday
            timeOfDay: "08:00",
          },
        });

        // 5. Enroll lead
        const membership = await enrollInSequence(
          dbStore,
          orgA,
          seq.id,
          "lead",
          lead.id,
        );

        const baseTime = new Date("2026-05-28T10:00:00Z"); // Thursday

        // Force membership nextExecutionAt to baseTime to make it pending
        await dbStore.marketingSequenceMemberships.update(membership.id, {
          nextExecutionAt: baseTime,
        });

        // 6. Execute step 1.
        const processed = await executePendingSequenceSteps(dbStore, baseTime);
        expect(processed).toBe(1);

        // 7. Verify membership next execution is scheduled for Monday June 1st at 08:00 AM
        // baseTime + 2 delayDays = Saturday (May 30th).
        // Next Monday after Saturday is June 1st.
        const updated = await dbStore.marketingSequenceMemberships.findOne(
          membership.id,
        );
        expect(updated).not.toBeNull();
        expect(updated?.status).toBe("active");
        expect(updated?.currentStepNumber).toBe(1);

        const nextExec = new Date(updated?.nextExecutionAt || "");
        expect(nextExec.getDay()).toBe(1); // Monday
        expect(nextExec.getHours()).toBe(8);
        expect(nextExec.getMinutes()).toBe(0);
      });
    });
  });

  describe("API and RLS boundaries", () => {
    it("should prevent Tenant B from inserting or viewing Tenant A's step wait conditions", async () => {
      let stepIdTenantA = "";

      // 1. Setup Tenant A
      await withTenant(orgA, mockDb, async () => {
        const seq = await dbStore.marketingSequences.insert({
          orgId: orgA,
          name: "Sequence A",
          description: "Tenancy Test",
          status: "active",
        });

        const template = await dbStore.emailTemplates.insert({
          orgId: orgA,
          name: "Temp",
          subject: "Subj",
          body: "Body",
        });

        const step = await dbStore.marketingSequenceSteps.insert({
          orgId: orgA,
          sequenceId: seq.id,
          stepNumber: 1,
          delayDays: 1,
          templateId: template.id,
          waitCondition: {
            waitType: "day_of_week",
            daysOfWeek: [3],
            timeOfDay: "14:00",
          },
        });
        stepIdTenantA = step.id;
      });

      // 2. Accessing Tenant A step under Tenant B context MUST fail RLS
      await withTenant(orgB, mockDb, async () => {
        const step =
          await dbStore.marketingSequenceSteps.findOne(stepIdTenantA);
        expect(step).toBeNull();
      });
    });
  });
});
