# Specification: Marketing Sequence Archiving & Deletion Engine - Brief

## 1. Functional Objective
This feature introduces high-value **Marketing Sequence Archiving & Purging (Deletion) Engine** capabilities. When a campaign or sequence completes its lifecycle, users need the ability to archive it to keep their workspace clean, prevent future accidental enrollments, and automatically complete all current active/paused memberships. Furthermore, users require a secure "purge" mechanism to completely hard-delete archived sequences and all their child entities (steps, branches, split tests, actions, tag mappings, memberships) from the database to comply with privacy or data retention mandates.

## 2. Technical Scope
- **Pure Core Logic**: 
  - `archiveMarketingSequence(dbStore, sequenceId, orgId)`: Archives the sequence, sets status to `"archived"`, and sets all associated active/paused memberships to `"completed"`.
  - `purgeMarketingSequence(dbStore, sequenceId, orgId)`: Deletes the archived sequence and all child records recursively. A sequence must be `"archived"` first before it can be purged.
  - Reject enrollments in `enrollInSequence` if `seq.status === "archived"`.
- **REST Endpoints**:
  - `POST /api/sequences/:id/archive` - Archives the sequence.
  - `DELETE /api/sequences/:id/purge` - Purges (hard-deletes) the archived sequence.
- **Verification**: Complete integration tests asserting RLS isolation, correct state transitions, membership updates, enrollment blocking, cascade deletions, and clean workspace verification (`pnpm verify`).
