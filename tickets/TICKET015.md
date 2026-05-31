# TICKET015: Conversational AI Lead Qualification Bot

## Details
- **Status**: completed
- **Priority**: High
- **Goal**: Implement a conversational bot evaluating BANT criteria over simulated email and SMS conversations inside the multi-tenant CRM.
- **Context**: Spec 072 describes establishing an offline BANT rule engine, mutation-driven qualification service, and REST simulation endpoints.

---

## Scope

### In Scope
- Create `packages/core/src/domain/leads/bot.ts` implementing offline BANT semantic checks and bot response generator.
- Create `packages/core/src/domain/leads/bot-service.ts` to manage the qualification queue, wired to db mutation listeners.
- Expose Hono REST endpoints:
  - `POST /api/leads/:id/conversation/simulate` (Simulate an inbound client message)
  - `GET /api/leads/:id/conversation/status` (Retrieve extracted BANT profile and logs)
- Support strict organization-level RLS context binding inside the background worker.
- Mock all outbound communication by creating db activities without external network requests.
- Author `packages/testing/src/conversational-bot.test.ts` validating BANT extraction, turns, auto-qualification, and tenant boundaries.
- Ensure 100% Biome formatting, linting, and compile success.

### Out of Scope
- Integrating live SendGrid or Twilio services.
- Altering core PostgreSQL table schemas.

---

## Steps to Execute
1. Implement the BANT rule engine and reply generator in `packages/core/src/domain/leads/bot.ts`.
2. Implement the `ConversationalBotService` background queue in `packages/core/src/domain/leads/bot-service.ts`.
3. Register the bot listener inside `packages/db/src/index.ts` alongside existing mutation callbacks.
4. Mount simulated endpoints `POST /api/leads/:id/conversation/simulate` and `GET /api/leads/:id/conversation/status` in the Hono leads routing package.
5. Create `packages/testing/src/conversational-bot.test.ts` with comprehensive unit and integration test assertions.
6. Verify formatting, linting, typescript build, and all vitest checks run successfully.

---

## Acceptance Criteria
- [x] Record mutations (new activities linked to leads) automatically trigger async conversational BANT analysis.
- [x] Extracted traits (`bantBudget`, `bantAuthority`, `bantNeed`, `bantTimeline`), qualification score (`bantScore`), and bot chat state are stored in `custom` JSONB.
- [x] Lead `status` auto-transitions to `Qualified` when `bantScore` exceeds 80.
- [x] The bot generates conversational follow-up activities in the database asking for missing criteria when incomplete.
- [x] Dynamic RLS tenant boundaries are perfectly maintained (no cross-tenant leakage).
- [x] All verification build and test gates are entirely green.
