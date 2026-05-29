# TICKET002: Automated Agent Utility Scripts

## Details
- **Status**: completed
- **Priority**: High
- **Goal**: Create highly repeatable, atomic, non-interactive shell scripts under `scripts/agent/` and register them as pnpm scripts to verify the codebase state quickly.
- **Context**: AFK autonomous agents need deterministic pipelines that print status and exit non-zero on compiler, linter, typecheck, or test failures.

---

## Scope

### In Scope
- Create scripts: `bootstrap.sh`, `doctor.sh`, `check.sh`, `test.sh`, `lint.sh`, `typecheck.sh`, `format.sh`, `status.sh` in `scripts/agent/` folder.
- Ensure all scripts use `set -euo pipefail` and detect the workspace package manager (`pnpm`).
- Map package.json scripts to these commands using `"agent:*"` patterns.

### Out of Scope
- Writing OS-destructive scripts or executing remote push operations.

---

## Technical Mappings

- **Likely Files**:
  - `package.json`
  - `scripts/agent/bootstrap.sh`
  - `scripts/agent/doctor.sh`
  - `scripts/agent/check.sh`
  - `scripts/agent/test.sh`
  - `scripts/agent/lint.sh`
  - `scripts/agent/typecheck.sh`
  - `scripts/agent/format.sh`
  - `scripts/agent/status.sh`

---

## Steps to Execute
1. Write the agent utility scripts under `scripts/agent/` with clean formatting, path variables, and execution gates.
2. Update the root `package.json` with `"agent:*"` script mappings.
3. Test every script locally using Git Bash or standard shell environments.

---

## Acceptance Criteria
- [x] Every agent script exists under `scripts/agent/` and exits non-zero on real compilation or testing failure.
- [x] Package.json scripts expose the utility helpers cleanly.
- [x] Absent engines or gates print `"no X found"` or `"not found"` rather than crashing.

---

## Verification Commands
```bash
pnpm run agent:check
pnpm run agent:status
```

---

## Risks & Notes
- **Risk**: Line endings (CRLF vs LF) on Windows systems.
- **Note**: Ensure all `.sh` scripts use LF line endings for maximum portability across Unix/Windows containers.
