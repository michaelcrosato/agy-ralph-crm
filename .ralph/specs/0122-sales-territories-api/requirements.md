# Task 0122: Sales Territories & Account Routing Engine - Requirements

## 1. Functional Requirements

### 1.1 Territory Definition & CRUD
- The system must support creating, reading, updating, and deleting territories under `territories` table.
- A territory must have a unique ID, an `orgId`, a `name`, an `isActive` status flag (0 = inactive, 1 = active), and a `criteria` configuration containing matching rules for accounts.
- The criteria must be structured as an array of matching conditions:
  - `field`: string (e.g. `country`, `state`, `industry`, or `custom.something`)
  - `operator`: `"equals" | "contains" | "greater_than" | "less_than"`
  - `value`: string

### 1.2 Territory Member Management
- Each territory can have multiple members (`territory_members` table).
- A member association must contain `id`, `orgId`, `territoryId`, `userId`, and `role` (e.g., `"Primary" | "Overlay"`).
- API endpoints must exist to add and remove users from a territory.

### 1.3 Account Routing Evaluation
- The core routing engine must implement a pure evaluation function `evaluateTerritoryRouting(account, territories, members)` in `packages/core`.
- The evaluation must sort territories by a sort order or evaluate active ones sequentially.
- For a matching territory:
  - If it has members, it must support routing to the Primary member or distributing via a round-robin style round-robin queue amongst primary members, or simply assigning to the primary member with role `"Primary"`.
  - Specifically, if `routingMethod` is `"round_robin"`, it should route to the next primary member in the member list based on `lastAssignedIndex` field on the territory.
  - If `routingMethod` is `"direct"`, it should assign to the first primary member in the member list.
  - If no members exist, it should keep the existing account owner.

### 1.4 REST API & Integration
- Register Hono endpoints under `apps/api`:
  - `POST /api/territories` - Create a territory
  - `PUT /api/territories/:id` - Update a territory
  - `GET /api/territories` - List active tenant territories
  - `POST /api/territories/:id/members` - Add a territory member
  - `DELETE /api/territories/:id/members/:userId` - Remove a territory member
  - `POST /api/accounts/:id/route` - Evaluate active territories and automatically assign/route the account, updating its `ownerId` and custom territory field if matched.

### 1.5 Audit Logs
- When an account is successfully routed to a territory, an immutable audit log entry must be created detailing the `changes` (before/after for ownerId and territory).

---

## 2. Row-Level Security & Multi-Tenancy

- **Hard Multi-Tenant Isolation**: RLS must be fully active on all database store interactions.
- **Tenant Mismatch Failure**: Direct inserts or mutations on territories/members of a different org must throw an RLS Isolation Violation error.
- **Query Restriction**: Queries to list territories or members must return only records belonging to the active tenant.

---

## 3. Technical Constraints & Verification

- **Pure Functions**: The territory evaluation logic must be stateless and implemented as pure exported functions in `packages/core`.
- **Slim Files**: Maintain file sizes under the 400-line budget limit.
- **Clean Biome Lints**: The workspace must compile and lint checks pass cleanly using `pnpm verify`.
