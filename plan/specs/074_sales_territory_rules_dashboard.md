# 074 — Sales Territory & Routing Assignment Dashboard

**Phase:** 5 · **Priority:** High · **Status:** `[ ] Todo` · **Depends on:** 073

## Description & Expected Impact
Sales executives need an elegant, robust workspace to configure geographic and firmographic territory rules and assign members with direct/round-robin routing.
This specification details the frontend Next.js interface components, criteria rules editors, assigned members grids, and interactive accounts routing simulators required to consume the sales operations REST gateways under strict organization JWT bounds.

## Definition of Done & Acceptance Criteria
- [ ] Create a comprehensive territory management workspace panel under `/territories` in Next.js (`apps/web`).
- [ ] Implement a dynamic territory rules editor supporting active/inactive status switches, routing method toggles, and criteria filter builders (field, operator, value).
- [ ] Implement a territory members list to assign users to territories with primary roles.
- [ ] Implement an interactive Account Routing Simulator allowing real-time rules execution (`POST /api/accounts/:id/route`) and instant owner reassignments.
- [ ] Integrate these components under a unified glassmorphic console routing page (`apps/web/src/app/territories/page.tsx`).
- [ ] Safely support strict tenant boundaries (zero cross-tenant information exposure).
- [ ] Verify 100% monorepo build, Biome formatting, and linter checks pass green.

## Implementation Approach
1. **Frontend Components**:
   - `apps/web/src/components/territories/TerritoryList.tsx` — Shows a list of territories, active badges, routing method types, and criteria summary.
   - `apps/web/src/components/territories/TerritoryEditor.tsx` — Offers a criteria rule builder (adding/removing filter rows) and assigned members grid (adding/removing userIds).
   - `apps/web/src/components/territories/RoutingSimulator.tsx` — Interactive sandbox fetching accounts, selecting one, executing the backend `/api/accounts/:id/route` endpoint, and showing the detailed routing trace.
2. **Unified Console Page**:
   - Create `apps/web/src/app/territories/page.tsx` incorporating these components. Add navbar triggers to move back to the console landing page.
3. **Dashboard Navigation**:
   - Add navigation link to `/territories` in the main header of `apps/web/src/app/page.tsx`.
4. **Verification**:
   - Run linter formatter auto-fixes, Next.js static production builds, and full test suite to guarantee 100% correctness.

## Rollback
- Revert Next.js page modifications and delete components.
