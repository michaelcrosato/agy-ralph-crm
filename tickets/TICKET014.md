# TICKET014: AI Attributes & Auto-Enrichment Background Worker

## Details
- **Status**: todo
- **Priority**: High
- **Goal**: Implement a background worker and REST endpoint to automatically calculate AI Attributes (summarization, ICP scoring, and competitor extraction) on CRM records.
- **Context**: Spec 071 describes establishing real-time background semantic enrichment for Contacts and Leads under strict tenant RLS isolation.

---

## Scope

### In Scope
- Build a central `AIAttributeService` background listener/worker that intercepts Contact and Lead mutations.
- Automatically calculate three standard AI attributes inside the record's `custom` JSONB block:
  1. `aiSummary` (a natural language synthesis of the record's primary fields, emails, and custom details).
  2. `icpScore` (a calculated score from `0` to `100` evaluating target company/industry suitability).
  3. `competitorMentions` (an array of extracted competitor names matching lead/domain details).
- Implement a deterministic offline mock AI provider executing NLP concept checks and regex rule models.
- Support an explicit force-recalculate trigger endpoint: `POST /api/leads/:id/enrich` and `POST /api/contacts/:id/enrich` scoped by tenant orgId.
- Create an integration test suite under `packages/testing/src/ai-enrichment.test.ts` verifying mutation triggers, calculation rules, and RLS boundary security.
- Maintain 100% type safety and zero linter warnings.

### Out of Scope
- Integrating remote OpenAI/Anthropic APIs requiring real paid credentials.

---

## Steps to Execute
1. Define the AI enrichment helper functions and mock model inside `packages/core/src/domain/shared/ai.ts` or a new domain subdirectory.
2. Build the `AIAttributeService` listener queue in `packages/core/src/domain/leads/` or similar, wired to mutation callbacks.
3. Add route endpoints `POST /api/leads/:id/enrich` and `POST /api/contacts/:id/enrich` under `apps/api/src/routes/`.
4. Implement `packages/testing/src/ai-enrichment.test.ts` validating auto-calculation, rule accuracy, manual endpoints, and RLS tenant isolation.
5. Verify via `pnpm verify` and `pnpm test`.

---

## Acceptance Criteria
- [ ] Record insertions and updates automatically trigger async background AI attributes calculation.
- [ ] Enriched attributes (`aiSummary`, `icpScore`, `competitorMentions`) are saved correctly inside the `custom` JSONB column.
- [ ] Tenant boundaries are strictly isolated (Tenant A enrichment worker never sees or accesses Tenant B context).
- [ ] All monorepo verification checks pass cleanly.
