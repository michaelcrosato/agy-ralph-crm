import { createSessionToken } from "@crm/auth";
import { executePendingSequenceSteps } from "@crm/core";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestApp } from "./_harness";

const app = createTestApp();

describe("Marketing Sequence Conversion Goals & Attribution Engine API & Logic Tests (Task 0184)", () => {
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

  it("should support CRUD on sequence conversion goals with strict tenant RLS isolation", async () => {
    let seqId = "";

    await withTenant(orgA, mockDb, async () => {
      const seq = await dbStore.marketingSequences.insert({
        orgId: orgA,
        name: "Enterprise Sequence",
        description: "B2B enterprise sequence",
        status: "active",
      });
      seqId = seq.id;
    });

    // 1. Create conversion goal via POST API
    const createRes = await app.request(`/api/sequences/${seqId}/goals`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        goalType: "lead_status_equals",
        targetValue: "Qualified",
      }),
    });
    expect(createRes.status).toBe(200);
    const createData = await createRes.json();
    expect(createData.success).toBe(true);
    expect(createData.data.goalType).toBe("lead_status_equals");
    expect(createData.data.targetValue).toBe("Qualified");

    // 2. Read conversion goal via GET API
    const getRes = await app.request(`/api/sequences/${seqId}/goals`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
      },
    });
    expect(getRes.status).toBe(200);
    const getData = await getRes.json();
    expect(getData.success).toBe(true);
    expect(getData.data).toHaveLength(1);
    expect(getData.data[0].goalType).toBe("lead_status_equals");
    expect(getData.data[0].targetValue).toBe("Qualified");

    // 3. Verify Tenant RLS: Tenant B cannot access Tenant A's goals
    const getResTenantB = await app.request(`/api/sequences/${seqId}/goals`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantB}`,
      },
    });
    expect(getResTenantB.status).toBe(404); // returns Sequence not found because Sequence findOne blocks across tenants
  });

  it("should dynamically trigger lead status goals, update status to converted, and compute analytics", async () => {
    let seqId = "";
    let leadId = "";
    let templateId = "";
    let membershipId = "";

    await withTenant(orgA, mockDb, async () => {
      const template = await dbStore.emailTemplates.insert({
        orgId: orgA,
        name: "Welcome",
        subject: "Welcome subject",
        body: "body",
      });
      templateId = template.id;

      const seq = await dbStore.marketingSequences.insert({
        orgId: orgA,
        name: "Qualified Lead Journey",
        description: "Drips leads to qualify",
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

      // Define goal: Lead status must equal "Qualified"
      await dbStore.marketingSequenceGoals.insert({
        orgId: orgA,
        sequenceId: seqId,
        goalType: "lead_status_equals",
        targetValue: "Qualified",
        isActive: 1,
      });

      const lead = await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "user-a",
        status: "Qualified", // immediately Qualified to meet the goal
        email: "lead@example.com",
        company: "Acme Corp",
        convertedAccountId: null,
        convertedContactId: null,
        custom: null,
      });
      leadId = lead.id;

      const membership = await dbStore.marketingSequenceMemberships.insert({
        orgId: orgA,
        sequenceId: seqId,
        recordType: "lead",
        recordId: leadId,
        status: "active",
        currentStepNumber: 0,
        lastExecutedAt: null,
        nextExecutionAt: new Date(Date.now() - 5000), // due now
      });
      membershipId = membership.id;
    });

    // Run pending steps loop (should trigger goal conversion instead of email sending)
    let runRes = 0;
    await withTenant(orgA, mockDb, async () => {
      runRes = await executePendingSequenceSteps(dbStore, new Date());
    });
    expect(runRes).toBe(1);

    // Verify membership was converted and logged in conversions
    await withTenant(orgA, mockDb, async () => {
      const updatedMemb =
        await dbStore.marketingSequenceMemberships.findOne(membershipId);
      expect(updatedMemb?.status).toBe("converted");

      const conversions =
        await dbStore.marketingSequenceConversions.findForSequence(seqId);
      expect(conversions).toHaveLength(1);
      expect(conversions[0].membershipId).toBe(membershipId);
      expect(conversions[0].attributedRevenue).toBe("0.00");

      // Verify audit log
      const logs = await dbStore.auditLogs.findMany();
      const goalLog = logs.find((l) => l.action === "goal_conversion");
      expect(goalLog).toBeDefined();
      expect(goalLog?.recordId).toBe(membershipId);
      expect(goalLog?.changes.status.after).toBe("converted");
    });

    // Check Hono conversion analytics endpoint
    const analyticsRes = await app.request(
      `/api/sequences/${seqId}/conversion-analytics`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      },
    );
    expect(analyticsRes.status).toBe(200);
    const analyticsData = await analyticsRes.json();
    expect(analyticsData.success).toBe(true);
    expect(analyticsData.data.totalEnrolled).toBe(1);
    expect(analyticsData.data.convertedCount).toBe(1);
    expect(analyticsData.data.conversionRate).toBe("100.00%");
    expect(analyticsData.data.totalAttributedRevenue).toBe("0.00");
  });

  it("should dynamically trigger opportunity_created goals and attribute close amount to revenue", async () => {
    let seqId = "";
    let leadId = "";
    let templateId = "";
    let _membershipId = "";

    await withTenant(orgA, mockDb, async () => {
      const template = await dbStore.emailTemplates.insert({
        orgId: orgA,
        name: "Drip Test",
        subject: "drip subject",
        body: "body",
      });
      templateId = template.id;

      const seq = await dbStore.marketingSequences.insert({
        orgId: orgA,
        name: "Opportunity Drip",
        description: "Drip to opportunity",
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

      // Goal: Opportunity Created
      await dbStore.marketingSequenceGoals.insert({
        orgId: orgA,
        sequenceId: seqId,
        goalType: "opportunity_created",
        targetValue: null,
        isActive: 1,
      });

      const lead = await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "user-a",
        status: "Contacted",
        email: "contacted@example.com",
        company: "Acme LLC",
        convertedAccountId: null,
        convertedContactId: null,
        custom: null,
      });
      leadId = lead.id;

      // Create an opportunity linked to this lead in custom JSONB fields
      await dbStore.opportunities.insert({
        orgId: orgA,
        ownerId: "user-a",
        name: "Enterprise Software Deal",
        stage: "Qualification",
        amount: "15500.50",
        closeDate: null,
        accountId: "dummy-acc",
        custom: {
          sourceLeadId: leadId,
        },
      });

      const membership = await dbStore.marketingSequenceMemberships.insert({
        orgId: orgA,
        sequenceId: seqId,
        recordType: "lead",
        recordId: leadId,
        status: "active",
        currentStepNumber: 0,
        lastExecutedAt: null,
        nextExecutionAt: new Date(Date.now() - 5000),
      });
      _membershipId = membership.id;
    });

    let runRes = 0;
    await withTenant(orgA, mockDb, async () => {
      runRes = await executePendingSequenceSteps(dbStore, new Date());
    });
    expect(runRes).toBe(1);

    // Verify conversion metrics and revenue attribution
    const analyticsRes = await app.request(
      `/api/sequences/${seqId}/conversion-analytics`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      },
    );
    expect(analyticsRes.status).toBe(200);
    const analyticsData = await analyticsRes.json();
    expect(analyticsData.success).toBe(true);
    expect(analyticsData.data.totalEnrolled).toBe(1);
    expect(analyticsData.data.convertedCount).toBe(1);
    expect(analyticsData.data.conversionRate).toBe("100.00%");
    expect(analyticsData.data.totalAttributedRevenue).toBe("15500.50");
  });
});
