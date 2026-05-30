import { hasPermission, Permission } from "@crm/auth";
import { createMiddleware } from "hono/factory";
import type { Env } from "./tenantAuth";
import { tenantAuth } from "./tenantAuth";

/**
 * Custom Hono RBAC middleware verifying context TenantContext bitmask permissions.
 * Rejects the request with a `403 Forbidden` response if the bitmask verification fails.
 * Self-authenticating: dynamically invokes tenantAuth if not already authenticated.
 */
export function requirePermission(requiredPermission: Permission) {
  return createMiddleware<Env>(async (c, next) => {
    let tenant = c.get("tenant");
    if (!tenant) {
      // Self-authenticate dynamically if tenantAuth hasn't run yet
      await tenantAuth(c, async () => {
        tenant = c.get("tenant");
      });
    }

    if (!tenant) {
      return c.json(
        { error: "Unauthorized: Missing active tenant session" },
        401,
      );
    }

    if (!hasPermission(tenant.permissionsMask, requiredPermission)) {
      return c.json(
        { error: "Forbidden: Insufficient system permissions" },
        403,
      );
    }

    return await next();
  });
}

/**
 * Automatic CRUD resource RBAC middleware:
 * - GET requests require READ_RECORDS
 * - DELETE requests require DELETE_RECORDS
 * - POST / PATCH / PUT requests require WRITE_RECORDS
 * Self-authenticating: dynamically invokes tenantAuth if not already authenticated.
 */
export const resourceRbac = createMiddleware<Env>(async (c, next) => {
  let tenant = c.get("tenant");
  if (!tenant) {
    // Self-authenticate dynamically if tenantAuth hasn't run yet
    await tenantAuth(c, async () => {
      tenant = c.get("tenant");
    });
  }

  if (!tenant) {
    return c.json(
      { error: "Unauthorized: Missing active tenant session" },
      401,
    );
  }

  const method = c.req.method.toUpperCase();
  let required: Permission;

  if (method === "GET") {
    required = Permission.READ_RECORDS;
  } else if (method === "DELETE") {
    required = Permission.DELETE_RECORDS;
  } else {
    required = Permission.WRITE_RECORDS;
  }

  if (!hasPermission(tenant.permissionsMask, required)) {
    return c.json({ error: "Forbidden: Insufficient system permissions" }, 403);
  }

  return await next();
});
