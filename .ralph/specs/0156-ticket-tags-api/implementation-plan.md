# Specification: Support Ticket Tags & Categorization Engine - Implementation Plan

## 1. Database Implementation
- Add `ticketTags` and `ticketTagLinks` tables to `packages/db/src/schema.ts`.
- Export `DBTicketTag` and `DBTicketTagLink` interfaces in `packages/db/src/index.ts`.
- Add mock storage arrays `ticketTags` and `ticketTagLinks` to the `store` object inside `packages/db/src/index.ts`.
- Add CRUD wrapper mappings for `ticketTags` and `ticketTagLinks` in `dbStore` inside `packages/db/src/index.ts`.
- Update `dbStore.clear()` inside `packages/db/src/index.ts` to reset `store.ticketTags` and `store.ticketTagLinks`.

## 2. Core Business Logic Implementation
- In `packages/core/src/index.ts`, add and export `TicketTagInput` interface and `validateTicketTagInput` function.

## 3. Hono API Routes Implementation
- In `apps/api/src/index.ts`, implement endpoints:
  - `POST /api/service/tags` (create a tag)
  - `GET /api/service/tags` (list all tags)
  - `POST /api/service/tickets/:id/tags` (link a tag to a ticket)
  - `DELETE /api/service/tickets/:id/tags/:tagId` (unlink a tag from a ticket)
  - `GET /api/service/tickets/:id/tags` (list tags linked to a ticket)

## 4. Integration Tests
- Create `packages/testing/src/ticket-tags.test.ts` to test all ticket tag operations, deduplication, idempotency, and tenant RLS isolation.

## 5. Verification Gate
- Run `pnpm verify` and verify that all lint checks, type checks, and tests pass cleanly.
