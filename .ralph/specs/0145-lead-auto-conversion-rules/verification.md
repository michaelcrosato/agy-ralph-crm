# Specification: Lead Auto-Conversion Rules & Criteria Engine - Verification

## 1. Automated Test Suite Execution
Verify that the integration and RLS tests for Lead Auto-Conversion pass without error:

```bash
pnpm --filter @crm/testing test run lead-auto-conversion.test.ts
```

## 2. Workspace Verification
Verify that the monorepo workspace compiles cleanly, types are consistent, and formatting matches standard rules:

```bash
pnpm verify
```

## 3. Definition of Done Checklist
- `lead_auto_conversion_rules` table registered in Drizzle schemas.
- `dbStore.leadAutoConversionRules` enforces tenant-level context boundaries.
- `evaluateLeadAutoConversion` evaluates criteria correctly.
- REST API matches endpoints and executes auto-conversion on matching updates.
- 100% clean output from `pnpm verify` with zero TypeScript or Biome lint failures.
