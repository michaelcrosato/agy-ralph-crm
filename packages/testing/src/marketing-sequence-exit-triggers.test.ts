import { createSessionToken } from "@crm/auth";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../../../apps/api/src/index";

describe("Marketing Sequence Exit Triggers Engine API & Logic Tests (Task 0181)", () => {
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

  it("should create, read, and delete exit triggers with strict RLS tenant isolation", async () => {
    let seqId = "";

    await withTenant(orgA, mockDb, async () => {
      const seq = await dbStore.marketingSequences.insert({
        orgId: orgA,
        name: "Acme Sequence",
        description: "Standard sales sequence",
        status: "active",
      });
      seqId = seq.id;
    });

    // 1. Create exit trigger via POST API
    const createRes = await app.request(
      `/api/sequences/${seqId}/exit-triggers`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          triggerType: "lead_status_changed",
          criteria: { status: "Converted" },
        }),
      },
    );
    expect(createRes.status).toBe(200);
    const createData = await createRes.json();
    expect(createData.success).toBe(true);
    expect(createData.data.triggerType).toBe("lead_status_changed");
    expect(createData.data.criteria.status).toBe("Converted");
    const triggerId = createData.data.id;

    // 2. Read exit triggers via GET API
    const getRes = await app.request(`/api/sequences/${seqId}/exit-triggers`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
      },
    });
    expect(getRes.status).toBe(200);
    const getData = await getRes.json();
    expect(getData.success).toBe(true);
    expect(getData.data.length).toBe(1);
    expect(getData.data[0].id).toBe(triggerId);

    // 3. Verify Tenant Isolation (Tenant B attempts to access Tenant A's exit triggers)
    const badGetRes = await app.request(
      `/api/sequences/${seqId}/exit-triggers`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
        },
      },
    );
    expect(badGetRes.status).toBe(404);

    const badCreateRes = await app.request(
      `/api/sequences/${seqId}/exit-triggers`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          triggerType: "lead_status_changed",
          criteria: { status: "Converted" },
        }),
      },
    );
    expect(badCreateRes.status).toBe(404);

    // 4. Delete exit trigger via DELETE API
    const deleteRes = await app.request(
      `/api/sequences/${seqId}/exit-triggers/${triggerId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      },
    );
    expect(deleteRes.status).toBe(200);

    // Verify it is gone
    const getRes2 = await app.request(`/api/sequences/${seqId}/exit-triggers`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
      },
    });
    expect(getRes2.status).toBe(200);
    const getData2 = await getRes2.json();
    expect(getData2.data.length).toBe(0);
  });

  it("should automatically unenroll Lead membership when lead_status_changed trigger is met", async () => {
    let seqId = "";
    let tplId = "";
    let lead1Id = "";
    let lead2Id = "";

    await withTenant(orgA, mockDb, async () => {
      // Setup Sequence & Step
      const seq = await dbStore.marketingSequences.insert({
        orgId: orgA,
        name: "Lead Drip",
        status: "active",
      });
      seqId = seq.id;

      const tpl = await dbStore.emailTemplates.insert({
        orgId: orgA,
        name: "Welcome Template",
        subject: "Welcome",
        body: "Hello",
      });
      tplId = tpl.id;

      await dbStore.marketingSequenceSteps.insert({
        orgId: orgA,
        sequenceId: seqId,
        stepNumber: 1,
        delayDays: 0,
        templateId: tplId,
      });

      // Lead 1: Meets trigger criteria (status = Converted)
      const lead1 = await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "user-a",
        status: "Converted",
        email: "alice@example.com",
        company: "Alice Corp",
      });
      lead1Id = lead1.id;

      // Lead 2: Does not meet trigger criteria (status = New)
      const lead2 = await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "user-a",
        status: "New",
        email: "bob@example.com",
        company: "Bob Corp",
      });
      lead2Id = lead2.id;
    });

    // Create exit trigger: Auto-exit if lead status is Converted
    const triggerRes = await app.request(
      `/api/sequences/${seqId}/exit-triggers`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          triggerType: "lead_status_changed",
          criteria: { status: "Converted" },
        }),
      },
    );
    expect(triggerRes.status).toBe(200);

    // Enroll both leads
    await app.request(`/api/sequences/${seqId}/enroll`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ recordType: "lead", recordId: lead1Id }),
    });

    await app.request(`/api/sequences/${seqId}/enroll`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ recordType: "lead", recordId: lead2Id }),
    });

    // Execute Sequence Steps
    const execRes = await app.request("/api/sequences/execute", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
      },
    });
    expect(execRes.status).toBe(200);
    const execData = await execRes.json();
    // 2 memberships processed:
    // Lead 1: Exited the sequence automatically (processed, but no email dispatched)
    // Lead 2: Executed normally, email dispatched
    expect(execData.processedCount).toBe(2);

    await withTenant(orgA, mockDb, async () => {
      const memberships =
        await dbStore.marketingSequenceMemberships.findForSequence(seqId);
      const m1 = memberships.find((m) => m.recordId === lead1Id);
      const m2 = memberships.find((m) => m.recordId === lead2Id);

      expect(m1?.status).toBe("completed");
      expect(m2?.status).toBe("completed"); // Only 1 step exists, so both end up completed

      // Verify only 1 email activity was created (for Lead 2)
      const activities = await dbStore.activities.findMany();
      expect(activities.length).toBe(1);

      // Verify Audit Log has the exit_trigger_fired record for Lead 1
      const audits = await dbStore.auditLogs.findMany();
      const triggerAudit = audits.find(
        (a) => a.action === "exit_trigger_fired",
      );
      expect(triggerAudit).toBeDefined();
      expect(triggerAudit?.recordId).toBe(m1?.id);
    });
  });

  it("should automatically unenroll Contact membership when opportunity_stage_changed trigger is met", async () => {
    let seqId = "";
    let tplId = "";
    let contact1Id = "";
    let contact2Id = "";
    let acc1Id = "";
    let acc2Id = "";

    await withTenant(orgA, mockDb, async () => {
      // Setup Sequence & Step
      const seq = await dbStore.marketingSequences.insert({
        orgId: orgA,
        name: "Contact Drip",
        status: "active",
      });
      seqId = seq.id;

      const tpl = await dbStore.emailTemplates.insert({
        orgId: orgA,
        name: "Welcome",
        subject: "Welcome",
        body: "Hello",
      });
      tplId = tpl.id;

      await dbStore.marketingSequenceSteps.insert({
        orgId: orgA,
        sequenceId: seqId,
        stepNumber: 1,
        delayDays: 0,
        templateId: tplId,
      });

      // Accounts
      const acc1 = await dbStore.accounts.insert({
        orgId: orgA,
        ownerId: "user-a",
        name: "Acme Corp",
      });
      acc1Id = acc1.id;

      const acc2 = await dbStore.accounts.insert({
        orgId: orgA,
        ownerId: "user-a",
        name: "Global Corp",
      });
      acc2Id = acc2.id;

      // Contacts
      const contact1 = await dbStore.contacts.insert({
        orgId: orgA,
        ownerId: "user-a",
        accountId: acc1Id,
        firstName: "Charlie",
        lastName: "Brown",
        email: "charlie@example.com",
      });
      contact1Id = contact1.id;

      const contact2 = await dbStore.contacts.insert({
        orgId: orgA,
        ownerId: "user-a",
        accountId: acc2Id,
        firstName: "Dave",
        lastName: "Smith",
        email: "dave@example.com",
      });
      contact2Id = contact2.id;

      // Opportunity associated with Account 1 (Stage = Closed Won)
      await dbStore.opportunities.insert({
        orgId: orgA,
        ownerId: "user-a",
        accountId: acc1Id,
        stage: "Closed Won",
        amount: "5000",
      });

      // Opportunity associated with Account 2 (Stage = Pipeline/Negotiation)
      await dbStore.opportunities.insert({
        orgId: orgA,
        ownerId: "user-a",
        accountId: acc2Id,
        stage: "Qualification",
        amount: "10000",
      });
    });

    // Create exit trigger: Auto-exit if any associated opportunity stage is Closed Won
    const triggerRes = await app.request(
      `/api/sequences/${seqId}/exit-triggers`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          triggerType: "opportunity_stage_changed",
          criteria: { stage: "Closed Won" },
        }),
      },
    );
    expect(triggerRes.status).toBe(200);

    // Enroll contacts
    await app.request(`/api/sequences/${seqId}/enroll`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ recordType: "contact", recordId: contact1Id }),
    });

    await app.request(`/api/sequences/${seqId}/enroll`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ recordType: "contact", recordId: contact2Id }),
    });

    // Execute Sequence Steps
    const execRes = await app.request("/api/sequences/execute", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
      },
    });
    expect(execRes.status).toBe(200);
    const execData = await execRes.json();
    expect(execData.processedCount).toBe(2);

    await withTenant(orgA, mockDb, async () => {
      const memberships =
        await dbStore.marketingSequenceMemberships.findForSequence(seqId);
      const m1 = memberships.find((m) => m.recordId === contact1Id);
      const m2 = memberships.find((m) => m.recordId === contact2Id);

      // Contact 1 should auto-exit (completed, skip email step execution)
      expect(m1?.status).toBe("completed");
      expect(m2?.status).toBe("completed");

      // Verify only 1 email was sent (to Contact 2)
      const activities = await dbStore.activities.findMany();
      expect(activities.length).toBe(1);

      // Verify Audit Log has the exit_trigger_fired record for Contact 1
      const audits = await dbStore.auditLogs.findMany();
      const triggerAudit = audits.find(
        (a) => a.action === "exit_trigger_fired",
      );
      expect(triggerAudit).toBeDefined();
      expect(triggerAudit?.recordId).toBe(m1?.id);
    });
  });
});
