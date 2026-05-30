import {
  calculateAdjustedForecast,
  calculateAgentCSATMetrics,
  calculateContractRenewalAmount,
  calculateGlobalCompetitorAnalytics,
  calculateNextRunDate,
  calculateNextStepExecutionTime,
  calculateRecipientEngagementScore,
  calculateSlaStatus,
  calculateStageVelocity,
  detectFolderLoop,
  generateStraightLineSchedules,
  getFieldValue,
  getNextValidSendingTime,
  getPartsInTimezone,
  incrementArticleViewCount,
  isContractInRenewalWindow,
  isDateInPeriod,
  rollupHierarchyPipeline,
  runReportInline,
  syncExternalItems,
  validateArticleStatus,
  validateCommunicationConsent,
  validateCSATFeedbackInput,
  validateHexColor,
  validatePicklistDependencies,
} from "@crm/core";
import { describe, expect, it } from "vitest";

describe("Shared Domain Utilities (Spec 061 & Spec 058)", () => {
  describe("calculations.ts", () => {
    it("1. calculateStageVelocity should compute stage velocities", () => {
      const now = new Date("2026-05-30T12:00:00Z");
      const history = [
        {
          opportunityId: "opp1",
          fromStage: "Qualification",
          toStage: "Proposal",
          createdAt: new Date("2026-05-25T12:00:00Z"),
        },
        {
          opportunityId: "opp1",
          fromStage: "Proposal",
          toStage: "Negotiation",
          createdAt: new Date("2026-05-27T12:00:00Z"),
        },
      ];
      const result = calculateStageVelocity(history, now);
      expect(result.Proposal).toBeDefined();
      expect(result.Proposal.transitionCount).toBe(1);
      expect(result.Proposal.averageDurationDays).toBe(2);
    });

    it("2. calculateContractRenewalAmount should escalate amounts correctly", () => {
      expect(calculateContractRenewalAmount("100.00", 10)).toBe("110.00");
      expect(calculateContractRenewalAmount("bad_value", 5)).toBe("0.00");
    });

    it("3. isContractInRenewalWindow should evaluate expiration windows", () => {
      const reference = new Date("2026-05-30T00:00:00Z");
      const contract = {
        status: "Active",
        endDate: new Date("2026-07-30T00:00:00Z"), // ~61 days out
      };
      expect(isContractInRenewalWindow(contract, 90, reference)).toBe(true);
      expect(isContractInRenewalWindow(contract, 30, reference)).toBe(false);
    });

    it("4. rollupHierarchyPipeline should sum pipeline across account tree", () => {
      const accounts = [
        { id: "parent", parentAccountId: null },
        { id: "child", parentAccountId: "parent" },
        { id: "grandchild", parentAccountId: "child" },
      ];
      const opportunities = [
        { id: "o1", accountId: "parent", amount: "1000", stage: "Proposal" },
        { id: "o2", accountId: "child", amount: "500", stage: "Closed Won" },
        {
          id: "o3",
          accountId: "grandchild",
          amount: "250",
          stage: "Qualification",
        },
      ];
      const result = rollupHierarchyPipeline(accounts, opportunities, "parent");
      expect(result.activePipeline).toBe("1250.00");
      expect(result.closedWonPipeline).toBe("500.00");
    });

    it("5. calculateSlaStatus should evaluate SLAs properly", () => {
      const created = new Date("2026-05-30T10:00:00Z");
      const metResponse = new Date("2026-05-30T10:15:00Z");
      const breachedResponse = new Date("2026-05-30T11:30:00Z");
      const current = new Date("2026-05-30T10:45:00Z");

      expect(calculateSlaStatus(created, 30, metResponse, current).status).toBe(
        "Met",
      );
      expect(
        calculateSlaStatus(created, 30, breachedResponse, current).status,
      ).toBe("Breached");
      expect(calculateSlaStatus(created, 30, null, current).status).toBe(
        "Breached",
      );
    });

    it("6. generateStraightLineSchedules should generate correct quantity and revenue schedules", () => {
      const start = new Date("2026-01-01T00:00:00Z");
      const schedules = generateStraightLineSchedules(
        "prod1",
        "100",
        3,
        start,
        "revenue",
      );
      expect(schedules).toHaveLength(3);
      expect(schedules[0].amount).toBe("33.33");
      expect(schedules[2].amount).toBe("33.34");
    });

    it("7. calculateAdjustedForecast should process manual and override forecast adjustments", () => {
      const adjustments = [
        {
          period: "2026-05",
          adjustmentType: "override_quota",
          amount: "50000",
        },
        {
          period: "2026-05",
          adjustmentType: "manager_adjustment",
          amount: "1000",
        },
      ];
      const result = calculateAdjustedForecast({
        period: "2026-05",
        baseQuota: 40000,
        baseWeightedAmount: 15000,
        closedWonAmount: 25000,
        adjustments,
      });
      expect(result.adjustedQuota).toBe(50000);
      expect(result.adjustedWeightedAmount).toBe(16000);
    });
  });

  describe("analytics.ts", () => {
    it("8. calculateGlobalCompetitorAnalytics should compute stats based on opportunities", () => {
      const competitors = [
        {
          id: "c1",
          opportunityId: "o1",
          name: "CompetitorA",
          winLossStatus: "Lost" as const,
        },
      ];
      const opportunities = [{ id: "o1", amount: "100", stage: "Closed Won" }];
      const analytics = calculateGlobalCompetitorAnalytics({
        competitors,
        opportunities,
      });
      expect(analytics).toHaveLength(1);
      expect(analytics[0].name).toBe("CompetitorA");
      expect(analytics[0].winRate).toBe(100);
    });

    it("9. calculateAgentCSATMetrics should summarize ticket metrics", () => {
      const tickets = [
        {
          id: "t1",
          assignedToId: "agent1",
          status: "Resolved",
          createdAt: new Date("2026-05-30T10:00:00Z"),
          resolvedAt: new Date("2026-05-30T10:30:00Z"),
        },
      ];
      const responses = [{ id: "r1", ticketId: "t1", score: 5 }];
      const metrics = calculateAgentCSATMetrics({
        agentId: "agent1",
        tickets,
        responses,
      });
      expect(metrics.totalTickets).toBe(1);
      expect(metrics.satisfactionRate).toBe(100);
      expect(metrics.averageResolutionTimeMinutes).toBe(30);
    });

    it("10. calculateRecipientEngagementScore should compute robust score", () => {
      const score = calculateRecipientEngagementScore({
        openCount: 2,
        clickCount: 1,
        replyCount: 1,
        isUnsubscribed: true,
        readTimeEvents: [{ readClassification: "read" }],
        bounceEvents: [],
      });
      // 2*1 + 1*3 + 1*10 - 15 + 5 = 5
      expect(score).toBe(5);
    });
  });

  describe("fields.ts", () => {
    it("11. getFieldValue should handle nested and custom properties", () => {
      const record = {
        name: "Test Lead",
        custom: {
          score: 85,
        },
        address: {
          city: "San Francisco",
        },
      };
      expect(getFieldValue(record, "name")).toBe("Test Lead");
      expect(getFieldValue(record, "custom.score")).toBe(85);
      expect(getFieldValue(record, "score")).toBe(85);
      expect(getFieldValue(record, "address.city")).toBe("San Francisco");
    });

    it("12. validatePicklistDependencies should prevent invalid combinations", () => {
      const fields = {
        country: "US",
        state: "CA",
      };
      const dependencies = [
        {
          parentField: "country",
          dependentField: "state",
          dependencyMap: {
            US: ["CA", "NY"],
            CA: ["ON", "QC"],
          },
        },
      ];
      expect(validatePicklistDependencies(fields, dependencies).success).toBe(
        true,
      );

      const invalidFields = { country: "US", state: "QC" };
      expect(
        validatePicklistDependencies(invalidFields, dependencies).success,
      ).toBe(false);
    });

    it("13. validateHexColor should enforce exact matches", () => {
      expect(validateHexColor("#FF00FF")).toBe(true);
      expect(validateHexColor("FF00FF")).toBe(false);
      expect(validateHexColor("#FF00FF1")).toBe(false);
    });
  });

  describe("sequences.ts", () => {
    it("14. getPartsInTimezone should format properties accurately", () => {
      const dt = new Date("2026-05-30T12:00:00Z");
      const utc = getPartsInTimezone(dt, "UTC");
      expect(utc.hour).toBe(12);
    });

    it("15. getNextValidSendingTime should evaluate timezone windows", () => {
      const current = new Date("2026-05-27T12:00:00Z");
      const nextTime = getNextValidSendingTime(
        current,
        [1, 2, 3, 4, 5],
        "09:00",
        "17:00",
        "UTC",
      );
      // Current 12:00 is within 09:00 - 17:00 and on a valid weekday (Wednesday)
      expect(nextTime.getTime()).toBe(current.getTime());
    });
  });

  describe("reporting.ts", () => {
    it("16. detectFolderLoop should identify parent loops", () => {
      const folders = [
        { id: "f1", parentFolderId: "f2", name: "Folder 1" },
        { id: "f2", parentFolderId: null, name: "Folder 2" },
      ];
      expect(detectFolderLoop("f2", "f1", folders)).toBe(true);
      expect(detectFolderLoop("f2", null, folders)).toBe(false);
    });

    it("17. isDateInPeriod should evaluate quarters and months", () => {
      const dt = new Date("2026-05-15T00:00:00Z");
      expect(isDateInPeriod(dt, "2026-05")).toBe(true);
      expect(isDateInPeriod(dt, "2026-Q2")).toBe(true);
      expect(isDateInPeriod(dt, "2026-Q3")).toBe(false);
    });
  });
});
