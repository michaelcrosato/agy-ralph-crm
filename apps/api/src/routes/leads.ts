import { OpenAPIHono } from "@hono/zod-openapi";
import { resourceRbac } from "../middleware/rbac";
import type { Env } from "../middleware/tenantAuth";
import { assignmentRouter, leadAssignmentRulesApp } from "./leads/assignment";
import { conversionRouter } from "./leads/conversion";
import { crudRouter } from "./leads/crud";
import { dedupRouter } from "./leads/dedup";
import { leadScoringRulesApp, scoringRouter } from "./leads/scoring";
import { slaRouter } from "./leads/sla";

export const leadsApp = new OpenAPIHono<Env>();
leadsApp.use("*", resourceRbac);

// Mount the decomposed leads sub-routers at the root path
leadsApp.route("/", slaRouter);
leadsApp.route("/", conversionRouter);
leadsApp.route("/", dedupRouter);
leadsApp.route("/", assignmentRouter);
leadsApp.route("/", scoringRouter);
leadsApp.route("/", crudRouter);

export { leadAssignmentRulesApp, leadScoringRulesApp };
