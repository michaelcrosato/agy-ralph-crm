# Specification: Opportunity Teams & Collaborative Roles API - Design

## 1. Relational Database Additions (`packages/db/src/schema.ts`)

```typescript
export const opportunityTeams = pgTable("opportunity_teams", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  opportunityId: uuid("opportunity_id").notNull().references(() => opportunities.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

*Note*: Corresponding in-memory stubs must be added to `packages/db/src/index.ts` under `store` and `dbStore` interfaces to support fast unit/integration testing without requiring a live Postgres database instance.

## 2. Core Billing Functions (`packages/core/src/index.ts`)

```typescript
export const SUPPORTED_OPPORTUNITY_TEAM_ROLES = [
  "Opportunity Owner",
  "Sales Representative",
  "Sales Engineer",
  "Executive Sponsor",
  "Other",
];

export function validateOpportunityTeamMember(
  opportunityId: string,
  userId: string,
  role: string,
): { success: boolean; error?: string } {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const mockRegex = /^(opportunity|user|team)-[a-z0-9]+$/i;

  if (!opportunityId || (!uuidRegex.test(opportunityId) && !mockRegex.test(opportunityId))) {
    return { success: false, error: "Invalid Opportunity ID format." };
  }
  if (!userId || (!uuidRegex.test(userId) && !mockRegex.test(userId))) {
    return { success: false, error: "Invalid User ID format." };
  }
  if (!SUPPORTED_OPPORTUNITY_TEAM_ROLES.includes(role)) {
    return {
      success: false,
      error: `Invalid role. Supported roles are: ${SUPPORTED_OPPORTUNITY_TEAM_ROLES.join(", ")}`,
    };
  }
  return { success: true };
}
```

## 3. Hono API Routes (`apps/api/src/index.ts`)

- **GET `/api/opportunities/:id/team`**: Retrieve all team members on an opportunity.
- **POST `/api/opportunities/:id/team`**: Add or update a team member. Requires body: `{ userId: string, role: string }`. Creates audit log action `opportunity_team_member_added` or `opportunity_team_member_updated`.
- **DELETE `/api/opportunities/:id/team/:userId`**: Remove a team member. Creates audit log action `opportunity_team_member_removed`.
