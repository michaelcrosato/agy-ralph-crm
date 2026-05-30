import { createSessionToken } from "@crm/auth";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { enqueueOutboundWebhooks } from "@crm/webhooks";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../../../apps/api/src/index";

describe("Outbound Webhooks Outbox & Dead Letter Queue (DLQ) Integration Tests", () => {
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

  it("should write outbound webhooks to the outbox queue instead of executing immediate REST calls", async () => {
    let webhookId = "";
    // 1. Create a webhook for Tenant A
    await withTenant(orgA, mockDb, async () => {
      const webhook = await dbStore.webhooks.insert({
        orgId: orgA,
        targetUrl: "https://tenant-a.com/webhook",
        secret: "signing-secret",
        status: "active",
      });
      webhookId = webhook.id;

      // 2. Directly call enqueueOutboundWebhooks
      const payload = {
        email: "alice@test.com",
        company: "Test Corp",
        status: "New",
      };
      await enqueueOutboundWebhooks(orgA, "lead.created", payload, dbStore);
    });

    // 3. Verify that the webhook is enqueued in the outbox
    const getOutboxRes = await app.request("/api/webhooks/outbox", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenA}`,
      },
    });
    expect(getOutboxRes.status).toBe(200);
    const outboxData = await getOutboxRes.json();
    expect(outboxData.success).toBe(true);
    expect(outboxData.data.length).toBe(1);
    expect(outboxData.data[0].event).toBe("lead.created");
    expect(outboxData.data[0].status).toBe("pending");
    expect(outboxData.data[0].attempts).toBe(0);
    expect(outboxData.data[0].webhookId).toBe(webhookId);

    // Verify webhook deliveries remains 0 initially (since it's only enqueued)
    const deliveriesRes = await app.request("/api/webhooks/deliveries", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenA}`,
      },
    });
    const deliveries = await deliveriesRes.json();
    expect(deliveries.data.length).toBe(0);
  });

  it("should process the outbox, dispatch webhooks, and log deliveries on success", async () => {
    // 1. Setup webhook
    await withTenant(orgA, mockDb, async () => {
      const webhook = await dbStore.webhooks.insert({
        orgId: orgA,
        targetUrl: "https://tenant-a.com/webhook-success",
        secret: "signing-secret",
        status: "active",
      });

      // Insert directly into outbox for testing processing
      await dbStore.webhookOutbox.insert({
        orgId: orgA,
        webhookId: webhook.id,
        event: "opportunity.stage_changed",
        payload: JSON.stringify({ oppId: "opp-123", stage: "Closed Won" }),
        status: "pending",
        attempts: 0,
        lastAttemptAt: null,
        nextAttemptAt: new Date(Date.now() - 10000), // due
        lastError: null,
      });
    });

    // 2. Trigger outbox processing via API
    const processRes = await app.request("/api/webhooks/process-outbox", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
      },
    });
    expect(processRes.status).toBe(200);
    const processResult = await processRes.json();
    expect(processResult.success).toBe(true);
    expect(processResult.successes).toBe(1);
    expect(processResult.failures).toBe(0);
    expect(processResult.dlqTransitions).toBe(0);

    // 3. Verify outbox is now empty for Tenant A
    const getOutboxRes = await app.request("/api/webhooks/outbox", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenA}`,
      },
    });
    const outbox = await getOutboxRes.json();
    expect(outbox.data.length).toBe(0);

    // 4. Verify a successful webhook delivery is logged
    const deliveriesRes = await app.request("/api/webhooks/deliveries", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenA}`,
      },
    });
    const deliveries = await deliveriesRes.json();
    expect(deliveries.data.length).toBe(1);
    expect(deliveries.data[0].event).toBe("opportunity.stage_changed");
    expect(deliveries.data[0].statusCode).toBe(200);
  });

  it("should implement exponential backoff retry logic and increment attempts on delivery failures", async () => {
    // 1. Setup a failing webhook endpoint
    await withTenant(orgA, mockDb, async () => {
      const webhook = await dbStore.webhooks.insert({
        orgId: orgA,
        targetUrl: "https://tenant-a.com/webhook-fail-path",
        secret: null,
        status: "active",
      });

      await dbStore.webhookOutbox.insert({
        orgId: orgA,
        webhookId: webhook.id,
        event: "lead.converted",
        payload: JSON.stringify({ leadId: "lead-999" }),
        status: "pending",
        attempts: 0,
        lastAttemptAt: null,
        nextAttemptAt: new Date(Date.now() - 5000), // due
        lastError: null,
      });
    });

    // 2. Trigger first outbox process run
    const run1Res = await app.request("/api/webhooks/process-outbox", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
      },
    });
    const run1 = await run1Res.json();
    expect(run1.successes).toBe(0);
    expect(run1.failures).toBe(1);

    // 3. Verify outbox entry transitioned to "failed" status, attempts = 1, and backoff is calculated
    const getOutboxRes = await app.request("/api/webhooks/outbox", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenA}`,
      },
    });
    const outbox = await getOutboxRes.json();
    expect(outbox.data.length).toBe(1);
    const entry = outbox.data[0];
    expect(entry.status).toBe("failed");
    expect(entry.attempts).toBe(1);
    expect(entry.lastError).toContain("HTTP status 500");

    // The backoff calculation for 1st attempt should be 2^1 = 2 seconds
    const now = Date.now();
    const nextAttemptTime = new Date(entry.nextAttemptAt).getTime();
    expect(nextAttemptTime).toBeGreaterThanOrEqual(now + 1000); // roughly +2s
    expect(nextAttemptTime).toBeLessThanOrEqual(now + 3000);
  });

  it("should move webhooks failing 5 times to the Dead Letter Queue (DLQ) and generate audit log", async () => {
    let webhookId = "";

    // 1. Setup a webhook and an outbox record already at 4 attempts (one more to trigger DLQ)
    await withTenant(orgA, mockDb, async () => {
      const webhook = await dbStore.webhooks.insert({
        orgId: orgA,
        targetUrl: "https://tenant-a.com/webhook-fail-final",
        secret: null,
        status: "active",
      });
      webhookId = webhook.id;

      await dbStore.webhookOutbox.insert({
        orgId: orgA,
        webhookId: webhook.id,
        event: "lead.created",
        payload: JSON.stringify({ info: "will-dlq" }),
        status: "failed",
        attempts: 4,
        lastAttemptAt: new Date(),
        nextAttemptAt: new Date(Date.now() - 1000), // due
        lastError: "Previous failures",
      });
    });

    // 2. Trigger processing which will fail for the 5th time
    const processRes = await app.request("/api/webhooks/process-outbox", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
      },
    });
    const result = await processRes.json();
    expect(result.successes).toBe(0);
    expect(result.failures).toBe(0);
    expect(result.dlqTransitions).toBe(1);

    // 3. Verify it is purged from the outbox
    const outboxRes = await app.request("/api/webhooks/outbox", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenA}`,
      },
    });
    const outbox = await outboxRes.json();
    expect(outbox.data.length).toBe(0);

    // 4. Verify it exists in the Dead Letter Queue
    const dlqRes = await app.request("/api/webhooks/dlq", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenA}`,
      },
    });
    expect(dlqRes.status).toBe(200);
    const dlq = await dlqRes.json();
    expect(dlq.success).toBe(true);
    expect(dlq.data.length).toBe(1);
    expect(dlq.data[0].attempts).toBe(5);
    expect(dlq.data[0].webhookId).toBe(webhookId);
    expect(dlq.data[0].lastError).toBe("HTTP status 500");

    // 5. Verify system audit log entry
    await withTenant(orgA, mockDb, async () => {
      const logs = await dbStore.auditLogs.findMany();
      const dlqLog = logs.find((l) => l.action === "dlq_transition");
      expect(dlqLog).toBeDefined();
      expect(dlqLog?.recordType).toBe("webhook");
      expect(dlqLog?.recordId).toBe(webhookId);
    });
  });

  it("should strictly enforce active tenant RLS bounds on outbox processing, query, and DLQ datasets", async () => {
    // 1. Setup outbox entries for BOTH Tenant A and Tenant B
    let webhookAId = "";
    let webhookBId = "";

    await withTenant(orgA, mockDb, async () => {
      const webhookA = await dbStore.webhooks.insert({
        orgId: orgA,
        targetUrl: "https://tenant-a.com/success",
        secret: null,
        status: "active",
      });
      webhookAId = webhookA.id;

      await dbStore.webhookOutbox.insert({
        orgId: orgA,
        webhookId: webhookA.id,
        event: "lead.created",
        payload: JSON.stringify({ source: "Tenant A" }),
        status: "pending",
        attempts: 0,
        lastAttemptAt: null,
        nextAttemptAt: new Date(Date.now() - 1000), // due
        lastError: null,
      });
    });

    await withTenant(orgB, mockDb, async () => {
      const webhookB = await dbStore.webhooks.insert({
        orgId: orgB,
        targetUrl: "https://tenant-b.com/success",
        secret: null,
        status: "active",
      });
      webhookBId = webhookB.id;

      await dbStore.webhookOutbox.insert({
        orgId: orgB,
        webhookId: webhookB.id,
        event: "lead.created",
        payload: JSON.stringify({ source: "Tenant B" }),
        status: "pending",
        attempts: 0,
        lastAttemptAt: null,
        nextAttemptAt: new Date(Date.now() - 1000), // due
        lastError: null,
      });
    });

    // 2. Tenant A reads outbox -> gets ONLY Tenant A's entry
    const outboxResA = await app.request("/api/webhooks/outbox", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenA}`,
      },
    });
    const outboxA = await outboxResA.json();
    expect(outboxA.data.length).toBe(1);
    expect(outboxA.data[0].webhookId).toBe(webhookAId);

    // 3. Tenant A processes outbox -> processes ONLY Tenant A's entry (successes = 1)
    const processResA = await app.request("/api/webhooks/process-outbox", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenA}`,
      },
    });
    const processResultA = await processResA.json();
    expect(processResultA.successes).toBe(1);
    expect(processResultA.failures).toBe(0);

    // 4. Tenant B's outbox remains UNTOUCHED
    const outboxResB = await app.request("/api/webhooks/outbox", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenB}`,
      },
    });
    const outboxB = await outboxResB.json();
    expect(outboxB.data.length).toBe(1);
    expect(outboxB.data[0].webhookId).toBe(webhookBId);
  });
});
