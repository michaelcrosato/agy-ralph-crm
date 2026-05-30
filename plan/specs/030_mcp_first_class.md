# 030 — Promote MCP server to `packages/mcp` (Twenty-style native MCP)

**Phase:** 2 · **Priority:** High · **Status:** `[ ] Todo` · **Depends on:** 011

## Description & Expected Impact
Twenty 2.0 ships a native MCP server per workspace so AI assistants can interface directly with CRM data. Repo has 8 MCP tools embedded in `modules/service-lite` — a side-extension. Promote to first-class `packages/mcp` mirroring Twenty's pattern: tools (CRUD on every aggregate), resources (read-only entity snapshots), prompts (reusable agent templates). Uses official `@modelcontextprotocol/sdk` v1.11.x; aligns with the 2026-07-28 spec release candidate (stateless core, OAuth alignment).

## Definition of Done & Acceptance Criteria
- [ ] New `packages/mcp/` package depending on `@modelcontextprotocol/sdk@^1.11.0`.
- [ ] Exports `createMcpServer({ tenantContext, dbStore })` returning an `McpServer` instance.
- [ ] Tools: at least 20 — `crm_get_account`, `crm_list_contacts`, `crm_create_ticket`, `crm_log_activity`, `crm_search_leads`, `crm_create_opportunity`, etc. (cover every aggregate). All tenant-scoped via `withTenant`.
- [ ] Resources: read-only views (`crm://leads/{id}`, `crm://opportunities/{id}`).
- [ ] Prompts: 3 reusable templates ("summarize lead pipeline", "draft outreach email", "qualify opportunity").
- [ ] Transports: `stdio` (for local agents) + `streamable-http` (for hosted).
- [ ] New integration tests in `packages/testing/src/mcp-server.test.ts` covering tool execution, RLS enforcement, and unauthorized error handling.

## Implementation Approach
- Reuse handler logic from `modules/service-lite/src/`; do not duplicate code.
- Each tool is a thin adapter over `packages/core/` domain functions (clean from spec 011).
- Authn: assume the MCP transport has already authenticated; map session → `orgId` via existing auth package.

## Test Strategy
- Unit: each tool tested for input validation + tenant isolation.
- Integration: spawn MCP server over stdio in test; exercise 5 tools end-to-end.

## Rollback
Keep `modules/service-lite` MCP as-is; do not register the new package.

## References
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Twenty 2.0 MCP](https://twenty.com/)
- [MCP 2026-07-28 spec RC](https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/)
