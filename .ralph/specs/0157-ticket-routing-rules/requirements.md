# Specification: Support Ticket Routing & Assignment Rules Engine - Requirements

## 1. Functional Requirements

### 1.1 Support Ticket Schema Enhancement
- The `tickets` table must support an optional `assignedToId` field referencing `users.id`.
- By default, newly created tickets can have a null or unassigned `assignedToId` (indicating they are in the default support queue).

### 1.2 Ticket Assignment Rules & Entries
- Tenants can create multiple `ticket_assignment_rules` records, but at most **one** rule can be designated as `isActive = 1` per organization.
- Each rule must contain sequential `ticket_assignment_rule_entries` (ordered by `sortOrder`).
- Rule entries define:
  1. A list of criteria conditions (`CriteriaCondition[]`) that the ticket must satisfy.
  2. The `routingMethod` which can be `"direct"` or `"round_robin"`.
  3. A list of target user IDs `routingUserIds` (agents) who are eligible to receive the ticket.
  4. The `lastAssignedIndex` field to track round-robin rotation state.

### 1.3 Rules Evaluation Engine
- The routing engine must process entries in ascending `sortOrder` sequence.
- The first entry where all criteria evaluate to `true` is matched.
- If `"direct"`, the ticket is assigned to `routingUserIds[0]`.
- If `"round_robin"`, the ticket is assigned to `routingUserIds[(lastAssignedIndex + 1) % routingUserIds.length]`, and the entry's `lastAssignedIndex` is updated.
- If no rules are matched or no active rule exists, the ticket remains unassigned (or assigned to a fallback default support user).

### 1.4 Audit Trail Logging
- Any update to `assignedToId` on a ticket must log an entry in the `audit_logs` table detailing the owner changes (e.g. `changes: { assignedToId: { before: null, after: "user-id" } }`).
- Creating or updating ticket routing rules must also generate appropriate audit trails.

### 1.5 Tenant Row-Level Security (RLS)
- All rule creation, query, updates, and ticket assignment evaluations must strictly enforce active tenant `orgId` isolation.
- No user can fetch, update, or assign rules/entries/tickets across organizations.

---

## 2. API Endpoints Specification

### 2.1 Managing Routing Rules
- `POST /api/service/tickets/routing-rules`
  - Body: `{ name: string, isActive?: number }`
  - Action: Creates a new routing rule. If `isActive: 1` is provided, deactivate all other rules for that tenant.
- `GET /api/service/tickets/routing-rules`
  - Action: Lists all routing rules for the active tenant.

### 2.2 Managing Rule Entries
- `POST /api/service/tickets/routing-rules/:id/entries`
  - Body: `{ sortOrder: number, routingMethod: "direct" | "round_robin", routingUserIds: string[], criteria: CriteriaCondition[] }`
  - Action: Inserts a new entry linked to the rule.
- `GET /api/service/tickets/routing-rules/:id/entries`
  - Action: Lists all entries for the specified rule, sorted by `sortOrder`.

### 2.3 Ticket Assignment & Automatic Routing
- `POST /api/service/tickets/:id/route`
  - Action: Automatically evaluates and applies active routing rules to assign the ticket.
  - Return: The updated ticket object.
- `PUT /api/service/tickets/:id/assign`
  - Body: `{ assignedToId: string | null }`
  - Action: Manually assigns the ticket.
