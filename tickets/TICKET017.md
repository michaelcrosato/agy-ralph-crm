# TICKET017: Sales Territory & Routing Assignment Dashboard (Next.js Dashboard Integration)

## Details
- **Status**: completed
- **Priority**: High
- **Goal**: Implement Next.js frontend interfaces and simulation panels for managing sales territory criteria rules, members mapping, and dynamic routing.
- **Context**: Spec 074 describes establishing active territory listing panels, rules criteria editors, and account routing simulators.

---

## Scope

### In Scope
- Create Sales Territory listing component (`TerritoryList.tsx`).
- Create territory editor with dynamic filter criteria rules builder (`TerritoryEditor.tsx`).
- Create interactive account routing simulator panel (`RoutingSimulator.tsx`) executing `POST /api/accounts/:id/route`.
- Wire components to Hono RPC client and mount under /territories dashboard path.
- Maintain strict multi-tenant context boundaries.
- Ensure 100% build and Biome compliance.

### Out of Scope
- Modifying backend server logic or database schemas.

---

## Steps to Execute
1. Implement the Territory listing interface in `apps/web/src/components/territories/TerritoryList.tsx`.
2. Implement the criteria editor and members list in `apps/web/src/components/territories/TerritoryEditor.tsx`.
3. Implement the Account routing simulator sandbox in `apps/web/src/components/territories/RoutingSimulator.tsx`.
4. Create the page router and wire all elements in `apps/web/src/app/territories/page.tsx`.
5. Link `/territories` on the main page console navbar in `apps/web/src/app/page.tsx`.
6. Verify Next.js build compiles successfully with zero warnings/errors.
7. Run workspace linter, typecheck, and validation checks.

---

## Acceptance Criteria
- [x] Active and inactive Sales Territories are visualized with clean status badges and routing details.
- [x] Criteria rules criteria builder dynamically supports adding/removing filter clauses with operators (equals, contains, greater_than, less_than).
- [x] Users can be assigned as territory members with role settings.
- [x] Interactive Accounts Routing Simulator executes live routing rules and updates the account owner in the list immediately.
- [x] Strictly adheres to tenant JWT boundaries.
- [x] All build and verification checks pass green.
