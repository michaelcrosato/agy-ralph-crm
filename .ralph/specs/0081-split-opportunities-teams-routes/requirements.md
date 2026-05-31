# Spec 081 Requirements

## Functional Requirements
- **Route Preservation**: Decompose all 13 existing endpoints under `/api/opportunities` sub-domains exactly, preserving parameters, validation guards, and authorization middleware.
- **RPC Consistency**: Ensure Hono's RPC type inference (`hc<AppType>`) remains perfectly intact, resolving compile-time client SDK bindings without any modification in consuming front-end pages.
- **Opportunity Splits Commissions**: Retain split allocations math (`calculateOpportunitySplits`), quotas Closed Won tracking, commissions calculations (`calculateOpportunityCommission`), RLS logs, and webhook triggers.
- **Dynamic Primary Contact Assignment**: Retain primary role selections logic (`setPrimaryOpportunityContactRole`) and audit updates.
- **Revenue Share Attribution**: Retain total influence verification (`validateInfluencePercentageTotal`), percentage bounds (0-100), and revenue share calculations (`calculateCampaignRevenueShare`).
- **Competitors win-loss check**: Retain competitor win-loss status validators (Pending/Won/Lost) and cascades.
- **Opportunity Team Validators**: Retain team member validation rules (`validateOpportunityTeamMember`).

## Non-Functional Requirements
- **File line limits**: Every decomposed route file must remain strictly under 400 lines. The orchestrating `index.ts` must remain under 100 lines.
- **Zero regressions**: All existing unit and integration tests must run and complete successfully with zero errors.
- **Biome compliance**: Code formatting, rules, and lints must pass cleanly.
