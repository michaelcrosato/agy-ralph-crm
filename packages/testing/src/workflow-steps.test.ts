// biome-ignore-all lint/suspicious/noThenProperty: workflow IF-step "then" field (spec 032); step literals are plain data, never awaited.
import {
  evaluateCondition,
  executeSteps,
  parseStepProgram,
  safeParseStepProgram,
  type WorkflowStep,
} from "@crm/workflow";
import { describe, expect, it } from "vitest";

describe("Spec 032: workflow IF/FOREACH step engine", () => {
  it("runs the THEN branch when the IF condition is true", () => {
    const steps: WorkflowStep[] = [
      {
        type: "if",
        condition: "stage == 'Closed Won'",
        then: [
          { type: "action", action: { type: "notification", target: "won" } },
        ],
        else: [
          { type: "action", action: { type: "notification", target: "nope" } },
        ],
      },
    ];
    const res = executeSteps(steps, { stage: "Closed Won" });
    expect(res.actions.map((a) => a.target)).toEqual(["won"]);
  });

  it("runs the ELSE branch (short-circuit) when the IF condition is false", () => {
    const steps: WorkflowStep[] = [
      {
        type: "if",
        condition: "amount > 1000",
        then: [{ type: "action", action: { type: "webhook", target: "big" } }],
        else: [
          { type: "action", action: { type: "webhook", target: "small" } },
        ],
      },
    ];
    const res = executeSteps(steps, { amount: 500 });
    expect(res.actions.map((a) => a.target)).toEqual(["small"]);
  });

  it("supports nested IF inside a THEN branch", () => {
    const steps: WorkflowStep[] = [
      {
        type: "if",
        condition: "tier == 'gold'",
        then: [
          {
            type: "if",
            condition: "balance > 100",
            then: [
              {
                type: "action",
                action: { type: "task", target: "vip-followup" },
              },
            ],
          },
        ],
      },
    ];
    const won = executeSteps(steps, { tier: "gold", balance: 250 });
    expect(won.actions.map((a) => a.target)).toEqual(["vip-followup"]);
    const skipped = executeSteps(steps, { tier: "gold", balance: 10 });
    expect(skipped.actions).toHaveLength(0);
  });

  it("iterates a FOREACH collection and binds the item variable", () => {
    const steps: WorkflowStep[] = [
      {
        type: "foreach",
        collection: "contacts",
        item: "contact",
        body: [
          {
            type: "if",
            condition: "contact.daysSinceActivity > 30",
            then: [
              {
                type: "action",
                action: { type: "notification", target: "re-engage" },
              },
            ],
          },
        ],
      },
    ];
    const res = executeSteps(steps, {
      contacts: [
        { daysSinceActivity: 45 },
        { daysSinceActivity: 5 },
        { daysSinceActivity: 60 },
      ],
    });
    expect(res.iterations).toBe(3);
    expect(res.actions).toHaveLength(2);
  });

  it("enforces the maxIterations cap (infinite-loop guardrail)", () => {
    const items = Array.from({ length: 50 }, (_, i) => i);
    const steps: WorkflowStep[] = [
      {
        type: "foreach",
        collection: "items",
        item: "n",
        maxIterations: 10,
        body: [{ type: "action", action: { type: "webhook", target: "ping" } }],
      },
    ];
    const res = executeSteps(steps, { items });
    expect(res.iterations).toBe(10);
    expect(res.actions).toHaveLength(10);
    expect(res.trace.some((t) => t.type === "foreach.capped")).toBe(true);
  });

  it("records an execution trace of the path taken", () => {
    const steps: WorkflowStep[] = [
      {
        type: "foreach",
        collection: "xs",
        item: "x",
        body: [
          {
            type: "if",
            condition: "x > 1",
            then: [
              { type: "action", action: { type: "webhook", target: "hi" } },
            ],
          },
        ],
      },
    ];
    const res = executeSteps(steps, { xs: [1, 2] });
    expect(res.trace.map((t) => t.type)).toEqual([
      "foreach.iteration",
      "if",
      "foreach.iteration",
      "if",
      "action",
    ]);
  });

  it("evaluates every DSL operator without eval/Function", () => {
    const ctx = {
      stage: "Closed Won",
      amount: 2500,
      tags: ["vip", "enterprise"],
      email: "a@example.com",
      status: "active",
    };
    expect(evaluateCondition("stage == 'Closed Won'", ctx)).toBe(true);
    expect(evaluateCondition("stage != 'Lost'", ctx)).toBe(true);
    expect(evaluateCondition("amount > 1000", ctx)).toBe(true);
    expect(evaluateCondition("amount < 1000", ctx)).toBe(false);
    expect(evaluateCondition("status in ['active', 'pending']", ctx)).toBe(
      true,
    );
    expect(evaluateCondition("tags contains 'vip'", ctx)).toBe(true);
    expect(evaluateCondition("email matches '@example.com'", ctx)).toBe(true);
  });

  it("validates step-program payloads with the Zod schema", () => {
    const valid = [
      {
        type: "foreach",
        collection: "contacts",
        item: "c",
        body: [
          {
            type: "if",
            condition: "c.active == true",
            then: [
              { type: "action", action: { type: "webhook", target: "x" } },
            ],
          },
        ],
      },
    ];
    expect(() => parseStepProgram(valid)).not.toThrow();

    const missingCondition = [{ type: "if", then: [] }];
    expect(safeParseStepProgram(missingCondition).success).toBe(false);

    const overCap = [
      {
        type: "foreach",
        collection: "xs",
        item: "x",
        body: [],
        maxIterations: 99999,
      },
    ];
    expect(safeParseStepProgram(overCap).success).toBe(false);
  });
});
