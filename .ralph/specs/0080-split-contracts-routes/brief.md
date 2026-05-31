# Spec 080: Split contracts routes (427 → ≤400 lines)

## Brief

The monolithic Hono contracts router at `apps/api/src/routes/contracts.ts` has grown to 427 lines, exceeding our strict 400-line budget limit. It contains endpoints for four distinct domain resource sub-applications: `contractsApp` (contract CRUD, pro-rated math, and renewal opportunity generation), `documentsApp` (document templates management and dynamic merge compiling), `invoicesApp` (batch invoicing generation with pro-rating calculations), and `subscriptionsApp` (active client subscriptions management).

This specification describes the architectural decomposition of this monolith into isolated, single-responsibility route modules under a dedicated `apps/api/src/routes/contracts/` directory. By splitting the endpoints, we enhance maintainability, reduce token overhead, and conform fully to the file line limits while preserving RPC type schemas.
