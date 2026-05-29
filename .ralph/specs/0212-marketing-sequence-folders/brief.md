# Specification: Marketing Sequence Folders & Tag Categorization - Brief

## 1. Functional Objective
This feature introduces organization-wide folders and tagging systems for marketing sequences, allowing corporate users to categorize and organize marketing sequences hierarchically and attach tags with dynamic color coding.

## 2. Technical Scope
- **Tenancy Isolation**: The folders, tags, and mapping stores must integrate fully with the tenant context and `AsyncLocalStorage` RLS context.
- **Pure Core Logic**: Core folder validation (e.g. folder name unique per parent/tenant, no recursive loops) and tag color hex validation will reside in `@crm/core` as pure relational functions.
- **REST Endpoints**:
  - `POST /api/sequences/folders` - Create a folder.
  - `GET /api/sequences/folders` - List folders under tenant isolation.
  - `POST /api/sequences/tags` - Create a categorization tag.
  - `GET /api/sequences/tags` - List tags.
  - `POST /api/sequences/:id/tags` - Assign a tag to a sequence.
  - `DELETE /api/sequences/:id/tags/:tagId` - Remove a tag from a sequence.
- **Verification**: Complete unit and integration test coverage verifying multi-tenant isolation, recursive loop detection, and Hono routes.
