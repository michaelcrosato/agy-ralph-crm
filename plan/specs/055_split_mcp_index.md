# Spec 055 — Split `packages/mcp/src/index.ts` (1,185 lines)

## Description & Impact

`packages/mcp/src/index.ts` is 1,185 lines — 3× the 400-line budget. It contains MCP server setup, tool definitions for leads/contacts/accounts/opportunities/tickets/macros/custom objects, and stdio/Hono transport. Splitting into tool-group modules improves maintainability.

**Impact:** MCP package becomes modular, enabling easier addition of new tool categories.

## Definition of Done

- [ ] `packages/mcp/src/index.ts` reduced to ≤400 lines (server setup + tool registration).
- [ ] Tool definitions split into `tools/leads.ts`, `tools/contacts.ts`, `tools/accounts.ts`, `tools/opportunities.ts`, `tools/service.ts`, `tools/custom.ts`.
- [ ] All MCP-related tests pass without modification.
- [ ] `pnpm run agent:check` green.

## Approach

### Files to modify
- `packages/mcp/src/index.ts` — slim to server setup + imports
- `packages/mcp/src/tools/leads.ts` — lead tool definitions
- `packages/mcp/src/tools/contacts.ts` — contact tool definitions
- `packages/mcp/src/tools/accounts.ts` — account tool definitions
- `packages/mcp/src/tools/opportunities.ts` — opportunity tool definitions
- `packages/mcp/src/tools/service.ts` — ticket/macro tool definitions
- `packages/mcp/src/tools/custom.ts` — custom entity tool definitions

### Pattern
Each tool file exports an array of tool definitions. The main index imports and registers them via `server.setRequestHandler`.

## Test Strategy
Regression-only. `mcp-server.test.ts`, `mcp-and-ticketing.test.ts`, `mcp-service-lite.test.ts`, and `custom-objects-full-stack.test.ts` must pass unchanged.

## Depends on
None.
