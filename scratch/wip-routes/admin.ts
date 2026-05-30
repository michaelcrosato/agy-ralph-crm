import {
  calculateAdjustedForecast,
  calculateGlobalCompetitorAnalytics,
  calculateNextRunDate,
  calculateSalesLeaderboard,
  calculateStageVelocity,
  parseCSV,
  processCSVImport,
  rollbackStoreMigrations,
  runPendingScheduledReports,
  runStoreMigrations,
} from "@crm/core";
import { dbStore, store } from "@crm/db";
import { compileForecastSummary } from "@crm/forecasting";
import { runReport } from "@crm/reporting";
import { Hono } from "hono";
import { triggerOutboundWebhooks } from "../lib/webhooks";
import { type Env, tenantAuth } from "../middleware/tenantAuth";

export const adminApp = new Hono<Env>();
export const dbApp = new Hono<Env>();
export const importsApp = new Hono<Env>();
export const reportsApp = new Hono<Env>();
export const leaderboardsApp = new Hono<Env>();
export const forecastsApp = new Hono<Env>();

reportsApp.get("/stage-velocity", tenantAuth, async (c) => {
  const history = await dbStore.opportunityStageHistory.findMany();
  const historyInputs = history.map((h) => ({
    opportunityId: h.opportunityId,
    fromStage: h.fromStage,
    toStage: h.toStage,
    createdAt: h.createdAt,
  }));
  const velocityReport = calculateStageVelocity(historyInputs, new Date());
  return c.json({ success: true, data: velocityReport });
});

reportsApp.get("/competitor-analytics", tenantAuth, async (c) => {
  const competitors = await dbStore.opportunityCompetitors.findMany();
  const opportunities = await dbStore.opportunities.findMany();

  const report = calculateGlobalCompetitorAnalytics({
    competitors: competitors.map((comp) => ({
      id: comp.id,
      orgId: comp.orgId,
      opportunityId: comp.opportunityId,
      name: comp.name,
      strength: comp.strength,
      weakness: comp.weakness,
      winLossStatus: comp.winLossStatus,
    })),
    opportunities: opportunities.map((opp) => ({
      id: opp.id,
      orgId: opp.orgId,
      stage: opp.stage,
      amount: opp.amount,
    })),
  });

  return c.json({ success: true, data: report });
});

reportsApp.post("/", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { name, objectType, groupBy, aggregateField, aggregateFunc } = body;

  if (!name || !objectType || !groupBy) {
    return c.json({ error: "Missing required report fields" }, 400);
  }

  const allowedObjectTypes = [
    "leads",
    "opportunities",
    "tickets",
    "accounts",
    "contacts",
  ];
  if (!allowedObjectTypes.includes(objectType)) {
    return c.json(
      {
        error: `Invalid object type. Allowed: ${allowedObjectTypes.join(", ")}`,
      },
      400,
    );
  }

  const allowedFuncs = ["count", "sum", "avg"];
  const func = aggregateFunc || "count";
  if (!allowedFuncs.includes(func)) {
    return c.json(
      {
        error: `Invalid aggregate function. Allowed: ${allowedFuncs.join(", ")}`,
      },
      400,
    );
  }

  const newReport = await dbStore.reports.insert({
    orgId: tenant.orgId,
    name,
    objectType: objectType as
      | "leads"
      | "opportunities"
      | "tickets"
      | "accounts"
      | "contacts",
    groupBy,
    aggregateField: aggregateField || null,
    aggregateFunc: func as "count" | "sum" | "avg",
  });

  return c.json({ success: true, data: newReport });
});

reportsApp.get("/", tenantAuth, async (c) => {
  const reports = await dbStore.reports.findMany();
  return c.json({ success: true, data: reports });
});

