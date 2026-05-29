# Specification: Multi-Stage Opportunity Approval Processes - Design

## 1. Domain Modeling

### 1.1 Core Submission Utility
Add the following interfaces and functions to `packages/core/src/index.ts`:

```typescript
export interface OpportunityRecord {
  id: string;
  orgId: string;
  stage: string;
  amount: string | null;
}

export function validateOpportunityApprovalSubmission(
  opportunity: OpportunityRecord,
): { success: boolean; error?: string } {
  if (opportunity.stage === "Closed Won" || opportunity.stage === "Closed Lost") {
    return {
      success: false,
      error: "Opportunity is already closed.",
    };
  }
  const amount = Number.parseFloat(opportunity.amount || "0");
  if (amount <= 0) {
    return {
      success: false,
      error: "Opportunity must have an amount greater than zero.",
    };
  }
  return { success: true };
}
```

### 1.2 Schema and Mock Stores

#### 1.2.1 `packages/db/src/schema.ts`
Add the standard Drizzle schemas:

```typescript
export const opportunityApprovals = pgTable("opportunity_approvals", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  opportunityId: uuid("opportunity_id")
    .notNull()
    .references(() => opportunities.id, { onDelete: "cascade" }),
  submitterId: uuid("submitter_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("Pending"), // "Pending" | "Approved" | "Rejected"
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const opportunityApprovalSteps = pgTable("opportunity_approval_steps", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  approvalId: uuid("approval_id")
    .notNull()
    .references(() => opportunityApprovals.id, { onDelete: "cascade" }),
  stepName: text("step_name").notNull(),
  approverRoleId: text("approver_role_id").notNull(),
  status: text("status").notNull().default("Pending"), // "Pending" | "Approved" | "Rejected"
  decidedByUserId: uuid("decided_by_user_id").references(() => users.id, { onDelete: "set null" }),
  comments: text("comments"),
  decidedAt: timestamp("decided_at"),
});
```

#### 1.2.2 `packages/db/src/index.ts`
Implement standard mock collections and store interfaces under RLS tenancy rules:

```typescript
export interface DBOpportunityApproval {
  id: string;
  orgId: string;
  opportunityId: string;
  submitterId: string;
  status: string;
  createdAt: Date;
}

export interface DBOpportunityApprovalStep {
  id: string;
  orgId: string;
  approvalId: string;
  stepName: string;
  approverRoleId: string;
  status: string;
  decidedByUserId: string | null;
  comments: string | null;
  decidedAt: Date | null;
}
```

Add these to the `store` collections and expose `dbStore.opportunityApprovals` and `dbStore.opportunityApprovalSteps` with `findMany`, `findOne`, `insert`, and `update` logic.

## 2. API Routing Layer

### 2.1 `POST /api/opportunities/:id/submit-approval`
1. Validate opportunity existence and tenant context.
2. Call `validateOpportunityApprovalSubmission` to assert validity.
3. Verify no pending approvals exist for this opportunity.
4. Insert the `opportunityApprovals` record and its nested `opportunityApprovalSteps` entries ("Manager Review" and "VP Review").
5. Record an audit log entry for the submission event.

### 2.2 `POST /api/approvals/:id/decide`
1. Load approval step and verify tenant isolation context.
2. Verify step status is `Pending` and current user role matches step `approverRoleId`.
3. Update step status to `Approved` or `Rejected` with comments.
4. Re-calculate overall approval status. If "Rejected", mark approval as "Rejected" and change opportunity stage to "Closed Lost". If all steps are "Approved", mark approval as "Approved" and change opportunity stage to "Closed Won". Record audit logs for the stage changes.

### 2.3 `GET /api/opportunities/:id/approvals`
1. List all approvals and nested steps connected to the opportunity under strict RLS isolation.
