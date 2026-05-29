# Specification: Case Service Level Agreements (SLA) & Milestone Management Engine - Implementation Plan

## Step-by-Step Code Generation Sequence

### Step 1: Database Schema Modification (`packages/db/src/schema.ts`)
- Append the `slaPolicies` and `ticketMilestones` table definitions at the end of the file.
- Ensure references to `organizations` and `tickets` are correctly defined with cascade deletion options.

### Step 2: Database Store Expansion (`packages/db/src/index.ts`)
- Define TypeScript interfaces `DBSlaPolicy` and `DBTicketMilestone`.
- Add `slaPolicies` and `ticketMilestones` arrays to the `store` object.
- Add `slaPolicies` and `ticketMilestones` CRUD helpers to `dbStore` enforcing active tenant RLS bounds.
- Update `dbStore.clear()` to purge both new stores on reset.

### Step 3: Pure Logic Engine Implementation (`packages/core/src/index.ts`)
- Implement `calculateMilestoneDueDate(createdAt: Date, limitMinutes: number): Date`
- Implement `evaluateMilestoneCompletion(targetTime: Date, completedAt: Date): { isMet: boolean; status: "completed" | "breached" }`
- Export these functions so they can be consumed by the API.

### Step 4: REST API Route Hooking (`apps/api/src/index.ts`)
- Add routes:
  - `POST /api/service/sla-policies`
  - `GET /api/service/sla-policies`
  - `POST /api/service/tickets/:id/milestones`
  - `GET /api/service/tickets/:id/milestones`
  - `PUT /api/service/tickets/:id/milestones/:milestoneId`
- Enforce tenancy checks on all routes via standard Hono response handling and active tenant RLS context.
- Write audit logs when SLA policies are created and milestones are updated.

### Step 5: Integration & Isolation Test Suite (`packages/testing/src/service-sla.test.ts`)
- Scaffold standard tenant-isolated test environments.
- Verify basic SLA policy creations and milestone initialization.
- Test milestone completions, ensuring correct `isMet` calculations and transitions.
- Validate cross-tenant boundaries, proving that one tenant cannot access or update another tenant's policies or milestones.

### Step 6: Workspace Compile Verification
- Execute `pnpm verify` to perform typescript compilation and Biome code linting checks.
- Run `pnpm test` to verify Vitest tests run perfectly.
