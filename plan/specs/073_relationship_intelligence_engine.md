# 073 — Relationship Intelligence Engine

**Phase:** 5 · **Priority:** High · **Status:** `[ ] Todo` · **Depends on:** 072

## Description & Expected Impact
Enterprise users need visually rich, real-time analytics to track autonomous BANT qualification outcomes and conversion performance across all leads.
This specification details the frontend Next.js interface components, data visualization layouts, and custom React hook bindings required to consume the simulated BANT status REST gateways and render qualification summaries under strict tenant-level organization bounds.

## Definition of Done & Acceptance Criteria
- [ ] Create a comprehensive BANT qualification status card dashboard panel inside Next.js (`apps/web`).
- [ ] Implement an interactive conversation simulation panel allowing real-time message exchange and instant BANT score progression updates.
- [ ] Bind custom React hooks utilizing `@crm/api-client` to poll or fetch qualification details dynamically.
- [ ] Safely support strict tenant boundaries (zero cross-tenant information exposure).
- [ ] Verify 100% monorepo build, Biome formatting, and linting pipeline success.

## Implementation Approach
1. **Frontend BANT Analytics Component**: Create `apps/web/src/components/leads/BantAnalytics.tsx` to render the Budget, Authority, Need, and Timeline traits with progress bars and color-coded status badges.
2. **Interactive Simulator Interface**: Create `apps/web/src/components/leads/ConversationSimulator.tsx` rendering the turn-by-turn chat history (Lead messages vs Bot replies) and a text area for simulating new inbound client messages.
3. **Type-Safe API Binding**: Integrate these components into `apps/web/src/app/leads/page.tsx` using the typed RPC client (`@crm/api-client`) for seamless end-to-end data synchronization.
4. **Verification**: Run `pnpm build` and `pnpm run agent:check` to ensure formatting, linting, and Next.js static rendering are fully green.

## Rollback
- Revert Next.js page modifications and delete components.
