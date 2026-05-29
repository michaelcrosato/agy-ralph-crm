# Specification: Outbound Email Log Adapters & Service Activity Integrations - Design

## 1. Domain Modeling

### 1.1 Outbound Email Utility Types
Add the following interfaces to `packages/core/src/index.ts`:

```typescript
export interface EmailLogInput {
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
}

export function validateEmailLogInput(input: EmailLogInput): {
  success: boolean;
  error?: string;
} {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(input.from)) {
    return { success: false, error: "Invalid 'from' email format." };
  }
  if (!Array.isArray(input.to) || input.to.length === 0) {
    return { success: false, error: "'to' must be a non-empty array." };
  }
  for (const email of input.to) {
    if (!emailRegex.test(email)) {
      return { success: false, error: `Invalid 'to' email address: ${email}` };
    }
  }
  if (input.cc) {
    for (const email of input.cc) {
      if (!emailRegex.test(email)) {
        return { success: false, error: `Invalid 'cc' email address: ${email}` };
      }
    }
  }
  if (input.bcc) {
    for (const email of input.bcc) {
      if (!emailRegex.test(email)) {
        return { success: false, error: `Invalid 'bcc' email address: ${email}` };
      }
    }
  }
  if (!input.subject || input.subject.trim() === "") {
    return { success: false, error: "'subject' is required." };
  }
  if (!input.body || input.body.trim() === "") {
    return { success: false, error: "'body' is required." };
  }
  return { success: true };
}
```

### 1.2 Database Structure
No changes are required to `packages/db/src/schema.ts` as `activities` and `activityLinks` tables already support these records:
- `DBActivity` record uses `type: "email"`.
- `DBActivity.custom` JSONB stores: `{ from, to, cc, bcc }`.

## 2. API Routing Layer
Endpoints inside `apps/api/src/index.ts`:

### 2.1 `POST /api/emails/log`
- Protected by `tenantAuth`.
- Payload structure:
  ```json
  {
    "from": "user@tenant.com",
    "to": ["client@example.com"],
    "cc": [],
    "bcc": [],
    "subject": "Proposal Outline",
    "body": "Hi, please see details...",
    "links": [
      { "targetType": "Contact", "targetId": "contact-abc" }
    ]
  }
  ```
- Steps:
  1. Validate email structure using `validateEmailLogInput`.
  2. Verify that all target entities exist and belong to the active tenant using standard `dbStore.contacts.findOne`, etc.
  3. Insert a new `activities` record with:
     - `type: "email"`
     - `subject: payload.subject`
     - `body: payload.body`
     - `custom: { from: payload.from, to: payload.to, cc: payload.cc, bcc: payload.bcc }`
  4. Insert associated `activityLinks` for each valid link.
  5. Log audit trail entry: `recordType: "EmailLog"`, `action: "create"`.
  6. Return `200 OK` with `{ success: true, data: newActivity }`.

### 2.2 `GET /api/emails/:id`
- Protected by `tenantAuth`.
- Steps:
  1. Find the activity using `dbStore.activities.findOne(id)`.
  2. Verify that `activity.type === "email"`.
  3. Find links connected to the activity in `activityLinks`.
  4. Return the activity and links list or `404` if not found.
