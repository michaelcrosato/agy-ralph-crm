# 072 — Conversational AI Lead Qualification Bot

**Phase:** 5 · **Priority:** High · **Status:** `[ ] Todo` · **Depends on:** 013, 014, 025, 047, 071

## Description & Expected Impact
Enterprise CRM systems require autonomous qualification workflows to engage leads instantly.
This specification details a robust `ConversationalBotService` background worker and REST endpoints that listen to inbound communication (recorded as `email` or `sms` activities linked to a Lead), evaluate the lead's messages using an offline BANT (Budget, Authority, Need, Timeline) semantic rules engine, update lead custom attributes, transition the lead status dynamically, and generate simulated outbound conversational follow-up questions.

Outbound communication remains strictly mocked by creating activity records inside the database, guaranteeing that no external messaging providers are contacted during testing or execution.

## Definition of Done & Acceptance Criteria
- [ ] Create a robust conversational rules engine evaluating conversation history for BANT categories (Budget, Authority, Need, Timeline).
- [ ] Implement `ConversationalBotService` that automatically processes a lead's qualification state when a new inbound `email` or `sms` activity is linked to a Lead.
- [ ] Persist extracted BANT traits (`bantBudget`, `bantAuthority`, `bantNeed`, `bantTimeline`), qualification score (`bantScore`), and current bot response state inside `lead.custom`.
- [ ] Automatically transition `lead.status` to `Qualified` when the calculated `bantScore` exceeds 80, or `Disqualified` if explicit mismatch signals are parsed.
- [ ] Generate an outbound conversational reply activity (e.g., asking for the next missing BANT parameter) linked to the Lead if more context is required, strictly avoiding external network calls.
- [ ] Expose OpenAPI-compliant endpoints:
  - `POST /api/leads/:id/conversation/simulate` (simulates an inbound message from the lead to trigger the qualification loop)
  - `GET /api/leads/:id/conversation/status` (retrieves the current extracted BANT state and message log)
- [ ] Authored comprehensive integration tests in `packages/testing/src/conversational-bot.test.ts` verifying multi-turn qualification, auto-conversion, and strict RLS tenant isolation.
- [ ] Maintain 100% type safety and green passing status across all verify/build/test gates.

## Implementation Approach
1. **BANT Semantic Rule Model**: Create `packages/core/src/domain/leads/bot.ts` implementing `evaluateBantState(history: DBActivity[])`:
   - Parse texts of linked activities for indicators:
     - **Budget**: Look for dollar amounts or numbers (> $5,000, > 10k, budget is 20k -> high score; no budget, zero dollar, free -> disqualified).
     - **Authority**: Look for professional roles or decision power (VP, Director, Founder, CEO, CTO, "decision maker", "make the choice" -> high; intern, student, evaluator, "no say" -> low).
     - **Need**: Look for core CRM value drivers ("needs multi-tenant", "scaling operations", "sequences", "sales automation" -> high).
     - **Timeline**: Look for conversion speeds ("3 months", "ASAP", "this quarter", "immediate" -> high; "next year", "someday", "just browsing" -> low).
   - Generate natural language follow-up queries based on the first missing BANT parameter (e.g. if budget is missing: "Could you tell me more about your planned budget for this implementation?").
2. **Dynamic Store Hooks Integration**:
   - Update `packages/db/src/index.ts` (the mutation hook listener registry) to trigger the `ConversationalBotService` when a new activity is inserted/updated.
3. **Conversational bot Service**:
   - Create `packages/core/src/domain/leads/bot-service.ts` managing the transaction-locked enrichment queue.
   - Restrict updates to non-bot mutations using a thread-safe transaction-level exclusion set.
   - Run under database org RLS context boundaries using `withTenant(orgId, ...)`.
4. **Hono OpenAPI Routes**:
   - Expose the simulated incoming trigger path `/api/leads/:id/conversation/simulate` and the status getter `/api/leads/:id/conversation/status` inside the leads routing package.
5. **Integration Testing**:
   - Write `packages/testing/src/conversational-bot.test.ts` checking positive/negative qualifications, conversational progress, and strict multi-tenant boundaries.

## Test Strategy
- **BANT Evaluation Rule**: Validate that mock incoming SMS/emails correct trigger correct budget, authority, and need ratings.
- **Simulated Conversational Turns**: Assert that a sequence of simulated client inputs triggers automatic BANT score progression and corresponding bot activity creations.
- **Lead Dynamic Status Updates**: Confirm lead transitions cleanly to `Qualified` once all four parameters are verified.
- **Tenant Isolation**: Verify Tenant B's bot never processes Tenant A's messages or updates Tenant A's leads.

## Rollback
- Disable hooks inside `packages/db/src/index.ts` and revert endpoint mounts.
