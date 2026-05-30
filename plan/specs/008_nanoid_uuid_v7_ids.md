# 008 — Replace `Math.random()` IDs with `uuid v7`

**Phase:** 0 · **Priority:** High · **Status:** `[ ] Todo`

## Description & Expected Impact
`packages/db/src/index.ts` uses `Math.random().toString(36).substring(2, 11)` at **111 sites** to generate entity IDs (e.g. `lead-`, `account-`, `opp-`). `Math.random()` is not cryptographically secure (predictable) and collision probability is unacceptable at scale. UUID v7 is time-ordered (B-tree friendly for Postgres) and is the 2026 default for new schemas. Replacing now prevents data corruption when spec 013 swaps in real Postgres.

## Definition of Done & Acceptance Criteria
- [ ] Add `uuid@^10.x` dependency to `packages/db/package.json`.
- [ ] Add helper `genId(prefix?: string): string` in `packages/db/src/_ids.ts` that returns `${prefix}-${uuidv7()}` (preserves the existing prefix-encoded form).
- [ ] Replace all 111 occurrences of `Math.random().toString(36).substring(2, 11)` in `packages/db/src/index.ts` with `genId('<prefix>')`.
- [ ] Existing tests pass without modification (IDs are still strings; ordering tests must use insertion order, not lexicographic of ID).
- [ ] No other call site in repo uses `Math.random()` for ID generation (grep gate).

## Implementation Approach
- Grep: `Math\.random\(\)\.toString\(36\)` should return 0 results post-spec.
- Use `import { v7 as uuidv7 } from "uuid"` (avoids deprecated v1/v4 entropy patterns).
- Be cautious of any test that depends on a specific ID literal (none expected; tests query by attribute).

## Test Strategy
- Regression: full `pnpm test` → 403/403.
- Sanity: run a quick property test that 10K generated IDs are unique.

## Rollback
Revert the file; remove `uuid` dependency.

## References
- [UUID v7 RFC 9562](https://www.rfc-editor.org/rfc/rfc9562)
