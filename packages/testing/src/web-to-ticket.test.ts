import { createSessionToken } from "@crm/auth";
import { dbStore, mockDb, store, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestApp } from "./_harness";

const app = createTestApp();

describe("Public Web-to-Ticket Capture API & RLS Tests", () => {
  let tokenTenantA: string;
  let tokenTenantB: string;

  const orgA = "org-tenant-a";
  const orgB = "org-tenant-b";

  beforeEach(async () => {
    // Clear mock store before each test run
    store.tickets = [];
    store.contacts = [];
    store.auditLogs = [];
    store.fieldDefinitions = [];
    store.ticketAssignmentRules = [];
    store.ticketAssignmentRuleEntries = [];
    store.webhooks = [];
    store.webhookOutbox = [];

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

  it("should successfully capture a ticket publicly, create a new contact, and assign to fallback owner", async () => {
    const payload = {
      orgId: orgA,
      subject: "Broken Printer",
      body: "My printer is smoking and making weird noises.",
      email: "jane.doe@example.com",
      firstName: "Jane",
      lastName: "Doe",
    };

    const res = await app.request("/api/public/web-to-ticket", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBeDefined();
    expect(body.data.subject).toBe("Broken Printer");
    expect(body.data.status).toBe("Open");
    expect(body.data.priority).toBe("Medium");
    expect(body.data.assignedToId).toBe("user-system");
    expect(body.contactCreated).toBe(true);

    // Verify contact and ticket exist under Tenant A isolation context
    await withTenant(orgA, mockDb, async () => {
      const contact = await dbStore.contacts.findOne(body.data.contactId);
      expect(contact).not.toBeNull();
      expect(contact?.email).toBe("jane.doe@example.com");
      expect(contact?.firstName).toBe("Jane");
      expect(contact?.lastName).toBe("Doe");

      const ticket = await dbStore.tickets.findOne(body.data.id);
      expect(ticket).not.toBeNull();
      expect(ticket?.subject).toBe("Broken Printer");
      expect(ticket?.contactId).toBe(contact?.id);

      // Verify audit logs exist for both Contact and Ticket creation
      const logs = await dbStore.auditLogs.findMany();
      const contactLog = logs.find((l) => l.recordId === contact?.id);
      const ticketLog = logs.find((l) => l.recordId === ticket?.id);

      expect(contactLog).toBeDefined();
      expect(contactLog?.action).toBe("create");
      expect(ticketLog).toBeDefined();
      expect(ticketLog?.action).toBe("create");
    });
  });

  it("should link to an existing contact if one already exists with the same email", async () => {
    // 1. Manually insert contact under Tenant A
    let contactId = "";
    await withTenant(orgA, mockDb, async () => {
      const c = await dbStore.contacts.insert({
        orgId: orgA,
        email: "jane.doe@example.com",
        firstName: "Jane",
        lastName: "Doe",
        custom: null,
      });
      contactId = c.id;
    });

    // 2. Submit public ticket with the same email
    const payload = {
      orgId: orgA,
      subject: "Connection issues",
      body: "Cannot connect to the VPN.",
      email: "jane.doe@example.com",
    };

    const res = await app.request("/api/public/web-to-ticket", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.contactId).toBe(contactId);
    expect(body.contactCreated).toBe(false);

    // Verify only 1 contact exists
    await withTenant(orgA, mockDb, async () => {
      const contactsList = await dbStore.contacts.findMany();
      expect(contactsList.length).toBe(1);
    });
  });

  it("should enforce dynamic custom field schema validation on public submission", async () => {
    // 1. Inject custom field definition for Tenant A tickets
    await withTenant(orgA, mockDb, async () => {
      await dbStore.fieldDefinitions.insert({
        orgId: orgA,
        objectType: "tickets",
        apiName: "severityLevel",
        label: "Severity Level",
        dataType: "number",
        validationRules: { min: 1, max: 4 },
      });
    });

    // 2. Submit invalid value (failing validation rules)
    const invalidPayload = {
      orgId: orgA,
      subject: "VPN Down",
      body: "Entire company is blocked.",
      email: "admin@acme.com",
      custom: { severityLevel: 5 }, // too high (max 4)
    };

    const resFail = await app.request("/api/public/web-to-ticket", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(invalidPayload),
    });

    expect(resFail.status).toBe(400);
    const bodyFail = await resFail.json();
    expect(bodyFail.error).toBe("Validation failed");

    // 3. Submit valid value
    const validPayload = {
      orgId: orgA,
      subject: "VPN Down",
      body: "Entire company is blocked.",
      email: "admin@acme.com",
      custom: { severityLevel: 3 }, // valid
    };

    const resPass = await app.request("/api/public/web-to-ticket", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validPayload),
    });

    expect(resPass.status).toBe(201);
    const bodyPass = await resPass.json();
    expect(bodyPass.success).toBe(true);
    expect(bodyPass.data.id).toBeDefined();
  });

  it("should integrate with active Ticket Assignment Rules (direct and round-robin queue)", async () => {
    // 1. Set up active rule and entries for Tenant A
    await withTenant(orgA, mockDb, async () => {
      const rule = await dbStore.ticketAssignmentRules.insert({
        orgId: orgA,
        name: "Acme Ticket Routing",
        isActive: 1,
      });

      // Entry 1: Direct route to rep-1 if subject contains "urgent" or priority is Urgent
      await dbStore.ticketAssignmentRuleEntries.insert({
        orgId: orgA,
        ruleId: rule.id,
        sortOrder: 1,
        routingMethod: "direct",
        routingUserIds: ["rep-1"],
        lastAssignedIndex: -1,
        criteria: [{ field: "priority", operator: "equals", value: "Urgent" }],
      });

      // Entry 2: Round-Robin route between rep-rr-1 & rep-rr-2 if subject contains "Billing"
      await dbStore.ticketAssignmentRuleEntries.insert({
        orgId: orgA,
        ruleId: rule.id,
        sortOrder: 2,
        routingMethod: "round_robin",
        routingUserIds: ["rep-rr-1", "rep-rr-2"],
        lastAssignedIndex: -1,
        criteria: [
          { field: "subject", operator: "contains", value: "Billing" },
        ],
      });
    });

    // 2. Submit matching Direct Route Ticket
    const directPayload = {
      orgId: orgA,
      subject: "Urgent: VPN is broken",
      body: "Cannot access internal services.",
      email: "employee@acme.com",
      priority: "Urgent",
    };

    const resDirect = await app.request("/api/public/web-to-ticket", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(directPayload),
    });
    expect(resDirect.status).toBe(201);
    const bodyDirect = await resDirect.json();
    expect(bodyDirect.data.assignedToId).toBe("rep-1");

    // 3. Submit matching Round-Robin Ticket (first hit)
    const rrPayload1 = {
      orgId: orgA,
      subject: "Billing Inquiry",
      body: "I was charged twice.",
      email: "buyer@gmail.com",
    };
    const resRR1 = await app.request("/api/public/web-to-ticket", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rrPayload1),
    });
    expect(resRR1.status).toBe(201);
    const bodyRR1 = await resRR1.json();
    expect(bodyRR1.data.assignedToId).toBe("rep-rr-1");

    // 4. Submit matching Round-Robin Ticket (second hit)
    const rrPayload2 = {
      orgId: orgA,
      subject: "Billing error on receipt",
      body: "Incorrect item price listed.",
      email: "buyer2@gmail.com",
    };
    const resRR2 = await app.request("/api/public/web-to-ticket", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rrPayload2),
    });
    expect(resRR2.status).toBe(201);
    const bodyRR2 = await resRR2.json();
    expect(bodyRR2.data.assignedToId).toBe("rep-rr-2");
  });

  it("should maintain strict multi-tenant RLS isolation", async () => {
    // 1. Submit ticket publicly to Tenant A
    const payload = {
      orgId: orgA,
      subject: "TenantA-Ticket",
      body: "Isolated issue.",
      email: "contact@tenant-a.com",
    };

    const res = await app.request("/api/public/web-to-ticket", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    expect(res.status).toBe(201);
    const ticketId = (await res.json()).data.id;

    // 2. Try to fetch the ticket using Tenant B's session token
    const resGetB = await app.request("/api/tickets", {
      method: "GET",
      headers: { Authorization: `Bearer ${tokenTenantB}` },
    });
    expect(resGetB.status).toBe(200);
    const bodyGetB = await resGetB.json();
    expect(bodyGetB.success).toBe(true);
    const ticketForB = bodyGetB.data.find(
      (t: { id: string }) => t.id === ticketId,
    );
    expect(ticketForB).toBeUndefined(); // Should not be found under Tenant B's context

    // 3. Successfully fetch using Tenant A's session token
    const resGetA = await app.request("/api/tickets", {
      method: "GET",
      headers: { Authorization: `Bearer ${tokenTenantA}` },
    });
    expect(resGetA.status).toBe(200);
    const bodyGetA = await resGetA.json();
    expect(bodyGetA.success).toBe(true);
    const ticketForA = bodyGetA.data.find(
      (t: { id: string; subject?: string }) => t.id === ticketId,
    );
    expect(ticketForA).toBeDefined();
    expect(ticketForA?.subject).toBe("TenantA-Ticket");
  });
});
