import { createSessionToken } from "@crm/auth";
import { convertCurrency, rollupOpportunityAmountsInBase } from "@crm/core";
import { dbStore, mockDb, pgDb, withTenant } from "@crm/db";
import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestApp } from "./_harness";

const app = createTestApp();

import { getTestPgContainer, isDockerAvailable } from "./pg-container";

const backends = [
  {
    name: "mock",
    setup: async () => {
      process.env.DB_DRIVER = "mock";
    },
  },
];

if (isDockerAvailable()) {
  backends.push({
    name: "postgres",
    setup: async () => {
      const { connectionString } = await getTestPgContainer();
      process.env.DB_DRIVER = "pg";
      process.env.DB_URL = connectionString;
    },
  });
}

describe.each(
  backends,
)("Multi-Currency & Exchange Rates Engine Tests on $name backend", ({
  setup,
}) => {
  let tokenTenantA: string;
  let tokenTenantB: string;

  const orgA = "org-tenant-a";
  const orgB = "org-tenant-b";

  beforeEach(async () => {
    await setup();
    await dbStore.clear();

    // Insert organizations and users to satisfy PostgreSQL foreign key constraints
    if (process.env.DB_DRIVER === "pg") {
      await pgDb.execute(
        sql.raw(
          `INSERT INTO "organizations" ("id", "name", "status") VALUES ('${orgA}', 'Tenant A', 'active'), ('${orgB}', 'Tenant B', 'active') ON CONFLICT DO NOTHING`,
        ),
      );
      await pgDb.execute(
        sql.raw(
          `INSERT INTO "users" ("id", "email", "password_hash", "status") VALUES ('user-a', 'user-a@example.com', 'hash', 'active'), ('user-b', 'user-b@example.com', 'hash', 'active') ON CONFLICT DO NOTHING`,
        ),
      );
    }

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
  }, 60000);

  describe("Core Business Logic", () => {
    it("should accurately convert currency amounts using exchange rates", () => {
      // 1 EUR = 1.10 USD, 1 GBP = 1.30 USD
      const eurRate = "1.10";
      const gbpRate = "1.30";
      const usdRate = "1.00";

      // EUR to USD: 100 EUR = 110.00 USD
      const usdAmount = convertCurrency("100.00", eurRate, usdRate);
      expect(usdAmount).toBe("110.00");

      // USD to EUR: 110 USD = 100.00 EUR
      const eurAmount = convertCurrency("110.00", usdRate, eurRate);
      expect(eurAmount).toBe("100.00");

      // EUR to GBP: 100 EUR = 84.62 GBP (110 USD / 1.30)
      const gbpAmount = convertCurrency("100.00", eurRate, gbpRate);
      expect(gbpAmount).toBe("84.62");
    });

    it("should consolidate and rollup multi-currency opportunity amounts in corporate currency", () => {
      const opps = [
        { amount: "100.00", exchangeRate: "1.10" }, // 110.00 USD equivalent
        { amount: "200.00", exchangeRate: "1.30" }, // 260.00 USD equivalent
        { amount: "50.00", exchangeRate: "1.00" }, // 50.00 USD equivalent
      ];

      const rolledUp = rollupOpportunityAmountsInBase(opps);
      expect(rolledUp).toBe("420.00"); // 110 + 260 + 50 = 420
    });
  });

  describe("REST API Endpoints", () => {
    it("should perform CRUD on currencies and enforce strict active tenant RLS isolation", async () => {
      // 1. Create a currency as Tenant A
      const postRes = await app.request("/api/currencies", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenTenantA}`,
        },
        body: JSON.stringify({
          isoCode: "EUR",
          displayName: "Euro",
          symbol: "€",
          exchangeRate: "1.0850",
          isCorporate: false,
        }),
      });

      expect(postRes.status).toBe(201);
      const postBody = await postRes.json();
      expect(postBody.success).toBe(true);
      expect(postBody.data.isoCode).toBe("EUR");
      expect(postBody.data.exchangeRate).toBe("1.0850");

      // 2. RLS - Tenant B attempts to read Tenant A's currencies -> should receive empty array
      const getBRes = await app.request("/api/currencies", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
        },
      });
      expect(getBRes.status).toBe(200);
      const getBBody = await getBRes.json();
      expect(getBBody.data.length).toBe(0);

      // 3. GET - Tenant A retrieves its currencies
      const getARes = await app.request("/api/currencies", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      });
      expect(getARes.status).toBe(200);
      const getABody = await getARes.json();
      expect(getABody.data.length).toBe(1);
      expect(getABody.data[0].isoCode).toBe("EUR");

      // 4. Update the exchange rate as Tenant A
      const updateRes = await app.request("/api/currencies", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenTenantA}`,
        },
        body: JSON.stringify({
          isoCode: "EUR",
          displayName: "Euro",
          symbol: "€",
          exchangeRate: "1.1000",
          isCorporate: true,
        }),
      });

      expect(updateRes.status).toBe(201);
      const updateBody = await updateRes.json();
      expect(updateBody.data.exchangeRate).toBe("1.1000");
      expect(updateBody.data.isCorporate).toBe(true);

      // 5. Test Live Currency Convert API Endpoint
      const convertRes = await app.request(
        "/api/currencies/convert?amount=100.00&from=EUR&to=USD",
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${tokenTenantA}`,
          },
        },
      );
      expect(convertRes.status).toBe(200);
      const convertBody = await convertRes.json();
      // Since EUR is 1.1000 and USD is missing (defaults to 1.0000)
      expect(convertBody.converted).toBe("110.00");
    });

    it("should automatically calculate amountCorporate when creating and patching opportunities", async () => {
      // 1. Setup a custom active currency EUR for Tenant A
      await app.request("/api/currencies", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenTenantA}`,
        },
        body: JSON.stringify({
          isoCode: "EUR",
          displayName: "Euro",
          symbol: "€",
          exchangeRate: "1.1000",
          isCorporate: false,
        }),
      });

      // 2. Create an Account for Tenant A
      let accountId = "";
      const activeDb = process.env.DB_DRIVER === "pg" ? pgDb : mockDb;
      await withTenant(orgA, activeDb, async () => {
        const acc = await dbStore.accounts.insert({
          orgId: orgA,
          ownerId: "user-a",
          name: "ACME Corp",
          domain: "acme.com",
          custom: null,
        });
        accountId = acc.id;
      });

      // 3. Create an Opportunity specifying EUR currency code
      const oppPostRes = await app.request("/api/opportunities", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenTenantA}`,
        },
        body: JSON.stringify({
          accountId,
          name: "Big EUR Expansion",
          stage: "Prospecting",
          amount: "50000.00",
          currencyCode: "EUR",
        }),
      });

      expect(oppPostRes.status).toBe(200);
      const oppPostBody = await oppPostRes.json();
      expect(oppPostBody.success).toBe(true);
      expect(oppPostBody.data.currencyCode).toBe("EUR");
      // 50000 EUR * 1.10 USD/EUR = 55000.00 USD
      expect(oppPostBody.data.amountCorporate).toBe("55000.00");

      const oppId = oppPostBody.data.id;

      // 4. Update the Opportunity amount
      const patchRes = await app.request(`/api/opportunities/${oppId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenTenantA}`,
        },
        body: JSON.stringify({
          amount: "100000.00",
        }),
      });

      expect(patchRes.status).toBe(200);
      const patchBody = await patchRes.json();
      expect(patchBody.data.amount).toBe("100000.00");
      // 100000 EUR * 1.10 = 110000.00 USD
      expect(patchBody.data.amountCorporate).toBe("110000.00");

      // 5. Update the Opportunity currency code to GBP (defaults to 1.0000 since it is not defined/active)
      const patchCurrRes = await app.request(`/api/opportunities/${oppId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenTenantA}`,
        },
        body: JSON.stringify({
          currencyCode: "GBP",
        }),
      });

      expect(patchCurrRes.status).toBe(200);
      const patchCurrBody = await patchCurrRes.json();
      expect(patchCurrBody.data.currencyCode).toBe("USD"); // Safe fallback to standard default USD
      expect(patchCurrBody.data.amountCorporate).toBe("100000.00"); // 100000 USD
    });
  });
});
