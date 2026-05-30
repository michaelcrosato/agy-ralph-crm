import { OpenAPIHono } from "@hono/zod-openapi";
import type { Env } from "../middleware/tenantAuth";
import { assignmentRouter, leadAssignmentRulesApp } from "./leads/assignment";
import { conversionRouter } from "./leads/conversion";
import { crudRouter } from "./leads/crud";
import { dedupRouter } from "./leads/dedup";
import { leadScoringRulesApp, scoringRouter } from "./leads/scoring";
import { slaRouter } from "./leads/sla";

export const leadsApp = new OpenAPIHono<Env>();

// Mount the decomposed leads sub-routers at the root path
leadsApp.route("/", crudRouter);
leadsApp.route("/", slaRouter);
leadsApp.route("/", conversionRouter);
leadsApp.route("/", dedupRouter);
leadsApp.route("/", assignmentRouter);
leadsApp.route("/", scoringRouter);

export { leadAssignmentRulesApp, leadScoringRulesApp };
