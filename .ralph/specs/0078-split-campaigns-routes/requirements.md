# Spec 078 Requirements

## Functional Requirements
- **Route Preservation**: Decompose all 17 existing endpoints under `/api/campaigns`, `/api/segments`, and `/api/unsubscribes` exactly, preserving parameters, validation guards, and authorization middleware.
- **RPC Consistency**: Ensure Hono's RPC type inference (`hc<AppType>`) remains perfectly intact, resolving compile-time client SDK bindings without any modification in consuming front-end pages.
- **Dynamic Segment Resolution**: Maintain dynamic segment query compilation and execution on `GET /api/segments/:id/members` and `POST /api/segments/:id/enroll-sequence`.
- **Campaign Email Blast**: Ensure template compiling (`compileEmailTemplate`), activity link bindings (Campaign, Account, Lead, Contact, Opportunity), member status updates, and audit logging on email-blast execution run exactly as they currently do.
- **ROI & Attribution Analytics**: Retain computed ROI math and revenue-share campaign attribution evaluations under `GET /:id/attribution` and `GET /:id/roi`.

## Non-Functional Requirements
- **File line limits**: Every decomposed route file must remain strictly under 400 lines. The orchestrating `index.ts` must remain under 100 lines.
- **Zero regressions**: All existing unit and integration tests must run and complete successfully with zero errors.
- **Biome compliance**: Code formatting, rules, and lints must pass cleanly.
