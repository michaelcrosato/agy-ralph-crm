# Specification: Competitor Win/Loss & Performance Analytics API - Brief

## 1. Functional Objective
To drive strategic sales insights, enterprise CRMs must analyze competition. While we can log individual competitors on specific opportunities, there is currently no global, organization-wide reporting engine or REST API that aggregates competitor presence, win/loss rates, financial impact, and compiled strengths/weaknesses.

This feature introduces the Competitor Win/Loss & Performance Analytics API. The engine will aggregate:
- **Total Competitions Count**: Total number of opportunities where the competitor was present.
- **Won Competitions Count**: Opportunities won (`stage === "Closed Won"`) where the competitor was present and their status was logged as `"Lost"`.
- **Lost Competitions Count**: Opportunities lost (`stage === "Closed Lost"`) where the competitor was present and their status was logged as `"Won"`.
- **Win Rate**: Percentage rate of wins against the competitor: `(wonCount / (wonCount + lostCount)) * 100`. Defaults to `0.0` if both won and lost counts are zero.
- **Total Opportunity Value**: Sum of the amount of all opportunities where the competitor was present.
- **Won Opportunity Value**: Sum of the amount of all won opportunities where the competitor was present and defeated.
- **Compiled Strengths**: List of all distinct strength statements logged for this competitor across opportunities.
- **Compiled Weaknesses**: List of all distinct weakness statements logged for this competitor across opportunities.

All calculations must execute under strict active tenant Row-Level Security (RLS) isolation.

## 2. Technical Scope
- **Core Analytics Engine**: Implement `calculateGlobalCompetitorAnalytics` in `packages/core` that processes arrays of competitors and opportunities to produce the consolidated stats per competitor name.
- **REST Endpoints**: Expose a REST route `GET /api/reports/competitor-analytics` inside `apps/api` returning the organization-wide competitor analysis.
- **Tenant RLS & Security**: Ensure all query fetches strictly run within the active tenant's context (e.g. active organization context). An organization must not be able to query another's competitor analytics.
- **Verification & Integration Tests**: Write integration tests inside `packages/testing/src/competitor-analytics.test.ts` validating mathematical accuracy and multi-tenant isolation.
