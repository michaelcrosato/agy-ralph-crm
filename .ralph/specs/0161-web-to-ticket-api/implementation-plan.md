# Task 0161: Public Web-to-Ticket Capture API - Implementation Plan

## Step 1: Endpoint Scaffolding in API
- Open `apps/api/src/index.ts`.
- Find a suitable location near the `/api/public/web-to-lead` endpoint (around line 308).
- Scaffold the `POST /api/public/web-to-ticket` endpoint.
- Implement input validation:
  - Assert that `orgId`, `subject`, `body`, and `email` are provided.
  - Return `400 Bad Request` if any are missing.
  - Verify that the target `orgId` exists by querying organizations (using `dbStore.organizations.findMany()` or checking if it exists in the organization list).

## Step 2: Contact Matching and Creation
- Wrap subsequent operations inside `withTenant(orgId, mockDb, async () => { ... })`.
- Fetch all contacts inside the active RLS context:
  - `const contacts = await dbStore.contacts.findMany();`
  - Find a contact with `c.email === email`.
- If found:
  - Store `contactId = contact.id`.
  - Set `contactCreated = false`.
- If NOT found:
  - Call `dbStore.contacts.insert({ orgId, email, firstName: firstName || null, lastName: lastName || 'Web Contact', custom: null })`.
  - Log audit trail for contact creation:
    - Action: `"create"`, RecordType: `"Contact"`, changes: `null`.
  - Store the resulting contact's ID.
  - Set `contactCreated = true`.

## Step 3: Custom Ticket Fields Validation
- If `custom` fields are provided:
  - Fetch field definitions: `dbStore.fieldDefinitions.findMany()`
  - Filter for definitions where `objectType === 'tickets'`.
  - Validate the `custom` fields against these definitions using `validateCustomFields`.
  - If invalid, throw or return `400 Bad Request` with the validation errors list.

## Step 4: Assignment Rules Evaluation
- Fetch active assignment rules for tickets:
  - `const rules = await dbStore.ticketAssignmentRules.findMany();`
  - Find an active rule: `rules.find(r => r.isActive === 1)`.
- If an active rule is found:
  - Fetch rule entries: `dbStore.ticketAssignmentRuleEntries.findMany()`.
  - Sort entries by `sortOrder`.
  - Compile the ticket structure:
    - `{ subject, body, priority, custom, email, firstName, lastName }`
  - Evaluate routing using `evaluateTicketAssignment(evalTicket, activeEntries)`.
  - If a match is found:
    - Assign the ticket to `matchResult.newAssignedToId`.
    - If `routingMethod === 'round_robin'`, update `lastAssignedIndex` on the matched entry.
- If no active rule matches or exists:
  - Assign the ticket to the provided `assignedToId` in the payload (if it matches an existing user).
  - If still unassigned, fall back to `"user-system"`.

## Step 5: Ticket Insertion & Audit Trail
- Call `dbStore.tickets.insert({ orgId, contactId, subject, status: 'Open', priority, assignedToId, custom })` or store the ticket description in custom metadata/body. (Wait, the `tickets` table has `id`, `orgId`, `contactId`, `subject`, `status`, `priority`, `assignedToId`. Let's save `body` in custom metadata or as a dynamic field since Drizzle tickets schema doesn't have a direct `body` column, or check if we can save it in custom JSONB, wait, wait! Let's check if the `tickets` table in `packages/db/src/schema.ts` has a body column or custom column, wait, in line 199 it didn't have a `body` column, so we should save the body in the custom JSONB or see how other tickets are created).
- Log an audit trail for the ticket creation:
  - Action: `"create"`, RecordType: `"Ticket"`, changes: `null`.
- Trigger outbound webhooks with the event `ticket.created` asynchronously.
- Return a success response `201 Created` with the new ticket record and the `contactCreated` flag.

## Step 6: Verification Tests
- Create `packages/testing/src/web-to-ticket.test.ts`.
- Write tests that:
  - Post to the public route.
  - Verify contact matching.
  - Verify new contact creation and its audit logs.
  - Verify custom fields validation.
  - Verify ticket assignment rule matching (direct and round-robin).
  - Verify active tenant RLS context isolation.
  - Verify `pnpm verify` passes cleanly.
