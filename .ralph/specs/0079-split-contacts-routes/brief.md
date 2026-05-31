# Spec 079: Split contacts routes (457 → ≤400 lines)

## Brief

The monolithic Hono contacts router at `apps/api/src/routes/contacts.ts` has grown to 457 lines, exceeding our strict 400-line budget limit. It contains standard CRUD endpoints, picklist and custom validation rules enforcement, dynamic duplicate calculation algorithms, hierarchical path resolutions, record merging operations with database cascade updates, and AI automatic enrichment triggering endpoints.

This specification describes the architectural decomposition of this contacts monolith into isolated, single-responsibility route sub-modules under a dedicated `apps/api/src/routes/contacts/` directory. By splitting the endpoints, we enhance maintainability, reduce token overhead, and conform fully to the file line limits while preserving absolute Hono RPC compile-time type-safety.
