# Specification: Multi-Stage Opportunity Approval Processes - Requirements

## 1. Functional Requirements

### 1.1 Core Submission Validation Utility
- **REQ-1.1.1**: Expose a utility function in `packages/core` to validate opportunity approval submissions.
- **REQ-1.1.2**: Validation must ensure that:
  - The opportunity is not already closed (must not be in "Closed Won" or "Closed Lost" stage).
  - The opportunity amount is a valid, positive number greater than zero.

### 1.2 Multi-Tenant Opportunity Approvals & Steps Schemas
- **REQ-1.2.1**: Define database schemas for `opportunity_approvals` and `opportunity_approval_steps` in `packages/db`.
- **REQ-1.2.2**: `opportunity_approvals` must track:
  - `id`: unique UUID
  - `orgId`: tenant organization UUID reference
  - `opportunityId`: opportunity UUID reference
  - `submitterId`: user UUID reference who submitted the request
  - `status`: "Pending" | "Approved" | "Rejected" (default: "Pending")
  - `createdAt`: timestamp
- **REQ-1.2.3**: `opportunity_approval_steps` must track:
  - `id`: unique UUID
  - `orgId`: tenant organization UUID reference
  - `approvalId`: reference to the main approval record
  - `stepName`: name of the stage step (e.g. "Manager Review", "VP Review")
  - `approverRoleId`: the role ID required to decide the step
  - `status`: "Pending" | "Approved" | "Rejected" (default: "Pending")
  - `decidedByUserId`: UUID of the user who approved or rejected
  - `comments`: optional text field for review comments
  - `decidedAt`: timestamp when decision occurred

### 1.3 Approval Submission REST API
- **REQ-1.3.1**: Expose `POST /api/opportunities/:id/submit-approval` protected by `tenantAuth`.
- **REQ-1.3.2**: Check if the opportunity exists and belongs to the active tenant. Return `404` if not found or unauthorized.
- **REQ-1.3.3**: Validate the opportunity for submission using the core validation utility. Return `400` if invalid.
- **REQ-1.3.4**: Ensure only one pending approval exists for an opportunity at any time. Return `400` if already pending.
- **REQ-1.3.5**: Create the approval and seed two sequential steps:
  - Step 1: "Manager Review" requiring role `role-manager`
  - Step 2: "VP Review" requiring role `role-vp`
- **REQ-1.3.6**: Log an audit trail entry (`DBAuditLog`) of `action: "submit"` and `recordType: "OpportunityApproval"`.

### 1.4 Approval Step Decision REST API
- **REQ-1.4.1**: Expose `POST /api/approvals/:id/decide` protected by `tenantAuth`.
- **REQ-1.4.2**: Accept body `status` ("Approved" or "Rejected") and optional `comments`.
- **REQ-1.4.3**: Enforce that the step must be in "Pending" status and the active user's `roleId` must match the step's `approverRoleId`. Return `403` if unauthorized, and `400` if already decided.
- **REQ-1.4.4**: Update the step status, decidedByUserId, and decidedAt fields.
- **REQ-1.4.5**: Update the overall approval status:
  - If any step is "Rejected", set approval status to "Rejected" and auto-update the opportunity stage to "Closed Lost", logging the transition in the audit trail.
  - If all steps are "Approved", set approval status to "Approved" and auto-update the opportunity stage to "Closed Won", logging the transition in the audit trail.
- **REQ-1.4.6**: Log an audit trail entry (`DBAuditLog`) of `action: "decide"` and `recordType: "OpportunityApprovalStep"`.

### 1.5 Opportunity Approval History REST API
- **REQ-1.5.1**: Expose `GET /api/opportunities/:id/approvals` protected by `tenantAuth` returning approvals and their nested steps.

## 2. Technical & Security Requirements
- **REQ-2.1**: Active Row-Level Security (RLS) context must prevent cross-tenant data leakage. Any access or decision attempt from Tenant B to Tenant A's records must fail.
- **REQ-2.2**: Clean TypeScript compilation and lint checks must pass across the workspace.
