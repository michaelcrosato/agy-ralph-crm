# Specification: E-Signature Integration & Document Signing API - Verification

## 1. Concrete Verification Commands

Execute the standard verification gates to ensure workspace linkages, types, and test suites are 100% stable:

```bash
# 1. Typecheck and lint validation
pnpm typecheck
pnpm lint

# 2. Execute unit & integration test suite
pnpm test:integration --run packages/testing/src/esignature.test.ts

# 3. Comprehensive verify gate
pnpm verify
```

## 2. Test Cases to Assert in Integration Suite
- **E-Signature Request CRUD**:
  - Insert new E-Signature settings linking to Opportunity or Contract.
  - Assert that missing both relation linkages fails request validation.
  - Verify requests belong strictly to the user's active tenant (`orgId`).
- **RLS Boundary Assertion**:
  - Assert that Org A's user cannot simulate or view E-Signature requests for Org B's user.
  - Assert that DB insertions for another tenant fail automatically with a tenant context mismatch error.
- **State Transitions**:
  - Assert invalid actions throw errors.
  - Assert correct status flow (`"sent"` -> `"viewed"` -> `"signed"`/`"declined"`).
  - Verify completed state updates `completedAt` timestamp.
