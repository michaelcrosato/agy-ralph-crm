import { OpenAPIHono } from "@hono/zod-openapi";
import { resourceRbac } from "../../middleware/rbac";
import { type Env, tenantAuth } from "../../middleware/tenantAuth";
import { crudApp } from "./crud";
import { hierarchyApp } from "./hierarchy";
import { operationsApp } from "./operations";

export { ContactSchema, getContactRoute, listContactsRoute } from "./crud";

const baseApp = new OpenAPIHono<Env>();

// Global middleware for this resource domain
baseApp.use("*", tenantAuth, resourceRbac);

// Compose modular sub-routers with chained types
export const contactsApp = baseApp
  .route("/", crudApp)
  .route("/", hierarchyApp)
  .route("/", operationsApp);
