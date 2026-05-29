import { verifySessionToken } from "@crm/auth";
import { describe, expect, it } from "vitest";
import app from "../../../apps/api/src/index";

describe("Dashboard Portal & Auth API Tests", () => {
  it("should generate a valid JWT session token when POSTing to /api/auth/token", async () => {
    const res = await app.request("/api/auth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId: "user-test",
        orgId: "org-test",
        roleId: "role-test",
        permissionsMask: 15,
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.token).toBeDefined();

    // Verify token structure
    const payload = await verifySessionToken(body.token);
    expect(payload.userId).toBe("user-test");
    expect(payload.orgId).toBe("org-test");
    expect(payload.roleId).toBe("role-test");
    expect(payload.permissionsMask).toBe(15);
  });

  it("should generate default tokens when parameters are omitted", async () => {
    const res = await app.request("/api/auth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.token).toBeDefined();

    // Verify default payload values
    const payload = await verifySessionToken(body.token);
    expect(payload.userId).toBe("user-a");
    expect(payload.orgId).toBe("org-tenant-a");
    expect(payload.roleId).toBe("role-a");
    expect(payload.permissionsMask).toBe(7);
  });

  it("should support CORS headers on API requests", async () => {
    const res = await app.request("/api/auth/token", {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:3000",
        "Access-Control-Request-Method": "POST",
      },
    });

    expect(res.headers.get("access-control-allow-origin")).toBeDefined();
  });
});
