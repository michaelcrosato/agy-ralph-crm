import {
  type AuditLogInsert,
  formatAuditLog,
  formatTimeline,
} from "@crm/audit";
import {
  convertLead,
  type LeadConversionInput,
  type LeadRecord,
} from "@crm/core";
import { describe, expect, it } from "vitest";

describe("Phase 2: Lead Conversion & Audit Timeline Engine Tests", () => {
  it("should correctly compile lead details into Account and Contact structures during conversion", () => {
    const mockLead: LeadRecord = {
      id: "lead-111",
      orgId: "org-222",
      ownerId: "user-333",
      status: "New",
      email: "john.doe@company.com",
      company: "Acme Corp",
      custom: { priority: "High" },
    };

    const input: LeadConversionInput = {
      lead: mockLead,
      opportunityName: "Acme Enterprise Deal",
      opportunityAmount: "50000",
    };

    const entities = convertLead(input);

    // Account verification
    expect(entities.account).toBeDefined();
    expect(entities.account.name).toBe("Acme Corp");
    expect(entities.account.orgId).toBe(mockLead.orgId);
    expect(entities.account.custom).toEqual(mockLead.custom);

    // Contact verification
    expect(entities.contact).toBeDefined();
    expect(entities.contact.firstName).toBe("john");
    expect(entities.contact.lastName).toBe("doe");
    expect(entities.contact.email).toBe(mockLead.email);

    // Opportunity verification
    expect(entities.opportunity).toBeDefined();
    expect(entities.opportunity?.name).toBe("Acme Enterprise Deal");
    expect(entities.opportunity?.amount).toBe("50000");
    expect(entities.opportunity?.stage).toBe("Qualification");
  });

  it("should compile and format change auditories correctly", () => {
    const mockInsert: AuditLogInsert = {
      orgId: "org-222",
      recordId: "lead-111",
      recordType: "Lead",
      action: "update",
      userId: "user-333",
      changes: {
        status: { before: "New", after: "Converted" },
      },
    };

    const auditPayload = formatAuditLog(mockInsert);
    expect(auditPayload).toBeDefined();
    expect(auditPayload.action).toBe("update");
    expect(auditPayload.changes).toEqual(mockInsert.changes);
    expect(auditPayload.createdAt).toBeInstanceOf(Date);
  });

  it("should build structured, chronological timelines from change logs", () => {
    const dummyLogs = [
      {
        id: "log-1",
        orgId: "org-222",
        recordId: "lead-111",
        recordType: "Lead",
        action: "create",
        userId: "user-333",
        changes: null,
        createdAt: new Date("2026-05-28T10:00:00Z"),
      },
      {
        id: "log-2",
        orgId: "org-222",
        recordId: "lead-111",
        recordType: "Lead",
        action: "update",
        userId: "user-333",
        changes: { status: { before: "New", after: "Converted" } },
        createdAt: new Date("2026-05-28T10:05:00Z"),
      },
    ];

    const timeline = formatTimeline(dummyLogs);
    expect(timeline.length).toBe(2);
    expect(timeline[0].summary).toContain("created");
    expect(timeline[1].summary).toContain("updated");
    expect(timeline[1].details).toHaveProperty("status");
  });
});
