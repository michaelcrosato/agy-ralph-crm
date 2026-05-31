# Spec 080 Requirements

## Functional Requirements
- **Route Preservation**: Decompose all 11 existing endpoints under `/api/contracts`, `/api/documents`, `/api/invoices`, and `/api/subscriptions` exactly, preserving parameters, validation guards, and authorization middleware.
- **RPC Consistency**: Ensure Hono's RPC type inference (`hc<AppType>`) remains perfectly intact, resolving compile-time client SDK bindings without any modification in consuming front-end pages.
- **Contract Renewal Calculations**: Retain escalation math (`escalationPercentage`) and dynamic renewal opportunity generation (`generateRenewalOpportunity`) on `POST /api/contracts/:id/renew`.
- **Document Template Merging**: Ensure document compilation (`compileTemplate`) resolving records of type Lead, Account, Contact, Opportunity, or Ticket executes exactly as currently written.
- **Pro-rated Invoice Generation**: Preserve computed pro-rated amounts calculations (`calculateProRatedAmount`) and batch invoice logs creation on `POST /api/invoices/generate`.

## Non-Functional Requirements
- **File line limits**: Every decomposed route file must remain strictly under 400 lines. The orchestrating `index.ts` must remain under 100 lines.
- **Zero regressions**: All existing unit and integration tests must run and complete successfully with zero errors.
- **Biome compliance**: Code formatting, rules, and lints must pass cleanly.
