# Task 0160: Support Ticket CSAT Feedback Integration - Design

## 1. Database Schema Extensions

### 1.1 `survey_responses` Table
- Extend `surveyResponses` table definition in `packages/db/src/schema.ts` to include:
  ```typescript
  ticketId: uuid("ticket_id").references(() => tickets.id, {
    onDelete: "set null",
  }),
  ```

### 1.2 DB In-Memory Store CRUD Mappings
- Update `DBSurveyResponse` interface in `packages/db/src/index.ts` to include:
  ```typescript
  ticketId: string | null;
  ```
- Update `dbStore.surveyResponses` to support saving and querying by `ticketId`. Specifically, add:
  ```typescript
  findByTicket: async (ticketId: string) => {
    const orgId = getActiveOrgId();
    return store.surveyResponses.filter(
      (r) => r.ticketId === ticketId && r.orgId === orgId,
    );
  }
  ```

## 2. Core Business Logic Helpers (`packages/core`)

### 2.1 Agent Metrics Aggregator
```typescript
export interface AgentCSATMetricsInput {
  agentId: string;
  tickets: {
    id: string;
    assignedToId: string | null;
    status: string;
    createdAt: Date;
    resolvedAt?: Date | null; // fallbacks to current date or closedDate
  }[];
  responses: {
    ticketId: string | null;
    score: number;
  }[];
}

export interface AgentCSATMetricsResult {
  totalTickets: number;
  resolvedTickets: number;
  averageCsat: string; // 2 decimal string, e.g. "4.50"
  satisfactionRate: number; // percentage of 4-5 scores, e.g. 80
  averageResolutionTimeMinutes: number; // average duration in minutes
}
```

Implement `calculateAgentCSATMetrics` inside `packages/core/src/index.ts` to process these metrics.

## 3. REST API Routes (`apps/api`)

### 3.1 Submit CSAT Feedback
- **Route**: `POST /api/service/tickets/:id/feedback`
- **Controller Action**:
  - Read `score`, `comment`, and optional `surveyId` from body.
  - Verify active tenant authorization matching ticket orgId.
  - Find or create a default survey of type "csat" if no `surveyId` is passed.
  - Add survey response with `ticketId`.
  - Update ticket status to "Resolved" if not already resolved/closed.
  - Log audit log with action `submit_feedback`.

### 3.2 Retrieve Ticket Feedback
- **Route**: `GET /api/service/tickets/:id/feedback`
- **Controller Action**:
  - Verify active tenant matches ticket orgId.
  - Find all `surveyResponses` matching the `ticketId` under tenant context.

### 3.3 Retrieve Agent Metrics
- **Route**: `GET /api/service/agents/:id/metrics`
- **Controller Action**:
  - Retrieve all tickets assigned to the agent `id`.
  - Retrieve all CSAT survey responses linked to those tickets.
  - Run the core aggregation logic and return `AgentCSATMetricsResult`.
