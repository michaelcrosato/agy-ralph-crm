import { Permission } from "@crm/auth";
import { parseCSV, processCSVImport } from "@crm/core";
import { dbStore } from "@crm/db";
import { Hono } from "hono";
import { requirePermission } from "../../middleware/rbac";
import { type Env, tenantAuth } from "../../middleware/tenantAuth";

export const importsApp = new Hono<Env>();

importsApp.use("*", tenantAuth, requirePermission(Permission.MANAGE_USERS));

importsApp.post("/csv", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { entityType, csvContent, mapping, dryRun } = body;

  if (!entityType || !["lead", "contact"].includes(entityType)) {
    return c.json(
      { error: "Invalid or missing entityType (must be 'lead' or 'contact')" },
      400,
    );
  }
  if (!csvContent) {
    return c.json({ error: "Missing csvContent" }, 400);
  }
  if (!mapping || typeof mapping !== "object") {
    return c.json({ error: "Invalid or missing mapping definition" }, 400);
  }

  const parsed = parseCSV(csvContent);
  const { valid, errors } = processCSVImport(entityType, parsed, mapping);

  const totalRows = Math.max(0, parsed.length - 1);
  const invalidRows = errors.length;
  const validRows = Math.max(0, totalRows - invalidRows);

  const importedIds: string[] = [];

  if (!dryRun && valid.length > 0) {
    const orgId = tenant.orgId;
    const ownerId = tenant.userId;

    for (const record of valid) {
      if (entityType === "lead") {
        const lead = await dbStore.leads.insert({
          orgId,
          ownerId,
          status: (record.status as string) || "New",
          email: (record.email as string) || null,
          company: (record.company as string) || null,
          convertedAccountId: null,
          convertedContactId: null,
          custom: null,
        });
        importedIds.push(lead.id);
      } else if (entityType === "contact") {
        const contact = await dbStore.contacts.insert({
          orgId,
          ownerId,
          accountId: null,
          firstName: (record.firstName as string) || "",
          lastName: (record.lastName as string) || "",
          email: (record.email as string) || null,
          custom: null,
        });
        importedIds.push(contact.id);
      }
    }
  }

  return c.json({
    success: true,
    data: {
      totalRows,
      validRows,
      invalidRows,
      errors,
      importedIds: dryRun ? undefined : importedIds,
    },
  });
});
