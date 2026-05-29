# Specification: Support Ticket Comments & Replies Management Engine - Implementation Plan

## 1. Database Implementation
- Add `ticketComments` table to `packages/db/src/schema.ts`.
- Export `ticketComments` in `packages/db/src/schema.ts` if not done automatically.
- Export `DBTicketComment` interface in `packages/db/src/index.ts`.
- Add `ticketComments` mock storage array to `store` object inside `packages/db/src/index.ts`.
- Add `ticketComments` CRUD wrapper methods to `dbStore` inside `packages/db/src/index.ts`.
- Update `dbStore.clear()` inside `packages/db/src/index.ts` to clear `store.ticketComments`.

## 2. Core Business Logic Implementation
- In `packages/core/src/index.ts`, add and export `TicketCommentInput` interface and `validateTicketCommentInput` function.

## 3. Hono API Routes Implementation
- In `apps/api/src/index.ts`, implement endpoints `POST /api/service/tickets/:id/comments` and `GET /api/service/tickets/:id/comments`.

## 4. Integration Tests
- Create `packages/testing/src/ticket-comments.test.ts` to test all ticket comment operations and tenant RLS isolation.

## 5. Verification Gate
- Run `pnpm verify` and verify that all lint checks, type checks, and tests pass cleanly.
