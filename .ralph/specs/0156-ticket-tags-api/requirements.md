# Specification: Support Ticket Tags & Categorization Engine - Requirements

## 1. Functional Requirements

### 1.1 Support Ticket Tag Structure (`ticket_tags` & `ticket_tag_links`)
- **Tags (`ticket_tags`)**:
  - Each tag must belong to a specific tenant (`orgId`).
  - Each tag must have a unique `name` within that tenant.
  - Each tag must have a `color` represented as a valid hex code (e.g. `#FF0000`).
  - Each tag must have a creation timestamp (`createdAt`).
- **Tag Links (`ticket_tag_links`)**:
  - Each link must belong to a specific tenant (`orgId`).
  - Each link must associate a valid existing support ticket (`ticketId`) with a valid existing tag (`tagId`).
  - Each link must have a creation timestamp (`createdAt`).

### 1.2 Validation Rules
- Tag name must not be empty or consist only of whitespace.
- Tag name must be 1 to 50 characters long.
- Tag color must be a valid hex color starting with '#' followed by exactly 6 hexadecimal characters (case-insensitive).
- Linking a tag to a ticket must fail if the tag or ticket does not exist or belongs to another tenant.
- Attempting to link the same tag to a ticket multiple times should be safely idempotent or handled cleanly.

### 1.3 REST API Surface
- **Create Tag**:
  - `POST /api/service/tags` - Payload: `{ name: string, color: string }`.
  - Sets `orgId` to the active tenant ID. Returns the created tag.
- **List All Tags**:
  - `GET /api/service/tags` - Returns all tags defined for the active tenant.
- **Link Tag to Ticket**:
  - `POST /api/service/tickets/:id/tags` - Payload: `{ tagId: string }`.
  - Automatically sets `orgId` to the active tenant ID and links the tag to the ticket.
- **Unlink Tag from Ticket**:
  - `DELETE /api/service/tickets/:id/tags/:tagId` - Removes the link between the ticket and the tag.
- **List Ticket Tags**:
  - `GET /api/service/tickets/:id/tags` - Returns all tags linked to the specific ticket.

### 1.4 Tenant Isolation & RLS
- All database operations must strictly verify the active tenant ID (`orgId`) via `AsyncLocalStorage` and `getActiveOrgId()`.
- Tenants must never see, create, or link tags or tickets belonging to another organization.

### 1.5 Audit Trails
- Creating a tag, linking a tag, and unlinking a tag must log an audit entry in the `auditLogs` table under the active tenant.

## 2. Technical Constraints
- Pure logic functions in `packages/core` must be fully type-safe.
- TypeScript type-checking must pass cleanly with zero warnings or `any` workarounds.
- Lint and formatting must pass Biome checks.
