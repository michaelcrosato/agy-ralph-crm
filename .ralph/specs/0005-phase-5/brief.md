# Phase 5: Managed First-Party Core Extensions - Brief

## Objective
Establish first-party module extension layers (such as `modules/service-lite` for basic ticketing) and integrate a standardized Model Context Protocol (MCP) server that exposes lookup tools to query CRM data under active row-level security parameters.

## Boundaries & Constraints
- Database schemas for ticketing and extensions must reside in `packages/db`.
- Ticket creation and lifecycle management must reside in `modules/service-lite`.
- Standardized MCP server implementation and lookup tools must reside in `apps/api`.
