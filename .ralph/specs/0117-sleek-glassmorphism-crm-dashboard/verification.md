# Specification: Sleek Glassmorphism CRM Dashboard Portal - Verification

## 1. Verification Scripts

The verification pipeline requires running type safety checks, linter checks, and integration tests to confirm the dashboard features are fully functional.

```bash
# 1. Biome Linter Verification
pnpm biome check .

# 2. TypeScript Compilation Verification
pnpm typecheck

# 3. Integration & API Tests Execution
pnpm test
```

## 2. Test Coverage Criteria
- **Auth Endpoint Test**: Verify `/api/auth/token` accepts requests and returns valid signed JWT tokens.
- **Tenant Isolation Test**: Verify that exchanging the JWT token swaps active DB contexts cleanly under transaction borders.
