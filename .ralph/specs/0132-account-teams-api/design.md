# Spec 0132: Account Teams & Collaboration Roles Design

## 1. Database Schema (`packages/db/src/schema.ts`)

We will define the `accountTeams` table schema mapping accounts to collaborative team members.

```typescript
export const accountTeams = pgTable("account_teams", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // "Account Manager" | "Sales Engineer" | "Customer Success Manager" | "Executive Sponsor" | "Other"
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

## 2. Store Interfaces (`packages/db/src/index.ts`)

We will extend `dbStore` with a new `accountTeams` store object implementing tenant-isolated operations:

```typescript
export interface AccountTeamMember {
  id: string;
  orgId: string;
  accountId: string;
  userId: string;
  role: string;
  createdAt: Date;
}

// In the DbStore initialization:
accountTeams: {
  findMany: () => Promise<AccountTeamMember[]>,
  findForAccount: (accountId: string) => Promise<AccountTeamMember[]>,
  insert: (data: Omit<AccountTeamMember, "id" | "createdAt">) => Promise<AccountTeamMember>,
  update: (id: string, data: Partial<Omit<AccountTeamMember, "id" | "createdAt">>) => Promise<AccountTeamMember>,
  delete: (id: string) => Promise<void>,
}
```

## 3. Core Logic Contract (`packages/core/src/index.ts`)

We will add the following validation method to the core package:

```typescript
export const SUPPORTED_TEAM_ROLES = [
  "Account Manager",
  "Sales Engineer",
  "Customer Success Manager",
  "Executive Sponsor",
  "Other"
];

export function validateAccountTeamMember(
  accountId: string,
  userId: string,
  role: string,
): { success: boolean; error?: string } {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!accountId || !uuidRegex.test(accountId)) {
    return { success: false, error: "Invalid Account ID format." };
  }
  if (!userId || !uuidRegex.test(userId)) {
    return { success: false, error: "Invalid User ID format." };
  }
  if (!SUPPORTED_TEAM_ROLES.includes(role)) {
    return { success: false, error: `Invalid role. Supported roles are: ${SUPPORTED_TEAM_ROLES.join(", ")}` };
  }
  return { success: true };
}
```

## 4. REST API Endpoint Mapping (`apps/api/src/index.ts`)

### `GET /api/accounts/:id/team`
Returns all team members assigned to the account.
- **Middleware**: `tenantAuth`
- **Output**: `200 OK` with JSON array of team members.

### `POST /api/accounts/:id/team`
Adds a team member to an account or updates their role if they are already assigned.
- **Middleware**: `tenantAuth`
- **Request Body**:
  ```json
  {
    "userId": "uuid-here",
    "role": "Sales Engineer"
  }
  ```
- **Output**: `201 Created` or `200 OK` with updated team member record.

### `DELETE /api/accounts/:id/team/:userId`
Removes a team member from the account.
- **Middleware**: `tenantAuth`
- **Output**: `200 OK` with `{ success: true }`.
