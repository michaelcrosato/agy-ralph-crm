# Specification: Contact Consent & GDPR Compliance API - Verification

## 1. Local Command Gate

To verify this implementation, execute the following command at the repository root:

```bash
pnpm verify
```

This will run Turborepo's complete compilation, linting, and typechecking verification pipelines, along with executing the complete unit and integration test suite (including our newly written `contact-consent.test.ts` integration test).

## 2. Test Execution Focus

You can run the specific test suite directly to ensure local development cycle loops are ultra-fast:

```bash
pnpm --filter @crm/testing test -- src/contact-consent.test.ts
```
