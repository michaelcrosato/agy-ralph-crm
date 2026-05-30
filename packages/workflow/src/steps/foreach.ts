import { z } from "zod";
import { evaluateExpression } from "../dsl/conditions";
import { stepSchema } from "./schema";
import {
  DEFAULT_MAX_ITERATIONS,
  type ForeachStep,
  type RunSteps,
  type StepTraceEntry,
} from "./types";

export const foreachStepSchema: z.ZodType<ForeachStep> = z.lazy(() =>
  z.object({
    type: z.literal("foreach"),
    collection: z.string().min(1),
    item: z.string().min(1),
    body: z.array(stepSchema),
    maxIterations: z
      .number()
      .int()
      .positive()
      .max(DEFAULT_MAX_ITERATIONS)
      .optional(),
  }),
);

export function executeForeachStep(
  step: ForeachStep,
  context: Record<string, unknown>,
  runSteps: RunSteps,
  trace: StepTraceEntry[],
  counter: { iterations: number },
): void {
  const raw = evaluateExpression(step.collection, context);
  const collection = Array.isArray(raw) ? raw : [];
  const max = step.maxIterations ?? DEFAULT_MAX_ITERATIONS;
  const limit = Math.min(collection.length, max);
  if (collection.length > max) {
    trace.push({
      type: "foreach.capped",
      detail: `${step.collection}: ${collection.length} items exceeds maxIterations ${max}`,
    });
  }
  for (let i = 0; i < limit; i++) {
    counter.iterations++;
    trace.push({ type: "foreach.iteration", detail: `${step.item}#${i}` });
    runSteps(step.body, { ...context, [step.item]: collection[i] });
  }
}
