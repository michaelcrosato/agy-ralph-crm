# 075 — Split Main Dashboard Page (1,502 → ≤400 lines)

**Phase:** 6 · **Priority:** Critical · **Status:** `[x] Done` · **Depends on:** 074

## Description & Expected Impact
`apps/web/src/app/page.tsx` has grown to 1,502 lines, nearly 4× the 400-line budget. It contains embedded mock data, authentication logic, search, metrics panels, tab navigation, record grids, lead conversion modals, and activity feeds all in a single file. This severely impacts maintainability and makes targeted testing/modification difficult.

## Definition of Done & Acceptance Criteria
- [x] Extract mock data constants to `apps/web/src/data/mock-tenants.ts`.
- [x] Extract shared type interfaces to `apps/web/src/types/crm.ts`.
- [x] Extract metrics/statistics dashboard section to `apps/web/src/components/dashboard/MetricsGrid.tsx`.
- [x] Extract fuzzy search bar + results to `apps/web/src/components/dashboard/SearchBar.tsx`.
- [x] Extract lead/contact/opportunity tab grids to `apps/web/src/components/dashboard/RecordTabs.tsx`.
- [x] Extract lead conversion modal to `apps/web/src/components/dashboard/ConversionModal.tsx`.
- [x] Extract activity feed to `apps/web/src/components/dashboard/ActivityFeed.tsx`.
- [x] `page.tsx` orchestrator remains ≤400 lines composing extracted components.
- [x] 100% monorepo build, Biome lint, and full test suite pass green.
- [x] No visual regression (same glassmorphic layout, interactions, and data flow).

## Implementation Approach
1. Create `apps/web/src/types/crm.ts` with shared CRM interfaces (Lead, Contact, Opportunity, SearchResult, Activity).
2. Move `MOCK_DATA` constant to `apps/web/src/data/mock-tenants.ts`.
3. Extract each major UI section into a focused component that accepts data via props.
4. Rewire `page.tsx` to import and compose extracted components with state management in the parent.
5. Run Biome check and Next.js build to verify no regressions.

## Rollback
- Revert to monolithic `page.tsx` and delete extracted components/data files.
