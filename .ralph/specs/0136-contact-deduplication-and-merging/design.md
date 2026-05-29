# Spec 0136: Contact De-duplication and Merging API Design

## 1. Core Logic Signature (`packages/core`)

```typescript
export interface ContactRecord {
  id: string;
  orgId: string;
  ownerId: string;
  accountId: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  custom: Record<string, unknown> | null;
  reportsToId?: string | null;
}

export interface MergeContactsInput {
  master: ContactRecord;
  duplicate: ContactRecord;
  fieldResolution: Record<string, FieldResolutionSource>;
}

export function calculateContactDuplicates(
  sourceContact: ContactRecord,
  allContacts: ContactRecord[],
): ContactRecord[];

export function mergeContacts(input: MergeContactsInput): ContactRecord;
```

## 2. Database & Store Operations (`packages/db`)

Adding a `delete` method to the `contacts` store object:

```typescript
contacts: {
  // ... existing methods
  delete: async (id: string) => {
    const orgId = getActiveOrgId();
    const index = store.contacts.findIndex((c) => c.id === id);
    if (index === -1) return false;
    if (store.contacts[index].orgId !== orgId) {
      throw new Error("RLS Isolation Violation: Tenant mismatch.");
    }
    store.contacts.splice(index, 1);
    return true;
  }
}
```

## 3. REST API Endpoints (`apps/api`)

### duplicate detection
```http
GET /api/contacts/:id/duplicates
Authorization: Bearer <token>
```
Response:
```json
{
  "success": true,
  "data": [
    {
      "id": "contact-xyz",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john.doe@example.com"
      // ... contact details
    }
  ]
}
```

### contact merging
```http
POST /api/contacts/:id/merge
Authorization: Bearer <token>
Content-Type: application/json

{
  "duplicateId": "contact-xyz",
  "fieldResolution": {
    "firstName": "master",
    "lastName": "master",
    "email": "duplicate",
    "custom.title": "duplicate"
  }
}
```
Response:
```json
{
  "success": true,
  "data": {
    "id": "contact-master",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com"
    // ... merged contact details
  }
}
```

## 4. Webhook Trigger and Audit Log format
Outbound webhook is triggered using event `"contact.merged"` with details:
```json
{
  "contactId": "<master-id>",
  "mergedContactId": "<duplicate-id>",
  "finalContact": { ... }
}
```

Audit log record is created:
```json
{
  "orgId": "<org-id>",
  "recordId": "<master-id>",
  "recordType": "contacts",
  "action": "update",
  "userId": "<user-id>",
  "changes": {
    "merge": { "before": "<duplicate-id>", "after": "merged_into_master" }
  }
}
```
