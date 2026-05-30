import { createSessionToken } from "@crm/auth";
import { calculateProRatedAmount } from "@crm/core";
import { dbStore, mockDb, store, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestApp } from "./_harness";

const app = createTestApp();

describe("Recurring Invoicing & Subscription Billing API Tests", () => {
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

  describe("Core Unit Tests", () => {
    it("should calculate correct pro-rated amounts based on fractional period use", () => {
      // 10 days out of 30, $30.00 unit price, quantity 2 -> expected amount: $20.00
      const proRatedAmount = calculateProRatedAmount({
        unitPrice: "30.00",
        quantity: 2,
        daysUsed: 10,
        daysInPeriod: 30,
      });
      expect(proRatedAmount).toBe("20.00");

      // Mid-month, $99.99 unit price, quantity 1 -> 15 days out of 31
      const anotherProRate = calculateProRatedAmount({
        unitPrice: "99.99",
        quantity: 1,
        daysUsed: 15,
        daysInPeriod: 31,
      });
      expect(anotherProRate).toBe("48.38"); // 99.99 * 1 * (15/31) = 48.3822... -> 48.38
    });
  });

  describe("Subscription & Invoicing REST API Integration", () => {
    it("should support creating, listing, and RLS isolating subscription plans", async () => {
      // 1. Create a subscription under Tenant A
      const createSubResA = await app.request("/api/subscriptions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          accountId: "account-123",
          planName: "Pro Subscription",
          billingPeriod: "monthly",
          unitPrice: "50.00",
          quantity: 3,
          startDate: "2026-05-01T00:00:00Z",
        }),
      });

      expect(createSubResA.status).toBe(200);
      const subDataA = await createSubResA.json();
      expect(subDataA.success).toBe(true);
      expect(subDataA.data.id).toBeDefined();
      expect(subDataA.data.orgId).toBe(orgA);
      expect(subDataA.data.planName).toBe("Pro Subscription");
      expect(subDataA.data.unitPrice).toBe("50.00");
      expect(subDataA.data.quantity).toBe(3);

      const subId = subDataA.data.id;

      // 2. Listing subscriptions as Tenant A -> returns 1 item
      const listSubsResA = await app.request("/api/subscriptions", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      });
      expect(listSubsResA.status).toBe(200);
      const listSubsA = await listSubsResA.json();
      expect(listSubsA.data.length).toBe(1);
      expect(listSubsA.data[0].id).toBe(subId);

      // 3. Listing subscriptions as Tenant B -> returns 0 items (strict RLS isolation)
      const listSubsResB = await app.request("/api/subscriptions", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
        },
      });
      expect(listSubsResB.status).toBe(200);
      const listSubsB = await listSubsResB.json();
      expect(listSubsB.data.length).toBe(0);

      // 4. Verify audit log entry was created for Tenant A's subscription
      const auditLogs = store.auditLogs.filter((log) => log.orgId === orgA);
      expect(
        auditLogs.some(
          (log) =>
            log.recordId === subId &&
            log.recordType === "Subscription" &&
            log.action === "create",
        ),
      ).toBe(true);
    });

    it("should reject subscription creation missing required parameters", async () => {
      const res = await app.request("/api/subscriptions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          planName: "Failed Plan",
        }),
      });
      expect(res.status).toBe(400);
    });

    it("should dynamically generate full-amount and pro-rated invoice cycles", async () => {
      // 1. Create a subscription for Tenant A
      await withTenant(orgA, mockDb, async () => {
        await dbStore.subscriptions.insert({
          orgId: orgA,
          accountId: "acc-tenant-a",
          planName: "Enterprise Tier",
          status: "active",
          billingPeriod: "monthly",
          unitPrice: "100.00",
          quantity: 2,
          startDate: new Date("2026-05-01T00:00:00Z"),
          endDate: null,
        });
      });

      // 2. Generate standard invoices for Tenant A (full price)
      const generateFullRes = await app.request("/api/invoices/generate", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dueDate: "2026-06-01T00:00:00Z",
        }),
      });

      expect(generateFullRes.status).toBe(200);
      const fullInvoiceBody = await generateFullRes.json();
      expect(fullInvoiceBody.success).toBe(true);
      expect(fullInvoiceBody.data.length).toBe(1);
      expect(fullInvoiceBody.data[0].amount).toBe("200"); // 100.00 * 2 = 200

      const _invoiceId = fullInvoiceBody.data[0].id;

      // 3. Generate pro-rated invoices for Tenant A (using force: true to bypass duplicate check)
      const generateProRes = await app.request("/api/invoices/generate", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dueDate: "2026-06-01T00:00:00Z",
          daysUsed: 15,
          daysInPeriod: 30,
          force: true,
        }),
      });

      expect(generateProRes.status).toBe(200);
      const proInvoiceBody = await generateProRes.json();
      expect(proInvoiceBody.success).toBe(true);
      expect(proInvoiceBody.data.length).toBe(1);
      // 100 * 2 * (15/30) = 100.00
      expect(proInvoiceBody.data[0].amount).toBe("100.00");

      // 4. Verify duplicate generation is blocked without force flag
      const duplicateRes = await app.request("/api/invoices/generate", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dueDate: "2026-06-01T00:00:00Z",
        }),
      });
      expect(duplicateRes.status).toBe(200);
      const duplicateBody = await duplicateRes.json();
      expect(duplicateBody.success).toBe(true);
      expect(duplicateBody.data.length).toBe(0); // skipped

      // 5. Query Billing history (GET /api/invoices) for Tenant A
      const getInvoicesResA = await app.request("/api/invoices", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      });
      expect(getInvoicesResA.status).toBe(200);
      const invoicesA = await getInvoicesResA.json();
      expect(invoicesA.data.length).toBe(2); // The full invoice + the pro-rated invoice

      // 6. Query Billing history (GET /api/invoices) for Tenant B -> returns 0 (isolated RLS)
      const getInvoicesResB = await app.request("/api/invoices", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
        },
      });
      expect(getInvoicesResB.status).toBe(200);
      const invoicesB = await getInvoicesResB.json();
      expect(invoicesB.data.length).toBe(0);
    });
  });
});
