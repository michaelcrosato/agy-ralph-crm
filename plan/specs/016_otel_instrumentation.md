# 016 — OpenTelemetry traces + metrics + log correlation

**Phase:** 1 · **Priority:** High · **Status:** `[ ] Todo`

## Description & Expected Impact
2026 Node baseline = OTel. Repo has zero observability. Add `@opentelemetry/sdk-node` with auto-instrumentations for HTTP, Hono, pg, plus a custom span per `withTenant`. Bridge logs (spec 022) so log entries auto-attach `trace_id` + `span_id` and oncall can pivot from log → trace in one click.

## Definition of Done & Acceptance Criteria
- [ ] New package `packages/observability/` with:
  - `src/otel.ts` — `initOtel({ serviceName, env })` exporting via OTLP/HTTP to a configurable endpoint.
  - `src/spans.ts` — helper `withSpan(name, fn)` and `withTenantSpan(orgId, fn)` (wraps spec 014's `withTenant`).
- [ ] `apps/api/src/index.ts` initializes OTel before any other import (`-r packages/observability/dist/otel-bootstrap.js`).
- [ ] `.env.example` documents `OTEL_EXPORTER_OTLP_ENDPOINT` (default `http://localhost:4318`) and `OTEL_SERVICE_NAME`.
- [ ] Auto-instrumentations enabled: `@opentelemetry/instrumentation-http`, `@opentelemetry/instrumentation-pg`, hono auto-instrumentation if available (else custom middleware).
- [ ] Smoke: `pnpm dev` running with an OTLP collector (docker-compose example added under `docs/observability/`) emits a trace per request with `http.route`, `tenant.org_id` attributes.
- [ ] No measurable latency regression in `perf.test.ts` (>20% slowdown is a fail).

## Implementation Approach
- Use `@opentelemetry/sdk-node` v0.5x+ (stable).
- Initialize via a `-r` bootstrap module to ensure auto-instrumentations patch before user code requires `pg`/`http`.
- Add `tenant.org_id` as a span attribute on the root server span (read from JWT or `withTenant` context).
- Avoid logging request bodies (PII risk); log only IDs and route templates.

## Test Strategy
- Unit: `withSpan` propagates context (Async hooks).
- Integration: launch `docker-compose -f docs/observability/otel-stack.yml up` (Jaeger + Prometheus); make a request; assert trace appears via API.
- Perf gate: re-run `packages/testing/src/perf.test.ts`; assert no > 20% regression.

## Rollback
Skip OTel init (env var `OTEL_DISABLED=1`). Remove `-r` bootstrap.

## References
- [OpenTelemetry Node SDK](https://opentelemetry.io/docs/languages/js/instrumentation/)
- [Node.js OTel stack 2026](https://dev.to/axiom_agent/the-nodejs-observability-stack-in-2026-opentelemetry-prometheus-and-distributed-tracing-229b)
