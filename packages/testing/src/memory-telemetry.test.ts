import { MemoryTelemetry } from "@crm/observability";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("Spec 048: Memory Telemetry Integration", () => {
  beforeEach(() => {
    MemoryTelemetry.clearHistory();
    // Configure thresholds for highly sensitive tests
    MemoryTelemetry.eventLoopLagThresholdMs = 1; // 1ms threshold for testing lag warn logs
    MemoryTelemetry.heapGrowthWarningThresholdBytes = 1000; // very low threshold to trigger mock warnings easily
  });

  afterEach(() => {
    MemoryTelemetry.stop();
  });

  it("should initialize with clean history and track process memory usage", () => {
    expect(MemoryTelemetry.getHistory()).toEqual([]);

    // Perform a check
    const isLeak = MemoryTelemetry.check();
    expect(isLeak).toBe(false);
    expect(MemoryTelemetry.getHistory().length).toBe(1);
  });

  it("should maintain a rolling history of maximum 5 samples", () => {
    for (let i = 0; i < 10; i++) {
      MemoryTelemetry.check();
    }
    expect(MemoryTelemetry.getHistory().length).toBe(5);
  });

  it("should not alert when heap changes are non-monotonic", () => {
    const originalMemoryUsage = process.memoryUsage;

    try {
      const mockValues = [10000, 9000, 11000, 10500, 12000];
      let callCount = 0;
      process.memoryUsage = () => {
        const val = mockValues[callCount % mockValues.length];
        callCount++;
        return {
          rss: val * 2,
          heapTotal: val * 1.5,
          heapUsed: val,
          external: 100,
          arrayBuffers: 10,
        } as any;
      };

      for (let i = 0; i < 5; i++) {
        const detected = MemoryTelemetry.check();
        expect(detected).toBe(false); // No leak alert since values fluctuate
      }
    } finally {
      process.memoryUsage = originalMemoryUsage;
    }
  });

  it("should successfully trigger alert when monotonic heap growth exceeds threshold", () => {
    const originalMemoryUsage = process.memoryUsage;

    try {
      // Strictly increasing heap sizes exceeding threshold (1000 bytes)
      const mockValues = [2000, 3000, 4000, 5000, 6000];
      let callCount = 0;
      process.memoryUsage = () => {
        const val = mockValues[Math.min(callCount, mockValues.length - 1)];
        callCount++;
        return {
          rss: val * 2,
          heapTotal: val * 1.5,
          heapUsed: val,
          external: 100,
          arrayBuffers: 10,
        } as any;
      };

      // First 4 checks shouldn't alert (length < 5)
      for (let i = 0; i < 4; i++) {
        expect(MemoryTelemetry.check()).toBe(false);
      }

      // 5th check should alert as it's monotonic and above threshold
      expect(MemoryTelemetry.check()).toBe(true);
    } finally {
      process.memoryUsage = originalMemoryUsage;
    }
  });
});
