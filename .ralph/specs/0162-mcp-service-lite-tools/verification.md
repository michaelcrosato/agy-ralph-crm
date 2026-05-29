# Task 0162: Model Context Protocol (MCP) Ticketing Integration - Verification

## 1. Automated Verification Command
To verify that this task is complete, run:
```bash
pnpm verify && npx vitest run packages/testing/src/mcp-service-lite.test.ts
```

## 2. Manual Verification Checklist
- [ ] List all active MCP tools by GET `/mcp/tools`. Verify the new ticket tools are listed with correct schemas.
- [ ] Call `crm_get_ticket` via MCP for a valid ticket. Assert details are returned correctly.
- [ ] Call `crm_get_ticket` for a cross-tenant ticket. Assert it returns `null` or error.
- [ ] Call `crm_create_ticket` via MCP. Verify a contact and ticket are correctly created, assigned according to rules, and webhooks / audit logs are triggered.
- [ ] Call `crm_add_ticket_comment` and assert comments are created and logged.
- [ ] Call `crm_apply_ticket_macro` and assert macros apply properly, updating the ticket's state.
