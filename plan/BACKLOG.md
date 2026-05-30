# /plan/BACKLOG.md — Dynamic Project Backlog

This backlog tracks adjacent feature ideas, technical debt recommendations, and long-term optimization vectors discovered during the autonomous engineering loop.

---

## 1. Phase 4 — Wave 4 Advanced Features (Replenished)

- **BG-004: RRF Search Cross-Encoder Reranking Engine**
  - *Description*: Implement a high-performance cross-encoder semantic reranker (using a local transformer model or remote cohort provider) to refine the top $N$ hits returned by Reciprocal Rank Fusion (RRF).
  - *Benefit*: Maximizes precision for deep semantic queries.

- **BG-006: Full-Stack OpenAPI SDK Generation & Next.js Dashboard Integration**
  - *Description*: Automate TypeScript client SDK generation from the `@hono/zod-openapi` schema definitions and refactor the Next.js `apps/web` pages to consume the client end-to-end.
  - *Benefit*: Solidifies compile-time type safety across the monorepo boundary.

---

## 2. Phase 4 — Wave 4 Technical Debt & Observability

- [x] **TD-003: Continuous Playwright E2E Integration in CI** (Spec 067)
  - *Description*: Establish a headless Playwright runtime service inside the GitHub Actions pipeline to run full browser-level flow checks against the CRM.
  - *Benefit*: Safeguards the user interface from regression.

- **TD-004: OpenTelemetry Collector Service & Grafana Performance Dashboard**
  - *Description*: Configure an OTEL Collector, Prometheus, and Jaeger stack in a local `docker-compose.yaml` to aggregate live telemetry (traces, metrics, logs) from Hono.
  - *Benefit*: Establishes enterprise-grade production observability.
