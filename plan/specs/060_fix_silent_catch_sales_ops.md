# Spec 060 — Fix Silent Error Swallowing in `sales-ops.ts`

## Description & Impact

`apps/api/src/routes/sales-ops.ts` line 145 has `catch (_) {}` that silently swallows Date parsing errors. This can mask bugs where invalid `closeDate` values pass through without any feedback.

**Impact:** Prevents silent data corruption from invalid date inputs; improves debuggability.

## Definition of Done

- [ ] `catch (_) {}` replaced with proper error handling (log warning + return null/undefined for the date).
- [ ] No other silent catches remain in the file.
- [ ] All tests pass unchanged.
- [ ] `pnpm run agent:check` green.

## Approach

### Files to modify
- `apps/api/src/routes/sales-ops.ts` — replace silent catch with structured logging

### Pattern
Replace `catch (_) {}` with `catch (err) { log.warn({ err }, 'Invalid closeDate format'); }` and ensure the calling code handles the failed parse gracefully (e.g., treats as null).

## Test Strategy
Regression-only. No behavioral change to API responses.

## Depends on
None.
