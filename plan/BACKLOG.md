# /plan/BACKLOG.md — Dynamic Project Backlog

This backlog tracks adjacent feature ideas, technical debt recommendations, and long-term optimization vectors discovered during the autonomous engineering loop.

---

## 1. Phase 4 — Wave 4 Advanced Features (Replenished)

- **BG-004: RRF Search Cross-Encoder Reranking Engine**
  - *Description*: Implement a high-performance cross-encoder semantic reranker (using a local transformer model or remote cohort provider) to refine the top $N$ hits returned by Reciprocal Rank Fusion (RRF).
  - *Benefit*: Maximizes precision for deep semantic queries.

- [x] **BG-006: Full-Stack OpenAPI SDK Generation & Next.js Dashboard Integration** (Spec 070)
  - *Description*: Automate TypeScript client SDK generation from the `@hono/zod-openapi` schema definitions and refactor the Next.js `apps/web` pages to consume the client end-to-end.
  - *Benefit*: Solidifies compile-time type safety across the monorepo boundary.

---

## 2. Phase 4 — Wave 4 Technical Debt & Observability

- [x] **TD-003: Continuous Playwright E2E Integration in CI** (Spec 067)
  - *Description*: Establish a headless Playwright runtime service inside the GitHub Actions pipeline to run full browser-level flow checks against the CRM.
  - *Benefit*: Safeguards the user interface from regression.

- [x] **TD-005: Deep RBAC (Role-Based Access Control) Enforcement Engine** (Spec 068)
  - *Description*: Inject granular permission verification middleware across core CRM routes (GET/POST/PATCH/DELETE) matching the session jwt bitmask.
  - *Benefit*: Hardens tenant Org-isolation with standard functional authorization gates.


- [x] **TD-004: OpenTelemetry Collector Service & Grafana Performance Dashboard** (Spec 069)
  - *Description*: Configure an OTEL Collector, Prometheus, and Jaeger stack in a local `docker-compose.yaml` to aggregate live telemetry (traces, metrics, logs) from Hono.
  - *Benefit*: Establishes enterprise-grade production observability.

---

## 3. Phase 6 — File Line Budget Compliance (Replenished Wave)

The following files exceed the `ralph.yml` 400-line limit budget and are scheduled for decomposition in future waves:

- **TD-077: Split accounts routes (`apps/api/src/routes/accounts.ts`, 624 lines)**
- **TD-078: Split campaigns routes (`apps/api/src/routes/campaigns.ts`, 534 lines)**
- **TD-079: Split contacts routes (`apps/api/src/routes/contacts.ts`, 457 lines)**
- **TD-080: Split contracts routes (`apps/api/src/routes/contracts.ts`, 427 lines)**
- **TD-081: Split opportunities teams routes (`apps/api/src/routes/opportunities/teams.ts`, 819 lines)**
- **TD-082: Split opportunities products routes (`apps/api/src/routes/opportunities/products.ts`, 620 lines)**
- **TD-083: Split productivity routes (`apps/api/src/routes/productivity.ts`, 859 lines)**
- **TD-084: Split sequence steps routes (`apps/api/src/routes/sequences/steps.ts`, 721 lines)**
- **TD-085: Split sequence public emails routes (`apps/api/src/routes/sequences/public-emails.ts`, 552 lines)**
- **TD-086: Split sequence enrollment routes (`apps/api/src/routes/sequences/enrollment.ts`, 495 lines)**
- **TD-087: Split lead domain core logic (`packages/core/src/domain/leads/index.ts`, 599 lines)**
- **TD-088: Split opportunity domain core logic (`packages/core/src/domain/opportunities/index.ts`, 515 lines)**
- **TD-089: Split sequence lifecycle domain logic (`packages/core/src/domain/sequences/lifecycle.ts`, 727 lines)**
- **TD-090: Split sequence tracking domain logic (`packages/core/src/domain/sequences/tracking.ts`, 720 lines)**
- **TD-091: Split sequence analytics domain logic (`packages/core/src/domain/sequences/analytics.ts`, 716 lines)**
- **TD-092: Split sequence execution domain logic (`packages/core/src/domain/sequences/execution.ts`, 580 lines)**
- **TD-093: Split email domain core logic (`packages/core/src/domain/email/index.ts`, 443 lines)**
- **TD-094: Modularize shared core types (`packages/core/src/types.ts`, 1,296 lines)**
