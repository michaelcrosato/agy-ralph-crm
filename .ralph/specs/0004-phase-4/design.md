# Phase 4: Workflow Engine & External Interface Integration - Design

## Database Schema (Drizzle ORM)

We will define `workflows` and `webhooks` in `packages/db/src/schema.ts`:

* **`workflows`**
  * `id`: uuid (primary key)
  * `orgId`: uuid (tenant)
  * `name`: text (non-nullable)
  * `triggerEvent`: text (e.g. "opportunity.stage_changed")
  * `conditions`: jsonb (e.g. "stage equals Closed Won")
  * `actions`: jsonb (array of actions, e.g. webhooks, updates)

* **`webhooks`**
  * `id`: uuid (primary key)
  * `orgId`: uuid
  * `targetUrl`: text (non-nullable)
  * `secret`: text (for payload signing)
  * `status`: text (active, suspended)

## ECA Engine Contracts

In `packages/workflow/src/index.ts`:
* Parse and match workflow logic:
```typescript
export interface WorkflowRule {
  id: string;
  triggerEvent: string;
  conditions: {
    field: string;
    operator: "equals" | "not_equals";
    value: string;
  };
  actions: Array<{
    type: "webhook" | "notification";
    target: string;
  }>;
}

export function executeWorkflows(
  event: { name: string; payload: Record<string, unknown> },
  rules: WorkflowRule[]
): Promise<{ dispatchedWebhooks: string[]; notificationsCreated: string[] }>;
```
