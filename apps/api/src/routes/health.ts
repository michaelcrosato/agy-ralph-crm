import { Hono } from "hono";

/**
 * Health route — single endpoint exercised by load balancers and the
 * Playwright smoke harness. Lives outside `/api/*` so it bypasses
 * tenantAuth.
 */
export const healthApp = new Hono();

healthApp.get("/", (c) =>
  c.json({ status: "ok", timestamp: new Date().toISOString() }),
);