reportsApp.post("/run", tenantAuth, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { name, objectType, groupBy, aggregateField, aggregateFunc } = body;

  if (!objectType || !groupBy) {
    return c.json({ error: "Missing required report execution fields" }, 400);
  }

  const allowedObjectTypes = [
    "leads",
    "opportunities",
    "tickets",
    "accounts",
    "contacts",
  ];
  if (!allowedObjectTypes.includes(objectType)) {
    return c.json(
      {
        error: `Invalid object type. Allowed: ${allowedObjectTypes.join(", ")}`,
      },
      400,
    );
  }

  const allowedFuncs = ["count", "sum", "avg"];
  const func = aggregateFunc || "count";
  if (!allowedFuncs.includes(func)) {
    return c.json(
      {
        error: `Invalid aggregate function. Allowed: ${allowedFuncs.join(", ")}`,
      },
      400,
    );
  }

  let records: Record<string, unknown>[] = [];
  if (objectType === "leads")
    records = (await dbStore.leads.findMany()) as unknown as Record<
      string,
      unknown
    >[];
  else if (objectType === "opportunities")
    records = (await dbStore.opportunities.findMany()) as unknown as Record<
      string,
      unknown
    >[];
  else if (objectType === "tickets")
    records = (await dbStore.tickets.findMany()) as unknown as Record<
      string,
      unknown
    >[];
  else if (objectType === "accounts")
    records = (await dbStore.accounts.findMany()) as unknown as Record<
      string,
      unknown
    >[];
  else if (objectType === "contacts")
    records = (await dbStore.contacts.findMany()) as unknown as Record<
      string,
      unknown
    >[];

  const results = runReport({
    name: name || "Ad-hoc Report",
    records,
    groupBy,
    aggregateField: aggregateField || null,
    aggregateFunc: func as "count" | "sum" | "avg",
  });

  return c.json({ success: true, data: results });
});

reportsApp.get("/:id/run", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const report = await dbStore.reports.findOne(id);
  if (!report) {
    return c.json({ error: "Report not found" }, 404);
  }

  let records: Record<string, unknown>[] = [];
  if (report.objectType === "leads")
    records = (await dbStore.leads.findMany()) as unknown as Record<
      string,
      unknown
    >[];
  else if (report.objectType === "opportunities")
    records = (await dbStore.opportunities.findMany()) as unknown as Record<
      string,
      unknown
    >[];
  else if (report.objectType === "tickets")
    records = (await dbStore.tickets.findMany()) as unknown as Record<
      string,
      unknown
    >[];
  else if (report.objectType === "accounts")
    records = (await dbStore.accounts.findMany()) as unknown as Record<
      string,
      unknown
    >[];
  else if (report.objectType === "contacts")
    records = (await dbStore.contacts.findMany()) as unknown as Record<
      string,
      unknown
    >[];

  const results = runReport({
    name: report.name,
    records,
    groupBy: report.groupBy,
    aggregateField: report.aggregateField,
    aggregateFunc: report.aggregateFunc,
  });

  return c.json({ success: true, data: results });
});

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

adminApp.post("/seed", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const accountCount = Math.min(Number(body.accountCount) || 10, 500);
  const contactCount = Math.min(Number(body.contactCount) || 10, 500);
  const leadCount = Math.min(Number(body.leadCount) || 10, 500);
  const opportunityCount = Math.min(Number(body.opportunityCount) || 10, 500);

  const orgId = tenant.orgId;
  const ownerId = tenant.userId;

  const accounts = [];
  const contacts = [];
  const leads = [];
  const opportunities = [];

  for (let i = 0; i < accountCount; i++) {
    const acc = await dbStore.accounts.insert({
      orgId,
      ownerId,
      name: `Scale Account ${i}`,
      domain: `scale-account-${i}.com`,
      custom: null,
    });
    accounts.push(acc);
  }

  for (let i = 0; i < contactCount; i++) {
    const parentAccount = accounts[i % (accounts.length || 1)];
    const con = await dbStore.contacts.insert({
      orgId,
      ownerId,
      accountId: parentAccount ? parentAccount.id : null,
      firstName: `FirstScale${i}`,
      lastName: `LastScale${i}`,
      email: `scale-contact-${i}@domain.com`,
      custom: null,
    });
    contacts.push(con);
  }

  for (let i = 0; i < leadCount; i++) {
    const ld = await dbStore.leads.insert({
      orgId,
      ownerId,
      status: i % 3 === 0 ? "New" : i % 3 === 1 ? "Working" : "Converted",
      email: `scale-lead-${i}@company.com`,
      company: `Scale Lead Company ${i}`,
      convertedAccountId: null,
      convertedContactId: null,
      custom: null,
    });
    leads.push(ld);
  }

  for (let i = 0; i < opportunityCount; i++) {
    const parentAccount = accounts[i % (accounts.length || 1)];
    const opp = await dbStore.opportunities.insert({
      orgId,
      ownerId,
      accountId: parentAccount ? parentAccount.id : null,
      name: `Scale Opportunity ${i}`,
      stage: i % 2 === 0 ? "Qualification" : "Closed Won",
      amount: (1000 + i * 150).toFixed(2),
      closeDate: new Date("2026-12-31"),
      custom: null,
    });
    opportunities.push(opp);
  }

  return c.json({
    success: true,
    message: `Seeded ${accounts.length} accounts, ${contacts.length} contacts, ${leads.length} leads, ${opportunities.length} opportunities successfully under org ${orgId}.`,
    counts: {
      accounts: accounts.length,
      contacts: contacts.length,
      leads: leads.length,
      opportunities: opportunities.length,
    },
  });
});

