import { convertCurrency } from "@crm/core";
import { type DBCurrency, dbStore } from "@crm/db";
import { Hono } from "hono";
import { type Env, tenantAuth } from "../middleware/tenantAuth";

/** Multi-currency CRUD + conversion query. */
export const currenciesApp = new Hono<Env>();

currenciesApp.get("/", tenantAuth, async (c) => {
  const currencies = await dbStore.currencies.findMany();
  return c.json({ success: true, data: currencies });
});

currenciesApp.get("/convert", tenantAuth, async (c) => {
  const amount = c.req.query("amount");
  const fromIso = c.req.query("from");
  const toIso = c.req.query("to");

  if (!amount || !fromIso || !toIso) {
    return c.json(
      { error: "Missing conversion query parameters: amount, from, to" },
      400,
    );
  }

  const fromCurr = await dbStore.currencies.findByIsoCode(fromIso);
  const toCurr = await dbStore.currencies.findByIsoCode(toIso);

  const fromRate = fromCurr?.isActive ? fromCurr.exchangeRate : "1.0000";
  const toRate = toCurr?.isActive ? toCurr.exchangeRate : "1.0000";

  const converted = convertCurrency(amount, fromRate, toRate);
  return c.json({ success: true, converted });
});

currenciesApp.post("/", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { isoCode, displayName, symbol, exchangeRate, isCorporate } = body;

  if (!isoCode || !displayName || !symbol || !exchangeRate) {
    return c.json({ error: "Missing required currency parameters" }, 400);
  }

  const existing = await dbStore.currencies.findByIsoCode(isoCode);
  let currency: DBCurrency | null = null;

  if (isCorporate) {
    const allCurrencies = await dbStore.currencies.findMany();
    for (const cur of allCurrencies) {
      if (cur.isCorporate) {
        await dbStore.currencies.update(cur.id, { isCorporate: false });
      }
    }
  }

  if (existing) {
    currency = await dbStore.currencies.update(existing.id, {
      displayName,
      symbol,
      exchangeRate: String(exchangeRate),
      isCorporate:
        isCorporate !== undefined ? Boolean(isCorporate) : existing.isCorporate,
    });

    await dbStore.auditLogs.insert({
      orgId: tenant.orgId,
      recordId: existing.id,
      recordType: "currencies",
      action: "update",
      userId: tenant.userId,
      changes: null,
    });
  } else {
    currency = await dbStore.currencies.insert({
      orgId: tenant.orgId,
      isoCode,
      displayName,
      symbol,
      exchangeRate: String(exchangeRate),
      isCorporate: isCorporate !== undefined ? Boolean(isCorporate) : false,
      isActive: true,
    });

    await dbStore.auditLogs.insert({
      orgId: tenant.orgId,
      recordId: currency.id,
      recordType: "currencies",
      action: "create",
      userId: tenant.userId,
      changes: null,
    });
  }

  return c.json({ success: true, data: currency }, 201);
});
