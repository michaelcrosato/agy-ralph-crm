# Specification: Support Ticket Comments & Replies Management Engine - Brief

## 1. Functional Objective
Customer support teams require the ability to collaborate and communicate on individual support tickets. Adding comments and replies directly to a ticket is crucial for tracking the progress, details, and conversation history between support agents and customers.

This feature introduces the **Support Ticket Comments & Replies Management Engine** under the `service-lite` module. The system will:
1. Allow tenants to post Comments/Replies on existing Support Tickets (`ticket_comments`).
2. Manage Comments containing a body text, relationship to the target ticket, author ID, and creation timestamp.
3. Expose REST endpoints to post a comment and list comments for a ticket under strict active tenant Row-Level Security (RLS) isolation.
4. Generate audit trails when comments are added to tickets.

## 2. Technical Scope
- **Database Schema**:
  - Add `ticketComments` table to `packages/db/src/schema.ts` and update the database store mappings and `clear` function in `packages/db/src/index.ts`.
- **Core Pure Logic**:
  - Implement `validateTicketCommentInput` in `packages/core/src/index.ts` to validate that the comment body is non-empty and well-formed.
- **REST Endpoints**:
  - `POST /api/service/tickets/:id/comments` - Creates a new comment/reply on a ticket, automatically assigning `authorId` to the current user.
  - `GET /api/service/tickets/:id/comments` - Returns all comments for a specific ticket under the active tenant.
- **Tenant RLS & Security**:
  - All operations must run strictly within the active tenant's context (`orgId`). A tenant must never see, modify, or insert comments belonging to another organization or ticket.
- **Verification & Integration Tests**:
  - Write integration tests inside `packages/testing/src/ticket-comments.test.ts` validating comment creation, ticket matching, retrieval, and tenant RLS isolation.
