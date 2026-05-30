import { createSessionToken } from "@crm/auth";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestApp } from "./_harness";

const app = createTestApp();

describe("Marketing Sequence Member Activity Logs & Timeline API Tests (Task 0218)", () => {
  interface TestEvent {
    id: string;
    type: string;
    timestamp: string;
    details: Record<string, string | number | null | undefined>;
  }

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

  describe("Timeline Consolidation & RLS Isolation Tests", () => {
    it("should consolidate and sort chronological events for sequence memberships with strict tenant RLS isolation", async () => {
      let sequenceId = "";
      let membershipId = "";
      let trackerId1 = "";
      let trackerId2 = "";

      // 1. Seed Tenant A records (Sequence, Membership, Trackers, and Event entries)
      await withTenant(orgA, mockDb, async () => {
        const seq = await dbStore.marketingSequences.insert({
          orgId: orgA,
          name: "Sequence with Activity Logs",
          description: "Activity logs testing",
          status: "active",
        });
        sequenceId = seq.id;

        const member = await dbStore.marketingSequenceMemberships.insert({
          orgId: orgA,
          sequenceId,
          recordType: "contact",
          recordId: "contact-123",
          status: "active",
        });
        membershipId = member.id;

        // Tracker 1: Represents first sent email (createdAt = 10 mins ago)
        const t1 = await dbStore.emailTrackers.insert({
          orgId: orgA,
          activityId: membershipId,
          token: "token-1",
          subject: "Welcome to our product",
          openCount: 1,
          clickCount: 1,
          replyCount: 1,
          bounceCount: 0,
          createdAt: new Date(Date.now() - 10 * 60 * 1000),
          updatedAt: new Date(Date.now() - 10 * 60 * 1000),
        });
        trackerId1 = t1.id;

        // Tracker 2: Represents second sent email (createdAt = 2 mins ago)
        const t2 = await dbStore.emailTrackers.insert({
          orgId: orgA,
          activityId: membershipId,
          token: "token-2",
          subject: "Checking back in",
          openCount: 1,
          clickCount: 0,
          replyCount: 0,
          bounceCount: 1,
          createdAt: new Date(Date.now() - 2 * 60 * 1000),
          updatedAt: new Date(Date.now() - 2 * 60 * 1000),
        });
        trackerId2 = t2.id;

        // Open event on Tracker 1 (createdAt = 8 mins ago)
        await dbStore.emailOpenEvents.insert({
          orgId: orgA,
          trackerId: trackerId1,
          ipAddress: "192.168.1.1",
          userAgent: "Mozilla/5.0",
          deviceType: "desktop",
          createdAt: new Date(Date.now() - 8 * 60 * 1000),
        });

        // Click event on Tracker 1 (createdAt = 7 mins ago)
        await dbStore.emailClickEvents.insert({
          orgId: orgA,
          trackerId: trackerId1,
          clickedUrl: "https://example.com/pricing",
          ipAddress: "192.168.1.1",
          userAgent: "Mozilla/5.0",
          utmSource: "sequence",
          utmMedium: "email",
          utmCampaign: "onboarding",
          createdAt: new Date(Date.now() - 7 * 60 * 1000),
        });

        // Reply event on Tracker 1 (createdAt = 5 mins ago)
        await dbStore.emailReplyEvents.insert({
          orgId: orgA,
          trackerId: trackerId1,
          replyBody: "Thanks for the welcome!",
          senderEmail: "user@customer.com",
          sentiment: "positive",
          createdAt: new Date(Date.now() - 5 * 60 * 1000),
        });

        // Bounce event on Tracker 2 (createdAt = 1 min ago)
        await dbStore.emailBounceEvents.insert({
          orgId: orgA,
          trackerId: trackerId2,
          eventType: "bounce",
          bounceType: "hard",
          bounceReason: "User mailbox unavailable",
          createdAt: new Date(Date.now() - 1 * 60 * 1000),
        });

        // Read Time event on Tracker 1 (createdAt = 6 mins ago)
        await dbStore.emailReadTimeEvents.insert({
          orgId: orgA,
          trackerId: trackerId1,
          durationMs: 15000,
          readClassification: "read",
          createdAt: new Date(Date.now() - 6 * 60 * 1000),
        });
      });

      // 2. Fetch timeline as Tenant A -> expect consolidated sorted timeline logs
      const resA = await app.request(
        `/api/sequences/${sequenceId}/members/${membershipId}/logs`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${tokenTenantA}`,
          },
        },
      );

      expect(resA.status).toBe(200);
      const dataA = await resA.json();
      expect(dataA.success).toBe(true);
      expect(dataA.data.length).toBe(7); // 2 sent + 1 open + 1 click + 1 reply + 1 bounce + 1 read_time = 7 total events

      // 3. Verify chronological descending sorting (newest first)
      const timestamps = dataA.data.map((e: TestEvent) =>
        new Date(e.timestamp).getTime(),
      );
      for (let i = 0; i < timestamps.length - 1; i++) {
        expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i + 1]);
      }

      // Verify specific timeline event entries and their details
      const bounceEvent = dataA.data.find(
        (e: TestEvent) => e.type === "bounce",
      ) as TestEvent;
      expect(bounceEvent).toBeDefined();
      expect(bounceEvent.details.bounceType).toBe("hard");
      expect(bounceEvent.details.bounceReason).toBe("User mailbox unavailable");

      const sentEvent2 = dataA.data.find(
        (e: TestEvent) => e.type === "sent" && e.details.token === "token-2",
      ) as TestEvent;
      expect(sentEvent2).toBeDefined();
      expect(sentEvent2.details.subject).toBe("Checking back in");

      const replyEvent = dataA.data.find(
        (e: TestEvent) => e.type === "reply",
      ) as TestEvent;
      expect(replyEvent).toBeDefined();
      expect(replyEvent.details.replyBody).toBe("Thanks for the welcome!");
      expect(replyEvent.details.sentiment).toBe("positive");

      const clickEvent = dataA.data.find(
        (e: TestEvent) => e.type === "click",
      ) as TestEvent;
      expect(clickEvent).toBeDefined();
      expect(clickEvent.details.clickedUrl).toBe("https://example.com/pricing");
      expect(clickEvent.details.utmSource).toBe("sequence");

      const openEvent = dataA.data.find(
        (e: TestEvent) => e.type === "open",
      ) as TestEvent;
      expect(openEvent).toBeDefined();
      expect(openEvent.details.deviceType).toBe("desktop");

      const readTimeEvent = dataA.data.find(
        (e: TestEvent) => e.type === "read_time",
      ) as TestEvent;
      expect(readTimeEvent).toBeDefined();
      expect(readTimeEvent.details.durationMs).toBe(15000);
      expect(readTimeEvent.details.readClassification).toBe("read");

      // 4. Fetch timeline as Tenant B -> strict RLS isolation blocks it (403 or throwing tenant context RLS err)
      const resB = await app.request(
        `/api/sequences/${sequenceId}/members/${membershipId}/logs`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${tokenTenantB}`,
          },
        },
      );
      expect(resB.status).toBe(404);
      const dataB = await resB.json();
      expect(dataB.success).toBe(false);
      expect(dataB.error).toContain("Sequence not found");
    });

    it("should return correct validations and error codes on bad parameters", async () => {
      let sequenceId = "";
      let membershipId = "";
      let anotherSeqId = "";

      await withTenant(orgA, mockDb, async () => {
        const seq = await dbStore.marketingSequences.insert({
          orgId: orgA,
          name: "Onboarding Sequence",
          description: "Main seq",
          status: "active",
        });
        sequenceId = seq.id;

        const member = await dbStore.marketingSequenceMemberships.insert({
          orgId: orgA,
          sequenceId,
          recordType: "contact",
          recordId: "contact-456",
          status: "active",
        });
        membershipId = member.id;

        const anotherSeq = await dbStore.marketingSequences.insert({
          orgId: orgA,
          name: "Another Sequence",
          description: "Other seq",
          status: "draft",
        });
        anotherSeqId = anotherSeq.id;
      });

      // 1. Missing / invalid sequence ID -> 404 Sequence not found
      const resNotFoundSeq = await app.request(
        `/api/sequences/sequence-does-not-exist/members/${membershipId}/logs`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${tokenTenantA}`,
          },
        },
      );
      expect(resNotFoundSeq.status).toBe(404);
      const dataNotFoundSeq = await resNotFoundSeq.json();
      expect(dataNotFoundSeq.success).toBe(false);
      expect(dataNotFoundSeq.error).toContain("Sequence not found");

      // 2. Missing / invalid membership ID -> 404 Membership not found
      const resNotFoundMember = await app.request(
        `/api/sequences/${sequenceId}/members/membership-does-not-exist/logs`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${tokenTenantA}`,
          },
        },
      );
      expect(resNotFoundMember.status).toBe(404);
      const dataNotFoundMember = await resNotFoundMember.json();
      expect(dataNotFoundMember.success).toBe(false);
      expect(dataNotFoundMember.error).toContain("Membership not found");

      // 3. Valid membership but mismatched sequence ID -> 400 Bad Request
      const resMismatchedSeq = await app.request(
        `/api/sequences/${anotherSeqId}/members/${membershipId}/logs`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${tokenTenantA}`,
          },
        },
      );
      expect(resMismatchedSeq.status).toBe(400);
      const dataMismatchedSeq = await resMismatchedSeq.json();
      expect(dataMismatchedSeq.success).toBe(false);
      expect(dataMismatchedSeq.error).toContain("Membership does not belong");
    });
  });
});
