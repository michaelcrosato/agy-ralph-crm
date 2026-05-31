# Spec 077 Requirements

## Functional Requirements
- **Route Preservation**: Decompose all 13 existing endpoints under `/api/accounts` exactly, preserving parameters, validation guards, and authorization middleware.
- **RPC Consistency**: Ensure Hono's RPC type inference (`hc<AppType>`) remains perfectly intact, resolving compile-time client SDK bindings without any modification in consuming front-end pages.
- **Val Validation Rules**: Maintain picklist validations (`enforcePicklistDependencies`) and custom validations (`enforceCustomValidationRules`) on creation (`POST /`) and updates (`PATCH /:id`).
- **Hierarchy Security & Cycles**: Retain cycle checks (`detectCircularAccountRelation`) on hierarchical account linking and preserve transactional RLS isolation checks on merge.

## Non-Functional Requirements
- **File line limits**: Every decomposed route file must remain strictly under 400 lines. The orchestrating `index.ts` must remain under 100 lines.
- **Zero regressions**: All existing unit and integration tests must run and complete successfully with zero errors.
- **Biome compliance**: Code formatting, rules, and lints must pass cleanly.
