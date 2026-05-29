# Specification: Document Templates & Mail Merge Engine - Requirements

## 1. Functional Requirements

### 1.1 Document Templates Configuration
- **REQ-1.1.1**: The system must allow users to manage document templates.
- **REQ-1.1.2**: A Document Template record must contain: `id` (UUID), `orgId` (UUID), `name` (text), `content` (text, e.g. markdown template containing fields like `{{Account.name}}`), and `createdAt` (timestamp).
- **REQ-1.1.3**: RLS tenant isolation must govern all document templates operations.

### 1.2 Mail Merge Compiler Engine
- **REQ-1.2.1**: The document compiler must accept a template body and a context mapping of data records, identifying and replacing tags in the form `{{Object.field}}` or `{{field}}` dynamically.
- **REQ-1.2.2**: The compiler must handle deep structures, including root standard properties and dynamic `custom` JSONB properties.
- **REQ-1.2.3**: Unmatched tags must be replaced with an empty string `""` or a placeholder `[N/A]` without failing compile execution.

### 1.3 Merged Documents Persistence
- **REQ-1.3.1**: The system must record a history log of completed merges.
- **REQ-1.3.2**: A Merged Document history log must contain: `id` (UUID), `orgId` (UUID), `templateId` (UUID), `recordType` (text, e.g., `Account`, `Contact`, `Lead`, `Opportunity`), `recordId` (UUID), `compiledContent` (text), and `createdAt` (timestamp).

### 1.4 REST API Endpoints
- **REQ-1.4.1**: `POST /api/documents/templates` - Register a new document template.
- **REQ-1.4.2**: `GET /api/documents/templates` - Retrieve active templates.
- **REQ-1.4.3**: `POST /api/documents/merge` - Execute a mail merge for a specific template, record type, and record ID. Fetches the target record dynamically from database stores under strict tenant RLS isolation and generates the compiled document.
- **REQ-1.4.4**: `GET /api/documents/merged` - Query historical compiled merged documents.

## 2. Security & Verification Requirements
- **REQ-2.1**: Strict tenant RLS: a tenant must never be allowed to merge records, view templates, or read history logs belonging to another organization.
- **REQ-2.2**: Complete TypeScript definitions and linter coverage.
