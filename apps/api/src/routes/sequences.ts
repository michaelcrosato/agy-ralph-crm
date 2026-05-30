import { Hono } from "hono";
import type { Env } from "../middleware/tenantAuth";
import { analyticsApp } from "./sequences/analytics";
import { crudApp } from "./sequences/crud";
import { enrollmentApp } from "./sequences/enrollment";
import { executionApp } from "./sequences/execution";
import { foldersApp } from "./sequences/folders";
import { stepsApp } from "./sequences/steps";
import { tagsApp } from "./sequences/tags";

// Re-export the main sub-apps so they are exposed exactly as before for api/index.ts
export { emailsApp } from "./sequences/emails";
export { publicEmailsApp } from "./sequences/public-emails";

export const sequencesApp = new Hono<Env>();

// Mount the modular sub-apps under sequencesApp root paths to preserve exact routing paths
sequencesApp
  .route("/", stepsApp)
  .route("/", enrollmentApp)
  .route("/", executionApp)
  .route("/", analyticsApp)
  .route("/", tagsApp)
  .route("/", foldersApp)
  .route("/", crudApp);
