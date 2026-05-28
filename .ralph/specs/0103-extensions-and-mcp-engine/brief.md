# Specification: Support Ticketing & MCP Execution Engine - Brief

## Objective
Establish the REST API endpoints for support ticketing (`service-lite` module). Additionally, implement a compliant Model Context Protocol (MCP) tool execution endpoint enabling authenticated AI assistants to query CRM accounts and contacts under active row-level isolation rules.

## Boundaries & Constraints
- Ticketing interfaces and state transitions must reside in `modules/service-lite`.
- Persistent storage schemas and RLS operations for support tickets must reside in `packages/db`.
- API endpoints for creating, resolving tickets, and executing MCP tool queries must reside in `apps/api`.
- All operations must enforce active tenant RLS security limits.