adminApp.post("/fuzz", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const orgId = tenant.orgId;
  const ownerId = tenant.userId;

  const payloads: { company?: string; email?: string; status?: string }[] = [
    {
      company: "A".repeat(5000), // extreme size
      email: "fuzz-oversized@domain.com",
    },
    {
      company: "Lead' OR '1'='1",
      email: "fuzz-sqli@domain.com",
    },
    {
      company: "Lead <script>alert(1)</script>",
      email: "fuzz-html@domain.com",
    },
    {
      email: "broken-lead@domain.com",
    },
    {
      company: "Empty status corp",
      email: "empty-status@domain.com",
      status: "",
    },
  ];

  const failures: { payload: unknown; error: string }[] = [];

  for (const payload of payloads) {
    try {
      await dbStore.leads.insert({
        orgId,
        ownerId,
        status: payload.status || "New",
        email: payload.email ?? null,
        company: payload.company || null,
        convertedAccountId: null,
        convertedContactId: null,
        custom: null,
      });
    } catch (err) {
      failures.push({
        payload,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return c.json({
    success: true,
    totalRuns: payloads.length,
    failures,
  });
});

dbApp.get("/migrations", tenantAuth, async (c) => {
  const migrations = await dbStore.schemaMigrations.findMany();
  return c.json({
    success: true,
    migrations,
  });
});

dbApp.post("/migrate", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const targetVersion =
    body.targetVersion !== undefined ? Number(body.targetVersion) : undefined;

  const result = await runStoreMigrations(
    dbStore,
    store,
    tenant.orgId,
    targetVersion,
  );

  return c.json(result);
});

dbApp.post("/rollback", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  if (body.targetVersion === undefined) {
    return c.json(
      { success: false, error: "targetVersion is required for rollback." },
      400,
    );
  }
  const targetVersion = Number(body.targetVersion);

  const result = await rollbackStoreMigrations(
    dbStore,
    store,
    tenant.orgId,
    targetVersion,
  );

  return c.json(result);
});

reportsApp.get("/scheduled", tenantAuth, async (c) => {
  const schedules = await dbStore.scheduledReports.findMany();
  return c.json({
    success: true,
    schedules,
  });
});

reportsApp.post("/scheduled", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { reportId, recipientEmail, frequency, isActive } = body;

  if (!reportId || !recipientEmail || !frequency) {
    return c.json(
      { error: "Missing required fields: reportId, recipientEmail, frequency" },
      400,
    );
  }

  const report = await dbStore.reports.findOne(reportId);
  if (!report) {
    return c.json({ error: `Report with ID ${reportId} not found.` }, 404);
  }

  const nextRunAt = calculateNextRunDate(new Date(), frequency);

  const schedule = await dbStore.scheduledReports.insert({
    orgId: tenant.orgId,
    reportId,
    recipientEmail,
    frequency,
    nextRunAt,
    isActive: isActive !== undefined ? Number(isActive) : 1,
  });

  return c.json({
    success: true,
    schedule,
  });
});

reportsApp.delete("/scheduled/:id", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const schedule = await dbStore.scheduledReports.findOne(id);
  if (!schedule) {
    return c.json(
      { error: "Scheduled report not found or unauthorized." },
      404,
    );
  }
  const success = await dbStore.scheduledReports.delete(id);
  if (!success) {
    return c.json(
      { error: "Scheduled report not found or unauthorized." },
      404,
    );
  }
  return c.json({
    success: true,
  });
});

