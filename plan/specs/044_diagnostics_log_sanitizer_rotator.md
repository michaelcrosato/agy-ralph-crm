# 044 — Workspace Diagnostics Log Sanitizer & Rotator

**Phase:** 2 (follow-up/tooling) · **Priority:** Medium · **Status:** `[x] Done`

## Description & Expected Impact

As autonomous agents operate continuously in the codebase, they execute many verification commands (`pnpm run agent:check`, tests, etc.) which append output to `test_output.log`. Over time, this file can grow very large (exceeding 2MB). Large log files consume unnecessary context window memory during file listings or recursive reads, leading to token bloat and poor execution efficiency. Furthermore, logs can occasionally print sensitive credentials, API keys, or JWT tokens, which poses a security risk if committed or exposed to the model context.

This specification implements an automated, cross-platform diagnostic log rotation and sanitization utility (`scripts/agent/rotate-logs.mjs`) inside the agent check pipeline.

## Definition of Done & Acceptance Criteria

- [x] Create `scripts/agent/rotate-logs.mjs` in Node.js (cross-platform compatible, no external dependencies).
- [x] The script must:
  - Check if `test_output.log` exists in the repository root. If not, exit cleanly with status `0` (graceful no-op).
  - Handle UTF-16LE (often produced by Windows PowerShell redirections) and UTF-8 encoding gracefully, normalizing the output to standard UTF-8.
  - Automatically scrub JWT-like tokens, Bearer API keys, base64 private keys, and passwords, replacing them with standard redaction placeholders (e.g., `[REDACTED_SECRET]`).
  - Check the size of `test_output.log`.
  - If the size exceeds `2,000,000` bytes (2MB):
    - Shift historic logs: remove `test_output.3.log` if it exists, rename `test_output.2.log` -> `test_output.3.log`, rename `test_output.1.log` -> `test_output.2.log`.
    - Write the sanitized log content to `test_output.1.log` as a standard UTF-8 text file.
    - Recreate or truncate `test_output.log` as an empty file (or write a standard rotation header).
  - If the size does NOT exceed 2MB:
    - Sanitize `test_output.log` in place, saving the clean UTF-8 text back to the file.
- [x] Add the npm script `"agent:rotate-logs": "node scripts/agent/rotate-logs.mjs"` inside the root `package.json`.
- [x] Integrate the log rotation script into `scripts/agent/check.ps1` and `scripts/agent/check.sh` so that it automatically runs at the end of successful agent check runs.
- [x] All workspace typechecks (`pnpm build`), linting (`pnpm run agent:lint`), and tests (`pnpm test`) must pass cleanly.

## Implementation Approach

1. **Log Rotator Core (`scripts/agent/rotate-logs.mjs`):**
   - Use standard Node `fs` and `path` modules.
   - Implement an encoding detector to read either UTF-8 or UTF-16LE format.
   - Implement sanitization function with clean regular expressions to redact secrets while preserving logging context (e.g., matching bearer tokens, JWTs, PEM private keys, and generic JSON/URL password/token pairs).
   - If size > 2,000,000 bytes, shift files `.1`, `.2`, `.3` (safely handling cases where files don't exist yet) and write the sanitized log to `.1.log`, then truncate `test_output.log`.
   - If size <= 2MB, overwrite `test_output.log` in place with the sanitized content.
2. **Integration:**
   - Add `"agent:rotate-logs"` to `package.json` scripts.
   - Edit `scripts/agent/check.ps1` to call `node scripts/agent/rotate-logs.mjs` at the end.
   - Edit `scripts/agent/check.sh` to call `node scripts/agent/rotate-logs.mjs` at the end.
3. **Validation & Verification:**
   - Run `node scripts/agent/rotate-logs.mjs` on dummy/mock logs with simulated tokens to verify regex accuracy and rotation bounds.

## Test Strategy

- **Manual Verification:** Create a mock `test_output.log` containing simulated Bearer token strings, JWT strings, and large text padding. Verify that:
  1. The tokens are correctly replaced by `[REDACTED_SECRET]` / `[REDACTED_JWT_TOKEN]`.
  2. The file is rotated to `test_output.1.log` if size exceeds 2MB.
  3. The script exits with `0` under all standard conditions.
- **Suite Verification:** Run the full `pnpm run agent:check` sequence.

## Rollback

- Revert changes via:
  ```bash
  git restore package.json scripts/agent/check.ps1 scripts/agent/check.sh
  rm -f scripts/agent/rotate-logs.mjs
  ```
