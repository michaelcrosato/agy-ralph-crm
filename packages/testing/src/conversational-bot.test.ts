import { createSessionToken } from "@crm/auth";
import { ConversationalBotService } from "@crm/core";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestApp } from "./_harness";

const app = createTestApp();

describe("Conversational AI Lead Qualification Bot Tests", () => {
  let tokenTenantA: string;
  let tokenTenantB: string;

  const orgA = "org-tenant-a";
  const orgB = "org-tenant-b";

  beforeEach(async () => {
    // Clear stores
    dbStore.clear();

    // Setup session tokens
    tokenTenantA = await createSessionToken({
      userId: "user-a",
      orgId: orgA,
      roleId: "role-a",
      permissionsMask: 63, // elevated permission
    });

    tokenTenantB = await createSessionToken({
      userId: "user-b",
      orgId: orgB,
      roleId: "role-b",
      permissionsMask: 63,
    });

    // Explicitly boot the ConversationalBotService listener
    ConversationalBotService.initialize();
  });

  it("should support multi-turn BANT qualification conversational loops, bot automated replies, and status transitions", async () => {
    // 1. Create a lead under Tenant A
    let leadId = "";
    await withTenant(orgA, mockDb, async () => {
      const lead = await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "user-a",
        status: "New",
        email: "bob@techcorp.io",
        company: "Tech Corp",
        custom: null,
      });
      leadId = lead.id;
    });

    // 2. Fetch conversational status initially -> BANT traits are unknown, score is 0
    const initRes = await app.request(
      `/api/leads/${leadId}/conversation/status`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      },
    );

    expect(initRes.status).toBe(200);
    const initBody = await initRes.json();
    expect(initBody.success).toBe(true);
    expect(initBody.data.bantBudget).toBe("unknown");
    expect(initBody.data.bantAuthority).toBe("unknown");
    expect(initBody.data.bantNeed).toBe("unknown");
    expect(initBody.data.bantTimeline).toBe("unknown");
    expect(initBody.data.bantScore).toBe(0);
    expect(initBody.data.botQualificationStatus).toBe("needs_more_info");
    expect(initBody.data.history.length).toBe(0);

    // 3. Turn 1: Inbound message from lead expressing urgent need for CRM
    const turn1Res = await app.request(
      `/api/leads/${leadId}/conversation/simulate`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message:
            "Hi, we are looking for a scaling CRM ASAP to handle our sales sequences.",
          type: "email",
        }),
      },
    );

    expect(turn1Res.status).toBe(200);
    const turn1Body = await turn1Res.json();
    expect(turn1Body.success).toBe(true);

    // BANT rating: Need and Timeline should now be qualified. Score goes to 50.
    const status1Res = await app.request(
      `/api/leads/${leadId}/conversation/status`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      },
    );

    const status1 = await status1Res.json();
    expect(status1.data.bantNeed).toBe("qualified");
    expect(status1.data.bantTimeline).toBe("qualified");
    expect(status1.data.bantScore).toBe(50);
    expect(status1.data.botQualificationStatus).toBe("needs_more_info");
    // History contains simulated inbound lead message + bot's auto-generated outbound reply!
    expect(status1.data.history.length).toBe(2);
    expect(status1.data.history[0].sender).toBe("Lead");
    expect(status1.data.history[1].sender).toBe("Bot");
    expect(status1.data.history[1].body).toContain("budget");

    // 4. Turn 2: Lead replies with their budget allocation
    const turn2Res = await app.request(
      `/api/leads/${leadId}/conversation/simulate`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: "Our budget allocated is $12,000 for the platform.",
          type: "email",
        }),
      },
    );

    expect(turn2Res.status).toBe(200);

    // BANT rating: Budget should now be qualified. Score goes to 75.
    const status2Res = await app.request(
      `/api/leads/${leadId}/conversation/status`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      },
    );

    const status2 = await status2Res.json();
    expect(status2.data.bantBudget).toBe("qualified");
    expect(status2.data.bantScore).toBe(75);
    expect(status2.data.botQualificationStatus).toBe("needs_more_info");
    expect(status2.data.history.length).toBe(4); // 2 inbound, 2 bot replies
    expect(status2.data.history[3].body).toContain("decision-maker");

    // 5. Turn 3: Lead replies confirming decision power as VP
    const turn3Res = await app.request(
      `/api/leads/${leadId}/conversation/simulate`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message:
            "Yes, I am the VP of Sales and make the primary purchasing decisions.",
          type: "email",
        }),
      },
    );

    expect(turn3Res.status).toBe(200);

    // BANT rating: Authority should now be qualified. Score is 100.
    // BotQualificationStatus is qualified, lead.status is Qualified.
    const status3Res = await app.request(
      `/api/leads/${leadId}/conversation/status`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      },
    );

    const status3 = await status3Res.json();
    expect(status3.data.bantAuthority).toBe("qualified");
    expect(status3.data.bantScore).toBe(100);
    expect(status3.data.botQualificationStatus).toBe("qualified");

    // Check actual lead record status
    await withTenant(orgA, mockDb, async () => {
      const finalLead = await dbStore.leads.findOne(leadId);
      expect(finalLead?.status).toBe("Qualified");
    });
  });

  it("should support instant disqualification when critical negative triggers are detected", async () => {
    // Create a lead
    let leadId = "";
    await withTenant(orgA, mockDb, async () => {
      const lead = await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "user-a",
        status: "New",
        email: "tester@retailshop.com",
        company: "Retail Shop",
        custom: null,
      });
      leadId = lead.id;
    });

    // Simulate negative budget message
    const simRes = await app.request(
      `/api/leads/${leadId}/conversation/simulate`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: "We want a free CRM tool because we have zero budget.",
        }),
      },
    );

    expect(simRes.status).toBe(200);

    // BANT status: Budget unqualified, bot qualification unqualified
    const statusRes = await app.request(
      `/api/leads/${leadId}/conversation/status`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      },
    );

    const status = await statusRes.json();
    expect(status.data.bantBudget).toBe("unqualified");
    expect(status.data.botQualificationStatus).toBe("unqualified");

    // Check actual lead status is Disqualified
    await withTenant(orgA, mockDb, async () => {
      const lead = await dbStore.leads.findOne(leadId);
      expect(lead?.status).toBe("Disqualified");
    });
  });

  it("should strictly enforce multi-tenant RLS isolation on bot simulation and status checks", async () => {
    // 1. Create a lead under Tenant A
    let leadIdA = "";
    await withTenant(orgA, mockDb, async () => {
      const lead = await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "user-a",
        status: "New",
        email: "bob@techcorp.io",
        company: "Tech Corp",
        custom: null,
      });
      leadIdA = lead.id;
    });

    // 2. Tenant B attempts to simulate -> returns 404
    const simResB = await app.request(
      `/api/leads/${leadIdA}/conversation/simulate`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: "Hello from wrong tenant" }),
      },
    );

    expect(simResB.status).toBe(404);

    // 3. Tenant B attempts to read status -> returns 404
    const statusResB = await app.request(
      `/api/leads/${leadIdA}/conversation/status`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
        },
      },
    );

    expect(statusResB.status).toBe(404);
  });
});
