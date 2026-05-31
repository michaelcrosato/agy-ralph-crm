import { Permission } from "@crm/auth";
import { dbStore } from "@crm/db";
import { Hono } from "hono";
import { requirePermission } from "../../middleware/rbac";
import { type Env, tenantAuth } from "../../middleware/tenantAuth";

export const adminApp = new Hono<Env>();

adminApp.use("*", tenantAuth, requirePermission(Permission.MANAGE_USERS));

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
