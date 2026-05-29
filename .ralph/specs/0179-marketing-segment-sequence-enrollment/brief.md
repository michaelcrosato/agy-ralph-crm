# Specification: Marketing Segment Sequence Enrollment API - Brief

## 1. Functional Objective
This feature bridges dynamic marketing segments and marketing automation sequences. It enables automated multi-channel journeys by allowing dynamic segment members (Leads or Contacts) to be enrolled in bulk into marketing sequences, preventing double-enrollment by skipping active members.

## 2. Technical Scope
- **Tenancy Isolation**: Bulk enrollment must strictly honor row-level security (RLS) context constraints via AsyncLocalStorage.
- **REST Endpoints**:
  - `POST /api/segments/:id/enroll-sequence` - Resolves segment members and enrolls them in a target sequence.
  - `POST /api/sequences/:id/enroll-segment` - Symmetrically triggers enrollment of a segment's resolved members into a target sequence.
- **Execution Logic**:
  - Dynamically query segment members via `resolveSegmentMembers`.
  - Filter out records that are already actively enrolled (status = "active") in the target sequence.
  - Create new active memberships using `enrollInSequence`.
- **Verification**: Thorough integration tests validating bulk enrollment behavior, duplicate avoidance, and strict tenant RLS isolation.
