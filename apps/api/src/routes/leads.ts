import { OpenAPIHono } from "@hono/zod-openapi";
import { resourceRbac } from "../middleware/rbac";
import type { Env } from "../middleware/tenantAuth";
import { assignmentRouter, leadAssignmentRulesApp } from "./leads/assignment";
import { conversionRouter } from "./leads/conversion";
import { crudRouter } from "./leads/crud";
import { dedupRouter } from "./leads/dedup";
import { leadScoringRulesApp, scoringRouter } from "./leads/scoring";
import { slaRouter } from "./leads/sla";

const baseLeadsApp = new OpenAPIHono<Env>();
baseLeadsApp.use("*", resourceRbac);

// Mount the decomposed leads sub-routers at the root path with chained types
export const leadsApp = baseLeadsApp
  .route("/", slaRouter)
  .route("/", conversionRouter)
  .route("/", dedupRouter)
  .route("/", assignmentRouter)
  .route("/", scoringRouter)
  .route("/", crudRouter);

export { leadAssignmentRulesApp, leadScoringRulesApp };
