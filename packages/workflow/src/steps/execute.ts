import type { WorkflowAction } from "../index";
import { executeForeachStep } from "./foreach";
import { executeIfStep } from "./if";
import type {
  RunSteps,
  StepExecutionResult,
  StepTraceEntry,
  WorkflowStep,
} from "./types";

/** Walk a step program against a context, collecting actions + an execution trace. */
export function executeSteps(
  steps: WorkflowStep[],
  rootContext: Record<string, unknown> = {},
): StepExecutionResult {
  const actions: WorkflowAction[] = [];
  const trace: StepTraceEntry[] = [];
  const counter = { iterations: 0 };

  const runSteps: RunSteps = (list, context) => {
    for (const step of list) {
      switch (step.type) {
        case "action":
          actions.push(step.action);
          trace.push({ type: "action", detail: step.action.type });
          break;
        case "if":
          executeIfStep(step, context, runSteps, trace);
          break;
        case "foreach":
          executeForeachStep(step, context, runSteps, trace, counter);
          break;
      }
    }
  };

  runSteps(steps, rootContext);
  return { actions, trace, iterations: counter.iterations };
}
