# Specification: Accounts & Contacts REST API - Design

## API Routing Layout
We will declare the new endpoints inside `apps/api/src/index.ts`:

- `GET /api/accounts`
  - Retrieves lists of accounts using `dbStore.accounts.findMany()`.
  - Returns: `{ success: true, data: Account[] }`.
  
- `GET /api/accounts/:id`
  - Retrieves single account using `dbStore.accounts.findOne(id)`.
  - Returns: `{ success: true, data: Account }` or `404` error if null.

- `GET /api/contacts`
  - Retrieves lists of contacts using `dbStore.contacts.findMany()`.
  - Returns: `{ success: true, data: Contact[] }`.

- `GET /api/contacts/:id`
  - Retrieves single contact using `dbStore.contacts.findOne(id)`.
  - Returns: `{ success: true, data: Contact }` or `404` error if null.
