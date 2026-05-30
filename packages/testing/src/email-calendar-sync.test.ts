import { createSessionToken } from "@crm/auth";
import { syncExternalItems } from "@crm/core";
import { dbStore, store } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestApp } from "./_harness";

const app = createTestApp();

describe("Email & Calendar Synchronization API Tests", () => {
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

  describe("Core Domain Logic Engine (syncExternalItems)", () => {
    const mockEmails = [
      {
        externalId: "ext-email-1",
        sender: "john@client.com",
        recipient: "user-a@mycompany.com",
        subject: "Contract details",
        body: "Here is the contract.",
        receivedAt: new Date("2026-05-20T10:00:00Z"),
      },
      {
        externalId: "ext-email-2",
        sender: "unknown@spam.com",
        recipient: "user-a@mycompany.com",
        subject: "Buy cheap stuff",
        body: "Link inside.",
        receivedAt: new Date("2026-05-20T11:00:00Z"),
      },
      {
        externalId: "ext-email-3",
        sender: "user-a@mycompany.com",
        recipient: "alice@lead.com",
        subject: "Introduction",
        body: "Hi Alice, nice to meet you.",
        receivedAt: new Date("2026-05-20T12:00:00Z"),
      },
    ];

    const mockEvents = [
      {
        externalId: "ext-event-1",
        title: "Kickoff Meeting",
        description: "Let's align on next steps.",
        attendees: ["john@client.com", "user-a@mycompany.com"],
        eventDate: new Date("2026-05-21T14:00:00Z"),
      },
      {
        externalId: "ext-event-2",
        title: "Personal Doctor Visit",
        description: "Routine checkup.",
        attendees: ["user-a@mycompany.com"],
        eventDate: new Date("2026-05-21T16:00:00Z"),
      },
      {
        externalId: "ext-event-3",
        title: "Lead Sync Up",
        description: "Brief call.",
        attendees: ["alice@lead.com", "user-a@mycompany.com"],
        eventDate: new Date("2026-05-21T18:00:00Z"),
      },
    ];

    const existingContacts = [{ id: "contact-john", email: "john@client.com" }];
    const existingLeads = [{ id: "lead-alice", email: "alice@lead.com" }];

    it("should correctly sync matching emails and calendar events and skip non-matching or duplicate ones", () => {
      const result = syncExternalItems({
        settings: { syncEmails: true, syncCalendar: true },
        externalEmails: mockEmails,
        externalCalendarEvents: mockEvents,
        existingContacts,
        existingLeads,
        existingActivityExternalIds: ["ext-email-1"], // Skip John's email since it is already synced
      });

      // Assert Emails
      // john@client.com is contact-john (but ext-email-1 is marked duplicate, so it is skipped)
      // unknown@spam.com has no match (skipped)
      // alice@lead.com is lead-alice (ext-email-3 is matched and synced)
      expect(result.syncedEmails.length).toBe(1);
      expect(result.syncedEmails[0].externalId).toBe("ext-email-3");
      expect(result.syncedEmails[0].targetType).toBe("Lead");
      expect(result.syncedEmails[0].targetId).toBe("lead-alice");

      // Assert Calendar Events
      // ext-event-1 contains john@client.com (matched contact-john)
      // ext-event-2 contains only user-a (no CRM record match, skipped)
      // ext-event-3 contains alice@lead.com (matched lead-alice)
      expect(result.syncedEvents.length).toBe(2);
      expect(result.syncedEvents[0].externalId).toBe("ext-event-1");
      expect(result.syncedEvents[0].targetType).toBe("Contact");
      expect(result.syncedEvents[0].targetId).toBe("contact-john");

      expect(result.syncedEvents[1].externalId).toBe("ext-event-3");
      expect(result.syncedEvents[1].targetType).toBe("Lead");
      expect(result.syncedEvents[1].targetId).toBe("lead-alice");
    });

    it("should respect settings disabling email or calendar syncing", () => {
      const resultNoEmail = syncExternalItems({
        settings: { syncEmails: false, syncCalendar: true },
        externalEmails: mockEmails,
        externalCalendarEvents: mockEvents,
        existingContacts,
        existingLeads,
        existingActivityExternalIds: [],
      });
      expect(resultNoEmail.syncedEmails.length).toBe(0);
      expect(resultNoEmail.syncedEvents.length).toBe(2);

      const resultNoCalendar = syncExternalItems({
        settings: { syncEmails: true, syncCalendar: false },
        externalEmails: mockEmails,
        externalCalendarEvents: mockEvents,
        existingContacts,
        existingLeads,
        existingActivityExternalIds: [],
      });
      expect(resultNoCalendar.syncedEmails.length).toBe(2);
      expect(resultNoCalendar.syncedEvents.length).toBe(0);
    });
  });

  describe("REST API Endpoints & RLS Verification", () => {
    it("should reject unauthenticated requests with 401", async () => {
      const getRes = await app.request("/api/productivity/sync/settings", {
        method: "GET",
      });
      expect(getRes.status).toBe(401);

      const triggerRes = await app.request("/api/productivity/sync/trigger", {
        method: "POST",
      });
      expect(triggerRes.status).toBe(401);
    });

    it("should support managing settings and triggering sync under strict tenant RLS isolation", async () => {
      // 1. Get settings initially -> returns null / success true data null
      const getInitRes = await app.request("/api/productivity/sync/settings", {
        method: "GET",
        headers: { Authorization: `Bearer ${tokenTenantA}` },
      });
      expect(getInitRes.status).toBe(200);
      expect((await getInitRes.json()).data).toBeNull();

      // 2. Set sync settings in Tenant A
      const postSettingsARes = await app.request(
        "/api/productivity/sync/settings",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenTenantA}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            provider: "google",
            isActive: true,
            syncEmails: true,
            syncCalendar: true,
          }),
        },
      );
      expect(postSettingsARes.status).toBe(200);
      const settingsA = (await postSettingsARes.json()).data;
      expect(settingsA.id).toBeDefined();
      expect(settingsA.provider).toBe("google");

      // 3. Verify Tenant B cannot see Tenant A's settings
      const getSettingsBRes = await app.request(
        "/api/productivity/sync/settings",
        {
          method: "GET",
          headers: { Authorization: `Bearer ${tokenTenantB}` },
        },
      );
      expect(getSettingsBRes.status).toBe(200);
      expect((await getSettingsBRes.json()).data).toBeNull();

      // 4. Create Contact and Lead in Tenant A
      const contactARes = await app.request("/api/contacts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName: "John",
          lastName: "Doe",
          email: "john.doe@partner.com",
        }),
      });
      expect(contactARes.status).toBe(201);
      const _contactA = (await contactARes.json()).data;

      // 5. Trigger sync in Tenant A with mock emails/events
      const triggerARes = await app.request("/api/productivity/sync/trigger", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          emails: [
            {
              externalId: "ext-1",
              sender: "john.doe@partner.com",
              recipient: "user-a@company.com",
              subject: "Contract signing",
              body: "Signed document attached.",
              receivedAt: new Date().toISOString(),
            },
          ],
          events: [
            {
              externalId: "ext-2",
              title: "Partner sync",
              description: "Review milestones.",
              attendees: ["john.doe@partner.com"],
              eventDate: new Date().toISOString(),
            },
          ],
        }),
      });

      expect(triggerARes.status).toBe(200);
      const runLogA = (await triggerARes.json()).data;
      expect(runLogA.status).toBe("success");
      expect(runLogA.emailsSyncedCount).toBe(1);
      expect(runLogA.eventsSyncedCount).toBe(1);

      // 6. Verify activities were correctly created in Tenant A
      const activitiesA = store.activities.filter((act) => act.orgId === orgA);
      // Should have imported 1 email activity and 1 task activity
      expect(activitiesA.length).toBe(2);
      expect(activitiesA[0].type).toBe("email");
      expect(activitiesA[0].subject).toBe("Contract signing");
      expect(activitiesA[1].type).toBe("task");
      expect(activitiesA[1].subject).toBe("Meeting: Partner sync");

      // 7. Verify Tenant B cannot see the created activities or sync runs
      const activitiesB = store.activities.filter((act) => act.orgId === orgB);
      expect(activitiesB.length).toBe(0);

      const getRunsBRes = await app.request("/api/productivity/sync/runs", {
        method: "GET",
        headers: { Authorization: `Bearer ${tokenTenantB}` },
      });
      expect(getRunsBRes.status).toBe(200);
      expect((await getRunsBRes.json()).data.length).toBe(0);

      // 8. Trigger sync in Tenant B -> Returns 400 because Tenant B has no active sync settings
      const triggerBRes = await app.request("/api/productivity/sync/trigger", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      expect(triggerBRes.status).toBe(400);
    });
  });
});
