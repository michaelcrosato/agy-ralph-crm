# Specification: Document Templates & Mail Merge Engine - Brief

## Objective
Implement an Advanced Document Templates & Mail Merge Engine. This engine allows organizations to manage formatted text/markdown templates containing dynamic replacement tags (e.g. `{{Account.name}}`, `{{Lead.company}}`), run mail merge compiler operations that substitute tags with actual relational database records, and persist/log history records of compiled documents under strict RLS isolation parameters.

## Core Boundaries
- **Document Compiler**: Core parsing, tag extraction, context substitutions, and validation helpers must reside in `packages/documents`.
- **Database Schema**: Extension schemas for templates and merged documents store maps must reside in `packages/db`.
- **REST API Endpoints**: Endpoints for template CRUD operations and compiling new mail merges must reside in `apps/api`.
