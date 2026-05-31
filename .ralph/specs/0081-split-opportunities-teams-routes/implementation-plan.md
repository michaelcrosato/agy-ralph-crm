# Spec 081 Implementation Plan

## Steps

1. **Extract Team Members Router**: Extract opportunity team members endpoints to `apps/api/src/routes/opportunities/teams/team-members.ts`.
2. **Extract Competitors Router**: Extract deal competitors endpoints to `apps/api/src/routes/opportunities/teams/competitors.ts`.
3. **Extract Campaign Influence Router**: Extract revenue campaign influence endpoints to `apps/api/src/routes/opportunities/teams/campaign-influence.ts`.
4. **Extract Contact Roles Router**: Extract contact roles endpoints to `apps/api/src/routes/opportunities/teams/contact-roles.ts`.
5. **Extract Splits Router**: Extract opportunity splits and commissions endpoints to `apps/api/src/routes/opportunities/teams/splits.ts`.
6. **Create Barrel index**: Export `opportunitiesTeamsApp` inside `apps/api/src/routes/opportunities/teams/index.ts`.
7. **Remove Monolith**: Safely remove monolithic `apps/api/src/routes/opportunities/teams.ts`.
8. **Verify Monorepo**: Run linter, compiler, tests, and preflights using `pnpm run agent:check`.
