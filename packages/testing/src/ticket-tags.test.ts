import { createSessionToken } from "@crm/auth";
import { validateTicketTagInput } from "@crm/core";
import { dbStore, mockDb, store, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../../../apps/api/src/index";

describe("Support Ticket Tags & Categorization Engine API Tests", () => {
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
    it("should validate and reject invalid tag inputs", () => {
      // Valid input
      const validRes = validateTicketTagInput({
        name: "Bug",
        color: "#FF0000",
      });
      expect(validRes.success).toBe(true);

      // Empty name
      const emptyNameRes = validateTicketTagInput({
        name: "",
        color: "#FF0000",
      });
      expect(emptyNameRes.success).toBe(false);
      expect(emptyNameRes.error).toBe("Tag name cannot be empty.");

      // Overly long name
      const longNameRes = validateTicketTagInput({
        name: "A".repeat(51),
        color: "#FF0000",
      });
      expect(longNameRes.success).toBe(false);
      expect(longNameRes.error).toBe("Tag name cannot exceed 50 characters.");

      // Invalid color missing #
      const colorRes1 = validateTicketTagInput({
        name: "Bug",
        color: "FF0000",
      });
      expect(colorRes1.success).toBe(false);
      expect(colorRes1.error).toBe(
        "Tag color must be a valid 6-character hex color starting with '#'.",
      );

      // Invalid color incorrect length
      const colorRes2 = validateTicketTagInput({ name: "Bug", color: "#FF00" });
      expect(colorRes2.success).toBe(false);

      // Invalid color non-hex character
      const colorRes3 = validateTicketTagInput({
        name: "Bug",
        color: "#FF00GG",
      });
      expect(colorRes3.success).toBe(false);
    });
  });

  describe("Ticket Tag REST API Integration", () => {
    it("should support tag creation, duplicate prevention, and listing", async () => {
      // 1. Create tag A
      const createRes = await app.request("/api/service/tags", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Billing",
          color: "#00FF00",
        }),
      });

      expect(createRes.status).toBe(200);
      const resBody = await createRes.json();
      expect(resBody.success).toBe(true);
      expect(resBody.data.id).toBeDefined();
      expect(resBody.data.name).toBe("Billing");
      expect(resBody.data.color).toBe("#00FF00");

      const tagId = resBody.data.id;

      // 2. Attempt duplicate tag name -> should return 400
      const dupRes = await app.request("/api/service/tags", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "  billing  ", // Trimmed case-insensitive match
          color: "#11FF11",
        }),
      });
      expect(dupRes.status).toBe(400);
      const dupBody = await dupRes.json();
      expect(dupBody.error).toBe("Tag name already exists");

      // 3. List all tags as Tenant A -> returns 1 tag
      const listResA = await app.request("/api/service/tags", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      });
      expect(listResA.status).toBe(200);
      const listBodyA = await listResA.json();
      expect(listBodyA.data.length).toBe(1);
      expect(listBodyA.data[0].id).toBe(tagId);

      // 4. List all tags as Tenant B -> returns 0 tags (isolated)
      const listResB = await app.request("/api/service/tags", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
        },
      });
      expect(listResB.status).toBe(200);
      const listBodyB = await listResB.json();
      expect(listBodyB.data.length).toBe(0);

      // Verify audit log exists for Tag A creation
      const auditLogs = store.auditLogs.filter((log) => log.orgId === orgA);
      expect(
        auditLogs.some(
          (log) =>
            log.recordId === tagId &&
            log.recordType === "ticket_tags" &&
            log.action === "create",
        ),
      ).toBe(true);
    });

    it("should support linking and unlinking tags to tickets under active RLS", async () => {
      let contactId = "";
      let ticketIdA = "";
      let tagIdA = "";
      let tagIdB = "";

      // 1. Seed tenant A contact and ticket, and a tenant A tag
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
          subject: "Ticket for Tagging",
          status: "Open",
        });
        ticketIdA = ticket.id;

        const tag = await dbStore.ticketTags.insert({
          orgId: orgA,
          name: "High-Priority",
          color: "#FF0000",
        });
        tagIdA = tag.id;
      });

      // Seed a tenant B tag to verify cross-tenant linking block
      await withTenant(orgB, mockDb, async () => {
        const tag = await dbStore.ticketTags.insert({
          orgId: orgB,
          name: "Tenant B Tag",
          color: "#0000FF",
        });
        tagIdB = tag.id;
      });

      // 2. Link Tenant A tag to Ticket A -> success
      const linkRes = await app.request(
        `/api/service/tickets/${ticketIdA}/tags`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenTenantA}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ tagId: tagIdA }),
        },
      );
      expect(linkRes.status).toBe(200);
      const linkBody = await linkRes.json();
      expect(linkBody.success).toBe(true);
      expect(linkBody.data.id).toBeDefined();

      const linkId = linkBody.data.id;

      // 3. Duplicate Link attempt -> should be idempotent (return 200 and existing link)
      const dupLinkRes = await app.request(
        `/api/service/tickets/${ticketIdA}/tags`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenTenantA}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ tagId: tagIdA }),
        },
      );
      expect(dupLinkRes.status).toBe(200);
      const dupLinkBody = await dupLinkRes.json();
      expect(dupLinkBody.data.id).toBe(linkId);

      // 4. Try to link Tenant B's tag to Ticket A -> should return 404 since Tag B is not found under Tenant A
      const linkResB = await app.request(
        `/api/service/tickets/${ticketIdA}/tags`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenTenantA}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ tagId: tagIdB }),
        },
      );
      expect(linkResB.status).toBe(404);

      // 5. Try to link Tenant A's tag to Ticket A as Tenant B -> should return 404 (Ticket not found/isolated)
      const linkResB2 = await app.request(
        `/api/service/tickets/${ticketIdA}/tags`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenTenantB}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ tagId: tagIdA }),
        },
      );
      expect(linkResB2.status).toBe(404);

      // 6. List Ticket Tags as Tenant A -> returns 1 tag
      const getTagsRes = await app.request(
        `/api/service/tickets/${ticketIdA}/tags`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${tokenTenantA}`,
          },
        },
      );
      expect(getTagsRes.status).toBe(200);
      const getTagsBody = await getTagsRes.json();
      expect(getTagsBody.data.length).toBe(1);
      expect(getTagsBody.data[0].id).toBe(tagIdA);

      // 7. List Ticket Tags as Tenant B -> returns 404 (isolated)
      const getTagsResB = await app.request(
        `/api/service/tickets/${ticketIdA}/tags`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${tokenTenantB}`,
          },
        },
      );
      expect(getTagsResB.status).toBe(404);

      // 8. Delete the link as Tenant B -> returns 404 (isolated)
      const deleteResB = await app.request(
        `/api/service/tickets/${ticketIdA}/tags/${tagIdA}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${tokenTenantB}`,
          },
        },
      );
      expect(deleteResB.status).toBe(404);

      // 9. Delete the link as Tenant A -> success (200)
      const deleteRes = await app.request(
        `/api/service/tickets/${ticketIdA}/tags/${tagIdA}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${tokenTenantA}`,
          },
        },
      );
      expect(deleteRes.status).toBe(200);

      // 10. List Ticket Tags again as Tenant A -> returns 0 tags
      const getTagsRes2 = await app.request(
        `/api/service/tickets/${ticketIdA}/tags`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${tokenTenantA}`,
          },
        },
      );
      expect(getTagsRes2.status).toBe(200);
      const getTagsBody2 = await getTagsRes2.json();
      expect(getTagsBody2.data.length).toBe(0);

      // Verify audit logs for both link creation and deletion
      const auditLogs = store.auditLogs.filter((log) => log.orgId === orgA);
      expect(
        auditLogs.some(
          (log) =>
            log.recordId === linkId &&
            log.recordType === "ticket_tag_links" &&
            log.action === "create",
        ),
      ).toBe(true);
      expect(
        auditLogs.some(
          (log) =>
            log.recordId === linkId &&
            log.recordType === "ticket_tag_links" &&
            log.action === "delete",
        ),
      ).toBe(true);
    });
  });
});
