# Spec 079 Requirements

## Functional Requirements
- **Route Preservation**: Decompose all 8 existing endpoints under `/api/contacts` exactly, preserving parameters, validation guards, and authorization middleware.
- **RPC Consistency**: Ensure Hono's RPC type inference (`hc<AppType>`) remains perfectly intact, resolving compile-time client SDK bindings without any modification in consuming front-end pages.
- **Validation Rules Hooks**: Preserve picklist validations (`enforcePicklistDependencies`) and custom validations (`enforceCustomValidationRules`) on creation (`POST /`) and updates (`PATCH /:id`).
- **Hierarchy Security & Cycles**: Retain circular reporting relationship detection (`detectCircularContactRelation`) on hierarchical contact reporting linking, hierarchy audit logs insertion, and webhook dispatches.
- **Duplicate Checking & Merge Cascades**: Retain duplicates checking (`calculateContactDuplicates`) and cascading contact merge operations (`mergeContacts`) updating dependent tickets, campaign memberships, opportunity contact roles, and activities link bindings in the database proxy, followed by duplicate record deletion and auditing.
- **AI Enrichment Bot**: Retain automatic AI enrichment background processing (`AIAttributeService.enrichRecord`) trigger on `POST /:id/enrich`.

## Non-Functional Requirements
- **File line limits**: Every decomposed route file must remain strictly under 400 lines. The orchestrating `index.ts` must remain under 100 lines.
- **Zero regressions**: All existing unit and integration tests must run and complete successfully with zero errors.
- **Biome compliance**: Code formatting, rules, and lints must pass cleanly.
