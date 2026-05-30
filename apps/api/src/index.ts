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

app.route("/health", healthApp);
app.route("/api/auth", authApp);
app.route("/api/public", publicApp);
app.route("/mcp", mcpApp);
app.route("/api/metadata", metadataApp);
app.route("/api/workflows", workflowsApp);
app.route("/api/tickets", ticketsApp);
app.route("/api/service", serviceApp);
app.route("/api/lead-conversions", leadConversionsApp);
app.route("/api/currencies", currenciesApp);
app.route("/api/stage-guidance", stageGuidanceApp);
app.route("/api/stage-gates", stageGatesApp);
app.route("/api/leads", leadsApp);
app.route("/api/lead-assignment-rules", leadAssignmentRulesApp);
app.route("/api/lead-scoring-rules", leadScoringRulesApp);
app.route("/api/accounts", accountsApp);
app.route("/api/contacts", contactsApp);
app.route("/api/opportunities", opportunitiesApp);
app.route("/api/campaigns", campaignsApp);
app.route("/api/segments", segmentsApp);
app.route("/api/unsubscribes", unsubscribesApp);
app.route("/api/products", productsApp);
app.route("/api/pricebooks", pricebooksApp);
app.route("/api/approvals", approvalsApp);
app.route("/api/sequences", sequencesApp);
app.route("/api/emails", emailsApp);
app.route("/api/public/emails", publicEmailsApp);
app.route("/api/territories", territoriesApp);
app.route("/api/commissions", commissionsApp);
app.route("/api/quotas", quotasApp);
app.route("/api/admin", adminApp);
app.route("/api/db", dbApp);
app.route("/api/imports", importsApp);
app.route("/api/reports", reportsApp);
app.route("/api/leaderboards", leaderboardsApp);
app.route("/api/forecasts", forecastsApp);
app.route("/api/forecasting", forecastingApp);
app.route("/api/contracts", contractsApp);
app.route("/api/documents", documentsApp);
app.route("/api/invoices", invoicesApp);
app.route("/api/subscriptions", subscriptionsApp);
app.route("/api/activities", activitiesApp);
app.route("/api/webhooks", webhooksApp);
app.route("/api/search", searchApp);
app.route("/api/consent", consentApp);
app.route("/api/productivity", productivityApp);
app.route("/api/sales", salesApp);

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

export default app;
