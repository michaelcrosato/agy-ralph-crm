import { type TenantContext, verifySessionToken } from "@crm/auth";
import { mockDb, withTenant } from "@crm/db";
import { createMiddleware } from "hono/factory";

export type Env = {
  Variables: {
    tenant: TenantContext;
  };
};

/**
 * Tenant verification middleware enforcing RLS integration.
 * Parses Bearer token, verifies session, sets tenant on context,
 * and wraps `next()` in a `withTenant` block so all downstream
 * DB ops see `app.current_org_id`.
 */
export const tenantAuth = createMiddleware<Env>(async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json(
      { error: "Unauthorized: Missing or invalid token format" },
      401,
    );
  }

  const token = authHeader.substring(7);
  let tenantContext: TenantContext;
  try {
    tenantContext = await verifySessionToken(token);
    c.set("tenant", tenantContext);
  } catch (_err) {
    return c.json({ error: "Unauthorized: Token verification failed" }, 401);
  }

  return await withTenant(tenantContext.orgId, mockDb, async () => {
    return await next();
  });
});
