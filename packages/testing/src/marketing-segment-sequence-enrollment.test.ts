import { createSessionToken } from "@crm/auth";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../../../apps/api/src/index";

describe("Marketing Segment Sequence Enrollment API Tests", () => {
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

  it("should support bulk enrolling dynamic lead segment members in sequence and skipping duplicates", async () => {
    let lead1Id = "";
    let lead2Id = "";
    let templateId = "";
    let segmentId = "";
    let sequenceId = "";

    // 1. Setup Lead templates and records under Tenant A
    await withTenant(orgA, mockDb, async () => {
      const l1 = await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "user-a",
        status: "New",
        email: "lead1@acme.com",
        company: "Acme",
        convertedAccountId: null,
        convertedContactId: null,
        custom: null,
      });
      lead1Id = l1.id;

      const l2 = await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "user-a",
        status: "New",
        email: "lead2@acme.com",
        company: "Acme",
        convertedAccountId: null,
        convertedContactId: null,
        custom: null,
      });
      lead2Id = l2.id;

      // Non-matching lead
      await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "user-a",
        status: "Working",
        email: "lead3@acme.com",
        company: "Other",
        convertedAccountId: null,
        convertedContactId: null,
        custom: null,
      });

      const t1 = await dbStore.emailTemplates.insert({
        orgId: orgA,
        name: "Welcome Drip",
        subject: "Welcome",
        body: "Hello",
      });
      templateId = t1.id;

      const seg = await dbStore.marketingSegments.insert({
        orgId: orgA,
        name: "Acme New Leads",
        description: "",
        objectType: "lead",
        criteria: [
          { field: "status", operator: "equals", value: "New" },
          { field: "company", operator: "contains", value: "Acme" },
        ],
      });
      segmentId = seg.id;

      const seq = await dbStore.marketingSequences.insert({
        orgId: orgA,
        name: "Acme Nurture Sequence",
        description: "",
        status: "active",
      });
      sequenceId = seq.id;

      await dbStore.marketingSequenceSteps.insert({
        orgId: orgA,
        sequenceId,
        stepNumber: 1,
        delayDays: 0,
        templateId,
      });
    });

    // 2. Enroll segment members into sequence via POST /api/segments/:id/enroll-sequence
    const enrollRes1 = await app.request(
      `/api/segments/${segmentId}/enroll-sequence`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sequenceId }),
      },
    );

    if (enrollRes1.status !== 200) {
      console.log("enrollRes1 status:", enrollRes1.status);
      console.log("enrollRes1 body:", await enrollRes1.text());
    }
    expect(enrollRes1.status).toBe(200);
    const body1 = await enrollRes1.json();
    expect(body1.success).toBe(true);
    expect(body1.enrolledCount).toBe(2);
    expect(body1.skippedCount).toBe(0);
    expect(body1.memberships.length).toBe(2);

    // Verify memberships are actually inserted
    await withTenant(orgA, mockDb, async () => {
      const memberships =
        await dbStore.marketingSequenceMemberships.findForSequence(sequenceId);
      expect(memberships.length).toBe(2);
      expect(memberships.some((m) => m.recordId === lead1Id)).toBe(true);
      expect(memberships.some((m) => m.recordId === lead2Id)).toBe(true);
    });

    // 3. Repeat enrollment -> all should be skipped to prevent duplicates
    const enrollRes2 = await app.request(
      `/api/segments/${segmentId}/enroll-sequence`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sequenceId }),
      },
    );

    expect(enrollRes2.status).toBe(200);
    const body2 = await enrollRes2.json();
    expect(body2.success).toBe(true);
    expect(body2.enrolledCount).toBe(0);
    expect(body2.skippedCount).toBe(2);
    expect(body2.memberships.length).toBe(0);
  });

  it("should support bulk enrolling dynamic contact segment members in sequence via sequences endpoint", async () => {
    let contactId = "";
    let templateId = "";
    let segmentId = "";
    let sequenceId = "";

    // 1. Setup Contact templates and records under Tenant A
    await withTenant(orgA, mockDb, async () => {
      const acc = await dbStore.accounts.insert({
        orgId: orgA,
        ownerId: "user-a",
        name: "Acme Account",
        domain: "acme.com",
        custom: null,
      });

      const c1 = await dbStore.contacts.insert({
        orgId: orgA,
        ownerId: "user-a",
        accountId: acc.id,
        firstName: "Alice",
        lastName: "Smith",
        email: "alice@acme.com",
        custom: null,
      });
      contactId = c1.id;

      const t1 = await dbStore.emailTemplates.insert({
        orgId: orgA,
        name: "Contact Drip",
        subject: "Welcome",
        body: "Hello",
      });
      templateId = t1.id;

      const seg = await dbStore.marketingSegments.insert({
        orgId: orgA,
        name: "Alice Segments",
        description: "",
        objectType: "contact",
        criteria: [{ field: "firstName", operator: "equals", value: "Alice" }],
      });
      segmentId = seg.id;

      const seq = await dbStore.marketingSequences.insert({
        orgId: orgA,
        name: "Contact Nurture Sequence",
        description: "",
        status: "active",
      });
      sequenceId = seq.id;

      await dbStore.marketingSequenceSteps.insert({
        orgId: orgA,
        sequenceId,
        stepNumber: 1,
        delayDays: 0,
        templateId,
      });
    });

    // 2. Enroll via POST /api/sequences/:id/enroll-segment
    const enrollRes = await app.request(
      `/api/sequences/${sequenceId}/enroll-segment`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ segmentId }),
      },
    );

    expect(enrollRes.status).toBe(200);
    const body = await enrollRes.json();
    expect(body.success).toBe(true);
    expect(body.enrolledCount).toBe(1);
    expect(body.skippedCount).toBe(0);
    expect(body.memberships.length).toBe(1);
    expect(body.memberships[0].recordId).toBe(contactId);
  });

  it("should strictly enforce tenant RLS isolation during segment sequence enrollment", async () => {
    let segmentIdA = "";
    let sequenceIdA = "";

    // Setup Segment and Sequence for Tenant A
    await withTenant(orgA, mockDb, async () => {
      const seg = await dbStore.marketingSegments.insert({
        orgId: orgA,
        name: "Tenant A Segment",
        description: "",
        objectType: "lead",
        criteria: [],
      });
      segmentIdA = seg.id;

      const seq = await dbStore.marketingSequences.insert({
        orgId: orgA,
        name: "Tenant A Sequence",
        description: "",
        status: "active",
      });
      sequenceIdA = seq.id;
    });

    // 1. Tenant B tries to enroll Tenant A's segment into Tenant A's sequence -> should fail (not found)
    const enrollResB1 = await app.request(
      `/api/segments/${segmentIdA}/enroll-sequence`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sequenceId: sequenceIdA }),
      },
    );
    expect(enrollResB1.status).toBe(400); // throws "Segment not found" due to RLS filter on segmentIdA for Tenant B

    // 2. Tenant B tries to trigger sequence endpoint with Tenant A's segment -> should fail
    const enrollResB2 = await app.request(
      `/api/sequences/${sequenceIdA}/enroll-segment`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ segmentId: segmentIdA }),
      },
    );
    expect(enrollResB2.status).toBe(400); // throws "Sequence not found" due to RLS filter on sequenceIdA for Tenant B
  });
});
