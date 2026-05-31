# TICKET022: Split Opportunities Teams Routes Monolith (Spec 081)

## Details
- **Status**: completed
- **Priority**: High
- **Goal**: Decompose monolithic `apps/api/src/routes/opportunities/teams.ts` into focused sub-modules to achieve compliance with our strict 400-line file limit budget.
- **Context**: Spec 081 describes split boundaries, sub-routers mounting, and test verification strategies.

---

## Scope

### In Scope
- Create `splits.ts`, `contact-roles.ts`, `campaign-influence.ts`, `competitors.ts`, `team-members.ts` under `apps/api/src/routes/opportunities/teams/`.
- Decompose opportunity splits, contact roles, campaign influence, competitors win-loss, and team members collaboration.
- Export unified `opportunitiesTeamsApp` from index.ts barrel to preserve route mounting and RPC client bindings.
- Remove old monolithic router file.
- Perform clean workspace verify run.

### Out of Scope
- Modifying backend core calculations or schemas.

---

## Steps to Execute
1. Implement the modular sub-routers inside `apps/api/src/routes/opportunities/teams/`.
2. Construct the entrypoint composter index.ts.
3. Remove monolithic `apps/api/src/routes/opportunities/teams.ts`.
4. Rerun `pnpm run agent:check` to verify no compilation or test regressions.

---

## Acceptance Criteria
- [x] No file exceeds 400 lines (barrel ≤ 100 lines).
- [x] Zod OpenAPI schema type inferences resolve cleanly in RPC client.
- [x] Splits commissions, contact roles, campaign influence, competitors, and team members logic execute cleanly.
- [x] All build gates and 546+ tests remain 100% green.
