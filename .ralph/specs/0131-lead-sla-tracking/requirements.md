# Spec 0131: Lead SLA & Response Aging Tracking Requirements

## 1. Functional Requirements

### Database Schema Expansion (`packages/db/src/schema.ts`)
* **R1.1**: Define the `leadSlaTargets` table storing organization-wide SLA parameters:
  - `id` (UUID, primary key)
  - `orgId` (UUID, references `organizations.id`)
  - `maxResponseTimeMinutes` (Integer, non-null, default 60)
  - `isActive` (Integer, non-null, default 1)
  - `createdAt` (Timestamp, non-null, default now)
* **R1.2**: Define the `leadSlaTrackers` table tracking individual lead status timelines:
  - `id` (UUID, primary key)
  - `orgId` (UUID, references `organizations.id`)
  - `leadId` (UUID, references `leads.id`)
  - `targetId` (UUID, references `leadSlaTargets.id`)
  - `status` (Text, non-null, default "Pending") // "Pending" | "Met" | "Breached"
  - `createdAt` (Timestamp, non-null, default now) // Lead creation time
  - `respondedAt` (Timestamp, nullable) // Time when lead was first contacted
  - `responseTimeMinutes` (Integer, nullable) // Calculated actual response time
* **R1.3**: Configure cascade delete constraints on references to `leads`, `organizations`, and `leadSlaTargets`.

### Business Logic Core (`packages/core/src/index.ts`)
* **R2.1**: **SLA Response Calculation**: Implement a function `calculateSlaStatus(createdAt: Date, maxResponseTimeMinutes: number, respondedAt: Date | null, currentTime: Date): { status: "Pending" | "Met" | "Breached"; responseTimeMinutes: number | null }`.
  - If `respondedAt` is present, `responseTimeMinutes` is `(respondedAt.getTime() - createdAt.getTime()) / 60000`. If this is <= `maxResponseTimeMinutes`, status is `"Met"`, else `"Breached"`.
  - If `respondedAt` is null, calculate response time as `(currentTime.getTime() - createdAt.getTime()) / 60000`. If this is > `maxResponseTimeMinutes`, status is `"Breached"`, else `"Pending"`.
  - All calculated response time minutes should be rounded to the nearest integer.

### Store Engine Expansion (`packages/db/src/index.ts`)
* **R3.1**: The mock DB store in `packages/db/src/index.ts` must expose collection managers for `leadSlaTargets` and `leadSlaTrackers`.
* **R3.2**: Add `withTenant` wrapper checks to prevent cross-tenant record injections or lookups.

### REST API Endpoints (`apps/api/src/index.ts`)
* **R4.1**: **POST `/api/leads/sla-targets`**: Creates an organization's SLA configuration.
* **R4.2**: **GET `/api/leads/sla-targets`**: Fetches the active SLA configurations.
* **R4.3**: **GET `/api/leads/sla-breaches`**: Scans all `leadSlaTrackers` with status `"Pending"` or `"Breached"`, runs the calculation, and lists those that are `"Breached"`.
* **R4.4**: **POST `/api/leads/:id/respond`**:
  - Record the response timestamp.
  - Fetch active SLA tracker for the lead.
  - Calculate actual response time and set status to `"Met"` or `"Breached"`.
  - Write a new audit log record.
  - Fire appropriate webhook events: `lead.sla_resolved` (if responded on time) or `lead.sla_breached` (if responded after SLA duration or detected breached during scan).

## 2. Non-Functional & Security Requirements

* **S1.1**: **Multi-Tenant RLS isolation**: A request with Tenant A's context must never be able to read or modify Tenant B's SLA targets or trackers.
* **S1.2**: All operations must operate within the active `AsyncLocalStorage` tenant context.
* **N1.1**: Performance: Scanning active lead SLA trackers and checking for breaches must be fast and complete in less than 50ms for lists up to 1000 trackers.
