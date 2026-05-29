# Spec 0126: Lead De-duplication and Merging API Design

## Pure Core Functions (`packages/core/src/index.ts`)

### Types
```typescript
export interface LeadRecord {
  id: string;
  orgId: string;
  ownerId: string;
  status: string;
  email: string | null;
  company: string | null;
  custom: Record<string, unknown> | null;
}

export type FieldResolutionSource = "master" | "duplicate";

export interface MergeLeadsInput {
  master: LeadRecord;
  duplicate: LeadRecord;
  fieldResolution: Record<string, FieldResolutionSource>;
}
```

### Signature: `calculateLeadDuplicates`
```typescript
export function calculateLeadDuplicates(
  sourceLead: LeadRecord,
  allLeads: LeadRecord[],
): LeadRecord[];
```
* **Algorithm**:
  - Filter out `sourceLead.id` and leads with differing `orgId`.
  - Extract domains from email strings. Exclude public domains (`gmail.com`, `yahoo.com`, `outlook.com`, `hotmail.com`).
  - Match if `email` values match exactly (case-insensitive, trimmed) OR (`company` names match exactly (case-insensitive, trimmed) AND email domains match exactly and are non-public).

### Signature: `mergeLeads`
```typescript
export function mergeLeads(input: MergeLeadsInput): LeadRecord;
```
* **Algorithm**:
  - Resolve primitive fields (`email`, `company`, `status`) according to `fieldResolution` (falling back to master if unspecified or invalid).
  - Merge the custom objects. For keys present in both, resolve using `fieldResolution['custom.' + key]` or default `fieldResolution.custom` or default to master. Let's explicitly support resolving specific custom field keys.

## API Route Design (`apps/api/src/index.ts`)

### `GET /api/leads/:id/duplicates`
* Middlewares: `tenantAuth`
* Logic:
  1. Retrieve source lead via `dbStore.leads.findOne(id)`. If not found, return 404.
  2. Retrieve all leads via `dbStore.leads.findMany()`.
  3. Call `calculateLeadDuplicates(sourceLead, allLeads)`.
  4. Return list of duplicate leads.

### `POST /api/leads/:id/merge`
* Middlewares: `tenantAuth`
* Request Body:
  ```json
  {
    "duplicateId": "lead-xyz",
    "fieldResolution": {
      "email": "master",
      "company": "duplicate",
      "status": "master",
      "custom.industry": "duplicate"
    }
  }
  ```
* Logic:
  1. Find master lead (`id`) and duplicate lead (`duplicateId`) via `dbStore.leads.findOne`. If either not found or orgId mismatch, return 404.
  2. Call `mergeLeads({ master, duplicate, fieldResolution })`.
  3. Update master lead using `dbStore.leads.update(id, mergedValues)`.
  4. Consolidation:
     - Update all `activityLinks` where `targetType === 'Lead' && targetId === duplicateId` to `targetId = id`.
     - Update `campaignMembers` where `leadId === duplicateId`. If master lead is already in that campaign (i.e. another campaignMember exists with `leadId === id && campaignId === campaignId`), delete the duplicate membership. Otherwise, update `leadId` to `id`.
  5. Delete duplicate lead via `dbStore.leads.delete(duplicateId)`.
  6. Create audit log entry tracking the merge.
  7. Trigger outbound webhook `lead.merged`.
  8. Return `{ success: true, data: mergedMasterLead }`.

## Database Schema & Store Expansion (`packages/db/src/index.ts`)
* Add `delete` method to `dbStore.leads`:
  ```typescript
  delete: async (id: string) => {
    const orgId = getActiveOrgId();
    const index = store.leads.findIndex((l) => l.id === id);
    if (index === -1) return false;
    if (store.leads[index].orgId !== orgId) {
      throw new Error("RLS Isolation Violation: Tenant mismatch.");
    }
    store.leads.splice(index, 1);
    return true;
  }
  ```
* Add standard array manipulations for updating/deleting `activityLinks` and `campaignMembers` directly within the service layer.
