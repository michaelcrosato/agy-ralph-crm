export const WORKFLOW_VERSION = "0.1.0";

export interface WorkflowAction {
  type: "webhook" | "notification";
  target: string;
}

export interface WorkflowRule {
  id: string;
  triggerEvent: string;
  conditions: {
    field: string;
    operator: "equals" | "not_equals";
    value: string;
  } | null;
  actions: WorkflowAction[];
}

export interface WorkflowEvent {
  name: string;
  payload: Record<string, unknown>;
}

// executeWorkflows parses incoming dynamic events and matches against workflow criteria
export async function executeWorkflows(
  event: WorkflowEvent,
  rules: WorkflowRule[],
): Promise<{ dispatchedWebhooks: string[]; notificationsCreated: string[] }> {
  const dispatchedWebhooks: string[] = [];
  const notificationsCreated: string[] = [];

  for (const rule of rules) {
    if (rule.triggerEvent !== event.name) {
      continue; // Skip rules for other trigger events
    }

    let conditionPassed = true;

    if (rule.conditions) {
      const fieldValue = String(event.payload[rule.conditions.field]);
      const expectedValue = rule.conditions.value;

      if (rule.conditions.operator === "equals") {
        conditionPassed = fieldValue === expectedValue;
      } else if (rule.conditions.operator === "not_equals") {
        conditionPassed = fieldValue !== expectedValue;
      }
    }

    if (conditionPassed) {
      for (const action of rule.actions) {
        if (action.type === "webhook") {
          // Mocking out webhook dispatcher gateway
          dispatchedWebhooks.push(
            `Dispatched webhook payload to: ${action.target}`,
          );
        } else if (action.type === "notification") {
          // Mocking out notification alert logger gateway
          notificationsCreated.push(
            `Logged notification alert: ${action.target}`,
          );
        }
      }
    }
  }

  return { dispatchedWebhooks, notificationsCreated };
}
