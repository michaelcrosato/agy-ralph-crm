import { dbStore } from "@crm/db";
import { Hono } from "hono";
import { type Env, tenantAuth } from "../../middleware/tenantAuth";

export const hierarchyApp = new Hono<Env>();

hierarchyApp.get("/:id/hierarchy", tenantAuth, async (c) => {
  const id = c.req.param("id");

  const contact = await dbStore.contacts.findOne(id);
  if (!contact) {
    return c.json({ error: "Contact not found" }, 404);
  }

  const parentPath = await dbStore.contacts.findParentPath(id);
  const directReports = await dbStore.contacts.findDirectReports(id);

  return c.json({
    success: true,
    data: {
      contact,
      parentPath,
      directReports,
    },
  });
});
