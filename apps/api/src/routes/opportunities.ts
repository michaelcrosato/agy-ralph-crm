import { Hono } from "hono";
import type { Env } from "../middleware/tenantAuth";
import { opportunitiesApprovalsApp } from "./opportunities/approvals";
import { crudApp } from "./opportunities/crud";
import { opportunitiesProductsApp } from "./opportunities/products";
import { opportunitiesStagesApp } from "./opportunities/stages";
import { opportunitiesTeamsApp } from "./opportunities/teams";

// Re-export the original sub-apps so they are exposed exactly as before for api/index.ts
export { approvalsApp } from "./opportunities/approvals";
export { pricebooksApp } from "./opportunities/pricebooks";
export { productsApp } from "./opportunities/products";

export const opportunitiesApp = new Hono<Env>();

// Mount the modular sub-apps under opportunitiesApp root paths to preserve exact routing paths.
// We mount crudApp last to prevent its parameterized /:id route from colliding with static routes.
opportunitiesApp
  .route("/", opportunitiesStagesApp)
  .route("/", opportunitiesTeamsApp)
  .route("/", opportunitiesApprovalsApp)
  .route("/", opportunitiesProductsApp)
  .route("/", crudApp);
