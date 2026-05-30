import { createSessionToken } from "@crm/auth";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestApp } from "./_harness";

const app = createTestApp();

describe("Case Service Level Agreements (SLA) & Milestone Management Engine API", () => {
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

  it("should successfully manage SLA policies and milestones under strict RLS isolation", async () => {
    // 1. Create a Contact for Tenant A (required for Ticket creation)
    let contactId = "";
    await withTenant(orgA, mockDb, async () => {
      const contact = await dbStore.contacts.insert({
        orgId: orgA,
        ownerId: "user-a",
        firstName: "Jane",
        lastName: "Doe",
        email: "jane.doe@example.com",
        custom: null,
      });
      contactId = contact.id;
    });

    // 2. Create SLA Policies for Tenant A
    const createPolicyRes = await app.request("/api/service/sla-policies", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Standard High Priority Support",
        priority: "high",
        responseTimeLimitMinutes: 60,
        resolutionTimeLimitMinutes: 240,
      }),
    });

    expect(createPolicyRes.status).toBe(201);
    const policyBody = await createPolicyRes.json();
    expect(policyBody.success).toBe(true);
    expect(policyBody.data.id).toBeDefined();
    expect(policyBody.data.name).toBe("Standard High Priority Support");
    expect(policyBody.data.priority).toBe("high");
    expect(policyBody.data.responseTimeLimitMinutes).toBe(60);

    const _policyId = policyBody.data.id;

    // 3. Query SLA Policies for Tenant A
    const listPoliciesResA = await app.request("/api/service/sla-policies", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
      },
    });

    expect(listPoliciesResA.status).toBe(200);
    const listBodyA = await listPoliciesResA.json();
    expect(listBodyA.success).toBe(true);
    expect(listBodyA.data.length).toBe(1);

    // 4. Query SLA Policies for Tenant B -> should return 0 (RLS isolation)
    const listPoliciesResB = await app.request("/api/service/sla-policies", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantB}`,
      },
    });

    expect(listPoliciesResB.status).toBe(200);
    const listBodyB = await listPoliciesResB.json();
    expect(listBodyB.success).toBe(true);
    expect(listBodyB.data.length).toBe(0);

    // 5. Create a Ticket for Tenant A
    let ticketId = "";
    await withTenant(orgA, mockDb, async () => {
      const ticket = await dbStore.tickets.insert({
        orgId: orgA,
        contactId,
        subject: "Urgent Server Issue",
        status: "Open",
      });
      ticketId = ticket.id;
    });

    // 6. Enroll Ticket in SLA (POST /api/service/tickets/:id/milestones) for Tenant A
    const enrollRes = await app.request(
      `/api/service/tickets/${ticketId}/milestones`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          priority: "high",
        }),
      },
    );

    expect(enrollRes.status).toBe(201);
    const enrollBody = await enrollRes.json();
    expect(enrollBody.success).toBe(true);
    expect(enrollBody.data.length).toBe(2);

    const m1 = enrollBody.data.find(
      (m: { milestoneType: string }) => m.milestoneType === "first_response",
    );
    const m2 = enrollBody.data.find(
      (m: { milestoneType: string }) => m.milestoneType === "resolution",
    );

    expect(m1).toBeDefined();
    expect(m1.status).toBe("pending");
    expect(m1.isMet).toBeNull();
    expect(new Date(m1.targetTime).getTime()).toBeGreaterThan(Date.now());

    expect(m2).toBeDefined();
    expect(m2.status).toBe("pending");
    expect(m2.isMet).toBeNull();

    // 7. Tenant B tries to query Tenant A's ticket milestones -> should fail (404 Ticket not found)
    const getMilestonesResB = await app.request(
      `/api/service/tickets/${ticketId}/milestones`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
        },
      },
    );
    expect(getMilestonesResB.status).toBe(404);

    // 8. Tenant A queries milestones for the ticket
    const getMilestonesResA = await app.request(
      `/api/service/tickets/${ticketId}/milestones`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      },
    );
    expect(getMilestonesResA.status).toBe(200);
    const milestonesBody = await getMilestonesResA.json();
    expect(milestonesBody.success).toBe(true);
    expect(milestonesBody.data.length).toBe(2);

    // 9. Complete the "first_response" milestone
    const completeRes = await app.request(
      `/api/service/tickets/${ticketId}/milestones/${m1.id}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "complete",
        }),
      },
    );

    expect(completeRes.status).toBe(200);
    const completeBody = await completeRes.json();
    expect(completeBody.success).toBe(true);
    expect(completeBody.data.status).toBe("completed");
    expect(completeBody.data.isMet).toBe(true);
    expect(completeBody.data.completedAt).toBeDefined();

    // 10. Tenant B tries to update Tenant A's milestone -> should fail (404 Milestone not found due to RLS)
    const completeResB = await app.request(
      `/api/service/tickets/${ticketId}/milestones/${m2.id}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "complete",
        }),
      },
    );
    expect(completeResB.status).toBe(404);

    // 11. Verify Audit Logs are created
    await withTenant(orgA, mockDb, async () => {
      const logs = await dbStore.auditLogs.findMany();
      // Look for sla_policies and ticket_milestones log entries
      const policyLog = logs.find((l) => l.recordType === "sla_policies");
      const milestoneLog = logs.find(
        (l) => l.recordType === "ticket_milestones",
      );

      expect(policyLog).toBeDefined();
      expect(policyLog?.action).toBe("create");

      expect(milestoneLog).toBeDefined();
      expect(milestoneLog?.action).toBe("update");
      expect(milestoneLog?.changes?.status?.after).toBe("completed");
    });
  });

  it("should correctly handle milestone breaches when completed late", async () => {
    // 1. Create a Contact
    let contactId = "";
    await withTenant(orgA, mockDb, async () => {
      const contact = await dbStore.contacts.insert({
        orgId: orgA,
        ownerId: "user-a",
        firstName: "Jane",
        lastName: "Doe",
        email: "jane.doe@example.com",
        custom: null,
      });
      contactId = contact.id;
    });

    // 2. Create a Ticket
    let ticketId = "";
    await withTenant(orgA, mockDb, async () => {
      const ticket = await dbStore.tickets.insert({
        orgId: orgA,
        contactId,
        subject: "Late SLA Ticket",
        status: "Open",
      });
      ticketId = ticket.id;
    });

    // 3. Create a custom targetTime in the past for a milestone
    let milestoneId = "";
    await withTenant(orgA, mockDb, async () => {
      const m = await dbStore.ticketMilestones.insert({
        orgId: orgA,
        ticketId,
        milestoneType: "resolution",
        targetTime: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
        completedAt: null,
        status: "pending",
        isMet: null,
      });
      milestoneId = m.id;
    });

    // 4. Complete the milestone
    const completeRes = await app.request(
      `/api/service/tickets/${ticketId}/milestones/${milestoneId}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "complete",
        }),
      },
    );

    expect(completeRes.status).toBe(200);
    const completeBody = await completeRes.json();
    expect(completeBody.success).toBe(true);
    expect(completeBody.data.status).toBe("breached");
    expect(completeBody.data.isMet).toBe(false);
  });
});
