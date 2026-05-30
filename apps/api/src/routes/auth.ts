import { createSessionToken } from "@crm/auth";
import { Hono } from "hono";

/** Auth routes — token issuance for dev / test harnesses. */
export const authApp = new Hono();

authApp.post("/token", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { userId, orgId, roleId, permissionsMask } = body;
  const token = await createSessionToken({
    userId: userId || "user-a",
    orgId: orgId || "org-tenant-a",
    roleId: roleId || "role-a",
    permissionsMask:
      permissionsMask !== undefined ? Number(permissionsMask) : 7,
  });
  return c.json({ success: true, token });
});
