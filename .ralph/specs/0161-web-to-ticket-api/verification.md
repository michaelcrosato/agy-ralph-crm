# Task 0161: Public Web-to-Ticket Capture API - Verification

## 1. Automated Verification Command
To verify that this task is complete, run:
```bash
pnpm verify && npx vitest run packages/testing/src/web-to-ticket.test.ts
```

## 2. Manual Verification Checklist
- [ ] Post a request to `POST /api/public/web-to-ticket` for a valid tenant org with a new email address. Assert that a new contact and a new ticket are created and linked.
- [ ] Post a request for the same email address. Assert that no new contact is created, and the ticket is linked to the existing contact.
- [ ] Setup ticket assignment rules for round-robin routing. Post consecutive requests and assert that tickets are assigned to users in a round-robin fashion, with rule entry indices updating.
- [ ] Post a request with invalid custom fields. Assert that a `400` validation error is returned.
- [ ] Post a request with an invalid or non-existent `orgId`. Assert that a `400` error is returned and no records are modified.
- [ ] Confirm RLS security by checking that database stores throw tenant mismatch errors if records are inserted with conflicting tenant IDs.