reportsApp.post("/scheduled/run-pending", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const processed = await runPendingScheduledReports(
    dbStore,
    store,
    tenant.orgId,
    triggerOutboundWebhooks,
  );
  return c.json({
    success: true,
    processed,
  });
});

leaderboardsApp.get("/", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const periodParam = c.req.query("period");

  let period = periodParam;
  if (!period) {
    const today = new Date();
    period = today.toISOString().substring(0, 7);
  }

  const tenantMemberships = store.memberships.filter(
    (m) => m.orgId === tenant.orgId,
  );
  const usersInput = tenantMemberships.map((m) => {
    const u = store.users.find((user) => user.id === m.userId);
    return {
      userId: m.userId,
      userName: u ? u.email.split("@")[0] : "Unknown Rep",
    };
  });

  const opportunities = await dbStore.opportunities.findMany();
  const quotas = await dbStore.quotas.findMany();

  const oppsInput = opportunities.map((opp) => ({
    id: opp.id,
    ownerId: opp.ownerId,
    stage: opp.stage,
    amount: opp.amount,
    closeDate: opp.closeDate ? new Date(opp.closeDate) : null,
  }));

  const quotasInput = quotas.map((q) => ({
    userId: q.userId,
    period: q.period,
    targetAmount: q.targetAmount,
  }));

  const result = calculateSalesLeaderboard({
    period,
    users: usersInput,
    opportunities: oppsInput,
    quotas: quotasInput,
  });

  return c.json({
    success: true,
    ...result,
  });
});

forecastsApp.get("/adjustments", tenantAuth, async (c) => {
  const adjustments = await dbStore.forecastAdjustments.findMany();
  return c.json({ success: true, data: adjustments });
});

forecastsApp.post("/adjustments", tenantAuth, async (c) => {
  const body = await c.req.json();
  const tenant = c.get("tenant");
  const newAdj = await dbStore.forecastAdjustments.insert({
    orgId: tenant.orgId,
    userId: body.userId,
    adjustedByUserId: tenant.userId,
    period: body.period,
    amount: body.amount,
    adjustmentType: body.adjustmentType,
    comments: body.comments || null,
  });
  return c.json({ success: true, data: newAdj });
});

forecastsApp.get("/adjusted-summary", tenantAuth, async (c) => {
  let period = c.req.query("period");
  if (!period) {
    period = new Date().toISOString().substring(0, 7);
  }

  const opportunities = await dbStore.opportunities.findMany();
  const quotas = await dbStore.quotas.findMany();
  const dbProbs = await dbStore.stageProbabilities.findMany();

  const customProbabilities: Record<string, number> = {};
  for (const p of dbProbs) {
    customProbabilities[p.stage] = p.probability;
  }

  const oppInputs = opportunities.map((opp) => ({
    id: opp.id,
    stage: opp.stage,
    amount: opp.amount,
    closeDate: opp.closeDate,
  }));

  const filteredOpps = oppInputs.filter((opp) => {
    if (!opp.closeDate) return false;
    try {
      const d = new Date(opp.closeDate);
      return (
        !Number.isNaN(d.getTime()) && d.toISOString().substring(0, 7) === period
      );
    } catch (_e) {
      return false;
    }
  });

  let closedWonAmount = 0;
  for (const opp of filteredOpps) {
    if (opp.stage === "Closed Won") {
      closedWonAmount += Number.parseFloat(opp.amount || "0") || 0;
    }
  }

  let totalQuota = 0;
  const filteredQuotas = quotas.filter((q) => q.period === period);
  for (const q of filteredQuotas) {
    totalQuota += Number.parseFloat(q.targetAmount) || 0;
  }

  const summary = compileForecastSummary({
    opportunities: filteredOpps,
    targetQuota: totalQuota,
    customProbabilities,
  });

  const adjustments = await dbStore.forecastAdjustments.findMany();
  const periodAdjustments = adjustments.filter((adj) => adj.period === period);

  const result = calculateAdjustedForecast({
    period,
    baseQuota: totalQuota,
    baseWeightedAmount: summary.totalWeightedAmount,
    closedWonAmount,
    adjustments: periodAdjustments.map((adj) => ({
      userId: adj.userId,
      period: adj.period,
      amount: adj.amount,
      adjustmentType: adj.adjustmentType,
    })),
  });

  return c.json({ success: true, data: result });
});
