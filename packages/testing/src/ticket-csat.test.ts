import { createSessionToken } from "@crm/auth";
import {
  calculateAgentCSATMetrics,
  validateCSATFeedbackInput,
} from "@crm/core";
import { dbStore, mockDb, store, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestApp } from "./_harness";

const app = createTestApp();

describe("Support Ticket CSAT Feedback & Agent Performance API Tests", () => {
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

  describe("Core Pure Logic Unit Tests", () => {
    it("should validate CSAT feedback score correctly", () => {
      const invalidScoreLow = validateCSATFeedbackInput({
        score: 0,
        comment: "Bad service",
      });
      expect(invalidScoreLow.success).toBe(false);
      expect(invalidScoreLow.error).toBe(
        "CSAT score must be an integer between 1 and 5.",
      );

      const invalidScoreHigh = validateCSATFeedbackInput({
        score: 6,
        comment: "Excellent service",
      });
      expect(invalidScoreHigh.success).toBe(false);
      expect(invalidScoreHigh.error).toBe(
        "CSAT score must be an integer between 1 and 5.",
      );

      const validFeedback = validateCSATFeedbackInput({
        score: 5,
        comment: "Perfect!",
      });
      expect(validFeedback.success).toBe(true);
    });

    it("should calculate agent CSAT metrics correctly", () => {
      const now = new Date();
      const createdAt1 = new Date(now.getTime() - 60 * 60 * 1000); // 60 mins ago
      const createdAt2 = new Date(now.getTime() - 30 * 60 * 1000); // 30 mins ago

      const tickets = [
        {
          id: "t-1",
          assignedToId: "agent-1",
          status: "Resolved",
          createdAt: createdAt1,
          resolvedAt: now,
        },
        {
          id: "t-2",
          assignedToId: "agent-1",
          status: "Closed",
          createdAt: createdAt2,
          resolvedAt: now,
        },
        {
          id: "t-3",
          assignedToId: "agent-2", // Different agent
          status: "Resolved",
          createdAt: createdAt2,
          resolvedAt: now,
        },
        {
          id: "t-4",
          assignedToId: "agent-1",
          status: "Open", // Not resolved/closed
          createdAt: createdAt2,
        },
      ];

      const responses = [
        { ticketId: "t-1", score: 5 },
        { ticketId: "t-2", score: 3 },
        { ticketId: "t-3", score: 4 }, // Different agent
      ];

      const metrics = calculateAgentCSATMetrics({
        agentId: "agent-1",
        tickets,
        responses,
      });

      expect(metrics.totalTickets).toBe(3);
      expect(metrics.resolvedTickets).toBe(2);
      expect(metrics.averageCsat).toBe("4.00"); // (5 + 3) / 2
      expect(metrics.satisfactionRate).toBe(50); // score 5 is positive (>=4), score 3 is not. 1/2 = 50%
      expect(metrics.averageResolutionTimeMinutes).toBe(45); // (60 + 30) / 2 = 45 mins
    });
  });

  describe("Ticket CSAT Feedback REST API Integration", () => {
    it("should support feedback submission, default survey auto-creation, RLS checks, and agent metrics", async () => {
      let contactId = "";
      let ticketIdA = "";

      // 1. Seed a ticket under Tenant A
      await withTenant(orgA, mockDb, async () => {
        const contact = await dbStore.contacts.insert({
          orgId: orgA,
          ownerId: "user-a",
          firstName: "John",
          lastName: "Doe",
          email: "john.doe@gmail.com",
          custom: null,
        });
        contactId = contact.id;

        const ticket = await dbStore.tickets.insert({
          orgId: orgA,
          contactId,
          subject: "Database connection timeout issue",
          status: "Open",
          priority: "High",
          assignedToId: "user-a",
        });
        ticketIdA = ticket.id;
      });

      // 2. Submit CSAT feedback as Tenant A (using default survey fallback)
      const feedbackRes = await app.request(
        `/api/service/tickets/${ticketIdA}/feedback`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenTenantA}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            score: 5,
            comment: "Resolved immediately, outstanding support!",
          }),
        },
      );

      expect(feedbackRes.status).toBe(200);
      const resBody = await feedbackRes.json();
      expect(resBody.success).toBe(true);
      expect(resBody.data.score).toBe(5);
      expect(resBody.data.comment).toBe(
        "Resolved immediately, outstanding support!",
      );
      expect(resBody.data.ticketId).toBe(ticketIdA);
      expect(resBody.data.orgId).toBe(orgA);
      expect(resBody.ticket.status).toBe("Resolved");

      // Verify default survey was auto-created under Tenant A
      await withTenant(orgA, mockDb, async () => {
        const surveys = await dbStore.surveys.findMany();
        expect(surveys.length).toBe(1);
        expect(surveys[0].name).toBe("Default Ticket CSAT Survey");
        expect(surveys[0].type).toBe("csat");
      });

      // 3. Verify audit log entry was created
      const auditLogs = store.auditLogs.filter((log) => log.orgId === orgA);
      expect(
        auditLogs.some(
          (log) =>
            log.recordId === ticketIdA &&
            log.recordType === "Ticket" &&
            log.action === "submit_feedback" &&
            log.changes?.score?.after === 5,
        ),
      ).toBe(true);

      // 4. Retrieve feedback as Tenant A
      const getFeedbackRes = await app.request(
        `/api/service/tickets/${ticketIdA}/feedback`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${tokenTenantA}`,
          },
        },
      );

      expect(getFeedbackRes.status).toBe(200);
      const getBody = await getFeedbackRes.json();
      expect(getBody.success).toBe(true);
      expect(getBody.data.length).toBe(1);
      expect(getBody.data[0].score).toBe(5);

      // 5. Try to retrieve Tenant A's ticket feedback as Tenant B (should return 404 since Tenant A's ticket is invisible to Tenant B)
      const getFeedbackResB = await app.request(
        `/api/service/tickets/${ticketIdA}/feedback`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${tokenTenantB}`,
          },
        },
      );
      expect(getFeedbackResB.status).toBe(404);

      // 6. Try to submit CSAT feedback on Tenant A's ticket as Tenant B (should fail with 404 because Tenant A's ticket is invisible to Tenant B)
      const feedbackResB = await app.request(
        `/api/service/tickets/${ticketIdA}/feedback`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenTenantB}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            score: 1,
            comment: "Attempting RLS intrusion",
          }),
        },
      );
      expect(feedbackResB.status).toBe(404);

      // 7. Retrieve agent metrics for Tenant A's agent (user-a)
      const metricsRes = await app.request(
        "/api/service/agents/user-a/metrics",
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${tokenTenantA}`,
          },
        },
      );

      expect(metricsRes.status).toBe(200);
      const metricsBody = await metricsRes.json();
      expect(metricsBody.success).toBe(true);
      expect(metricsBody.data.totalTickets).toBe(1);
      expect(metricsBody.data.resolvedTickets).toBe(1);
      expect(metricsBody.data.averageCsat).toBe("5.00");
      expect(metricsBody.data.satisfactionRate).toBe(100);
    });
  });
});
