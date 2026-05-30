# 050 — BG-003: Webhook Outbox Batching & Concurrency Optimization

**Phase:** 2 (Replenish) · **Priority:** Medium · **Status:** `[x] Done` · **Depends on:** 011

## Description & Expected Impact

Currently, the outbound webhook outbox worker processes pending delivery jobs sequentially. Each eligible webhook outbox entry executes blocking async requests one-by-one, which leads to prolonged execution latency, extended database connection holding times, and poor throughput under concurrent loads.
We will optimize this by implementing:
1. **Concurrent Processing**: Execute outbox dispatches concurrently using `Promise.all` with robust asynchronous worker orchestration.
2. **Resource Efficiency**: Maximize throughput of pending outbound events, reducing transaction lock contention in multi-tenant environments.

## Definition of Done & Acceptance Criteria

- [x] **Concurrent Outbox Execution (`packages/webhooks/src/index.ts`)**:
  - Refactor `processOutboxItems` to orchestrate dispatches concurrently via `Promise.all`.
  - Handle race-free updates to delivery, outbox, audit, and DLQ datasets.
- [x] **Integration & Verification**:
  - Run all webhook integration tests ensuring they pass 100% cleanly.
  - Assert that concurrent outbox processing scales seamlessly without regression.
