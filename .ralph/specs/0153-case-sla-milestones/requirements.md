# Specification: Case Service Level Agreements (SLA) & Milestone Management Engine - Requirements

## 1. Functional Requirements

### 1.1 SLA Policy Definition & Priority Management
- The system must allow tenants to define SLA Policies.
- An SLA Policy contains name, priority (`high` | `medium` | `low`), response time limit in minutes (`responseTimeLimitMinutes`), and resolution time limit in minutes (`resolutionTimeLimitMinutes`).
- Priority must be restricted to standard values: `"high"`, `"medium"`, `"low"`.
- Response and resolution durations must be positive integers representing minutes.

### 1.2 Ticket Milestones Auto-Enrollment
- Enrolling a ticket in an SLA policy must automatically initialize two milestones:
  1. `"first_response"` milestone with `targetTime = ticket.createdAt + responseTimeLimitMinutes`.
  2. `"resolution"` milestone with `targetTime = ticket.createdAt + resolutionTimeLimitMinutes`.
- If a ticket already has active milestones of these types, the system should prevent duplicate enrollment or overwrite them.
- If no SLA policy matches the ticket's priority, the enrollment should return a client error or fallback cleanly.

### 1.3 Milestone Evaluation and Completion
- A milestone is initialized in `"pending"` status with `completedAt = null` and `isMet = null`.
- Updating a milestone to `"completed"` must record the exact `completedAt` timestamp.
- The system must verify the completion timestamp against the `targetTime`:
  - If `completedAt <= targetTime`, set `status = "completed"` and `isMet = true`.
  - If `completedAt > targetTime`, set `status = "breached"` and `isMet = false`.
- Completed/breached milestones cannot be updated again.

### 1.4 REST API Surface
- **SLA Policies**:
  - `POST /api/service/sla-policies` - Payload: `{ name: string, priority: "high" | "medium" | "low", responseTimeLimitMinutes: number, resolutionTimeLimitMinutes: number }`. Returns the created policy.
  - `GET /api/service/sla-policies` - Returns all active SLA policies for the tenant.
- **Ticket Milestones**:
  - `POST /api/service/tickets/:id/milestones` - Payload: `{ priority: "high" | "medium" | "low" }`. Automatically looks up the active SLA Policy matching the priority, initializes the milestones, and saves them.
  - `GET /api/service/tickets/:id/milestones` - Lists all milestones for the ticket.
  - `PUT /api/service/tickets/:id/milestones/:milestoneId` - Payload: `{ action: "complete" }`. Completes the milestone and records the result.

### 1.5 Tenant Isolation & RLS
- Every db operation must verify `orgId` tenancy via `AsyncLocalStorage` and `getActiveOrgId()`.
- Tenants must never be able to access, update, or enroll tickets in another tenant's SLA policies or milestones.

### 1.6 Audit Trails
- Creating an SLA policy must log an audit entry in the `auditLogs` table.
- Completing a milestone must log an audit entry in the `auditLogs` table.

## 2. Technical Constraints
- No third-party datetime calculation packages (like moment or date-fns) - use vanilla JavaScript `Date` arithmetic.
- Code must reside cleanly inside the designated modules: pure logic in `packages/core`, DB schemas/stores in `packages/db`, and REST routes in `apps/api`.
- TypeScript type-checking must pass cleanly with zero warnings or `any` workarounds.
- Lint and formatting must pass Biome checks.
