# Task 0123: Opportunity Splits & Multi-Rep Commission Allocation - Requirements

## 1. Functional Requirements

### 1.1 Opportunity Splits CRUD
- The system must support creating, reading, and deleting opportunity splits under `opportunity_splits` table.
- An opportunity split must associate a unique ID, an `orgId`, an `opportunityId`, a `userId` (split recipient), a `percentage` (0 to 100), and a calculated `splitAmount`.
- When updating or setting splits, the total sum of split percentages for an opportunity must be exactly 100%.

### 1.2 Multi-Representative Commission Calculation
- When splits are defined/updated on a Closed Won opportunity, the system must automatically calculate commissions for *each* split member.
- The commission for a split member must be calculated based on their individual `splitAmount` instead of the full opportunity amount.
- Attainment calculations and quota checks must be executed against each user's closed-won totals as defined in the commissions package.

### 1.3 REST API endpoints
- Register Hono routes in `apps/api`:
  - `POST /api/opportunities/:id/splits` - Define or overwrite opportunity splits.
    - Body: `splits: { userId: string, percentage: number }[]`
    - Validates that splits sum to 100%.
    - Updates commission records for all split participants.
  - `GET /api/opportunities/:id/splits` - Retrieve opportunity splits.
  - `DELETE /api/opportunities/:id/splits` - Delete splits, reverting commissions back to 100% for the opportunity owner.

### 1.4 Audit Logging
- Defining, updating, or reverting opportunity splits must write a record in `audit_logs` detailing the action and split percentages configured.

---

## 2. Row-Level Security & Multi-Tenancy

- **RLS Tenancy Verification**: Tenant context must be propagated at the store level.
- **Cross-Tenant Prevention**: An organization can never query, insert, or delete opportunity splits belonging to another organization.
- **Reference Validation**: Inserting an opportunity split must fail if the referenced `opportunityId` or `userId` belongs to a different organization context.

---

## 3. Technical Constraints

- **Pure Business Logic**: Split validation and allocation logic must be pure exported functions in `packages/core`.
- **Slim Files**: File lengths must comply with standard line budget limits.
- **Verification Gate**: The workspace must compile cleanly, with all Vitest tests passing under `pnpm verify`.
