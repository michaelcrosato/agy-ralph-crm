# RISK REGISTER & ROLLBACK PLANS (RISK_REGISTER.md)

This registry catalogs critical engineering risks, mitigation procedures, and rollback plans for overnight autonomous agent feature generation.

---

## 1. Active Risk Mappings

### Risk 1: Tenant Context Leakage (Bypassing RLS)
- **Severity**: Critical
- **Likelihood**: Low
- **Mitigation**: Property-based RLS tests generating multiple random organizations to verify query isolation.
- **Rollback**: Immediately revert the offending core or API commit and execute `pnpm test` to restore sanity.

### Risk 2: TypeScript Compilation Failure (Type Drift)
- **Severity**: High
- **Likelihood**: Medium
- **Mitigation**: Pre-flight compiler verification `pnpm verify` run before every branch push.
- **Rollback**: Revert to the last clean compile state via `git checkout -f HEAD~1`.

---

## 2. General Rollback Guidelines

If the pre-flight checks fail on any task execution loop, the autonomous subagent must immediately:
1. Revert changes locally via `git restore .` and `git clean -df`.
2. Terminate the execution stack and exit non-zero to prevent pushing broken files.
3. Record the failure in `afk_error.log` with a trace of the compiler output.
