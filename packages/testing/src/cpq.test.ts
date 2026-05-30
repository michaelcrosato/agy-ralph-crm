import { createSessionToken } from "@crm/auth";
import { calculateCPQPrice } from "@crm/core";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestApp } from "./_harness";

const app = createTestApp();

describe("CPQ PDF Generator API Tests", () => {
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
    it("should calculate correct CPQ pricing based on default volume tiers", () => {
      // Tier 1: Qty 5 -> 0% discount. Price $10.00 -> subtotal $50.00, discount $0.00, total $50.00
      const calc1 = calculateCPQPrice({
        unitPrice: "10.00",
        quantity: 5,
      });
      expect(calc1.subtotal).toBe("50.00");
      expect(calc1.discountAmount).toBe("0.00");
      expect(calc1.totalPrice).toBe("50.00");

      // Tier 2: Qty 10 -> 10% discount. Price $10.00 -> subtotal $100.00, discount $10.00, total $90.00
      const calc2 = calculateCPQPrice({
        unitPrice: "10.00",
        quantity: 10,
      });
      expect(calc2.subtotal).toBe("100.00");
      expect(calc2.discountAmount).toBe("10.00");
      expect(calc2.totalPrice).toBe("90.00");

      // Tier 3: Qty 55 -> 15% discount. Price $20.00 -> subtotal $1100.00, discount $165.00, total $935.00
      const calc3 = calculateCPQPrice({
        unitPrice: "20.00",
        quantity: 55,
      });
      expect(calc3.subtotal).toBe("1100.00");
      expect(calc3.discountAmount).toBe("165.00");
      expect(calc3.totalPrice).toBe("935.00");

      // Tier 4: Qty 120 -> 20% discount. Price $50.00 -> subtotal $6000.00, discount $1200.00, total $4800.00
      const calc4 = calculateCPQPrice({
        unitPrice: "50.00",
        quantity: 120,
      });
      expect(calc4.subtotal).toBe("6000.00");
      expect(calc4.discountAmount).toBe("1200.00");
      expect(calc4.totalPrice).toBe("4800.00");
    });

    it("should allow custom manual discount percentage overrides", () => {
      // Qty 5 (normally 0%), but manual 25% discount override -> 25% discount
      const calc = calculateCPQPrice({
        unitPrice: "100.00",
        quantity: 5,
        customDiscountPercentage: 25,
      });
      expect(calc.subtotal).toBe("500.00");
      expect(calc.discountAmount).toBe("125.00");
      expect(calc.totalPrice).toBe("375.00");

      // Qty 120 (normally 20%), but custom discount 10% -> 20% applies (max of tiered or manual)
      const calcMax = calculateCPQPrice({
        unitPrice: "10.00",
        quantity: 120,
        customDiscountPercentage: 10,
      });
      expect(calcMax.subtotal).toBe("1200.00");
      expect(calcMax.discountAmount).toBe("240.00");
      expect(calcMax.totalPrice).toBe("960.00");
    });
  });

  describe("CPQ REST API Integration", () => {
    it("should support opportunity quote generation, automatic pricebook lookup, HTML rendering, and strict RLS tenant isolation", async () => {
      let oppIdA = "";
      let _oppIdB = "";

      // 1. Setup entities for Tenant A under isolation context
      await withTenant(orgA, mockDb, async () => {
        const account = await dbStore.accounts.insert({
          orgId: orgA,
          ownerId: "user-a",
          name: "Acme Corp",
          domain: "acme.com",
          custom: null,
        });

        const opportunity = await dbStore.opportunities.insert({
          orgId: orgA,
          ownerId: "user-a",
          accountId: account.id,
          name: "Acme Enterprise Expansion",
          stage: "Prospecting",
          amount: "0.00",
          closeDate: null,
          custom: null,
        });
        oppIdA = opportunity.id;

        const product1 = await dbStore.products.insert({
          orgId: orgA,
          name: "CRM License",
          sku: "CRM-LIC",
          description: "Per seat CRM software license",
          isActive: true,
        });

        const pricebook = await dbStore.pricebooks.insert({
          orgId: orgA,
          name: "Standard Pricebook",
          description: "Default standard price list",
          isActive: true,
          isStandard: true,
        });

        const pbe1 = await dbStore.pricebookEntries.insert({
          orgId: orgA,
          pricebookId: pricebook.id,
          productId: product1.id,
          unitPrice: "150.00",
          isActive: true,
        });

        // Add 10 Licenses (10% volume discount tier)
        await dbStore.opportunityProducts.insert({
          orgId: orgA,
          opportunityId: opportunity.id,
          pricebookEntryId: pbe1.id,
          quantity: 10,
          unitPrice: "150.00",
          totalPrice: "1500.00",
        });
      });

      // 2. Setup entities for Tenant B under isolation context
      await withTenant(orgB, mockDb, async () => {
        const accountB = await dbStore.accounts.insert({
          orgId: orgB,
          ownerId: "user-b",
          name: "Beta Industries",
          domain: "beta.com",
          custom: null,
        });

        const oppB = await dbStore.opportunities.insert({
          orgId: orgB,
          ownerId: "user-b",
          accountId: accountB.id,
          name: "Beta Standard Supply",
          stage: "Prospecting",
          amount: "0.00",
          closeDate: null,
          custom: null,
        });
        _oppIdB = oppB.id;
      });

      // 3. POST Generate Quote under Tenant A
      const postQuoteResA = await app.request(
        `/api/opportunities/${oppIdA}/quote`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenTenantA}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        },
      );

      expect(postQuoteResA.status).toBe(200);
      const quoteBodyA = await postQuoteResA.json();
      expect(quoteBodyA.success).toBe(true);
      expect(quoteBodyA.data.mergedDocumentId).toBeDefined();
      expect(quoteBodyA.data.compiledContent).toContain("PROPOSAL & QUOTE");
      expect(quoteBodyA.data.compiledContent).toContain("Acme Corp");
      expect(quoteBodyA.data.compiledContent).toContain("CRM License");
      // 10 qty * 150.00 = 1500 subtotal. 10% discount -> 150 discount -> 1350 total
      expect(quoteBodyA.data.subtotal).toBe("1500.00");
      expect(quoteBodyA.data.discountAmount).toBe("150.00");
      expect(quoteBodyA.data.totalPrice).toBe("1350.00");

      const quoteId = quoteBodyA.data.mergedDocumentId;

      // Assert opportunity amount rolled up successfully in Tenant A database
      await withTenant(orgA, mockDb, async () => {
        const updatedOpp = await dbStore.opportunities.findOne(oppIdA);
        expect(updatedOpp?.amount).toBe("1350.00");
      });

      // Verify audit log exists for Tenant A
      await withTenant(orgA, mockDb, async () => {
        const logs = await dbStore.auditLogs.findMany();
        expect(
          logs.some(
            (log) =>
              log.recordId === oppIdA &&
              log.recordType === "Opportunity" &&
              log.action === "generate_quote",
          ),
        ).toBe(true);
      });

      // 4. GET Retrieve Quote under Tenant A
      const getQuoteResA = await app.request(
        `/api/opportunities/${oppIdA}/quote`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${tokenTenantA}`,
          },
        },
      );

      expect(getQuoteResA.status).toBe(200);
      const getBodyA = await getQuoteResA.json();
      expect(getBodyA.success).toBe(true);
      expect(getBodyA.data.id).toBe(quoteId);

      // 5. Assert RLS prevents Tenant B from generating a quote for Tenant A's opportunity
      const postQuoteResB = await app.request(
        `/api/opportunities/${oppIdA}/quote`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenTenantB}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        },
      );
      // Should return 404 because the opportunity is not found under Tenant B's context
      expect(postQuoteResB.status).toBe(404);

      // 6. Assert RLS prevents Tenant B from retrieving Tenant A's quote
      const getQuoteResB = await app.request(
        `/api/opportunities/${oppIdA}/quote`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${tokenTenantB}`,
          },
        },
      );
      expect(getQuoteResB.status).toBe(404);
    });

    it("should allow custom manual discount override in API dispatch", async () => {
      let oppIdA = "";

      await withTenant(orgA, mockDb, async () => {
        const account = await dbStore.accounts.insert({
          orgId: orgA,
          ownerId: "user-a",
          name: "Acme Corp",
          domain: "acme.com",
          custom: null,
        });

        const opportunity = await dbStore.opportunities.insert({
          orgId: orgA,
          ownerId: "user-a",
          accountId: account.id,
          name: "Acme Big Deal",
          stage: "Prospecting",
          amount: "0.00",
          closeDate: null,
          custom: null,
        });
        oppIdA = opportunity.id;

        const product1 = await dbStore.products.insert({
          orgId: orgA,
          name: "CRM License",
          sku: "CRM-LIC",
          isActive: true,
        });

        const pb = await dbStore.pricebooks.insert({
          orgId: orgA,
          name: "Standard Pricebook",
          isActive: true,
        });

        const pbe1 = await dbStore.pricebookEntries.insert({
          orgId: orgA,
          pricebookId: pb.id,
          productId: product1.id,
          unitPrice: "100.00",
          isActive: true,
        });

        await dbStore.opportunityProducts.insert({
          orgId: orgA,
          opportunityId: opportunity.id,
          pricebookEntryId: pbe1.id,
          quantity: 2,
          unitPrice: "100.00",
          totalPrice: "200.00",
        });
      });

      // POST quote with a manual 30% discount
      const res = await app.request(`/api/opportunities/${oppIdA}/quote`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customDiscountPercentage: 30,
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      // 2 qty * 100 = 200 subtotal. 30% discount -> 60 discount -> 140 total
      expect(body.data.subtotal).toBe("200.00");
      expect(body.data.discountAmount).toBe("60.00");
      expect(body.data.totalPrice).toBe("140.00");
    });
  });
});
