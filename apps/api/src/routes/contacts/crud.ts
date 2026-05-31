import { detectCircularContactRelation } from "@crm/core";
import { dbStore } from "@crm/db";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  enforceCustomValidationRules,
  enforcePicklistDependencies,
} from "../../lib/validation";
import { triggerOutboundWebhooks } from "../../lib/webhooks";
import { type Env, tenantAuth } from "../../middleware/tenantAuth";

export const ContactSchema = z
  .object({
    id: z.string(),
    orgId: z.string(),
    ownerId: z.string(),
    accountId: z.string().nullable().optional(),
    firstName: z.string().nullable().optional(),
    lastName: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
    custom: z.any().nullable().optional(),
    reportsToId: z.string().nullable().optional(),
  })
  .openapi("Contact");

export const listContactsRoute = createRoute({
  method: "get",
  path: "/",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: z.array(ContactSchema),
          }),
        },
      },
      description: "List all contacts",
    },
  },
});

export const getContactRoute = createRoute({
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
            data: ContactSchema,
          }),
        },
      },
      description: "Retrieve a contact by ID",
    },
    404: {
      content: {
        "application/json": {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
      description: "Contact not found",
    },
  },
});

const baseApp = new OpenAPIHono<Env>();

export const crudApp = baseApp
  .openapi(listContactsRoute, async (c) => {
    const contacts = await dbStore.contacts.findMany();
    return c.json({ success: true, data: contacts }, 200);
  })
  .openapi(getContactRoute, async (c) => {
    const id = c.req.param("id");
    const contact = await dbStore.contacts.findOne(id);
    if (!contact) {
      return c.json({ error: "Contact not found" }, 404);
    }
    return c.json({ success: true, data: contact }, 200);
  })
  .post("/", tenantAuth, async (c) => {
    const tenant = c.get("tenant");
    const body = await c.req.json().catch(() => ({}));
    const { accountId, firstName, lastName, email, custom, reportsToId } = body;

    if (!lastName) {
      return c.json({ error: "Missing required parameter: lastName" }, 400);
    }

    const pldValidation = await enforcePicklistDependencies("contacts", {
      ...body,
      ...(custom || {}),
    });
    if (!pldValidation.success) {
      return c.json({ error: pldValidation.error }, 400);
    }

    const customValValidation = await enforceCustomValidationRules("contacts", {
      ...body,
      ...(custom || {}),
    });
    if (!customValValidation.success) {
      return c.json({ error: customValValidation.error }, 400);
    }

    if (reportsToId) {
      const manager = await dbStore.contacts.findOne(reportsToId);
      if (!manager) {
        return c.json({ error: "Manager contact not found" }, 400);
      }
    }

    const contact = await dbStore.contacts.insert({
      orgId: tenant.orgId,
      ownerId: tenant.userId,
      accountId: accountId || null,
      firstName: firstName || null,
      lastName,
      email: email || null,
      custom: custom || null,
      reportsToId: reportsToId || null,
    });

    await dbStore.auditLogs.insert({
      orgId: tenant.orgId,
      recordId: contact.id,
      recordType: "contacts",
      action: "create",
      userId: tenant.userId,
      changes: {
        contact: { before: null, after: contact },
      },
    });

    return c.json({ success: true, data: contact }, 201);
  })
  .patch("/:id", tenantAuth, async (c) => {
    const tenant = c.get("tenant");
    const id = c.req.param("id");

    const existing = await dbStore.contacts.findOne(id);
    if (!existing) {
      return c.json({ error: "Contact not found" }, 404);
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
    const pldValidation = await enforcePicklistDependencies("contacts", {
      ...combinedForValidation,
      ...(combinedForValidation.custom || {}),
    });
    if (!pldValidation.success) {
      return c.json({ error: pldValidation.error }, 400);
    }

    const customValValidation = await enforceCustomValidationRules("contacts", {
      ...combinedForValidation,
      ...(combinedForValidation.custom || {}),
    });
    if (!customValValidation.success) {
      return c.json({ error: customValValidation.error }, 400);
    }

    const updates: Partial<Omit<typeof existing, "id" | "orgId" | "ownerId">> =
      {};

    if (body.accountId !== undefined) updates.accountId = body.accountId;
    if (body.firstName !== undefined) updates.firstName = body.firstName;
    if (body.lastName !== undefined) updates.lastName = body.lastName;
    if (body.email !== undefined) updates.email = body.email;
    if (body.custom !== undefined) updates.custom = body.custom;

    if (body.reportsToId !== undefined) {
      const reportsToId = body.reportsToId;
      if (reportsToId !== null) {
        const manager = await dbStore.contacts.findOne(reportsToId);
        if (!manager) {
          return c.json({ error: "Manager contact not found" }, 400);
        }

        const allContacts = await dbStore.contacts.findMany();
        const hasCycle = detectCircularContactRelation(
          allContacts,
          id,
          reportsToId,
        );
        if (hasCycle) {
          return c.json(
            {
              error:
                "Setting this manager creates a circular reporting relationship.",
            },
            400,
          );
        }
      }
      updates.reportsToId = reportsToId;
    }

    const updated = await dbStore.contacts.update(id, updates);

    if (
      body.reportsToId !== undefined &&
      existing.reportsToId !== updates.reportsToId
    ) {
      await dbStore.auditLogs.insert({
        orgId: tenant.orgId,
        recordId: id,
        recordType: "contacts",
        action: "update_hierarchy",
        userId: tenant.userId,
        changes: {
          reportsToId: {
            before: existing.reportsToId,
            after: updates.reportsToId || null,
          },
        },
      });

      await triggerOutboundWebhooks(tenant.orgId, "contact.hierarchy_updated", {
        contactId: id,
        oldReportsToId: existing.reportsToId,
        newReportsToId: updates.reportsToId || null,
      });
    } else {
      await dbStore.auditLogs.insert({
        orgId: tenant.orgId,
        recordId: id,
        recordType: "contacts",
        action: "update",
        userId: tenant.userId,
        changes: {
          contact: { before: existing, after: updated },
        },
      });
    }

    return c.json({ success: true, data: updated });
  });
