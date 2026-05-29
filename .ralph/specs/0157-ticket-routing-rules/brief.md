# Specification: Support Ticket Routing & Assignment Rules Engine - Brief

## 1. Functional Objective
In high-volume customer service operations, manually assigning tickets to support agents is inefficient. A robust, automated **Support Ticket Routing & Assignment Rules Engine** solves this by routing newly created or unassigned support tickets to appropriate owners (agents or teams) based on predefined criteria.

This feature introduces the **Support Ticket Routing & Assignment Rules Engine** under the `service-lite` module. The system will:
1. Allow tenants to define Ticket Assignment Rules (`ticket_assignment_rules`) with routing conditions.
2. Allow tenants to define specific Rule Entries (`ticket_assignment_rule_entries`) with criteria and support routing details (such as direct user assignment or round-robin rotation).
3. Evaluate ticket details (e.g. subject, category, priority, custom field properties) against these rules to automatically determine the correct owner.
4. Support manual ownership override and automated queue assignment rules.
5. Expose REST endpoints to manage assignment rules and trigger automatic routing under strict active tenant Row-Level Security (RLS) isolation.
6. Generate audit trails when rules are modified, created, or when ticket ownership changes.

## 2. Technical Scope
- **Database Schema**:
  - Add `assignedToId` field (referencing `users.id`) to the `tickets` table in `packages/db/src/schema.ts`.
  - Add `ticketAssignmentRules` and `ticketAssignmentRuleEntries` tables to `packages/db/src/schema.ts` and update the database store mappings and `clear` function in `packages/db/src/index.ts`.
- **Core Pure Logic**:
  - Implement `evaluateTicketAssignment` in `packages/core/src/index.ts` to evaluate matching assignment rules and determine the target owner using either direct assignment or round-robin.
- **REST Endpoints**:
  - `POST /api/service/tickets/routing-rules` - Creates a new ticket assignment rule.
  - `GET /api/service/tickets/routing-rules` - Returns all ticket assignment rules.
  - `POST /api/service/tickets/routing-rules/:id/entries` - Adds a rule entry with routing criteria.
  - `GET /api/service/tickets/routing-rules/:id/entries` - Returns entries for a rule.
  - `POST /api/service/tickets/:id/route` - Evaluates the active assignment rules for a specific ticket and automatically updates its ownership context.
  - `PUT /api/service/tickets/:id/assign` - Explicitly updates the ticket's `assignedToId`.
- **Tenant RLS & Security**:
  - All operations must run strictly within the active tenant's context (`orgId`). A tenant must never see, modify, or assign rules/tickets belonging to other organizations.
- **Verification & Integration Tests**:
  - Write integration tests inside `packages/testing/src/ticket-routing.test.ts` validating rule creation, criteria matching, round-robin rotation, RLS isolation, and audit log generation.
