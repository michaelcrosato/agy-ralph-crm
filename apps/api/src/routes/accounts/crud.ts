import { detectCircularAccountRelation } from "@crm/core";
import { dbStore } from "@crm/db";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  enforceCustomValidationRules,
  enforcePicklistDependencies,
} from "../../lib/validation";
import { triggerOutboundWebhooks } from "../../lib/webhooks";
import { type Env, tenantAuth } from "../../middleware/tenantAuth";

export const AccountSchema = z
  .object({
    id: z.string(),
    orgId: z.string(),
    ownerId: z.string(),
    name: z.string(),
    domain: z.string().nullable(),
    custom: z.any().nullable().optional(),
    parentAccountId: z.string().nullable().optional(),
  })
  .openapi("Account");

export const listAccountsRoute = createRoute({
  method: "get",
  path: "/",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: z.array(AccountSchema),
          }),
        },
      },
      description: "List all accounts",
    },
  },
});

export const getAccountRoute = createRoute({
  method: "get",
  path: "/{id}",
  request: {
    params: z.object({
      id: z.string().openapi({
        param: {
          name: "id",
          in: "path",
        },
        example: "123e4567-e89b-12d3-a456-426614174000",
      }),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: AccountSchema,
          }),
        },
      },
      description: "Retrieve an account by ID",
    },
    404: {
      content: {
        "application/json": {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
      description: "Account not found",
    },
  },
});

const baseCrudRouter = new OpenAPIHono<Env>();

const appWithList = baseCrudRouter.openapi(listAccountsRoute, async (c) => {
  const accounts = await dbStore.accounts.findMany();
  return c.json({ success: true, data: accounts }, 200);
});

export const crudApp = appWithList.openapi(getAccountRoute, async (c) => {
  const id = c.req.param("id");
  const account = await dbStore.accounts.findOne(id);
  if (!account) {
    return c.json({ error: "Account not found" }, 404);
  }
  return c.json({ success: true, data: account }, 200);
});

crudApp.post("/", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { name, domain, custom, parentAccountId } = body;

  if (!name) {
    return c.json({ error: "Missing required parameter: name" }, 400);
  }

  const pldValidation = await enforcePicklistDependencies("accounts", {
    ...body,
    ...(custom || {}),
  });
  if (!pldValidation.success) {
    return c.json({ error: pldValidation.error }, 400);
  }

  const customValValidation = await enforceCustomValidationRules("accounts", {
    ...body,
    ...(custom || {}),
  });
  if (!customValValidation.success) {
    return c.json({ error: customValValidation.error }, 400);
  }

  if (parentAccountId) {
    const parent = await dbStore.accounts.findOne(parentAccountId);
    if (!parent) {
      return c.json({ error: "Parent account not found" }, 400);
    }
  }

  const account = await dbStore.accounts.insert({
    orgId: tenant.orgId,
    ownerId: tenant.userId,
    name,
    domain: domain || null,
    custom: custom || null,
    parentAccountId: parentAccountId || null,
  });

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: account.id,
    recordType: "accounts",
    action: "create",
    userId: tenant.userId,
    changes: {
      account: { before: null, after: account },
    },
  });

  return c.json({ success: true, data: account }, 201);
});

crudApp.patch("/:id", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const id = c.req.param("id");

  const existing = await dbStore.accounts.findOne(id);
  if (!existing) {
    return c.json({ error: "Account not found" }, 404);
  }

  const body = await c.req.json().catch(() => ({}));

  const combinedForValidation = {
    ...existing,
    ...body,
    custom: {
      ...(existing.custom || {}),
      ...(body.custom || {}),
    },
  };
  const pldValidation = await enforcePicklistDependencies("accounts", {
    ...combinedForValidation,
    ...(combinedForValidation.custom || {}),
  });
  if (!pldValidation.success) {
    return c.json({ error: pldValidation.error }, 400);
  }

  const customValValidation = await enforceCustomValidationRules("accounts", {
    ...combinedForValidation,
    ...(combinedForValidation.custom || {}),
  });
  if (!customValValidation.success) {
    return c.json({ error: customValValidation.error }, 400);
  }

  const updates: Partial<Omit<typeof existing, "id" | "orgId" | "ownerId">> =
    {};

  if (body.name !== undefined) updates.name = body.name;
  if (body.domain !== undefined) updates.domain = body.domain;
  if (body.custom !== undefined) updates.custom = body.custom;

  if (body.parentAccountId !== undefined) {
    const parentId = body.parentAccountId;
    if (parentId !== null) {
      const parent = await dbStore.accounts.findOne(parentId);
      if (!parent) {
        return c.json({ error: "Parent account not found" }, 400);
      }

      const allAccounts = await dbStore.accounts.findMany();
      const hasCycle = detectCircularAccountRelation(allAccounts, id, parentId);
      if (hasCycle) {
        return c.json(
          {
            error: "Setting this parent account creates a circular reference.",
          },
          400,
        );
      }
    }
    updates.parentAccountId = parentId;
  }

  const updated = await dbStore.accounts.update(id, updates);

  if (
    body.parentAccountId !== undefined &&
    existing.parentAccountId !== updates.parentAccountId
  ) {
    await dbStore.auditLogs.insert({
      orgId: tenant.orgId,
      recordId: id,
      recordType: "accounts",
      action: "update_hierarchy",
      userId: tenant.userId,
      changes: {
        parentAccountId: {
          before: existing.parentAccountId,
          after: updates.parentAccountId || null,
        },
      },
    });

    await triggerOutboundWebhooks(tenant.orgId, "account.hierarchy_updated", {
      accountId: id,
      oldParentId: existing.parentAccountId,
      newParentId: updates.parentAccountId || null,
    });
  } else {
    await dbStore.auditLogs.insert({
      orgId: tenant.orgId,
      recordId: id,
      recordType: "accounts",
      action: "update",
      userId: tenant.userId,
      changes: {
        account: { before: existing, after: updated },
      },
    });
  }

  return c.json({ success: true, data: updated });
});
