# Spec 0131: Lead SLA & Response Aging Tracking Brief

## Objective
High-performance sales organizations require prompt response times to newly generated leads. Research shows that contacting a lead within the first hour increases conversion rates by orders of magnitude. To enforce and monitor this, we need to introduce Lead Response SLA (Service Level Agreement) configurations and real-time response aging tracking into the CRM Core.

This feature enables setting SLA targets (maximum allowed minutes before a lead is contacted / response is tracked), automatically creating SLA tracking states when a lead is created, determining if a lead breaches its SLA, logging SLA breach events when response limits are exceeded, and resolving SLAs when a lead is contacted or converted. All of this must be enforced under strict multi-tenant Row-Level Security (RLS) isolation.

## Scope
* **Database & Store Actions (`packages/db`)**:
  - Create `leadSlaTargets` and `leadSlaTrackers` schemas in `packages/db/src/schema.ts`.
  - Expose helper store methods to query SLA targets, active SLA trackers, and SLA breaches under tenant isolation.
* **Core Business Logic (`packages/core`)**:
  - Implement a pure function `calculateSlaStatus` that determines if a lead is near breach, breached, or met based on creation time, current time, target duration, and response time.
  - Implement dynamic SLA status scoring.
* **REST API Endpoints (`apps/api`)**:
  - `POST /api/leads/sla-targets`: Configure response time targets for the organization.
  - `GET /api/leads/sla-targets`: Fetch all active SLA targets.
  - `GET /api/leads/sla-breaches`: List leads that have breached their SLA targets.
  - `POST /api/leads/:id/respond`: Mark a lead as responded (e.g. email or phone call activity logged), calculating and saving response time, and resolving the SLA.
* **Audit Trail & Webhooks**:
  - Log audit trail entries when an SLA target is created/modified, or when an SLA is breached or met.
  - Dispatch outbound webhook events (`lead.sla_breached`, `lead.sla_resolved`) to enable instant notifications.
* **Row-Level Security**:
  - Verify that SLA target definitions, active trackers, and breach lists strictly adhere to tenant isolation boundaries.
