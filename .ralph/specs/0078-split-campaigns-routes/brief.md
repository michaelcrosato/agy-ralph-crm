# Spec 078: Split campaigns routes (534 → ≤400 lines)

## Brief

The monolithic Hono campaigns router at `apps/api/src/routes/campaigns.ts` has grown to 534 lines, exceeding our strict 400-line budget limit. It contains endpoints for three distinct domain resource sub-applications: `campaignsApp` (campaign CRUD, member listing, email blast, and ROI attribution), `segmentsApp` (marketing segment CRUD, dynamic member resolution, and sequence enrollment), and `unsubscribesApp` (email unsubscribe logging and analytics).

This specification describes the architectural decomposition of this monolith into isolated, single-responsibility route modules under a dedicated `apps/api/src/routes/campaigns/` directory. By splitting the endpoints, we enhance maintainability, reduce token overhead, and conform fully to the file line limits while preserving RPC type schemas.
