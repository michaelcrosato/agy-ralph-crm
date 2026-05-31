import { Hono } from "hono";
import type { Env } from "../../../middleware/tenantAuth";
import { campaignInfluenceApp } from "./campaign-influence";
import { competitorsApp } from "./competitors";
import { contactRolesApp } from "./contact-roles";
import { splitsApp } from "./splits";
import { teamMembersApp } from "./team-members";

const baseApp = new Hono<Env>();

export const opportunitiesTeamsApp = baseApp
  .route("/", splitsApp)
  .route("/", contactRolesApp)
  .route("/", campaignInfluenceApp)
  .route("/", competitorsApp)
  .route("/", teamMembersApp);
