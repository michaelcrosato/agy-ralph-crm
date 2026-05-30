import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

/**
 * Health route — single endpoint exercised by load balancers and the
 * Playwright smoke harness. Lives outside `/api/*` so it bypasses
 * tenantAuth.
 */
export const healthApp = new OpenAPIHono();

const healthRoute = createRoute({
  method: "get",
  path: "/",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            status: z.string().openapi({ example: "ok" }),
            timestamp: z
              .string()
              .openapi({ example: "2026-05-30T13:30:00.000Z" }),
          }),
        },
      },
      description: "Retrieve health status",
    },
  },
});

healthApp.openapi(healthRoute, (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});
