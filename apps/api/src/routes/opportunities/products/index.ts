import { Hono } from "hono";
import type { Env } from "../../../middleware/tenantAuth";
import { lineItemsApp } from "./line-items";
import { quotesApp } from "./quotes";
import { schedulesApp } from "./schedules";

export { productsApp } from "./products";

const baseApp = new Hono<Env>();

export const opportunitiesProductsApp = baseApp
  .route("/", lineItemsApp)
  .route("/", quotesApp)
  .route("/", schedulesApp);
