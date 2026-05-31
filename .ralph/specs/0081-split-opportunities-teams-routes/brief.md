# Spec 081: Split opportunities teams routes (819 → ≤400 lines)

## Brief

The monolithic Hono opportunity teams router at `apps/api/src/routes/opportunities/teams.ts` has grown to 819 lines, exceeding our strict 400-line budget limit by more than 2×. It contains endpoints for five distinct opportunity-related sub-domains: `Opportunity Splits` (splitting deals values and calculating quotas Closed Won commissions), `Contact Roles` (binding CRM contacts to deals with primary role assignments), `Campaign Influence` (allocating revenue attribution to campaigns), `Competitors` (tracking deal competitors win-loss metrics), and `Opportunity Teams` (managing sales deal collaboration teams).

This specification describes the architectural decomposition of this monolith into isolated, single-responsibility route modules under a dedicated `apps/api/src/routes/opportunities/teams/` directory. By splitting the endpoints, we enhance maintainability, reduce token overhead, and conform fully to the file line limits while preserving RPC type schemas.
