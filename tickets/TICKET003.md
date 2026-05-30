# TICKET003: Marketing Sequence Call Actions & Bug Resolution

## Details
- **Status**: completed
- **Priority**: Critical
- **Goal**: Implement the new outbound `"call"` stepType, validate its schema persistence, execute personalization scripts, and fix testing suite regressions.
- **Context**: Completes Task 0222 in `.ralph/specs/` to allow full CRM call sequence automations under strict active tenant organization RLS security boundaries.

---

## Scope

### In Scope
- Add `callScript` text field to `marketingSequenceSteps` table in `packages/db/src/schema.ts` and `DBMarketingSequenceStep` types.
- Extend `executePendingSequenceSteps` in `packages/core/src/index.ts` to execute Call steps, logging `"call"` CRM Activities and linked target Lead/Contact records.
- Implement Zod-like string validation for `/api/sequences/:id/steps` in `apps/api/src/index.ts` to require a non-empty `callScript` for stepType: `"call"`.
- Write rigorous integration test suites in `packages/testing/src/marketing-sequence-call-actions.test.ts`.

### Out of Scope
- Mutating any other unrelated marketing sequence steps or email delivery channels.

---

## Technical Mappings

- **Likely Files**:
  - `packages/db/src/schema.ts`
  - `packages/db/src/index.ts`
  - `packages/core/src/index.ts`
  - `apps/api/src/index.ts`
  - `packages/testing/src/marketing-sequence-call-actions.test.ts`

---

## Steps to Execute
1. Update database schemas and mock types to include `callScript` and the `"call"` stepType.
2. Update the Hono REST API routing endpoint to support validations and persistence.
3. Update the sequence execution engine to trigger personalizations and activities linking under tenant isolation.
4. Run targeted integration tests using Vitest to verify all endpoints, active tenant isolation contexts, and schema integrations.

---

## Acceptance Criteria
- [x] Schema schema updates compile and build workspace without type errors.
- [x] POST step endpoint rejects stepType: `"call"` if callScript is missing or empty.
- [x] execute pending sequence steps advances sequence memberships and creates a personalized outbound Call Activity mapped to the correct recipient.
- [x] Strict Row-Level Security property-based isolation context blocks cross-tenant leaks.

---

## Commands
```bash
npx vitest run packages/testing/src/marketing-sequence-call-actions.test.ts
pnpm verify
```

---

## Risks & Notes
- **Risk**: Context leak if organizations share the database state without transaction leveltenant session bounds.
- **Note**: Ensure `withTenant` handles organization variable context encapsulation securely.
