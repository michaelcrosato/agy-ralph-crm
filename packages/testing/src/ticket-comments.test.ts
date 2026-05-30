import { createSessionToken } from "@crm/auth";
import { validateTicketCommentInput } from "@crm/core";
import { dbStore, mockDb, store, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestApp } from "./_harness";

const app = createTestApp();

describe("Support Ticket Comments & Replies Management Engine API Tests", () => {
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

  describe("Core Pure Logic Unit Tests", () => {
    it("should reject empty comment body or whitespace only", () => {
      const emptyRes = validateTicketCommentInput({ body: "" });
      expect(emptyRes.success).toBe(false);
      expect(emptyRes.error).toBe("Comment body cannot be empty.");

      const spaceRes = validateTicketCommentInput({ body: "   " });
      expect(spaceRes.success).toBe(false);
      expect(spaceRes.error).toBe("Comment body cannot be empty.");

      const validRes = validateTicketCommentInput({
        body: "This is a valid comment.",
      });
      expect(validRes.success).toBe(true);
    });
  });

  describe("Ticket Comment REST API Integration", () => {
    it("should support creating, listing, and RLS isolating ticket comments", async () => {
      let contactId = "";
      let ticketIdA = "";

      // 1. Seed tenant A contact and ticket
      await withTenant(orgA, mockDb, async () => {
        const contact = await dbStore.contacts.insert({
          orgId: orgA,
          ownerId: "user-a",
          firstName: "John",
          lastName: "Doe",
          email: "john.doe@org.com",
          custom: null,
        });
        contactId = contact.id;

        const ticket = await dbStore.tickets.insert({
          orgId: orgA,
          contactId,
          subject: "Database connection timeouts",
          status: "Open",
        });
        ticketIdA = ticket.id;
      });

      // 2. Post a comment under Tenant A
      const createCommentResA = await app.request(
        `/api/service/tickets/${ticketIdA}/comments`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenTenantA}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            body: "We are investigating the DB logs right now.",
          }),
        },
      );

      expect(createCommentResA.status).toBe(200);
      const commentBodyA = await createCommentResA.json();
      expect(commentBodyA.success).toBe(true);
      expect(commentBodyA.data.id).toBeDefined();
      expect(commentBodyA.data.orgId).toBe(orgA);
      expect(commentBodyA.data.ticketId).toBe(ticketIdA);
      expect(commentBodyA.data.body).toBe(
        "We are investigating the DB logs right now.",
      );
      expect(commentBodyA.data.authorId).toBe("user-a");

      const commentId = commentBodyA.data.id;

      // 3. List comments as Tenant A -> returns 1 item
      const listCommentsResA = await app.request(
        `/api/service/tickets/${ticketIdA}/comments`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${tokenTenantA}`,
          },
        },
      );
      expect(listCommentsResA.status).toBe(200);
      const listCommentsA = await listCommentsResA.json();
      expect(listCommentsA.success).toBe(true);
      expect(listCommentsA.data.length).toBe(1);
      expect(listCommentsA.data[0].id).toBe(commentId);
      expect(listCommentsA.data[0].body).toBe(
        "We are investigating the DB logs right now.",
      );

      // 4. Attempt to list comments as Tenant B -> returns 404 since Ticket belongs to A
      const listCommentsResB = await app.request(
        `/api/service/tickets/${ticketIdA}/comments`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${tokenTenantB}`,
          },
        },
      );
      expect(listCommentsResB.status).toBe(404);

      // 5. Attempt to post comment as Tenant B to Tenant A's ticket -> returns 404 (mismatch/isolation)
      const createCommentResB = await app.request(
        `/api/service/tickets/${ticketIdA}/comments`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenTenantB}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            body: "Trying to inject comment to Tenant A's ticket.",
          }),
        },
      );
      expect(createCommentResB.status).toBe(404);

      // 6. Verify audit log entry was created for Tenant A's comment
      const auditLogs = store.auditLogs.filter((log) => log.orgId === orgA);
      expect(
        auditLogs.some(
          (log) =>
            log.recordId === commentId &&
            log.recordType === "ticket_comments" &&
            log.action === "create",
        ),
      ).toBe(true);
    });

    it("should reject ticket comments with empty body", async () => {
      let contactId = "";
      let ticketId = "";

      await withTenant(orgA, mockDb, async () => {
        const contact = await dbStore.contacts.insert({
          orgId: orgA,
          ownerId: "user-a",
          firstName: "John",
          lastName: "Doe",
          email: "john.doe@org.com",
          custom: null,
        });
        contactId = contact.id;

        const ticket = await dbStore.tickets.insert({
          orgId: orgA,
          contactId,
          subject: "Empty comment test ticket",
          status: "Open",
        });
        ticketId = ticket.id;
      });

      const res = await app.request(
        `/api/service/tickets/${ticketId}/comments`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenTenantA}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            body: "   ",
          }),
        },
      );
      expect(res.status).toBe(400);
      const resBody = await res.json();
      expect(resBody.error).toBe("Comment body cannot be empty.");
    });
  });
});
