# Specification: Marketing Sequence Dynamic Sender Assignment - Requirements

## 1. Functional Requirements

### 1.1 Sender Policy Configuration
- The system MUST support three sender policy types on a sequence:
  - `"system"`: Sends from the standard CRM generic zero UUID (`"00000000-0000-0000-0000-000000000000"`).
  - `"owner"`: Sends from the active owner of the target Lead or Contact.
  - `"specific"`: Sends from a specific, pre-assigned user ID.
- The `senderType` MUST default to `"system"`.
- When `senderType` is `"specific"`, the `senderUserId` MUST be a valid user belonging to the same tenant organization.

### 1.2 Execution Resolution Loop
- During the `executePendingSequenceSteps` loop:
  - If a sequence's `senderType` is `"owner"`, retrieve the target recipient (Lead or Contact) via the corresponding finder methods. If the recipient has a valid `ownerId`, set the email activity `creatorId` to that `ownerId`.
  - If the recipient does not have an owner, or the owner is missing, fallback to `"00000000-0000-0000-0000-000000000000"`.
  - If a sequence's `senderType` is `"specific"`, resolve the configured `senderUserId`. If present, set the email activity `creatorId` to that `senderUserId`.
  - Otherwise, set the email activity `creatorId` to `"00000000-0000-0000-0000-000000000000"`.
- Ensure all resolved activity dispatches write correct `creatorId` values to the database.

### 1.3 REST API Endpoints
- Update `POST /api/sequences` to accept:
  - `senderType`: optional string, must be `"system"`, `"owner"`, or `"specific"`.
  - `senderUserId`: optional UUID string.
- Create `PATCH /api/sequences/:id` to accept partial updates for the sequence fields, including `senderType` and `senderUserId`.
- Input validation:
  - Return `400 Bad Request` if `senderType` is not one of `"system"`, `"owner"`, or `"specific"`.
  - Return `400 Bad Request` if `senderType` is `"specific"` but `senderUserId` is missing.
  - Return `400 Bad Request` if `senderUserId` is provided but does not belong to a user in the same tenant organization.

## 2. Security & RLS Requirements
- A tenant organization MUST NOT be able to view, modify, or assign a sequence to a `senderUserId` belonging to a different tenant organization.
- Tenancy MUST be resolved strictly from the active session context (`AsyncLocalStorage`).
