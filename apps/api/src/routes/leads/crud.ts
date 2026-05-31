import { dbStore } from "@crm/db";
import { validateCustomFields } from "@crm/metadata";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { checkAndRunLeadAutoConversion } from "../../lib/leadAutoConversion";
import {
  enforceCustomValidationRules,
  enforcePicklistDependencies,
} from "../../lib/validation";
import { triggerOutboundWebhooks } from "../../lib/webhooks";
import { type Env, tenantAuth } from "../../middleware/tenantAuth";

const baseCrudRouter = new OpenAPIHono<Env>();

baseCrudRouter.use(tenantAuth);

export const LeadSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  ownerId: z.string(),
  status: z.string(),
  email: z.string().nullable(),
  company: z.string().nullable(),
  convertedAccountId: z.string().nullable().optional(),
  convertedContactId: z.string().nullable().optional(),
  custom: z.any().nullable().optional(),
});

baseCrudRouter.post("/", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { email, company, status, custom } = body;

  if (custom && typeof custom === "object") {
    const allDefs = await dbStore.fieldDefinitions.findMany();
    const leadDefs = allDefs.filter((def) => def.objectType === "leads");
    const validation = validateCustomFields(
      custom,
      leadDefs.map((def) => ({
        apiName: def.apiName,
        dataType: def.dataType,
        validationRules: def.validationRules || undefined,
      })),
    );
    if (!validation.success) {
      return c.json(
        { error: "Validation failed", errors: validation.errors },
        400,
      );
    }
  }

  const pldValidation = await enforcePicklistDependencies("leads", {
    ...body,
    ...(custom || {}),
  });
  if (!pldValidation.success) {
    return c.json({ error: pldValidation.error }, 400);
  }

  const customValValidation = await enforceCustomValidationRules("leads", {
    ...body,
    ...(custom || {}),
  });
  if (!customValValidation.success) {
    return c.json({ error: customValValidation.error }, 400);
  }

  const leadData = {
    orgId: tenant.orgId,
    ownerId: tenant.userId,
    status: status || "New",
    email: email || null,
    company: company || null,
    convertedAccountId: null,
    convertedContactId: null,
    custom: custom || null,
  };

  const newLead = await dbStore.leads.insert(leadData);

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: newLead.id,
    recordType: "Lead",
    action: "create",
    userId: tenant.userId,
    changes: null,
  });

  await triggerOutboundWebhooks(
    tenant.orgId,
    "lead.created",
    newLead as unknown as Record<string, unknown>,
  );

  const targets = await dbStore.leadSlaTargets.findMany();
  const activeTarget = targets.find((t) => t.isActive === 1);
  if (activeTarget) {
    await dbStore.leadSlaTrackers.insert({
      orgId: tenant.orgId,
      leadId: newLead.id,
      targetId: activeTarget.id,
      status: "Pending",
      respondedAt: null,
      responseTimeMinutes: null,
    });
  }

  const autoConvertResult = await checkAndRunLeadAutoConversion(
    newLead.id,
    tenant.orgId,
    tenant.userId,
  );

  return c.json({
    success: true,
    data: newLead,
    autoConverted: autoConvertResult || null,
  });
});

export const listLeadsRoute = createRoute({
  method: "get",
  path: "/",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: z.array(LeadSchema),
          }),
        },
      },
      description: "List all leads",
    },
  },
});

const appWithList = baseCrudRouter.openapi(listLeadsRoute, async (c) => {
  const leads = await dbStore.leads.findMany();
  return c.json({ success: true, data: leads }, 200);
});

export const getLeadRoute = createRoute({
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
            data: LeadSchema,
          }),
        },
      },
      description: "Retrieve a lead by ID",
    },
    404: {
      content: {
        "application/json": {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
      description: "Lead not found",
    },
  },
});

const appWithGet = appWithList.openapi(getLeadRoute, async (c) => {
  const id = c.req.param("id");
  const lead = await dbStore.leads.findOne(id);
  if (!lead) {
    return c.json({ error: "Lead not found" }, 404);
  }
  return c.json({ success: true, data: lead }, 200);
});

baseCrudRouter.patch("/:id", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const { email, company, status, custom } = body;

  const lead = await dbStore.leads.findOne(id);
  if (!lead) {
    return c.json({ error: "Lead not found" }, 404);
  }

  if (custom && typeof custom === "object") {
    const allDefs = await dbStore.fieldDefinitions.findMany();
    const leadDefs = allDefs.filter((def) => def.objectType === "leads");
    const validation = validateCustomFields(
      custom,
      leadDefs.map((def) => ({
        apiName: def.apiName,
        dataType: def.dataType,
        validationRules: def.validationRules || undefined,
      })),
    );
    if (!validation.success) {
      return c.json(
        { error: "Validation failed", errors: validation.errors },
        400,
      );
    }
  }

  const combinedForValidation = {
    ...lead,
    ...body,
    custom: {
      ...(lead.custom || {}),
      ...(custom || {}),
    },
  };
  const pldValidation = await enforcePicklistDependencies("leads", {
    ...combinedForValidation,
    ...(combinedForValidation.custom || {}),
  });
  if (!pldValidation.success) {
    return c.json({ error: pldValidation.error }, 400);
  }

  const customValValidation = await enforceCustomValidationRules("leads", {
    ...combinedForValidation,
    ...(combinedForValidation.custom || {}),
  });
  if (!customValValidation.success) {
    return c.json({ error: customValValidation.error }, 400);
  }

  const updates: Record<string, unknown> = {};
  if (email !== undefined) updates.email = email;
  if (company !== undefined) updates.company = company;
  if (status !== undefined) updates.status = status;
  if (custom !== undefined) updates.custom = custom;

  const updatedLead = await dbStore.leads.update(id, updates);

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: id,
    recordType: "Lead",
    action: "update",
    userId: tenant.userId,
    changes: {
      update: { before: lead, after: updatedLead },
    },
  });

  const autoConvertResult = await checkAndRunLeadAutoConversion(
    id,
    tenant.orgId,
    tenant.userId,
  );

  return c.json({
    success: true,
    data: updatedLead,
    autoConverted: autoConvertResult || null,
  });
});

export const crudRouter = appWithGet;
