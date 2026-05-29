# Specification: Marketing Segment Sequence Enrollment API - Requirements

## 1. Functional Requirements

### 1.1 Bulk Enrollment Mechanics
- **REQ-1.1.1**: The system must expose an endpoint `POST /api/segments/:id/enroll-sequence` that accepts a target `sequenceId` in the request body.
- **REQ-1.1.2**: The system must expose an endpoint `POST /api/sequences/:id/enroll-segment` that accepts a target `segmentId` in the request body.
- **REQ-1.1.3**: When triggered, the system must:
  1. Retrieve the Dynamic Segment and verify it exists under the active tenant context.
  2. Retrieve the Marketing Sequence and verify it exists under the active tenant context.
  3. Resolve all current members of the dynamic segment (using the resolved leads/contacts).
  4. Query existing active memberships (`status === "active"`) in the target sequence for the resolved member record IDs to prevent double enrollment.
  5. Enroll only the non-duplicate records into the sequence, using `enrollInSequence`.
- **REQ-1.1.4**: The response for bulk enrollment endpoints must return a JSON payload with:
  - `success`: `true`
  - `enrolledCount`: number of new members enrolled.
  - `skippedCount`: number of members skipped due to existing active enrollment.
  - `memberships`: array of newly created `DBMarketingSequenceMembership` records.

### 1.2 Tenancy & Security Constraints
- **REQ-1.2.1**: A tenant must never be able to trigger sequence enrollment of another tenant's segment or sequence.
- **REQ-1.2.2**: The dynamic member resolution and enrollment execution must run strictly within the `withTenant` or active AsyncLocalStorage organization scope.
- **REQ-1.2.3**: Unenrolled records of other tenants must never be returned, resolved, or matched.

## 2. Technical & Quality Requirements
- **REQ-2.1**: Biome linter check (`pnpm verify`) must pass completely with zero errors or warnings.
- **REQ-2.2**: Full TypeScript safety with no unresolved variables or types.
- **REQ-2.3**: Vitest integration tests in `packages/testing/src/marketing-segment-sequence-enrollment.test.ts` asserting all conditions, duplicate prevention, and tenant isolation.
