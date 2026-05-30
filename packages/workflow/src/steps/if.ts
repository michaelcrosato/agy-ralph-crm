import { z } from "zod";
import { evaluateCondition } from "../dsl/conditions";
import { stepSchema } from "./schema";
import type { IfStep, RunSteps, StepTraceEntry } from "./types";

export const ifStepSchema: z.ZodType<IfStep> = z.lazy(() =>
  z.object({
    type: z.literal("if"),
    condition: z.string().min(1),
    // biome-ignore lint/suspicious/noThenProperty: "then" is the IF-step DSL field (spec 032); step descriptors are plain data, never awaited.
    then: z.array(stepSchema),
    else: z.array(stepSchema).optional(),
  }),
);

export function executeIfStep(
  step: IfStep,
  context: Record<string, unknown>,
  runSteps: RunSteps,
  trace: StepTraceEntry[],
): void {
  const passed = evaluateCondition(step.condition, context);
  trace.push({ type: "if", detail: `${step.condition} => ${passed}` });
  if (passed) {
    runSteps(step.then, context);
  } else if (step.else) {
    runSteps(step.else, context);
  }
}
