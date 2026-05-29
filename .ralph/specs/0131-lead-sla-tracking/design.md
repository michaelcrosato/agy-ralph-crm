# Spec 0131: Lead SLA & Response Aging Tracking Design

## 1. Database Schema Mappings (`packages/db/src/schema.ts`)

```typescript
export const leadSlaTargets = pgTable("lead_sla_targets", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  maxResponseTimeMinutes: integer("max_response_time_minutes").notNull().default(60),
  isActive: integer("is_active").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const leadSlaTrackers = pgTable("lead_sla_trackers", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  leadId: uuid("lead_id")
    .notNull()
    .references(() => leads.id, { onDelete: "cascade" }),
  targetId: uuid("target_id")
    .notNull()
    .references(() => leadSlaTargets.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("Pending"), // "Pending" | "Met" | "Breached"
  createdAt: timestamp("created_at").notNull().defaultNow(),
  respondedAt: timestamp("responded_at"),
  responseTimeMinutes: integer("response_time_minutes"),
});
```

## 2. Store Interfaces (`packages/db/src/index.ts`)

```typescript
export interface DBLeadSlaTarget {
  id: string;
  orgId: string;
  maxResponseTimeMinutes: number;
  isActive: number;
  createdAt: Date;
}

export interface DBLeadSlaTracker {
  id: string;
  orgId: string;
  leadId: string;
  targetId: string;
  status: string;
  createdAt: Date;
  respondedAt: Date | null;
  responseTimeMinutes: number | null;
}
```

Add these interfaces and matching in-memory dbStore collections to `packages/db/src/index.ts`.

## 3. Core Business Logic (`packages/core/src/index.ts`)

```typescript
export function calculateSlaStatus(
  createdAt: Date,
  maxResponseTimeMinutes: number,
  respondedAt: Date | null,
  currentTime: Date
): { status: "Pending" | "Met" | "Breached"; responseTimeMinutes: number | null } {
  if (respondedAt) {
    const diffMs = respondedAt.getTime() - createdAt.getTime();
    const diffMins = Math.round(diffMs / 60000);
    return {
      status: diffMins <= maxResponseTimeMinutes ? "Met" : "Breached",
      responseTimeMinutes: diffMins,
    };
  } else {
    const diffMs = currentTime.getTime() - createdAt.getTime();
    const diffMins = Math.round(diffMs / 60000);
    if (diffMins > maxResponseTimeMinutes) {
      return {
        status: "Breached",
        responseTimeMinutes: diffMins,
      };
    }
    return {
      status: "Pending",
      responseTimeMinutes: null,
    };
  }
}
```

## 4. API Endpoints (`apps/api/src/index.ts`)

* `POST /api/leads/sla-targets`
  - Body: `{ maxResponseTimeMinutes: number }`
  - Creates a new active SLA Target. Automatically deactivates previous active targets for the same org context.
* `GET /api/leads/sla-targets`
  - Returns active target configuration for current org.
* `GET /api/leads/sla-breaches`
  - Scans all pending/breached SLA trackers. Checks if they are breached using `calculateSlaStatus` with current time. Updates db tracker state to `Breached` dynamically and returns a list of breached leads.
* `POST /api/leads/:id/respond`
  - Locates the active `leadSlaTracker` for the given lead.
  - Updates the tracker: sets `respondedAt = now`, calculates status and response time.
  - Generates audit log and webhook event (`lead.sla_resolved` or `lead.sla_breached`).
