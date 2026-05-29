# Specification: Workflow Event-Condition-Action (ECA) Upgrades - Design

## 1. Data Schema & Types

### 1.1 Recursive Condition Type
We define a recursive condition evaluation type to support both simple and nested logical conditions:

```typescript
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
```

### 1.2 Upgraded Action Config
We extend the standard `WorkflowAction` to include optional configuration mappings:

```typescript
export interface WorkflowAction {
  type: "webhook" | "notification" | "task" | "field_update";
  target: string;
  config?: {
    template?: string; // Slack-like template
    subject?: string;   // For tasks
    body?: string;      // For tasks
    dueDateOffsetDays?: number; // For tasks
    field?: string;     // For field_update
    value?: string;     // For field_update
  };
}
```

## 2. Core Evaluation Algorithms

### 2.1 Nested Conditions Evaluator
The engine implements a recursive matching function `evaluateCondition(payload, condition)`:
1. If the condition has `field`, `operator`, and `value`, evaluate it directly based on the operator (coercing values to strings or numbers where appropriate).
2. If it is a logical condition containing `all`, return `true` if and only if every nested condition evaluates to `true`.
3. If it contains `any`, return `true` if at least one nested condition evaluates to `true`.

### 2.2 Advanced Action Executor
When evaluating and executing actions:
1. **Webhook Templating**: Use string interpolation (`replace(/{(\w+)}/g, ...)`) to compile the template.
2. **Automated Tasks**: Insert a task activity record into `dbStore.activities` (and link via `dbStore.activityLinks` if `payload.id` is available) in the active tenant's context.
3. **Field Updates**: Mutate the matching database entity using `dbStore.[entity].update` within the active tenant's context.
