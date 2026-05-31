# Spec 078 Implementation Plan

## Steps

1. **Extract Unsubscribes Router**: Extract unsubscribes endpoints to `apps/api/src/routes/campaigns/unsubscribes.ts`.
2. **Extract Segments Router**: Extract marketing segment endpoints, members list resolution, and sequence enrollment to `apps/api/src/routes/campaigns/segments.ts`.
3. **Extract Campaigns Router**: Extract campaigns endpoints, member listings, status updates, email blasts, and ROI attribution to `apps/api/src/routes/campaigns/campaigns.ts`.
4. **Create Barrel index**: Export `campaignsApp`, `segmentsApp`, and `unsubscribesApp` inside `apps/api/src/routes/campaigns/index.ts`.
5. **Remove Monolith**: Safely remove monolithic `apps/api/src/routes/campaigns.ts`.
6. **Verify Monorepo**: Run linter, compiler, tests, and preflights using `pnpm run agent:check`.
