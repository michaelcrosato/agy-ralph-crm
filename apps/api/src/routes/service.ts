import { Hono } from "hono";
import type { Env } from "../middleware/tenantAuth";
import { commentsRouter } from "./service/comments";
import { feedbackRouter } from "./service/feedback";
import { kbRouter } from "./service/kb";
import { macrosRouter } from "./service/macros";
import { routingRouter } from "./service/routing";
import { slaRouter } from "./service/sla";
import { tagsRouter } from "./service/tags";

export const serviceApp = new Hono<Env>();

// Mount the decomposed service sub-routers at the root path
serviceApp.route("/", routingRouter);
serviceApp.route("/", slaRouter);
serviceApp.route("/", kbRouter);
serviceApp.route("/", tagsRouter);
serviceApp.route("/", macrosRouter);
serviceApp.route("/", commentsRouter);
serviceApp.route("/", feedbackRouter);
