# Specification: Case Service Level Agreements (SLA) & Milestone Management Engine - Design

## 1. Database Schema Definitions

### 1.1 Drizzle Schema (`packages/db/src/schema.ts`)
```typescript
export const slaPolicies = pgTable("sla_policies", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  priority: text("priority").notNull(), // "high" | "medium" | "low"
  responseTimeLimitMinutes: integer("response_time_limit_minutes").notNull(),
  resolutionTimeLimitMinutes: integer("resolution_time_limit_minutes").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const ticketMilestones = pgTable("ticket_milestones", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  ticketId: uuid("ticket_id")
    .notNull()
    .references(() => tickets.id, { onDelete: "cascade" }),
  milestoneType: text("milestone_type").notNull(), // "first_response" | "resolution"
  targetTime: timestamp("target_time").notNull(),
  completedAt: timestamp("completed_at"),
  status: text("status").notNull().default("pending"), // "pending" | "completed" | "breached"
  isMet: boolean("is_met"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

### 1.2 Store Interfaces (`packages/db/src/index.ts`)
```typescript
export interface DBSlaPolicy {
  id: string;
  orgId: string;
  name: string;
  priority: "high" | "medium" | "low";
  responseTimeLimitMinutes: number;
  resolutionTimeLimitMinutes: number;
  isActive: boolean;
  createdAt: Date;
}

export interface DBTicketMilestone {
  id: string;
  orgId: string;
  ticketId: string;
  milestoneType: "first_response" | "resolution";
  targetTime: Date;
  completedAt: Date | null;
  status: "pending" | "completed" | "breached";
  isMet: boolean | null;
  createdAt: Date;
}
```

## 2. Core Business Logic Engine (`packages/core/src/index.ts`)

### 2.1 Pure Functions
- **SLA Target Due Date Calculator**:
  ```typescript
  export function calculateMilestoneDueDate(createdAt: Date, limitMinutes: number): Date {
    return new Date(createdAt.getTime() + limitMinutes * 60 * 1000);
  }
  ```
- **Milestone Evaluator**:
  ```typescript
  export function evaluateMilestoneCompletion(
    targetTime: Date,
    completedAt: Date,
  ): { isMet: boolean; status: "completed" | "breached" } {
    const isMet = completedAt.getTime() <= targetTime.getTime();
    return {
      isMet,
      status: isMet ? "completed" : "breached",
    };
  }
  ```

## 3. Hono API Routes (`apps/api/src/index.ts`)
- **SLA Policies CRUD**:
  - `POST /api/service/sla-policies` - Validate priority (`high` | `medium` | `low`), create policy, insert audit log.
  - `GET /api/service/sla-policies` - Query current tenant's active SLA policies.
- **Milestone Enrollment**:
  - `POST /api/service/tickets/:id/milestones` - Query active SLA Policy matching priority. Call `calculateMilestoneDueDate` twice. Insert milestones.
  - `GET /api/service/tickets/:id/milestones` - Get all milestones for ticket, filtering by tenant `orgId`.
- **Milestone Completion**:
  - `PUT /api/service/tickets/:id/milestones/:milestoneId` - Fetch milestone, throw if already completed. Update milestone using current date as `completedAt` and call `evaluateMilestoneCompletion`. Record audit trail.
