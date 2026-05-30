# 048 — BG-001: Automated Memory Leak Telemetry

**Phase:** 2 (Replenish) · **Priority:** Medium · **Status:** `[x] Completed` · **Depends on:** 016, 022

## Description & Expected Impact

Under heavy, concurrent sequence automation execution, background tasks run continuously and can suffer from progressive memory leaks or event loop blockages. To proactively surface memory issues and keep runtime environments healthy, we will implement an automated telemetry module:
1. **Memory & Heap Monitor**: A lightweight background monitor that periodically samples Node's heap usage and event loop delay.
2. **Threshold Alerts**: Stream warning and critical structured logs to `@crm/observability` when heap growth is monotonic over several intervals, or when event loop latency exceeds safe thresholds.
3. **Sequence Execution integration**: Wrap active sequences and worker queues with memory telemetry scopes to capture delta metrics.

## Definition of Done & Acceptance Criteria

- [ ] **Telemetry Utility (`packages/observability/src/memory.ts`)**:
  - Implement a `MemoryTelemetry` engine that samples `process.memoryUsage()` and tracks event loop lag using `perf_hooks` (e.g. `monitorEventLoopDelay`).
  - Keep sampling overhead negligible (default interval of 10s, inactive in test environment unless enabled via env).
  - Detect monotonic heap growth (e.g., heap size increasing consistently across 5 samples).
  - Stream warning logs with service name, current heap size, event loop lag, and system metrics.
- [ ] **Core Sequence Integration (`packages/core/src/domain/sequences/`)**:
  - Expose sequence telemetry wraps to track memory consumption during sequence step execution cycles.
- [ ] **Integration Tests (`packages/testing/src/memory-telemetry.test.ts`)**:
  - Verify that the telemetry monitor correctly detects event loop delay and heap changes.
  - Assert that a simulated heap leakage scenario successfully triggers alert logs via `@crm/observability`.

## Test Strategy

- **Test Suite**: `packages/testing/src/memory-telemetry.test.ts`
  - Simulates sequential steps with a mock leak to assert alert triggering.
  - Verifies event loop latency monitoring operates correctly.
