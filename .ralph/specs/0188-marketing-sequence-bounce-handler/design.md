# Specification: Marketing Sequence Bounce & Spam Protection / Handling - Design

## 1. Core Logic Signature & Design

We will add a new core domain function `handleEmailDeliveryEvent` inside `packages/core/src/index.ts`.

### 1.1 Data Schema Mappings
This feature utilizes the existing tables defined in `packages/db/src/schema.ts`:
- `marketing_sequence_suppressions`
- `marketing_sequence_memberships`
- `leads`
- `contacts`
- `audit_logs`

### 1.2 Core Domain API
```typescript
export async function handleEmailDeliveryEvent(
  dbStore: {
    marketingSequenceMemberships: {
      findMany: () => Promise<CoreSequenceMembership[]>;
      update: (
        id: string,
        updates: Partial<Omit<CoreSequenceMembership, "id" | "orgId" | "createdAt" | "updatedAt">>
      ) => Promise<CoreSequenceMembership | null>;
    };
    marketingSequenceSuppressions: {
      insert: (item: {
        orgId: string;
        recordType: string;
        recordId?: string | null;
        pattern: string;
        reason: string;
      }) => Promise<any>;
    };
    leads: {
      findMany: () => Promise<any[]>;
      update: (id: string, updates: any) => Promise<any>;
    };
    contacts: {
      findMany: () => Promise<any[]>;
      update: (id: string, updates: any) => Promise<any>;
    };
    auditLogs: {
      insert: (item: {
        orgId: string;
        recordId: string;
        recordType: string;
        action: string;
        userId: string;
        changes: Record<string, { before: unknown; after: unknown }>;
      }) => Promise<unknown>;
    };
  },
  eventDetails: {
    orgId: string;
    email: string;
    event: "bounce" | "complaint";
    reason?: string;
  }
): Promise<{ suppressionsCreated: number; membershipsExited: number }>
```

---

## 2. API Endpoint Design

We will expose a new route in `apps/api/src/index.ts`:
`POST /api/sequences/email-event`

### 2.1 Route Behavior
1. Uses `tenantAuth` middleware to verify tenant credentials.
2. Extracts `email`, `event`, and `reason` from the request JSON.
3. Validates that:
   - `email` is present and formatted correctly.
   - `event` is either `"bounce"` or `"complaint"`.
4. Runs `handleEmailDeliveryEvent` inside a tenant-isolated context.
5. Returns a JSON response:
   ```json
   {
     "success": true,
     "data": {
       "suppressionsCreated": 1,
       "membershipsExited": 2
     }
   }
   ```
