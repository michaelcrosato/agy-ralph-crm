# Specification: E-Signature Integration & Document Signing API - Requirements

## 1. Functional Requirements

### 1.1 Request Management
- Users must be able to create an e-signature request for an **Opportunity** or a **Contract**.
- A request must capture:
  - `documentName` (string, required)
  - `signerEmail` (string, required, validated format)
  - `status` (string, required, defaulted to `"sent"`. Valid values are `"sent"`, `"viewed"`, `"signed"`, `"declined"`)
  - `opportunityId` (UUID string, optional)
  - `contractId` (UUID string, optional)
  - `sentAt` (Date, required, defaulted to current time)
  - `completedAt` (Date, optional)
- The E-Signature request must be linked to at least one parent entity: either `opportunityId` or `contractId`. If both are missing, request creation must fail with a validation error.

### 1.2 State Transition Logic
- The E-Signature request status follows a strict state transition flow:
  - From `"sent"` to `"viewed"` or `"declined"`.
  - From `"viewed"` to `"signed"` or `"declined"`.
  - Terminal states (`"signed"`, `"declined"`) cannot be transitioned.
- Any invalid state transition (e.g. from `"sent"` directly to `"signed"`, or moving out of `"signed"`) must throw a validation error.
- When status changes to `"signed"` or `"declined"`, `completedAt` must be set to the current timestamp.

### 1.3 Simulator Engine
- The simulation engine must process signer actions:
  - `"view"`: Moves status to `"viewed"` if current state is `"sent"`.
  - `"sign"`: Moves status to `"signed"` if current state is `"viewed"`.
  - `"decline"`: Moves status to `"declined"` if current state is `"sent"` or `"viewed"`.
- Simulated actions must log an `audit` trail record and generate activities/timelines representing the document status update.

## 2. Security & RLS Isolation Requirements
- **Tenant Context**: Every database read and write to E-Signature requests must be bound strictly to the active tenant (`orgId`).
- **Authorization**: A user can only manage and query E-Signature requests belonging to their active tenant.
- **Cross-Tenant Prevention**: Direct mutations, simulation triggers, or reads for a request belonging to another tenant must immediately throw an RLS isolation violation.

## 3. Interface Requirements

### 3.1 REST API Contracts
- `POST /api/sales/esignature/requests`:
  - Body: `{ documentName: string, signerEmail: string, opportunityId?: string, contractId?: string }`
  - Returns: `{ success: true, data: ESignatureRequest }`
- `GET /api/sales/esignature/requests`:
  - Returns: `{ success: true, data: ESignatureRequest[] }`
- `POST /api/sales/esignature/simulate`:
  - Body: `{ requestId: string, action: "view" | "sign" | "decline" }`
  - Returns: `{ success: true, data: ESignatureRequest }`
