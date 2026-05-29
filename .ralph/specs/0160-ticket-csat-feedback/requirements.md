# Task 0160: Support Ticket CSAT Feedback Integration - Requirements

## 1. Functional Requirements

### 1.1 Support Ticket CSAT Feedback Submission
- Customers must be able to submit CSAT feedback for a specific ticket.
- Feedback must include a `score` (integer, strictly between 1 and 5, where 1 is worst and 5 is best) and an optional `comment` string.
- If a ticket-specific survey does not already exist, the API should associate the response with a survey or fall back to finding or creating a default "Support Ticket CSAT Survey" for the organization.
- Submitting feedback should record the transaction in the system audit logs.
- If the ticket was not already "Resolved" or "Closed", submitting CSAT feedback should automatically transition its status to "Resolved" or "Closed" (or keep it as is if already resolved). Let's default to transition to "Resolved" if not resolved/closed.

### 1.2 Agent Performance Metrics & CSAT Ratings
- The CRM must compile key performance indicators (KPIs) per support agent (`user`), including:
  - **Total Tickets Assigned**: The count of all tickets assigned to the agent.
  - **Closed/Resolved Ticket Count**: Count of tickets assigned to the agent with status "Resolved" or "Closed".
  - **Average CSAT Rating**: Arithmetic mean of all CSAT survey scores received on tickets assigned to the agent.
  - **CSAT Satisfaction Rate**: Percentage of CSAT scores that are 4 or 5.
  - **Average Resolution Time**: Average duration (in minutes) from ticket creation (`createdAt`) to the resolution/closing event.

## 2. Non-Functional & Security Requirements

### 2.1 Multi-Tenant Row-Level Security (RLS)
- All endpoints must strictly enforce active tenant isolation via `orgId`.
- Users from Tenant A must NEVER:
  - Submit CSAT feedback for a ticket belonging to Tenant B.
  - Retrieve CSAT feedback details for Tenant B's tickets.
  - Retrieve agent performance metrics for users belonging to Tenant B.
- Any attempt to cross-tenant boundaries must return a `403 Forbidden` response or throw an RLS mismatch database execution failure.

### 2.2 Compilation and Code Standards
- Keep file lines clean and tidy, observing the line limit budget of 400 lines (or avoiding bloated methods).
- Zero placeholders or TODO comments allowed.
- Strictly type-safe schemas, REST responses, and core parameters.
