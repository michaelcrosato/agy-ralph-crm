# Phase 2: Primitive Record Core & Event Timelines - Brief

## Objective
Implement the foundational business records of the CRM: Accounts, Contacts, Leads, and Opportunities. In addition, implement auditing ledgers to log record modifications, standard text search index helpers, and chronological timelines.

## Boundaries & Constraints
- Database tables for primitive records must reside in `packages/db`.
- Validation logic, core interfaces, and lead-to-record conversion logic must reside in `packages/core`.
- Change tracking and immutable auditing logs must reside in `packages/audit`.
- Search indexes and pg_trgm search utilities must reside in `packages/search`.
