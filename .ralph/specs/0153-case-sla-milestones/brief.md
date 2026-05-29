# Specification: Case Service Level Agreements (SLA) & Milestone Management Engine - Brief

## 1. Functional Objective
Enterprise customer service operations require precise SLA management to ensure support teams meet customer response and resolution deadlines. 

This feature introduces the **Case Service Level Agreements (SLA) & Milestone Management Engine** for the `service-lite` module. The system will:
1. Allow tenants to define SLA Policies (`sla_policies`) containing target response and resolution durations (in minutes) for each support priority (`high`, `medium`, `low`).
2. Track ticket milestones (`ticket_milestones`) like `"first_response"` and `"resolution"` linked to tickets.
3. Calculate milestone due dates dynamically based on ticket priority and the active SLA Policy when a ticket is enrolled in an SLA.
4. Support completing milestones (e.g., recording the `completedAt` timestamp) and evaluating whether the target was met (`isMet: true`) or breached (`isMet: false`).
5. Expose REST endpoints to manage SLA policies, enroll tickets, update milestone completions, and query milestone statuses under strict active tenant Row-Level Security (RLS) isolation.
6. Generate audit trails when SLA policies are created and milestones are updated.

## 2. Technical Scope
- **Database Schema**:
  - Add `slaPolicies` and `ticketMilestones` tables to `packages/db/src/schema.ts` and update the database store mappings and `clear` function in `packages/db/src/index.ts`.
- **Core Pure Logic**:
  - Implement `calculateMilestoneDueDate` and `evaluateMilestoneCompletion` in `packages/core/src/index.ts` to handle pure date math and target status verification.
- **REST Endpoints**:
  - `POST /api/service/sla-policies` - Creates a new SLA Policy.
  - `GET /api/service/sla-policies` - Queries SLA Policies for the active tenant.
  - `POST /api/service/tickets/:id/milestones` - Automatically creates/initializes target milestones for a ticket using the tenant's active SLA Policy.
  - `PUT /api/service/tickets/:id/milestones/:milestoneId` - Completes a milestone and updates its status and `isMet` state, enforcing active tenant context.
  - `GET /api/service/tickets/:id/milestones` - Queries milestones associated with a support ticket.
- **Tenant RLS & Security**:
  - All operations must run strictly within the active tenant's context (`orgId`). A tenant must never see, modify, or enroll tickets in SLA policies belonging to other organizations.
- **Verification & Integration Tests**:
  - Write integration tests inside `packages/testing/src/service-sla.test.ts` validating SLA policy configuration, milestone auto-initialization, status updates, and tenant RLS isolation.
