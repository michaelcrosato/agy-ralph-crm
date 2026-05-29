# Specification: Support Ticket SLA Alerts & Breaches Escalation Engine - Requirements

## 1. Functional Requirements

### 1.1 Support Ticket Schema Enhancement
- The `tickets` table must support a `priority` field (text, not null, default "Medium").
- The default priority for newly created tickets is "Medium". Eligible priority values are `"Low"`, `"Medium"`, `"High"`, `"Urgent"`.

### 1.2 Ticket Escalation Rules
- Tenants can create multiple `ticket_escalation_rules` records.
- Escalation rules define:
  1. `name`: a descriptive name for the rule (e.g. "Urgent First Response Escalation").
  2. `triggerType`: `"milestone_approaching"` or `"milestone_breached"`.
  3. `timeThresholdMinutes`: the threshold time (e.g., if a milestone is approaching breach in under X minutes). Only applicable for `triggerType = "milestone_approaching"`.
  4. `escalateToId`: the user ID to assign the ticket to when escalated.
  5. `newPriority`: the priority to elevate the ticket to (e.g., `"Urgent"`).
  6. `isActive`: whether the rule is currently active (0 = inactive, 1 = active).

### 1.3 Ticket Escalations History
- The system must record a history of all ticket escalations inside `ticket_escalations`.
- Each record must store:
  - The ticket ID.
  - The rule ID that triggered the escalation (optional if manual escalation).
  - The previous owner ID (`previousAssignedToId`) and new owner ID (`escalatedToId`).
  - The previous priority and the new priority.
  - An explicit `reason` string describing why it escalated.

### 1.4 Escalations Evaluation Engine
- When evaluating escalations for a ticket:
  - Fetch all active escalation rules for the tenant.
  - Fetch the ticket's active/pending milestones.
  - For `"milestone_breached"` rules, check if any milestone's status is `"breached"`, OR if `status` is `"pending"` and the current time is past the milestone's `targetTime`.
  - For `"milestone_approaching"` rules, check if any milestone's status is `"pending"` and the current time is within `timeThresholdMinutes` before the milestone's `targetTime`.
  - If a rule matches, perform the escalation:
    1. Update the ticket's `assignedToId` to `escalateToId` (if different).
    2. Update the ticket's `priority` to `newPriority` (if provided and higher or different).
    3. Save a record in `ticket_escalations`.
    4. Log an entry in `audit_logs` tracking changes to `assignedToId` and `priority` on the ticket.
    5. Return the matched rule and updated ticket state.

### 1.5 Tenant Row-Level Security (RLS)
- All rule creation, querying, updates, manual/automatic escalations, and escalation history lookups must strictly enforce active tenant `orgId` isolation.
- No user can access or escalate tickets, rules, or histories across organizations.

---

## 2. API Endpoints Specification

### 2.1 Managing Escalation Rules
- `POST /api/service/tickets/escalation-rules`
  - Body: `{ name: string, triggerType: "milestone_approaching" | "milestone_breached", timeThresholdMinutes: number, escalateToId: string, newPriority?: string, isActive?: number }`
  - Action: Creates a new escalation rule.
- `GET /api/service/tickets/escalation-rules`
  - Action: Lists all escalation rules for the active tenant.

### 2.2 Evaluating Escalations & Querying History
- `POST /api/service/tickets/:id/escalate`
  - Action: Automatically evaluates and applies active escalation rules to the ticket.
  - Return: `{ success: true, escalated: boolean, data: TicketRecord, escalation?: EscalationRecord }`
- `GET /api/service/tickets/:id/escalations`
  - Action: Lists all historical escalation event records for the specified ticket.
