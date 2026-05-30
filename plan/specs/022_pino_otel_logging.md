# 022 — Replace `console.*` with `pino` bridged to OTel

**Phase:** 1 · **Priority:** Medium · **Status:** `[ ] Todo` · **Depends on:** 016

## Description & Expected Impact
Structured logging at production grade. Pino is the 2026 default for Node (fastest, JSON, low overhead). Bridge to OTel logs via `@opentelemetry/instrumentation-pino` so log entries auto-attach `trace_id`/`span_id` for one-click correlation from dashboard → log → trace.

## Definition of Done & Acceptance Criteria
- [ ] Dep: `pino@^9.x`, `@opentelemetry/instrumentation-pino`.
- [ ] `packages/observability/src/logger.ts` exports `createLogger({ name })` returning a child of root pino logger.
- [ ] Auto-instrumentation included in spec 016's OTel init.
- [ ] All `console.log` / `console.error` calls in `apps/api/`, `packages/core/`, `packages/db/` replaced with `logger.info` / `logger.error`. (Grep gate: 0 results for `console\.(log|warn|error|debug)` outside `scripts/agent/`.)
- [ ] PII rules documented in `packages/observability/README.md`: never log full email bodies, PII fields, secrets.

## Implementation Approach
- Replace mechanically via codemod / batched sub-agent.
- Use `serializers` to redact known PII fields by name.
- Use `level` env var to control verbosity.

## Test Strategy
- Regression: 403/403.
- Manual: emit a log inside a request handler; confirm `trace_id` is present in the JSON output.

## Rollback
Revert `console.*` substitutions (only needed if log volume causes infra strain).
