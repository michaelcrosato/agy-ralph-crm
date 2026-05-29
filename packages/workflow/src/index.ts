export const WORKFLOW_VERSION = "0.1.0";

export type WorkflowConditionOperator =
  | "equals"
  | "not_equals"
  | "greater_than"
  | "less_than"
  | "contains";

export interface SimpleCondition {
  field: string;
  operator: WorkflowConditionOperator;
  value: string;
}

export interface LogicalCondition {
  any?: (SimpleCondition | LogicalCondition)[];
  all?: (SimpleCondition | LogicalCondition)[];
}

export type WorkflowConditions = SimpleCondition | LogicalCondition;

export interface WorkflowAction {
  type: "webhook" | "notification" | "task" | "field_update";
  target: string;
  config?: {
    template?: string;
    subject?: string;
    body?: string;
    dueDateOffsetDays?: number;
    field?: string;
    value?: string;
  };
}

export interface WorkflowRule {
  id: string;
  triggerEvent: string;
  conditions: WorkflowConditions | null;
  actions: WorkflowAction[];
}

export interface WorkflowEvent {
  name: string;
  payload: Record<string, unknown>;
}

export interface WorkflowExecutionContext {
  dbStore?: {
    activities: {
      insert: (activity: {
        orgId: string;
        creatorId: string;
        type: "task" | "call" | "note" | "email";
        subject: string;
        body: string | null;
        dueDate: Date | null;
      }) => Promise<{ id: string }>;
    };
    activityLinks: {
      insert: (link: {
        orgId: string;
        activityId: string;
        targetType: "Opportunity" | "Lead" | "Account" | "Contact";
        targetId: string;
      }) => Promise<unknown>;
    };
    opportunities: {
      update: (
        id: string,
        updates: Record<string, unknown>,
      ) => Promise<unknown>;
    };
  };
  userId?: string;
  orgId?: string;
}

function matchCondition(
  payload: Record<string, unknown>,
  cond: WorkflowConditions,
): boolean {
  if (!cond) return true;

  // Type check: Is it a logical condition?
  const logical = cond as LogicalCondition;
  if (logical.all !== undefined || logical.any !== undefined) {
    if (logical.all) {
      return logical.all.every((sub) => matchCondition(payload, sub));
    }
    if (logical.any) {
      return logical.any.some((sub) => matchCondition(payload, sub));
    }
    return true;
  }

  // Simple condition
  const simple = cond as SimpleCondition;
  if (!simple.field) return true;

  const rawVal = payload[simple.field];
  const fieldValue =
    rawVal !== undefined && rawVal !== null ? String(rawVal) : "";
  const expectedValue = simple.value;

  switch (simple.operator) {
    case "equals":
      return fieldValue === expectedValue;
    case "not_equals":
      return fieldValue !== expectedValue;
    case "greater_than": {
      const fNum = Number(fieldValue);
      const eNum = Number(expectedValue);
      return !Number.isNaN(fNum) && !Number.isNaN(eNum)
        ? fNum > eNum
        : fieldValue > expectedValue;
    }
    case "less_than": {
      const fNum = Number(fieldValue);
      const eNum = Number(expectedValue);
      return !Number.isNaN(fNum) && !Number.isNaN(eNum)
        ? fNum < eNum
        : fieldValue < expectedValue;
    }
    case "contains":
      return fieldValue.includes(expectedValue);
    default:
      return false;
  }
}

// executeWorkflows parses incoming dynamic events and matches against workflow criteria
export async function executeWorkflows(
  event: WorkflowEvent,
  rules: WorkflowRule[],
  context?: WorkflowExecutionContext,
): Promise<{
  dispatchedWebhooks: string[];
  notificationsCreated: string[];
  tasksCreated: string[];
  fieldsUpdated: { field: string; value: string }[];
}> {
  const dispatchedWebhooks: string[] = [];
  const notificationsCreated: string[] = [];
  const tasksCreated: string[] = [];
  const fieldsUpdated: { field: string; value: string }[] = [];

  for (const rule of rules) {
    if (rule.triggerEvent !== event.name) {
      continue; // Skip rules for other trigger events
    }

    let conditionPassed = true;

    if (rule.conditions) {
      conditionPassed = matchCondition(event.payload, rule.conditions);
    }

    if (conditionPassed) {
      for (const action of rule.actions) {
        if (action.type === "webhook") {
          let target = action.target;
          if (action.config?.template) {
            let compiled = action.config.template;
            for (const [key, value] of Object.entries(event.payload)) {
              compiled = compiled.replace(
                new RegExp(`{${key}}`, "g"),
                String(value),
              );
            }
            target = `${action.target}?payload=${encodeURIComponent(compiled)}`;
          }
          dispatchedWebhooks.push(`Dispatched webhook payload to: ${target}`);
        } else if (action.type === "notification") {
          let target = action.target;
          if (action.config?.template) {
            let compiled = action.config.template;
            for (const [key, value] of Object.entries(event.payload)) {
              compiled = compiled.replace(
                new RegExp(`{${key}}`, "g"),
                String(value),
              );
            }
            target = compiled;
          }
          notificationsCreated.push(`Logged notification alert: ${target}`);
        } else if (action.type === "task") {
          if (context?.dbStore && context.orgId) {
            const subject =
              action.config?.subject || action.target || "Automated Task";
            const body = action.config?.body || null;
            let dueDate: Date | null = null;
            if (action.config?.dueDateOffsetDays !== undefined) {
              dueDate = new Date();
              dueDate.setDate(
                dueDate.getDate() + action.config.dueDateOffsetDays,
              );
            }
            const task = await context.dbStore.activities.insert({
              orgId: context.orgId,
              creatorId: context.userId || "system",
              type: "task",
              subject,
              body,
              dueDate,
            });
            if (event.payload.id) {
              let targetType:
                | "Opportunity"
                | "Lead"
                | "Account"
                | "Contact"
                | undefined;
              if (event.name.startsWith("opportunity"))
                targetType = "Opportunity";
              else if (event.name.startsWith("lead")) targetType = "Lead";
              else if (event.name.startsWith("account")) targetType = "Account";
              else if (event.name.startsWith("contact")) targetType = "Contact";

              if (targetType) {
                await context.dbStore.activityLinks.insert({
                  orgId: context.orgId,
                  activityId: task.id,
                  targetType,
                  targetId: String(event.payload.id),
                });
              }
            }
            tasksCreated.push(`Created task: ${subject}`);
          } else {
            tasksCreated.push(
              `Mock created task: ${action.config?.subject || action.target}`,
            );
          }
        } else if (action.type === "field_update") {
          const fieldName = action.config?.field;
          const fieldValue = action.config?.value;
          if (fieldName && fieldValue !== undefined) {
            if (context?.dbStore && event.payload.id) {
              if (event.name.startsWith("opportunity")) {
                await context.dbStore.opportunities.update(
                  String(event.payload.id),
                  {
                    [fieldName]: fieldValue,
                  },
                );
              }
            }
            fieldsUpdated.push({ field: fieldName, value: fieldValue });
          }
        }
      }
    }
  }

  return {
    dispatchedWebhooks,
    notificationsCreated,
    tasksCreated,
    fieldsUpdated,
  };
}
