# Specification: Marketing Sequence Folders & Tag Categorization - Requirements

## 1. Functional Requirements

### 1.1 Sequence Folders Management
- **REQ-1.1.1**: The system must allow creating hierarchical folders for marketing sequences.
- **REQ-1.1.2**: A Folder record must contain: `id` (UUID), `orgId` (UUID), `name` (text, non-empty), `parentFolderId` (UUID or null, referencing another folder in the same org).
- **REQ-1.1.3**: Folders must be scoped strictly under active tenant RLS isolation.
- **REQ-1.1.4**: Folder names must be unique within the same parent folder (or top level) for a single organization.
- **REQ-1.1.5**: Folder creation or updating must reject parent associations that would result in recursive folder reference loops (e.g. folder A cannot be parent of folder A, nor parent of its own ancestor).

### 1.2 Categorization Tags Management
- **REQ-1.2.1**: The system must allow creating categorization tags with hex colors.
- **REQ-1.2.2**: A Tag record must contain: `id` (UUID), `orgId` (UUID), `name` (text, non-empty), `color` (text, valid hex code like `#FF0000`).
- **REQ-1.2.3**: The system must allow mapping multiple tags to a single marketing sequence via a mapping table.
- **REQ-1.2.4**: Sequence tag assignment and lookup must be isolated by active tenant RLS context.

### 1.3 REST API Endpoints
- **REQ-1.3.1**: `POST /api/sequences/folders` - Create a folder.
- **REQ-1.3.2**: `GET /api/sequences/folders` - Fetch active tenant folders.
- **REQ-1.3.3**: `POST /api/sequences/tags` - Create a tag.
- **REQ-1.3.4**: `GET /api/sequences/tags` - List active tenant tags.
- **REQ-1.3.5**: `POST /api/sequences/:id/tags` - Attach tag to sequence.
- **REQ-1.3.6**: `DELETE /api/sequences/:id/tags/:tagId` - Detach tag from sequence.

## 2. Security & Verification Requirements
- **REQ-2.1**: Tenant RLS: one tenant must never see, modify, delete, or link folders/tags belonging to another organization.
- **REQ-2.2**: Full TypeScript compilation with zero type errors.
- **REQ-2.3**: Comprehensive Vitest suite asserting RLS boundary limits, nested hierarchy logic, and color validator.
