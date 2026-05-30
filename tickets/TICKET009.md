# TICKET009: Automated Diagnostic Log Sanitizer & Workspace Rotator

## Details
- **Status**: completed
- **Priority**: Medium
- **Goal**: Implement a workspace diagnostics log rotation script (`scripts/agent/rotate-logs.mjs`) to auto-rotate, compress, and sanitize test output logs (`test_output.log`) exceeding 2MB, preventing context pollution for autonomous agents.
- **Context**: Large log files like `test_output.log` are heavy and can pollute token boundaries if they are accidentally scanned or included in workspace listings. Sanitizing secrets (e.g., matching env patterns or token strings) is critical for agent safety.

---

## Scope

### In Scope
- Create `scripts/agent/rotate-logs.mjs` in Node.js.
- Read `test_output.log` and check size.
- If it exceeds `2000000` bytes (2MB), rotate it to `test_output.1.log` (keeping up to 3 historic rotated files).
- Implement a regex filter to automatically replace potential API tokens, base64 private keys, or passwords with `[REDACTED_SECRET]` during log rotation.
- Integrate the script inside the root `package.json` as `"agent:rotate-logs"`.
- Hook this log rotation inside `scripts/agent/check.ps1` and `scripts/agent/check.sh` so it runs automatically at the end of successful validations.

### Out of Scope
- Creating physical database backup files or moving remote files.

---

## Technical Mappings

- **Likely Files**:
  - `package.json`
  - `scripts/agent/rotate-logs.mjs`
  - `scripts/agent/check.ps1`
  - `scripts/agent/check.sh`

---

## Steps to Execute
1. Develop `scripts/agent/rotate-logs.mjs` ensuring it handles missing files gracefully (no crash when `test_output.log` is absent).
2. Add regex patterns to find and scrub matching secret strings:
   - Match JWT-like tokens: `eyJhbGciOi...`
   - Match Bearer headers or API keys: `Bearer\s+[A-Za-z0-9\-\._~\+\/]+=*`
3. Map rotation logic: `log.3` deleted, `log.2` -> `log.3`, `log.1` -> `log.2`, `log` -> `log.1`.
4. Integrate the script into the `agent:rotate-logs` package script.
5. Hook the script call into `check.ps1` and `check.sh`.
6. Run `pnpm run agent:rotate-logs` and verify output.
7. Run `pnpm verify` to confirm formatting is clean.

---

## Acceptance Criteria
- [x] Log rotator handles absent `test_output.log` gracefully without non-zero exit codes.
- [x] Log files exceeding 2MB are successfully shifted and rotated up to index 3.
- [x] Detected token payloads are sanitized to `[REDACTED_SECRET]`.
- [x] Runs successfully in the agent verify checks pipeline.

---

## Commands
```bash
node scripts/agent/rotate-logs.mjs
pnpm run agent:check
```

---

## Risks & Notes
- **Risk**: Overwriting historic files if the shift index logic is out of order.
- **Note**: Ensure file writing uses robust synchronous streams or basic fs operations to maintain zero external dependencies.
