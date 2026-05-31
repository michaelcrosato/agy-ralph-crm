import { OpenAPIHono } from "@hono/zod-openapi";
import { resourceRbac } from "../../middleware/rbac";
import { type Env, tenantAuth } from "../../middleware/tenantAuth";
import { crudApp } from "./crud";
import { hierarchyApp } from "./hierarchy";
import { operationsApp } from "./operations";
import { teamApp } from "./team";

export { AccountSchema, getAccountRoute, listAccountsRoute } from "./crud";

const baseApp = new OpenAPIHono<Env>();

// Global middleware for this resource domain
baseApp.use("*", tenantAuth, resourceRbac);

// Compose modular sub-routers with chained types
export const accountsApp = baseApp
  .route("/", crudApp)
  .route("/", teamApp)
  .route("/", hierarchyApp)
  .route("/", operationsApp);
