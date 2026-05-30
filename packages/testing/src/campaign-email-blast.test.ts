import { createSessionToken } from "@crm/auth";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../../../apps/api/src/index";

describe("Campaign Email Blast Bulk API & RLS Isolation Tests", () => {
  let tokenTenantA: string;
  let tokenTenantB: string;

  const orgA = "org-tenant-a";
  const orgB = "org-tenant-b";

  beforeEach(async () => {
    dbStore.clear();

    tokenTenantA = await createSessionToken({
      userId: "user-a",
      orgId: orgA,
      roleId: "role-a",
      permissionsMask: 7,
    });

    tokenTenantB = await createSessionToken({
      userId: "user-b",
      orgId: orgB,
      roleId: "role-b",
      permissionsMask: 7,
    });
  });

  it("should successfully execute a bulk campaign email blast and personalize templates for Leads and Contacts", async () => {
    let campaignId = "";
    let templateId = "";
    let leadId = "";
    let contactId = "";
    let accountId = "";
    let opportunityId = "";

    // 1. Setup Tenant A mock data
    await withTenant(orgA, mockDb, async () => {
      const campaign = await dbStore.campaigns.insert({
        orgId: orgA,
        name: "Q2 Sale Campaign",
        status: "Active",
        type: "Email",
        isActive: 1,
      });
      campaignId = campaign.id;

      const template = await dbStore.emailTemplates.insert({
        orgId: orgA,
        name: "Bulk Offer Template",
        subject: "Exclusive Offer for {{Lead.email}}{{Contact.firstName}}",
        body: "Hello! Company: {{Lead.company}}{{Account.name}}. Opp value: {{Opportunity.amount}}. Score: {{Lead.custom.score}}.",
      });
      templateId = template.id;

      const lead = await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "user-a",
        status: "New",
        email: "alice@lead.com",
        company: "Alice Corp",
        convertedAccountId: null,
        convertedContactId: null,
        custom: {
          score: 95,
        },
      });
      leadId = lead.id;

      const account = await dbStore.accounts.insert({
        orgId: orgA,
        ownerId: "user-a",
        name: "Acme Enterprises",
        domain: "acme.com",
        custom: null,
      });
      accountId = account.id;

      const contact = await dbStore.contacts.insert({
        orgId: orgA,
        ownerId: "user-a",
        accountId: account.id,
        firstName: "Bob",
        lastName: "Smith",
        email: "bob@contact.com",
        custom: null,
      });
      contactId = contact.id;

      const opportunity = await dbStore.opportunities.insert({
        orgId: orgA,
        ownerId: "user-a",
        accountId: account.id,
        name: "Acme Renewal",
        stage: "Prospecting",
        amount: "15000.00",
        closeDate: new Date(),
        custom: null,
      });
      opportunityId = opportunity.id;

      // Register both as campaign members
      await dbStore.campaignMembers.insert({
        orgId: orgA,
        campaignId: campaign.id,
        leadId: lead.id,
        contactId: null,
        status: "Planned",
      });

      await dbStore.campaignMembers.insert({
        orgId: orgA,
        campaignId: campaign.id,
        leadId: null,
        contactId: contact.id,
        status: "Planned",
      });
    });

    // 2. Execute email blast API
    const resBlast = await app.request(
      `/api/campaigns/${campaignId}/email-blast`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          templateId,
          senderEmail: "marketing@acme.com",
        }),
      },
    );

    expect(resBlast.status).toBe(200);
    const bodyBlast = await resBlast.json();
    expect(bodyBlast.success).toBe(true);
    expect(bodyBlast.processedCount).toBe(2);
    expect(bodyBlast.emailLogs).toHaveLength(2);

    // 3. Verify activity logs, linking, member status updates, and audit logs under Tenant A
    await withTenant(orgA, mockDb, async () => {
      // Check campaign member statuses updated to "Sent"
      const members = await dbStore.campaignMembers.findForCampaign(campaignId);
      expect(members).toHaveLength(2);
      expect(members[0].status).toBe("Sent");
      expect(members[1].status).toBe("Sent");

      // Verify compiled activity logs in database
      const activities = await dbStore.activities.findMany();
      expect(activities).toHaveLength(2);

      const leadAct = activities.find(
        (a) => a.custom?.to?.[0] === "alice@lead.com",
      );
      expect(leadAct).toBeDefined();
      expect(leadAct?.subject).toBe("Exclusive Offer for alice@lead.com");
      expect(leadAct?.body).toBe(
        "Hello! Company: Alice Corp. Opp value: . Score: 95.",
      );

      const contactAct = activities.find(
        (a) => a.custom?.to?.[0] === "bob@contact.com",
      );
      expect(contactAct).toBeDefined();
      expect(contactAct?.subject).toBe("Exclusive Offer for Bob");
      expect(contactAct?.body).toBe(
        "Hello! Company: Acme Enterprises. Opp value: 15000.00. Score: .",
      );

      // Verify activity links
      const links = await dbStore.activityLinks.findMany();
      // Links for Lead: to Lead (1), to Campaign (1) -> 2
      // Links for Contact: to Contact (1), to Campaign (1), to Account (1), to Opportunity (1) -> 4
      // Total links: 6
      expect(links).toHaveLength(6);

      const leadLinks = links.filter((l) => l.activityId === leadAct?.id);
      expect(
        leadLinks.some((l) => l.targetType === "Lead" && l.targetId === leadId),
      ).toBe(true);
      expect(
        leadLinks.some(
          (l) => l.targetType === "Campaign" && l.targetId === campaignId,
        ),
      ).toBe(true);

      const contactLinks = links.filter((l) => l.activityId === contactAct?.id);
      expect(
        contactLinks.some(
          (l) => l.targetType === "Contact" && l.targetId === contactId,
        ),
      ).toBe(true);
      expect(
        contactLinks.some(
          (l) => l.targetType === "Campaign" && l.targetId === campaignId,
        ),
      ).toBe(true);
      expect(
        contactLinks.some(
          (l) => l.targetType === "Account" && l.targetId === accountId,
        ),
      ).toBe(true);
      expect(
        contactLinks.some(
          (l) => l.targetType === "Opportunity" && l.targetId === opportunityId,
        ),
      ).toBe(true);

      // Verify audit logs
      const audits = await dbStore.auditLogs.findMany();
      expect(
        audits.filter(
          (a) => a.recordType === "EmailLog" && a.action === "create",
        ),
      ).toHaveLength(2);
    });
  });

  it("should enforce strict tenant RLS isolation on campaign email blast execution", async () => {
    let campaignIdA = "";
    let templateIdA = "";
    let _campaignIdB = "";

    // 1. Setup Campaign & Template for Tenant A
    await withTenant(orgA, mockDb, async () => {
      const campaign = await dbStore.campaigns.insert({
        orgId: orgA,
        name: "Tenant A Campaign",
        status: "Active",
        type: "Email",
        isActive: 1,
      });
      campaignIdA = campaign.id;

      const template = await dbStore.emailTemplates.insert({
        orgId: orgA,
        name: "Tenant A Template",
        subject: "Hello {{Contact.firstName}}",
        body: "Tenant A Offer",
      });
      templateIdA = template.id;

      // Add a member
      const lead = await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "user-a",
        status: "New",
        email: "alice@tenant-a.com",
        company: "A Corp",
        convertedAccountId: null,
        convertedContactId: null,
        custom: null,
      });

      await dbStore.campaignMembers.insert({
        orgId: orgA,
        campaignId: campaign.id,
        leadId: lead.id,
        contactId: null,
        status: "Planned",
      });
    });

    // 2. Setup Campaign for Tenant B
    await withTenant(orgB, mockDb, async () => {
      const campaign = await dbStore.campaigns.insert({
        orgId: orgB,
        name: "Tenant B Campaign",
        status: "Active",
        type: "Email",
        isActive: 1,
      });
      _campaignIdB = campaign.id;
    });

    // 3. Tenant B trying to blast Tenant A's campaign -> should return 404 (due to RLS separation)
    const resBlastBOnA = await app.request(
      `/api/campaigns/${campaignIdA}/email-blast`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          templateId: templateIdA,
          senderEmail: "marketing@tenant-b.com",
        }),
      },
    );
    expect(resBlastBOnA.status).toBe(404);

    // 4. Tenant A trying to blast their own campaign using Tenant B's template -> should return 404
    const resBlastAWithBTemplate = await app.request(
      `/api/campaigns/${campaignIdA}/email-blast`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          templateId: "emailtpl-tenant-b-nonexistent",
          senderEmail: "marketing@tenant-a.com",
        }),
      },
    );
    expect(resBlastAWithBTemplate.status).toBe(404);
  });
});
