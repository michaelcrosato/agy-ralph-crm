# Specification: Marketing Sequence Suppression Lists & Exclusion Rules Engine - Requirements

## 1. Functional Requirements

### 1.1 Global Suppression List Definition & Storage
- The CRM must support a global **Suppression List** representing specific entities that should never be communicated with via marketing automation.
- Each suppression list entry must contain:
  - `id`: Unique identifier (UUID).
  - `orgId`: Tenant identifier for strict RLS.
  - `recordType`: Type of record suppressed, either `"lead"`, `"contact"`, or `"email_domain"`.
  - `recordId`: Nullable reference to the specific Lead or Contact ID (if applicable).
  - `pattern`: For domain/email blocking, a string (e.g. `competitor.com`, `spammer@domain.com`).
  - `reason`: The explanation for suppression (e.g. `"opt_out"`, `"competitor"`, `"bounce"`, `"complaint"`).
  - `createdAt`: Date/time when suppression was added.

### 1.2 Sequence-Specific Exclusion Rules
- The CRM must support per-sequence **Exclusion Rules** that govern which leads or contacts are excluded from that particular sequence.
- An exclusion rule configuration must include:
  - `id`: Unique identifier (UUID).
  - `orgId`: Tenant identifier for strict RLS.
  - `sequenceId`: The sequence this exclusion rule belongs to.
  - `exclusionType`: Supported rules are:
    - `"domain"`: Blocks records whose email domain matches the target value (e.g., `competitor.com`).
    - `"segment"`: Blocks records enrolled in a specific dynamic Marketing Segment (evaluated by checking membership in the segment).
    - `"email"`: Blocks a specific email address (e.g. `test@domain.com`).
  - `exclusionValue`: The target string value representing the domain, segment ID, or email address to exclude.
  - `createdAt`: Date/time of creation.

### 1.3 Active Suppression & Exclusion Check Flow
- When a client attempts to enroll a record (Lead or Contact) in a sequence via `enrollInSequence`:
  - The engine must check if the record is globally suppressed or matches any active exclusion rules for that sequence.
  - If a match is found, the membership status must be set immediately to `"suppressed"`, and the next execution time (`nextExecutionAt`) should not trigger any actions.
  - An audit trail log must be recorded with action `"membership_suppressed"` and descriptions detailing why (e.g. `"Suppressed due to competitor.com domain exclusion rule"`).
- When the background scheduler processes steps (`executePendingSequenceSteps`):
  - Before delivering any step, the engine must recheck suppression and exclusion rules for the target record.
  - This ensures that if a record is added to the suppression list *after* enrollment, they are bypassed before any email is sent.
  - If suppressed, the membership status must transition to `"suppressed"`, and an audit trail log must be generated.

### 1.4 Tenant RLS Isolation
- All suppression records and exclusion rules must be strictly isolated by `org_id` in the database.
- A user in Tenant A must never see, modify, or be affected by the suppression lists or exclusion rules configured in Tenant B.

---

## 2. API Endpoints

### 2.1 GET `/api/sequences/suppressions`
- Retrieves the global list of suppressions for the current tenant.
- Support optional query parameters for filtering by `recordType` or `reason`.

### 2.2 POST `/api/sequences/suppressions`
- Adds a new entry to the global suppression list.
- Payload:
  ```json
  {
    "recordType": "email_domain",
    "pattern": "competitor.com",
    "reason": "competitor"
  }
  ```

### 2.3 DELETE `/api/sequences/suppressions/:id`
- Removes a suppression entry by ID.

### 2.4 GET `/api/sequences/:id/exclusions`
- Retrieves all exclusion rules for a specific sequence.

### 2.5 POST `/api/sequences/:id/exclusions`
- Creates a new exclusion rule for a sequence.
- Payload:
  ```json
  {
    "exclusionType": "domain",
    "exclusionValue": "competitor.com"
  }
  ```

### 2.6 DELETE `/api/sequences/:id/exclusions/:exclusionId`
- Deletes an exclusion rule.
