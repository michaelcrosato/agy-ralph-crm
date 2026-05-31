# TICKET016: Relationship Intelligence Engine (Next.js Dashboard Integration)

## Details
- **Status**: completed
- **Priority**: High
- **Goal**: Implement Next.js frontend interfaces and simulation panels mapping to BANT conversational qualification metrics.
- **Context**: Spec 073 describes establishing visual analytics panels, conversation logs, and dynamic RPC hook connections.

---

## Scope

### In Scope
- Create BANT analytics tracking visual components.
- Create conversation turn-by-turn chat history simulator components.
- Wire components to Hono RPC client and mount under Leads dashboard path.
- Maintain strict multi-tenant context boundaries.
- Ensure 100% build and Biome compliance.

### Out of Scope
- Modifying backend server logic or database schemas.

---

## Steps to Execute
1. Implement the BANT analytics status component in `apps/web/src/components/leads/BantAnalytics.tsx`.
2. Implement the conversational simulator UI in `apps/web/src/components/leads/ConversationSimulator.tsx`.
3. Wire both to the Leads page layout and typed `@crm/api-client`.
4. Verify Next.js build compiles successfully with zero warnings/errors.
5. Run workspace linter, typecheck, and validation checks.

---

## Acceptance Criteria
- [x] BANT qualification traits (Budget, Authority, Need, Timeline) are visualized with clean status badges and progress scores.
- [x] Simulated turn-by-turn chat logs are clearly displayed.
- [x] Typing a new message and submitting triggers the simulation loop and updates the scores immediately.
- [x] Strictly adheres to tenant JWT boundaries.
- [x] All build and verification checks pass green.
