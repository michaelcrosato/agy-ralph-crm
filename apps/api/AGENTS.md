# API Layer Local Constraints (AGENTS.md)

This path-scoped file outlines execution guidelines and constraints for the Hono API Engine.

## Local Constraints
- **Routing Structure:** All routing endpoints must use Hono declarative routes. Keep routers thin; route handlers must delegate all business logic to `@crm/core` pure models.
- **MCP Server Seam:** The Model Context Protocol (MCP) server exposed by this package must strictly query database APIs via `@crm/db` and respect RLS tenancy limits.
- **Strict Content-Type:** All API routes must return JSON formatted responses with proper OpenAPI schema bindings.
- **Auth Enforcement:** Protect every route using the tenant verification middleware defined in `@crm/auth`. Never write ad-hoc session parsing logic in the router handlers.
