# Spec 0127: Opportunity Contact Roles API Requirements

## Functional Requirements

### 1. Relational Model & Attributes
An Opportunity Contact Role links a Contact to an Opportunity. The model must track:
* `id`: Unique identifier (e.g. `ocr-xxxxx`).
* `orgId`: Active tenant organization ID.
* `opportunityId`: The associated opportunity.
* `contactId`: The associated contact.
* `role`: The descriptive role of the contact (e.g., "Decision Maker", "Executive Sponsor", "Technical Buyer", "Influencer", "Evaluator"). Must be validated as a non-empty string.
* `isPrimary`: A boolean indicating if this is the main contact for the opportunity.

### 2. Stakeholder Invariants and Rules
* **Single Primary Stakeholder**: An opportunity must have at most one "Primary" contact role at any given time. If a contact role is set to `isPrimary = true`, any existing primary contact role on that same opportunity must automatically be updated/demoted to `isPrimary = false`.
* **Unique Assignment**: A contact can only be assigned to a specific opportunity once. Attempting to create duplicate assignments of the same contact to the same opportunity must result in a validation failure or conflict error.
* **Referential Integrity**: When creating or updating a contact role, both the `opportunityId` and the `contactId` must exist in the active organization context.

### 3. REST API Routes
All endpoints must live under `apps/api` and be protected by `tenantAuth` middleware:
* **List Roles**: `GET /api/opportunities/:id/contact-roles`
  - Returns a list of all contact roles assigned to the opportunity.
* **Assign Role**: `POST /api/opportunities/:id/contact-roles`
  - Assigns a contact to an opportunity with a role and optional primary flag.
* **Update Role**: `PUT /api/opportunities/:id/contact-roles/:roleId`
  - Updates the role string or toggles the primary status, handling demotion of any previous primary.
* **Remove Role**: `DELETE /api/opportunities/:id/contact-roles/:roleId`
  - Removes the contact role association.

### 4. Audit Logging & Webhooks
* Logging of the contact role assignments, updates, and deletes to the `auditLogs` table.
* Dispatching outbound webhook events when contact roles are created, updated, or deleted, with payloads including the role ID, opportunity ID, contact ID, and active tenant ID.

## Non-Functional & Security Requirements
* **Strict Tenant Isolation**: Enforce RLS checks at the store level and middleware level. Under no circumstances should Tenant A be able to read, assign, update, or delete contact roles for Tenant B. Cross-tenant references must throw RLS violations or return `404 Not Found`.
* **TypeScript Safety**: End-to-end compile-time safety without any dynamic casts (`any`) or generic placeholders.
* **Zero Lint Warnings**: Conform strictly to Biome rules, passing `pnpm verify` cleanly.
