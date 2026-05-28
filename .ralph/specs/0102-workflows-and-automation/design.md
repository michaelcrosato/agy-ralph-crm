# Specification: Workflow REST API & Event-Triggered Automation - Design

## Database Storage Expansion
We will expand the in-memory `dbStore` inside `packages/db/src/index.ts` to include:
- `workflows` persistent array storing `DBWorkflow`:
  ```typescript
  export interface DBWorkflow {
    id: string;
    orgId: string;
    name: string;
    triggerEvent: string;
    conditions: {
      field: string;
      operator: "equals" | "not_equals";
      value: string;
    } | null;
    actions: {
      type: "webhook" | "notification";
      target: string;
    }[];
  }
  ```
- Standard RLS isolation find/insert methods on `dbStore.workflows`.

## Event Automation Handler Integration
1. Define a helper method or integrate inside `POST /api/leads/:id/convert` where opportunities are created:
   ```typescript
   // On opportunity creation
   const rules = await dbStore.workflows.findMany();
   const execution = await executeWorkflows({
     name: "opportunity.stage_changed",
     payload: {
       id: opp.id,
       stage: opp.stage,
       amount: opp.amount
     }
   }, rules);
   ```
2. Include the triggered workflow execution summaries in the final API response.
