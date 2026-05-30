import { createSessionToken } from "@crm/auth";
import { parseCSV, processCSVImport } from "@crm/core";
import { dbStore } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestApp } from "./_harness";

const app = createTestApp();

describe("CSV Data Import & Column Mapping API Tests", () => {
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

  describe("Core Unit Tests - parseCSV & processCSVImport", () => {
    it("should parse standard comma-delimited strings with quotes correctly", () => {
      const csv = `Company Name,Email,Status
"Acme, Inc.",acme@test.com,New
"Globe Corp",globe@test.com,Working`;

      const parsed = parseCSV(csv);
      expect(parsed.length).toBe(3);
      expect(parsed[0]).toEqual(["Company Name", "Email", "Status"]);
      expect(parsed[1]).toEqual(["Acme, Inc.", "acme@test.com", "New"]);
      expect(parsed[2]).toEqual(["Globe Corp", "globe@test.com", "Working"]);
    });

    it("should process mappings and detect validation errors", () => {
      const csv = `Company,Email Address,Status
Acme Corp,acme@test.com,New
,,Working
Acme Corp,invalid-email,Working`;

      const parsed = parseCSV(csv);
      const mapping = {
        company: "Company",
        email: "Email Address",
        status: "Status",
      };

      const { valid, errors } = processCSVImport("lead", parsed, mapping);

      // Row 1: Valid
      // Row 2: Invalid (company and email missing)
      // Row 3: Invalid (invalid email format)
      expect(valid.length).toBe(1);
      expect(errors.length).toBe(2);

      expect(errors[0].row).toBe(3);
      expect(errors[0].column).toBe("company/email");
      expect(errors[1].row).toBe(4);
      expect(errors[1].column).toBe("email");
    });
  });

  describe("REST API Integration & RLS Isolation Tests", () => {
    it("should perform dry-run validation via API and return errors", async () => {
      const payload = {
        entityType: "lead",
        csvContent: `Company Name,Email Address,Status
Acme Corp,acme@test.com,New
,,Working
Acme Corp,invalid-email,Working`,
        mapping: {
          company: "Company Name",
          email: "Email Address",
          status: "Status",
        },
        dryRun: true,
      };

      const res = await app.request("/api/imports/csv", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.totalRows).toBe(3);
      expect(body.data.validRows).toBe(1);
      expect(body.data.invalidRows).toBe(2);
      expect(body.data.errors.length).toBe(2);
      expect(body.data.importedIds).toBeUndefined();
    });

    it("should perform real import when dryRun is false and secure RLS orgId", async () => {
      const payload = {
        entityType: "lead",
        csvContent: `Company Name,Email Address,Status
Acme Corp,acme@test.com,New
Globe Corp,globe@test.com,Working`,
        mapping: {
          company: "Company Name",
          email: "Email Address",
          status: "Status",
        },
        dryRun: false,
      };

      // Import as Tenant A
      const resA = await app.request("/api/imports/csv", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      expect(resA.status).toBe(200);
      const bodyA = await resA.json();
      expect(bodyA.success).toBe(true);
      expect(bodyA.data.importedIds.length).toBe(2);

      const importedIds = bodyA.data.importedIds;

      // Verify that leads can be queried by Tenant A and belong to Tenant A's orgId
      const leadsResA = await app.request("/api/leads", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      });
      expect(leadsResA.status).toBe(200);
      const leadsA = await leadsResA.json();
      // Ensure only Tenant A's leads are returned
      expect(leadsA.data.length).toBe(2);
      expect(leadsA.data.map((l: { id: string }) => l.id)).toContain(
        importedIds[0],
      );
      expect(leadsA.data.map((l: { id: string }) => l.id)).toContain(
        importedIds[1],
      );
      expect(
        leadsA.data.every((l: { orgId: string }) => l.orgId === orgA),
      ).toBe(true);

      // Verify Tenant B gets 0 leads (perfect RLS isolation!)
      const leadsResB = await app.request("/api/leads", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
        },
      });
      expect(leadsResB.status).toBe(200);
      const leadsB = await leadsResB.json();
      expect(leadsB.data.length).toBe(0);
    });

    it("should support importing Contacts with index-based mappings", async () => {
      const payload = {
        entityType: "contact",
        csvContent: `First Name,Last Name,Email Address
John,Doe,john@doe.com
Jane,Smith,jane@smith.com`,
        mapping: {
          firstName: "0",
          lastName: "1",
          email: "2",
        },
        dryRun: false,
      };

      const res = await app.request("/api/imports/csv", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.importedIds.length).toBe(2);

      // Query contacts to confirm correct import
      const contactsRes = await app.request("/api/contacts", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      });
      expect(contactsRes.status).toBe(200);
      const contacts = await contactsRes.json();
      expect(contacts.data.length).toBe(2);
      expect(contacts.data[0].firstName).toBe("John");
      expect(contacts.data[0].lastName).toBe("Doe");
      expect(contacts.data[0].email).toBe("john@doe.com");
      expect(contacts.data[0].orgId).toBe(orgA);
    });
  });
});
