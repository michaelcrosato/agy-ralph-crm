# 071 — AI Attributes & Auto-Enrichment Background Worker

**Phase:** 5 · **Priority:** High · **Status:** `[ ] Todo` · **Depends on:** 013, 014, 025, 047

## Description & Expected Impact
Modern CRM platforms like Attio and HubSpot provide "AI Attributes" to automatically synthesize and classify customer/lead data without manual manual data entry.
This specification details a robust, real-time background enrichment service (`AIAttributeService`) that listens to Contact and Lead mutations, computes custom semantic fields (`aiSummary`, `icpScore`, `competitorMentions`), and stores them inside the record's `custom` JSONB block under strict database organization-level RLS boundaries.

## Definition of Done & Acceptance Criteria
- [ ] Create an offline-capable NLP rules engine simulating advanced keyword semantic summarization, competitor extraction, and ICP rating.
- [ ] Establish `AIAttributeService` in `packages/core` that automatically triggers async queue processing on any database insert/update of Contacts and Leads.
- [ ] Enforce database multi-tenant safety by ensuring all async background queries execute strictly under the record's org context (`withTenant(item.orgId, ...)`).
- [ ] Expose manual trigger endpoints `POST /api/leads/:id/enrich` and `POST /api/contacts/:id/enrich` fully verified by RBAC.
- [ ] Implement robust integration tests inside `packages/testing/src/ai-enrichment.test.ts` verifying triggers, NLP classification accuracy, and strict RLS tenant isolation.
- [ ] Maintain 100% green passing status across all checks.

## Implementation Approach
1. **Offline NLP Rule Engine**: Create `packages/core/src/domain/shared/ai.ts` exporting `enrichRecordAttributes(entityType: string, record: any)`.
   - `aiSummary`: Generate a structured description, summarizing email domains, contact names, and active company details.
   - `icpScore`: Calculate suitability from `0` to `100` based on industry indicators (e.g. `tech`, `finance`, `software` -> high; `retail`, `hobby` -> low) and email domain properties.
   - `competitorMentions`: Parse text details and extract standard competitors (e.g. matching keywords "HubSpot", "Salesforce", "Twenty" -> ["HubSpot", "Salesforce", "Twenty"]).
2. **Dynamic Store Hooks**:
   - Update `packages/db/src/index.ts`'s mutation callback listener to trigger the `AIAttributeService` queue whenever a Contact or Lead is added/changed.
   - Store active listener hooks inside the `globalThis` mutation callback bridge.
3. **Async Queue Worker**:
   - Process enrichment jobs asynchronously inside `packages/core/src/domain/leads/ai-worker.ts`.
   - Wrap persistence calls inside `withTenant` blocks to preserve tenant safety.
4. **Hono REST Routes**:
   - Wire explicit REST paths `POST /api/leads/:id/enrich` and `POST /api/contacts/:id/enrich` executing immediate force recalculations under RBAC boundaries.
5. **Integration Testing**:
   - Write `packages/testing/src/ai-enrichment.test.ts` executing targeted checks.

## Test Strategy
- **NLP Rule Correctness**: Assert specific ICP values and correct competitor arrays are produced.
- **Async Verification**: Insert a record, wait for the tick, and verify custom JSONB parameters are populated.
- **Tenant Isolation**: Confirm that the background worker never accesses crossed tenant contexts or leaks attributes across orgs.

## Rollback
- Disable hooks inside `packages/db/src/index.ts` and revert endpoint mounts.
