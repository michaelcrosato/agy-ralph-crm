import { createSessionToken } from "@crm/auth";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { computeHmacSignature, simulateWebhookDispatch } from "@crm/webhooks";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../../../apps/api/src/index";

describe("Outbound REST Webhooks - Core Unit Tests", () => {
  it("should correctly calculate HMAC-SHA256 signature hashes for payload verification", () => {
    const payload = JSON.stringify({
      event: "lead.created",
      data: { id: "1" },
    });
    const secret = "test-signature-secret-key";

    const hash = computeHmacSignature(payload, secret);
    expect(hash).toBeDefined();
    expect(hash.length).toBe(64); // Hex signature length of sha256 is 64 characters

    // Identical inputs yield identical outputs
    const hashRepeat = computeHmacSignature(payload, secret);
    expect(hashRepeat).toBe(hash);
  });

  it("should simulate webhook delivery outcomes based on target URL patterns", async () => {
    const payload = { id: "lead-abc", status: "New" };

    // Standard success URL (should return HTTP 200)
    const successResult = await simulateWebhookDispatch({
      targetUrl: "https://my-endpoint.com/webhook",
      secret: "super-secret",
      event: "lead.created",
      payload,
    });
    expect(successResult.statusCode).toBe(200);
    expect(successResult.signature).not.toBeNull();
    expect(successResult.payloadString).toContain("lead-abc");

    // Failure URL (should simulate HTTP 500)
    const failResult = await simulateWebhookDispatch({
      targetUrl: "https://my-endpoint.com/webhook/fail-trigger",
      secret: null,
      event: "lead.created",
      payload,
    });
    expect(failResult.statusCode).toBe(500);
    expect(failResult.signature).toBeNull();
  });
});

describe("Outbound REST Webhooks - Integration REST API Tests", () => {
  let tokenA: string;
  let tokenB: string;

  const orgA = "org-tenant-a";
  const orgB = "org-tenant-b";

  beforeEach(async () => {
    dbStore.clear();

    tokenA = await createSessionToken({
      userId: "user-a",
      orgId: orgA,
      roleId: "role-a",
      permissionsMask: 7,
    });

    tokenB = await createSessionToken({
      userId: "user-b",
      orgId: orgB,
      roleId: "role-b",
      permissionsMask: 7,
    });
  });

  it("should enforce active tenant RLS bounds on webhook subscription and deliveries ledgers", async () => {
    // 1. POST /api/webhooks for Tenant A
    const subResA = await app.request("/api/webhooks", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        targetUrl: "https://tenant-a.com/events",
        secret: "secret-a",
      }),
    });
    expect(subResA.status).toBe(200);
    const subDataA = await subResA.json();
    expect(subDataA.success).toBe(true);

    // 2. GET /api/webhooks for Tenant A -> returns 1 item
    const getSubsResA = await app.request("/api/webhooks", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenA}`,
      },
    });
    expect(getSubsResA.status).toBe(200);
    const getSubsA = await getSubsResA.json();
    expect(getSubsA.data.length).toBe(1);
    expect(getSubsA.data[0].targetUrl).toBe("https://tenant-a.com/events");

    // 3. GET /api/webhooks for Tenant B -> returns 0 items (isolated RLS)
    const getSubsResB = await app.request("/api/webhooks", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenB}`,
      },
    });
    expect(getSubsResB.status).toBe(200);
    const getSubsB = await getSubsResB.json();
    expect(getSubsB.data.length).toBe(0);
  });

  it("should trigger webhooks automatically on CRM entity operations and log delivery outcome histories", async () => {
    // Register subscription for Tenant A
    await withTenant(orgA, mockDb, async () => {
      await dbStore.webhooks.insert({
        orgId: orgA,
        targetUrl: "https://receiver-a.com/webhook",
        secret: "my-signing-secret",
        status: "active",
      });
    });

    // 1. POST /api/leads -> triggers lead.created event
    const createLeadRes = await app.request("/api/leads", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "bob@jones.com",
        company: "Jones Group",
        status: "New",
      }),
    });
    expect(createLeadRes.status).toBe(200);
    const leadData = await createLeadRes.json();
    const leadId = leadData.data.id;

    // Small delay to let asynchronous webhook simulation complete
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Assert a delivery log has been registered under RLS bounds for Tenant A
    const deliveriesResA = await app.request("/api/webhooks/deliveries", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenA}`,
      },
    });
    expect(deliveriesResA.status).toBe(200);
    const deliveriesA = await deliveriesResA.json();
    expect(deliveriesA.success).toBe(true);
    expect(deliveriesA.data.length).toBe(1);
    expect(deliveriesA.data[0].event).toBe("lead.created");
    expect(deliveriesA.data[0].statusCode).toBe(200);

    // 2. POST /api/leads/:id/convert -> triggers lead.converted event
    const convertRes = await app.request(`/api/leads/${leadId}/convert`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        opportunityName: "Big Deal opportunity",
        opportunityAmount: 75000,
      }),
    });
    expect(convertRes.status).toBe(200);
    const convertData = await convertRes.json();
    const opportunityId = convertData.opportunityId;

    await new Promise((resolve) => setTimeout(resolve, 50));

    // Assert second delivery log registered for lead.converted
    const deliveriesResA2 = await app.request("/api/webhooks/deliveries", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenA}`,
      },
    });
    const deliveriesA2 = await deliveriesResA2.json();
    expect(deliveriesA2.data.length).toBe(2);
    expect(
      deliveriesA2.data.some(
        (d: { event: string }) => d.event === "lead.converted",
      ),
    ).toBe(true);

    // 3. PATCH /api/opportunities/:id -> stage changed triggers opportunity.stage_changed event
    const patchRes = await app.request(`/api/opportunities/${opportunityId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        stage: "Proposal",
      }),
    });
    expect(patchRes.status).toBe(200);

    await new Promise((resolve) => setTimeout(resolve, 50));

    const deliveriesResA3 = await app.request("/api/webhooks/deliveries", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenA}`,
      },
    });
    const deliveriesA3 = await deliveriesResA3.json();
    expect(deliveriesA3.data.length).toBe(3);
    expect(
      deliveriesA3.data.some(
        (d: { event: string }) => d.event === "opportunity.stage_changed",
      ),
    ).toBe(true);
  });
});
