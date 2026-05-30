import { OpenAPIHono } from "@hono/zod-openapi";
import app from "../../../apps/api/src/index";
import type { Env } from "../../../apps/api/src/middleware/tenantAuth";
import { leadsApp } from "../../../apps/api/src/routes/leads";
import { opportunitiesApp } from "../../../apps/api/src/routes/opportunities";

export function createTestApp(_options?: { drivers?: any; seed?: any }) {
  return app;
}

export function createLeadsApp() {
  const leadsSub = new OpenAPIHono<Env>();
  leadsSub.route("/api/leads", leadsApp);
  return leadsSub;
}

export function createOpportunitiesApp() {
  const oppSub = new OpenAPIHono<Env>();
  oppSub.route("/api/opportunities", opportunitiesApp);
  return oppSub;
}
