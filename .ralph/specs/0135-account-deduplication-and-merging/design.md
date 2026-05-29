# Spec 0135: Account De-duplication and Merging API Design

## Pure Core Functions (`packages/core/src/index.ts`)

### Types
```typescript
export interface AccountRecord {
  id: string;
  orgId: string;
  ownerId: string;
  name: string;
  domain: string | null;
  custom: Record<string, unknown> | null;
  parentAccountId?: string | null;
}

export type FieldResolutionSource = "master" | "duplicate";

export interface MergeAccountsInput {
  master: AccountRecord;
  duplicate: AccountRecord;
  fieldResolution: Record<string, FieldResolutionSource>;
}
```

### Signature: `calculateAccountDuplicates`
```typescript
export function calculateAccountDuplicates(
  sourceAccount: AccountRecord,
  allAccounts: AccountRecord[],
): AccountRecord[];
```
* **Algorithm**:
  - Filter out `sourceAccount.id` and accounts with differing `orgId`.
  - Match if:
    - `name` matches exactly (case-insensitive, trimmed).
    - OR `domain` values match exactly (case-insensitive, trimmed) and are not null/empty.
  - Return the filtered list of matching accounts.

### Signature: `mergeAccounts`
```typescript
export function mergeAccounts(input: MergeAccountsInput): AccountRecord;
```
* **Algorithm**:
  - Verify `master.orgId === duplicate.orgId`. If mismatch, throw an error.
  - Resolve primitive fields (`name`, `domain`) according to `fieldResolution` (defaulting to "master").
  - Merge custom JSONB attributes:
    - Identify all keys present in `master.custom` and `duplicate.custom`.
    - If a key exists in both, resolve based on `fieldResolution['custom.' + key]` or default `fieldResolution.custom` or default to master.
    - If only in master, keep master value.
    - If only in duplicate, keep duplicate value.
  - Return the updated `AccountRecord`.

## API Route Design (`apps/api/src/index.ts`)

### `GET /api/accounts/:id/duplicates`
* Middlewares: `tenantAuth`
* Logic:
  1. Retrieve source account via `dbStore.accounts.findOne(id)`. If not found, return 404.
  2. Retrieve all accounts for organization via `dbStore.accounts.findMany()`.
  3. Call `calculateAccountDuplicates(sourceAccount, allAccounts)`.
  4. Return `{ success: true, data: duplicateAccounts }`.

### `POST /api/accounts/:id/merge`
* Middlewares: `tenantAuth`
* Request Body:
  ```json
  {
    "duplicateId": "account-xyz",
    "fieldResolution": {
      "name": "master",
      "domain": "duplicate",
      "custom.industry": "duplicate"
    }
  }
  ```
* Logic:
  1. Find master account (`id`) and duplicate account (`duplicateId`) via `dbStore.accounts.findOne`. If either not found or orgId mismatch, return 404.
  2. Call `mergeAccounts({ master, duplicate, fieldResolution })`.
  3. Update master account using `dbStore.accounts.update(id, mergedValues)`.
  4. Consolidation and Re-parenting:
     - Update all `contacts` where `accountId === duplicateId` to `accountId = id`.
     - Update all `opportunities` where `accountId === duplicateId` to `accountId = id`.
     - Update all `contracts` where `accountId === duplicateId` to `accountId = id`.
     - Update all `activityLinks` where `targetType === 'Account' && targetId === duplicateId` to `targetId = id`.
     - Handle `accountTeams`:
       - Query all account team members for the duplicate account.
       - For each member, check if a member already exists for the master account (`id`) with the same `userId`.
       - If yes, delete the duplicate membership via `dbStore.accountTeams.removeMember(duplicateId, userId)`.
       - If no, update `accountId` from `duplicateId` to `id` for that team member.
  5. Delete duplicate account via `dbStore.accounts.delete(duplicateId)`.
  6. Create audit log entry tracking the merge.
  7. Trigger outbound webhook `account.merged`.
  8. Return `{ success: true, data: mergedMasterAccount }`.

## Database Schema & Store Expansion (`packages/db/src/index.ts`)
* Add `delete` method to `dbStore.accounts` under tenant context RLS isolation:
  ```typescript
  delete: async (id: string) => {
    const orgId = getActiveOrgId();
    const index = store.accounts.findIndex((a) => a.id === id);
    if (index === -1) return false;
    if (store.accounts[index].orgId !== orgId) {
      throw new Error("RLS Isolation Violation: Tenant mismatch.");
    }
    store.accounts.splice(index, 1);
    return true;
  }
  ```
* Add standard array manipulations for updating child relations directly in `apps/api/src/index.ts`.
