import type { WorkflowAction } from "../index";

export const DEFAULT_MAX_ITERATIONS = 1000;

/** Leaf step: emit an existing ECA-style action. */
export interface ActionStep {
  type: "action";
  action: WorkflowAction;
}

/** Conditional branch driven by a DSL condition string. */
export interface IfStep {
  type: "if";
  condition: string;
  then: WorkflowStep[];
  else?: WorkflowStep[];
}

/** Bounded loop over a resolved collection expression. */
export interface ForeachStep {
  type: "foreach";
  collection: string;
  item: string;
  body: WorkflowStep[];
  maxIterations?: number;
}

export type WorkflowStep = ActionStep | IfStep | ForeachStep;

export interface StepTraceEntry {
  type: string;
  detail?: string;
}

export interface StepExecutionResult {
  actions: WorkflowAction[];
  trace: StepTraceEntry[];
  iterations: number;
}

/** Internal: how IF/FOREACH handlers recurse back into the executor. */
export type RunSteps = (
  steps: WorkflowStep[],
  context: Record<string, unknown>,
) => void;
