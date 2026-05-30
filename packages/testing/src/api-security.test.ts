import { beforeEach, describe, expect, it } from "vitest";
import { resetRateLimiterStore } from "../../../apps/api/src/middleware/rateLimiter";
import { createTestApp } from "./_harness";

const app = createTestApp();

describe("API Security Hardening (spec 052)", () => {
  beforeEach(() => {
    resetRateLimiterStore();
  });

  it("should have secure headers in response", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);

    // Check for secure headers added by Hono secureHeaders middleware
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("x-frame-options")).toBe("SAMEORIGIN");
    expect(res.headers.get("referrer-policy")).toBe("no-referrer");
  });

  it("should limit requests after exceeding threshold", async () => {
    const ip = "1.2.3.4";
    const headers = new Headers({ "x-forwarded-for": ip });

    // Send 10 requests which should succeed (or at least not be 429)
    for (let i = 0; i < 10; i++) {
      const res = await app.request("/api/auth/login", {
        method: "POST",
        headers,
      });
      expect(res.status).not.toBe(429);
      expect(res.headers.get("RateLimit-Remaining")).toBe(String(10 - 1 - i));
    }

    // The 11th request should return 429
    const res11 = await app.request("/api/auth/login", {
      method: "POST",
      headers,
    });
    expect(res11.status).toBe(429);
    const body = await res11.json();
    expect(body.error).toBe("Too Many Requests");
    expect(res11.headers.get("RateLimit-Remaining")).toBe("0");
    expect(res11.headers.get("Retry-After")).toBeDefined();
  });

  it("should return JSON error and log under centralized error handler", async () => {
    // Construct a mock Hono Context to call app.errorHandler directly,
    // avoiding the need to dynamically mount a route after the router is built.
    let capturedBody: any = null;
    let capturedStatus: number | undefined;

    const mockContext = {
      req: {
        method: "GET",
        path: "/test-error-path",
      },
      json: (body: any, status?: number) => {
        capturedBody = body;
        capturedStatus = status;
        return { body, status };
      },
    } as any;

    const testError = new Error("Simulated Test Error");
    await app.errorHandler(testError, mockContext);

    expect(capturedStatus).toBe(500);
    expect(capturedBody).toBeDefined();
    expect(capturedBody.error).toBe("Simulated Test Error");
    expect(capturedBody.status).toBe(500);
  });
});
