# Specification: Opportunity Teams & Collaborative Roles API - Verification

## 1. Test Execution Commands

To execute the test verification gate, run:
```bash
pnpm verify
```

To run the newly added integration tests specifically:
```bash
npx vitest run packages/testing/src/opportunity-teams.test.ts
```

## 2. Success Criteria
- [ ] Workspace link check and typescript compiling with zero errors.
- [ ] Linting checking clean with zero errors via Biome.
- [ ] The integration suite `opportunity-teams.test.ts` executes and passes 100% cleanly.
