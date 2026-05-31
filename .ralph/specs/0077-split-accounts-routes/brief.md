# Spec 077: Split accounts routes (624 → ≤400 lines)

## Brief

The monolithic Hono accounts router at `apps/api/src/routes/accounts.ts` has grown to 624 lines, exceeding our strict 400-line budget limit. It contains standard CRUD, picklist/custom validations, account merging, hierarchy Rollups, and team management endpoints. 

This specification describes the architectural decomposition of this monolith into isolated, single-responsibility route modules under a dedicated `apps/api/src/routes/accounts/` directory. By splitting the endpoints, we enhance maintainability, reduce token overhead, and conform fully to the file line limits while preserving RPC type schemas.
