import { createSessionToken } from "@crm/auth";
import { applyTicketMacro, validateTicketMacroInput } from "@crm/core";
import { dbStore, mockDb, store, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../../../apps/api/src/index";

describe("Support Ticket Canned Responses & Macros Engine API Tests", () => {
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
    it("should validate macro inputs correctly", () => {
      const invalidName = validateTicketMacroInput({
        name: "",
        cannedResponse: "Valid Response",
      });
      expect(invalidName.success).toBe(false);
      expect(invalidName.error).toBe("Macro name cannot be empty.");

      const invalidResponse = validateTicketMacroInput({
        name: "Valid Name",
        cannedResponse: "   ",
      });
      expect(invalidResponse.success).toBe(false);
      expect(invalidResponse.error).toBe("Canned response cannot be empty.");

      const validMacro = validateTicketMacroInput({
        name: "Valid Macro Name",
        cannedResponse: "This is a canned response.",
      });
      expect(validMacro.success).toBe(true);
    });

    it("should process applyTicketMacro logic correctly", () => {
      const ticket = {
        id: "t-1",
        orgId: orgA,
        status: "Open",
        priority: "Medium",
      };

      const macro = {
        id: "m-1",
        orgId: orgA,
        name: "Close Ticket Macro",
        cannedResponse: "Closing this ticket due to inactivity.",
        updateStatus: "Resolved",
        updatePriority: "High",
      };

      const result = applyTicketMacro({ ticket, macro });
      expect(result.updatedStatus).toBe("Resolved");
      expect(result.updatedPriority).toBe("High");
      expect(result.commentBody).toBe("Closing this ticket due to inactivity.");
      expect(result.auditMessage).toContain(
        "Applied macro [Close Ticket Macro]",
      );

      // Test RLS Mismatch throws Error
      expect(() =>
        applyTicketMacro({
          ticket,
          macro: { ...macro, orgId: orgB },
        }),
      ).toThrow("RLS Isolation Violation: Tenant mismatch.");
    });
  });

  describe("Ticket Canned Responses & Macros REST API Integration", () => {
    it("should support macro creation, listing, applying, and strict tenant RLS isolation", async () => {
      // 1. Create a macro as Tenant A
      const createResA = await app.request("/api/service/tickets/macros", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Resolve Ticket Macro",
          description: "Resolves ticket with auto-response",
          cannedResponse:
            "Thank you for contacting support! Your ticket is resolved.",
          updateStatus: "Resolved",
          updatePriority: "Low",
        }),
      });

      expect(createResA.status).toBe(200);
      const macroBodyA = await createResA.json();
      expect(macroBodyA.success).toBe(true);
      expect(macroBodyA.data.id).toBeDefined();
      expect(macroBodyA.data.orgId).toBe(orgA);
      expect(macroBodyA.data.name).toBe("Resolve Ticket Macro");

      const macroIdA = macroBodyA.data.id;

      // 2. Create macro with empty name (should fail)
      const createResFail = await app.request("/api/service/tickets/macros", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "",
          cannedResponse: "Body",
        }),
      });
      expect(createResFail.status).toBe(400);

      // 3. List macros as Tenant A -> returns 1 macro
      const listResA = await app.request("/api/service/tickets/macros", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      });
      expect(listResA.status).toBe(200);
      const listA = await listResA.json();
      expect(listA.success).toBe(true);
      expect(listA.data.length).toBe(1);
      expect(listA.data[0].id).toBe(macroIdA);

      // 4. List macros as Tenant B -> returns 0 macros (RLS isolation)
      const listResB = await app.request("/api/service/tickets/macros", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
        },
      });
      expect(listResB.status).toBe(200);
      const listB = await listResB.json();
      expect(listB.success).toBe(true);
      expect(listB.data.length).toBe(0);

      // 5. Seed a ticket under Tenant A
      let contactId = "";
      let ticketIdA = "";

      await withTenant(orgA, mockDb, async () => {
        const contact = await dbStore.contacts.insert({
          orgId: orgA,
          ownerId: "user-a",
          firstName: "Alice",
          lastName: "Smith",
          email: "alice@domain.com",
          custom: null,
        });
        contactId = contact.id;

        const ticket = await dbStore.tickets.insert({
          orgId: orgA,
          contactId,
          subject: "Trouble resetting password",
          status: "Open",
          priority: "Medium",
        });
        ticketIdA = ticket.id;
      });

      // 6. Apply Tenant A's macro to Tenant A's ticket
      const applyRes = await app.request(
        `/api/service/tickets/${ticketIdA}/apply-macro/${macroIdA}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenTenantA}`,
          },
        },
      );

      expect(applyRes.status).toBe(200);
      const applyBody = await applyRes.json();
      expect(applyBody.success).toBe(true);
      expect(applyBody.data.status).toBe("Resolved");
      expect(applyBody.data.priority).toBe("Low");
      expect(applyBody.comment.body).toBe(
        "Thank you for contacting support! Your ticket is resolved.",
      );
      expect(applyBody.message).toContain(
        "Applied macro [Resolve Ticket Macro]",
      );

      // 7. Verify the comment actually exists in store
      await withTenant(orgA, mockDb, async () => {
        const comments = await dbStore.ticketComments.findMany();
        const ticketComments = comments.filter((c) => c.ticketId === ticketIdA);
        expect(ticketComments.length).toBe(1);
        expect(ticketComments[0].body).toBe(
          "Thank you for contacting support! Your ticket is resolved.",
        );
      });

      // 8. Verify the audit log exists
      const auditLogs = store.auditLogs.filter((log) => log.orgId === orgA);
      expect(
        auditLogs.some(
          (log) =>
            log.recordId === ticketIdA &&
            log.recordType === "Ticket" &&
            log.action === "apply_macro",
        ),
      ).toBe(true);

      // 9. Try to apply Tenant A's macro as Tenant B (mismatch orgId) -> should fail with 404 since Tenant A's ticket is invisible to Tenant B
      const applyResB = await app.request(
        `/api/service/tickets/${ticketIdA}/apply-macro/${macroIdA}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenTenantB}`,
          },
        },
      );
      expect(applyResB.status).toBe(404);
    });
  });
});
