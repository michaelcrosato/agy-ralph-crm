import { createSessionToken } from "@crm/auth";
import { executePendingSequenceSteps } from "@crm/core";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestApp } from "./_harness";

const app = createTestApp();

describe("Marketing Sequence A/B Split Testing Engine API & Logic Tests (Task 0182)", () => {
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

  it("should support CRUD on split-test configurations with strict RLS isolation", async () => {
    let seqId = "";
    let stepId = "";
    let templateId = "";
    let variantTemplateId = "";

    await withTenant(orgA, mockDb, async () => {
      const templateA = await dbStore.emailTemplates.insert({
        orgId: orgA,
        name: "Template A",
        subject: "Subject A",
        body: "Body A",
      });
      templateId = templateA.id;

      const templateB = await dbStore.emailTemplates.insert({
        orgId: orgA,
        name: "Template B",
        subject: "Subject B",
        body: "Body B",
      });
      variantTemplateId = templateB.id;

      const seq = await dbStore.marketingSequences.insert({
        orgId: orgA,
        name: "Welcome Drip",
        description: "Welcome sequence",
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
      stepId = step.id;
    });

    // 1. Create split-test via POST API
    const createRes = await app.request(
      `/api/sequences/${seqId}/steps/${stepId}/split-test`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          variantTemplateId,
          splitWeight: 50,
          isActive: 1,
        }),
      },
    );
    expect(createRes.status).toBe(200);
    const createData = await createRes.json();
    expect(createData.success).toBe(true);
    expect(createData.data.variantTemplateId).toBe(variantTemplateId);
    expect(createData.data.splitWeight).toBe(50);
    expect(createData.data.isActive).toBe(1);

    // 2. Read split-test via GET API
    const getRes = await app.request(
      `/api/sequences/${seqId}/steps/${stepId}/split-test`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      },
    );
    expect(getRes.status).toBe(200);
    const getData = await getRes.json();
    expect(getData.success).toBe(true);
    expect(getData.data.variantTemplateId).toBe(variantTemplateId);

    // 3. Verify Tenant Isolation (Tenant B trying to access Tenant A's split-test)
    const badGetRes = await app.request(
      `/api/sequences/${seqId}/steps/${stepId}/split-test`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
        },
      },
    );
    expect(badGetRes.status).toBe(404);

    const badCreateRes = await app.request(
      `/api/sequences/${seqId}/steps/${stepId}/split-test`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          variantTemplateId,
          splitWeight: 50,
          isActive: 1,
        }),
      },
    );
    expect(badCreateRes.status).toBe(404);
  });

  it("should dynamically allocate variant B template when splitWeight is 100", async () => {
    let seqId = "";
    let stepId = "";
    let templateId = "";
    let variantTemplateId = "";
    let leadId = "";
    let membershipId = "";

    await withTenant(orgA, mockDb, async () => {
      const templateA = await dbStore.emailTemplates.insert({
        orgId: orgA,
        name: "Default A",
        subject: "Welcome Default",
        body: "Hello default",
      });
      templateId = templateA.id;

      const templateB = await dbStore.emailTemplates.insert({
        orgId: orgA,
        name: "Variant B",
        subject: "Welcome Variant",
        body: "Hello variant",
      });
      variantTemplateId = templateB.id;

      const seq = await dbStore.marketingSequences.insert({
        orgId: orgA,
        name: "Welcome Drip",
        description: "Welcome sequence",
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
      stepId = step.id;

      await dbStore.marketingSequenceStepSplitTests.insert({
        orgId: orgA,
        stepId,
        variantTemplateId,
        splitWeight: 100, // 100% variant B
        isActive: 1,
      });

      const lead = await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "user-a",
        status: "New",
        email: "prospect@test.com",
        company: "Test Corp",
        convertedAccountId: null,
        convertedContactId: null,
        custom: null,
      });
      leadId = lead.id;

      const memb = await dbStore.marketingSequenceMemberships.insert({
        orgId: orgA,
        sequenceId: seqId,
        recordType: "lead",
        recordId: leadId,
        status: "active",
        currentStepNumber: 0,
        lastExecutedAt: null,
        nextExecutionAt: new Date(),
      });
      membershipId = memb.id;

      const processed = await executePendingSequenceSteps(dbStore, new Date());
      expect(processed).toBe(1);

      // Verify that variant B was chosen and allocated
      const alloc =
        await dbStore.marketingSequenceAbAllocations.findForMemberAndStep(
          membershipId,
          stepId,
        );
      expect(alloc).not.toBeNull();
      expect(alloc?.allocatedTemplateId).toBe(variantTemplateId);

      // Verify activity subject uses the variant subject
      const activities = await dbStore.activities.findMany();
      expect(activities.length).toBe(1);
      expect(activities[0].subject).toBe("Welcome Variant");
    });
  });

  it("should dynamically allocate default A template when splitWeight is 0", async () => {
    let seqId = "";
    let stepId = "";
    let templateId = "";
    let variantTemplateId = "";
    let leadId = "";
    let membershipId = "";

    await withTenant(orgA, mockDb, async () => {
      const templateA = await dbStore.emailTemplates.insert({
        orgId: orgA,
        name: "Default A",
        subject: "Welcome Default",
        body: "Hello default",
      });
      templateId = templateA.id;

      const templateB = await dbStore.emailTemplates.insert({
        orgId: orgA,
        name: "Variant B",
        subject: "Welcome Variant",
        body: "Hello variant",
      });
      variantTemplateId = templateB.id;

      const seq = await dbStore.marketingSequences.insert({
        orgId: orgA,
        name: "Welcome Drip",
        description: "Welcome sequence",
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
      stepId = step.id;

      await dbStore.marketingSequenceStepSplitTests.insert({
        orgId: orgA,
        stepId,
        variantTemplateId,
        splitWeight: 0, // 0% variant B (always default A)
        isActive: 1,
      });

      const lead = await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "user-a",
        status: "New",
        email: "prospect2@test.com",
        company: "Test Corp 2",
        convertedAccountId: null,
        convertedContactId: null,
        custom: null,
      });
      leadId = lead.id;

      const memb = await dbStore.marketingSequenceMemberships.insert({
        orgId: orgA,
        sequenceId: seqId,
        recordType: "lead",
        recordId: leadId,
        status: "active",
        currentStepNumber: 0,
        lastExecutedAt: null,
        nextExecutionAt: new Date(),
      });
      membershipId = memb.id;

      const processed = await executePendingSequenceSteps(dbStore, new Date());
      expect(processed).toBe(1);

      // Verify that default A was chosen and allocated
      const alloc =
        await dbStore.marketingSequenceAbAllocations.findForMemberAndStep(
          membershipId,
          stepId,
        );
      expect(alloc).not.toBeNull();
      expect(alloc?.allocatedTemplateId).toBe(templateId);

      // Verify activity subject uses the default subject
      const activities = await dbStore.activities.findMany();
      expect(activities.length).toBe(1);
      expect(activities[0].subject).toBe("Welcome Default");
    });
  });

  it("should reuse existing allocation for consistent templates across runs", async () => {
    let seqId = "";
    let stepId = "";
    let templateId = "";
    let variantTemplateId = "";
    let leadId = "";
    let membershipId = "";

    await withTenant(orgA, mockDb, async () => {
      const templateA = await dbStore.emailTemplates.insert({
        orgId: orgA,
        name: "Default A",
        subject: "Welcome Default",
        body: "Hello default",
      });
      templateId = templateA.id;

      const templateB = await dbStore.emailTemplates.insert({
        orgId: orgA,
        name: "Variant B",
        subject: "Welcome Variant",
        body: "Hello variant",
      });
      variantTemplateId = templateB.id;

      const seq = await dbStore.marketingSequences.insert({
        orgId: orgA,
        name: "Welcome Drip",
        description: "Welcome sequence",
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
      stepId = step.id;

      await dbStore.marketingSequenceStepSplitTests.insert({
        orgId: orgA,
        stepId,
        variantTemplateId,
        splitWeight: 50,
        isActive: 1,
      });

      const lead = await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "user-a",
        status: "New",
        email: "prospect3@test.com",
        company: "Test Corp 3",
        convertedAccountId: null,
        convertedContactId: null,
        custom: null,
      });
      leadId = lead.id;

      const memb = await dbStore.marketingSequenceMemberships.insert({
        orgId: orgA,
        sequenceId: seqId,
        recordType: "lead",
        recordId: leadId,
        status: "active",
        currentStepNumber: 0,
        lastExecutedAt: null,
        nextExecutionAt: new Date(),
      });
      membershipId = memb.id;

      // Pre-allocate to Variant B
      await dbStore.marketingSequenceAbAllocations.insert({
        orgId: orgA,
        membershipId,
        stepId,
        allocatedTemplateId: variantTemplateId,
      });

      const processed = await executePendingSequenceSteps(dbStore, new Date());
      expect(processed).toBe(1);

      // Verify activity subject uses the pre-allocated variant B template
      const activities = await dbStore.activities.findMany();
      expect(activities.length).toBe(1);
      expect(activities[0].subject).toBe("Welcome Variant");
    });
  });

  it("should support manual allocation via POST API with strict tenant isolation", async () => {
    let seqId = "";
    let stepId = "";
    let templateId = "";
    let variantTemplateId = "";
    let leadId = "";
    let membershipId = "";

    await withTenant(orgA, mockDb, async () => {
      const templateA = await dbStore.emailTemplates.insert({
        orgId: orgA,
        name: "Default A",
        subject: "Welcome Default",
        body: "Hello default",
      });
      templateId = templateA.id;

      const templateB = await dbStore.emailTemplates.insert({
        orgId: orgA,
        name: "Variant B",
        subject: "Welcome Variant",
        body: "Hello variant",
      });
      variantTemplateId = templateB.id;

      const seq = await dbStore.marketingSequences.insert({
        orgId: orgA,
        name: "Welcome Drip",
        description: "Welcome sequence",
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
      stepId = step.id;

      const lead = await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "user-a",
        status: "New",
        email: "prospect4@test.com",
        company: "Test Corp 4",
        convertedAccountId: null,
        convertedContactId: null,
        custom: null,
      });
      leadId = lead.id;

      const memb = await dbStore.marketingSequenceMemberships.insert({
        orgId: orgA,
        sequenceId: seqId,
        recordType: "lead",
        recordId: leadId,
        status: "active",
        currentStepNumber: 0,
        lastExecutedAt: null,
        nextExecutionAt: new Date(),
      });
      membershipId = memb.id;
    });

    // 1. Manually allocate to Variant B via API
    const allocateRes = await app.request(
      `/api/sequences/${seqId}/steps/${stepId}/split-test/allocate`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          membershipId,
          allocatedTemplateId: variantTemplateId,
        }),
      },
    );
    expect(allocateRes.status).toBe(200);
    const allocateData = await allocateRes.json();
    expect(allocateData.success).toBe(true);
    expect(allocateData.data.allocatedTemplateId).toBe(variantTemplateId);

    // 2. Tenant B attempting to allocate on Tenant A's resource should fail
    const badAllocateRes = await app.request(
      `/api/sequences/${seqId}/steps/${stepId}/split-test/allocate`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          membershipId,
          allocatedTemplateId: variantTemplateId,
        }),
      },
    );
    expect(badAllocateRes.status).toBe(404);
  });
});
