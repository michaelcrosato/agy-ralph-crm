# /plan/BACKLOG.md — Dynamic Project Backlog

This backlog tracks adjacent feature ideas, technical debt recommendations, and long-term optimization vectors discovered during the autonomous engineering loop.

---

## 1. Feature Extensions & Advanced Primitives

- **BG-001: Automated Memory Leak Telemetry (COMPLETED)**
  - *Description*: Capture event loop utilization and heap metrics during sequence execution, streaming alerts to `@crm/observability` if allocations leak.
  - *Benefit*: Prevent background execution exhaustion under high-scale concurrent loads.

- **BG-002: Dynamic MCP Custom Object Routers (COMPLETED)**
  - *Description*: Expose dynamically registered custom objects automatically as MCP tools (e.g. `crm_create_project`) without restarting the API gateway.
  - *Benefit*: Align completely with Twenty CRM's native metadata-first MCP architecture.

- **BG-003: Webhook Outbox Batching Optimization (COMPLETED)**
  - *Description*: Consolidate individual outbox triggers into streaming bulk payloads with transactional retry mechanics.
  - *Benefit*: Drastically lower transactional database connection holding time.

---

## 2. Technical Debt & Safety Gates

- **TD-001: Automatic Migration Conflict Prevention CI Gate (COMPLETED)**
  - *Description*: Add a validation task to verify that no overlapping schema migrations are created by concurrent branches prior to PR merge.
  - *Benefit*: Safeguard the PostgreSQL physical database deployment path.

- **TD-002: Dynamic Field Picklist Validation Optimization (COMPLETED)**
  - *Description*: Cache custom Picklist dependency metadata definitions in-memory to prevent database latency overhead on Lead creation pathways.
  - *Benefit*: Drastically lower write response latencies.
