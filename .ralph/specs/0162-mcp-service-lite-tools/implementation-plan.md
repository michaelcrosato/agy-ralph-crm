# Task 0162: Model Context Protocol (MCP) Ticketing Integration - Implementation Plan

## 1. Plan Overview
We will implement the ticket-specific MCP tools by extending `mcpTools` definitions and implementing their corresponding executor blocks in `POST /mcp/tools/call` in `apps/api/src/index.ts`. Since core database tables and business logic already exist, this task involves clean routing, validation, and integration.

## 2. Step-by-Step Implementation Sequence

### Step 2.1: Extend `mcpTools` Array in `apps/api/src/index.ts`
- Append `crm_get_ticket`, `crm_list_tickets`, `crm_create_ticket`, `crm_add_ticket_comment`, and `crm_apply_ticket_macro` schemas to `export const mcpTools = [...]`.

### Step 2.2: Implement Executor Blocks in `apps/api/src/index.ts`
- Within the `POST /mcp/tools/call` route handler:
  - Add handlers for all five new MCP tools.
  - Implement full validation, auto-matching, RLS mapping, audit log tracking, and outbound webhook trigger loops.
  - Ensure all database mutations are wrapped inside the active `withTenant(orgId, ...)` context.

### Step 2.3: Scaffold Integration Tests
- Create `packages/testing/src/mcp-service-lite.test.ts`.
- Write thorough tests to verify success paths, cross-tenant RLS protection (e.g. tenant B attempting to query or comment on tenant A's ticket returns `null`/error), and downstream triggers (audit logs, webhooks).

### Step 2.4: Verification & Format
- Run `npx biome check --write .` to format the workspace.
- Run `pnpm verify` to check compilation, biome lint/format, and typechecks.
- Run `npx vitest run packages/testing/src/mcp-service-lite.test.ts` to run the test suite.
