import {
  type WorkflowEvent,
  type WorkflowRule,
  executeWorkflows,
} from "@crm/workflow";
import { describe, expect, it } from "vitest";

describe("Phase 4: ECA Workflow Engine Tests", () => {
  it("should successfully trigger actions when event trigger and condition parameters match", async () => {
    const rules: WorkflowRule[] = [
      {
        id: "rule-1",
        triggerEvent: "opportunity.stage_changed",
        conditions: {
          field: "stage",
          operator: "equals",
          value: "Closed Won",
        },
        actions: [
          {
            type: "webhook",
            target: "https://api.external.com/endpoints/sales",
          },
          {
            type: "notification",
            target: "Sales target reached! Deal Closed Won.",
          },
        ],
      },
    ];

    // Case 1: Match conditions
    const matchedEvent: WorkflowEvent = {
      name: "opportunity.stage_changed",
      payload: {
        id: "opp-111",
        stage: "Closed Won",
        amount: 250000,
      },
    };

    const resMatched = await executeWorkflows(matchedEvent, rules);
    expect(resMatched.dispatchedWebhooks.length).toBe(1);
    expect(resMatched.notificationsCreated.length).toBe(1);
    expect(resMatched.dispatchedWebhooks[0]).toContain(
      "https://api.external.com/endpoints/sales",
    );
    expect(resMatched.notificationsCreated[0]).toContain(
      "Sales target reached!",
    );

    // Case 2: Event triggers but conditions mismatch
    const unmatchedEvent: WorkflowEvent = {
      name: "opportunity.stage_changed",
      payload: {
        id: "opp-111",
        stage: "Qualification",
        amount: 250000,
      },
    };

    const resUnmatched = await executeWorkflows(unmatchedEvent, rules);
    expect(resUnmatched.dispatchedWebhooks.length).toBe(0);
    expect(resUnmatched.notificationsCreated.length).toBe(0);
  });
});
