import { z } from "zod";
import { foreachStepSchema } from "./foreach";
import { ifStepSchema } from "./if";
import type { WorkflowStep } from "./types";

export const workflowActionSchema = z.object({
  type: z.enum(["webhook", "notification", "task", "field_update"]),
  target: z.string(),
  config: z
    .object({
      template: z.string().optional(),
      subject: z.string().optional(),
      body: z.string().optional(),
      dueDateOffsetDays: z.number().optional(),
      field: z.string().optional(),
      value: z.string().optional(),
    })
    .optional(),
});

export const actionStepSchema = z.object({
  type: z.literal("action"),
  action: workflowActionSchema,
});

export const stepSchema: z.ZodType<WorkflowStep> = z.lazy(() =>
  z.union([actionStepSchema, ifStepSchema, foreachStepSchema]),
);

/** Validate an untrusted step-program payload (throws on invalid). */
export function parseStepProgram(input: unknown): WorkflowStep[] {
  return z.array(stepSchema).parse(input);
}

/** Validate an untrusted step-program payload (returns a discriminated result). */
export function safeParseStepProgram(input: unknown) {
  return z.array(stepSchema).safeParse(input);
}
