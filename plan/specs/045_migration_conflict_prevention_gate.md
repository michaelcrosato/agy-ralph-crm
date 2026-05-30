# 045 — Automatic Migration Conflict Prevention Gate

**Phase:** R (replenish/tooling) · **Priority:** High · **Status:** `[x] Done`

## Description & Expected Impact

In a multi-agent or collaborative development environment, different branches can independently generate database migrations. If two branches both generate a new migration, they will often assign the same sequential prefix (e.g., `0003_xxx.sql` and `0003_yyy.sql`). When merged, git sees no conflict because the filenames are different. However, having duplicate sequential prefixes breaks the production deployment sequence and Drizzle ORM's schema matching. Furthermore, discrepancies can arise between SQL files present on disk and Drizzle's migration journal (`meta/_journal.json`).

This specification creates an automated Drizzle migrations health check script (`scripts/agent/check-migrations.mjs`) to validate:
1. Migration index (`idx`) sequence continuity and ordering.
2. Tag-to-file matching between `_journal.json` and `.sql` files on disk.
3. Uniqueness of prefix numbers (preventing branch overlap).

This check will be integrated directly into the `agent:doctor` diagnostics pipeline to prevent bad migration deployments.

## Definition of Done & Acceptance Criteria

- [x] Create `scripts/agent/check-migrations.mjs` in Node.js (cross-platform compatible, zero dependencies).
- [x] The script must:
  - Locate `packages/db/drizzle/` and verify that `meta/_journal.json` exists.
  - Parse the journal entries and assert:
    - Index sequence starts at `0`.
    - Every subsequent index increases exactly by 1 (no gaps).
    - Every entry's `tag` matches a physical `.sql` file in the directory.
  - Scan the `drizzle/` folder for all `.sql` files and assert:
    - Every SQL file is represented by a journal entry.
    - No two SQL files share the same 4-digit numeric prefix (e.g. `0003`).
  - Output descriptive success or error messages.
  - Return exit code `0` on success and exit code `1` on any failure.
- [x] Integrate the check into `scripts/agent/doctor.ps1` and `scripts/agent/doctor.sh` as an automated environment diagnostic.
- [x] Implement a unit/integration test in `packages/testing/src/check-migrations.test.ts` to assert that the script correctly catches gaps, duplicate prefixes, and unmatched journal files.
- [x] Run `pnpm run agent:check` to ensure the entire workspace is green.

## Implementation Approach

1. **Migration Check Core (`scripts/agent/check-migrations.mjs`):**
   - Use standard Node `fs` and `path` modules.
   - Resolve `packages/db/drizzle` path relative to repository root.
   - Read and parse `_journal.json`.
   - Validate index continuity and tag file checks.
   - Read files in `drizzle/` and extract prefixes, checking for duplicates.
2. **Integration:**
   - Hook the call into `scripts/agent/doctor.ps1` and `scripts/agent/doctor.sh`.
3. **Validation & Verification:**
   - Create mock files in the unit test to verify that the checker fails with exit status `1` when:
     - Gaps are present in `_journal.json`.
     - Duplicate prefix SQL files are found on disk.
     - A SQL file has no journal entry (or vice versa).

## Test Strategy

- **Targeted Integration Test:** Create `packages/testing/src/check-migrations.test.ts` that runs the script against temporary mocked directories and asserts correct exit codes and error output strings.
- **Suite Verification:** Run the full agent verification check.

## Rollback

- Revert changes via:
  ```bash
  git restore scripts/agent/doctor.ps1 scripts/agent/doctor.sh
  rm -f scripts/agent/check-migrations.mjs packages/testing/src/check-migrations.test.ts
  ```
