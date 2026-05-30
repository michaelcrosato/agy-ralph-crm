// MUST be the first import: initializes OTel + auto-instrumentations
// before any module they patch (http, pg, etc.) is required.
import { createLogger, initOtel } from "@crm/observability";

initOtel({
  serviceName: process.env.OTEL_SERVICE_NAME ?? "crm-api",
  serviceVersion: "0.1.0",
});

const log = createLogger({ name: "api.bootstrap" });

import { OpenAPIHono } from "@hono/zod-openapi";
import { apiReference } from "@scalar/hono-api-reference";
import { cors } from "hono/cors";
import type { Env } from "./middleware/tenantAuth";
import { accountsApp } from "./routes/accounts";
import {
  adminApp,
  dbApp,
  forecastingApp,
  forecastsApp,
  importsApp,
  leaderboardsApp,
  reportsApp,
} from "./routes/admin";
import { authApp } from "./routes/auth";
import { campaignsApp, segmentsApp, unsubscribesApp } from "./routes/campaigns";
import { contactsApp } from "./routes/contacts";
import {
  contractsApp,
  documentsApp,
  invoicesApp,
  subscriptionsApp,
} from "./routes/contracts";
import { currenciesApp } from "./routes/currencies";
import { healthApp } from "./routes/health";
import { leadConversionsApp } from "./routes/lead-conversions";
import {
  leadAssignmentRulesApp,
  leadScoringRulesApp,
  leadsApp,
} from "./routes/leads";
import { mcpApp } from "./routes/mcp";
import { metadataApp } from "./routes/metadata";
import {
  approvalsApp,
  opportunitiesApp,
  pricebooksApp,
  productsApp,
} from "./routes/opportunities";
import {
  activitiesApp,
  consentApp,
  productivityApp,
  salesApp,
  searchApp,
  webhooksApp,
} from "./routes/productivity";
import { publicApp } from "./routes/public";
import { commissionsApp, quotasApp, territoriesApp } from "./routes/sales-ops";
import { emailsApp, publicEmailsApp, sequencesApp } from "./routes/sequences";
import { serviceApp } from "./routes/service";
import { stageGatesApp, stageGuidanceApp } from "./routes/stages";
import { ticketsApp } from "./routes/tickets";
import { workflowsApp } from "./routes/workflows";

// Re-exports preserve the public surface used by 130 integration test
// files until spec 023 lands the createTestApp harness.
export { checkAndRunLeadAutoConversion } from "./lib/leadAutoConversion";
export { mcpTools } from "./lib/mcpTools";
export {
  enforceCustomValidationRules,
  enforcePicklistDependencies,
} from "./lib/validation";
export { triggerOutboundWebhooks } from "./lib/webhooks";
export { tenantAuth } from "./middleware/tenantAuth";

const app = new OpenAPIHono<Env>();
app.use("*", cors());

app.doc("/openapi.json", {
  openapi: "3.1.0",
  info: {
    title: "CRM API",
    version: "0.1.0",
  },
});

app.get(
  "/docs",
  apiReference({
    spec: {
      url: "/openapi.json",
    },
  }),
);

// Chain .route() calls so Hono RPC's hc<typeof routes> can infer the full
// route surface for typed API clients (spec 018).
const routes = app
  .route("/health", healthApp)
  .route("/api/auth", authApp)
  .route("/api/public", publicApp)
  .route("/mcp", mcpApp)
  .route("/api/metadata", metadataApp)
  .route("/api/workflows", workflowsApp)
  .route("/api/tickets", ticketsApp)
  .route("/api/service", serviceApp)
  .route("/api/lead-conversions", leadConversionsApp)
  .route("/api/currencies", currenciesApp)
  .route("/api/stage-guidance", stageGuidanceApp)
  .route("/api/stage-gates", stageGatesApp)
  .route("/api/leads", leadsApp)
  .route("/api/lead-assignment-rules", leadAssignmentRulesApp)
  .route("/api/lead-scoring-rules", leadScoringRulesApp)
  .route("/api/accounts", accountsApp)
  .route("/api/contacts", contactsApp)
  .route("/api/opportunities", opportunitiesApp)
  .route("/api/campaigns", campaignsApp)
  .route("/api/segments", segmentsApp)
  .route("/api/unsubscribes", unsubscribesApp)
  .route("/api/products", productsApp)
  .route("/api/pricebooks", pricebooksApp)
  .route("/api/approvals", approvalsApp)
  .route("/api/sequences", sequencesApp)
  .route("/api/emails", emailsApp)
  .route("/api/public/emails", publicEmailsApp)
  .route("/api/territories", territoriesApp)
  .route("/api/commissions", commissionsApp)
  .route("/api/quotas", quotasApp)
  .route("/api/admin", adminApp)
  .route("/api/db", dbApp)
  .route("/api/imports", importsApp)
  .route("/api/reports", reportsApp)
  .route("/api/leaderboards", leaderboardsApp)
  .route("/api/forecasts", forecastsApp)
  .route("/api/forecasting", forecastingApp)
  .route("/api/contracts", contractsApp)
  .route("/api/documents", documentsApp)
  .route("/api/invoices", invoicesApp)
  .route("/api/subscriptions", subscriptionsApp)
  .route("/api/activities", activitiesApp)
  .route("/api/webhooks", webhooksApp)
  .route("/api/search", searchApp)
  .route("/api/consent", consentApp)
  .route("/api/productivity", productivityApp)
  .route("/api/sales", salesApp);

if (process.env.NODE_ENV !== "test") {
  const port = Number(process.env.PORT) || 3001;
  import("@hono/node-server")
    .then(({ serve }) => {
      log.info({ port }, "Hono API server starting");
      serve({
        fetch: app.fetch,
        port,
      });
    })
    .catch((err) => {
      log.error({ err }, "Failed to load @hono/node-server");
    });
}

export type AppType = typeof routes;
export default app;
