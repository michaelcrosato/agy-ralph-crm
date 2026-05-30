import {
  createTicket,
  resolveTicket,
  type TicketInsert,
} from "@crm/module-service-lite";
import { describe, expect, it } from "vitest";
import app from "../../../apps/api/src/index";

describe("Phase 5: First-Party Extensions & MCP API Service Tests", () => {
  it("should successfully instantiate and resolve support tickets inside service-lite", () => {
    const insertData: TicketInsert = {
      orgId: "org-222",
      contactId: "contact-555",
      subject: "Urgent: Billing issue on checkout page",
    };

    const newTicket = createTicket(insertData);
    expect(newTicket).toBeDefined();
    expect(newTicket.subject).toBe(insertData.subject);
    expect(newTicket.status).toBe("Open");
    expect(newTicket.createdAt).toBeInstanceOf(Date);

    const resolved = resolveTicket(newTicket);
    expect(resolved.status).toBe("Resolved");
    expect(resolved.id).toBe(newTicket.id);
  });

  it("should expose Model Context Protocol (MCP) query definitions cleanly in the API router", async () => {
    const res = await app.request("/mcp/tools");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.tools).toBeDefined();
    expect(body.tools.length).toBeGreaterThanOrEqual(1);
    expect(body.tools[0].name).toBe("crm_get_account");
  });
});
