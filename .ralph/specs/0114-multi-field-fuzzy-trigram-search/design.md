# Specification: Multi-Field Fuzzy Trigram Search - Design

## 1. Unified Search Aggregator (`packages/search/src/index.ts`)

We will add a global search aggregator utility function to `@crm/search`:

```typescript
import { dbStore } from "@crm/db";

export interface GlobalSearchOptions {
  types?: ("Lead" | "Account" | "Contact" | "Opportunity")[];
  threshold?: number;
}

export async function globalFuzzySearch(
  query: string,
  options?: GlobalSearchOptions
): Promise<SearchResult[]> {
  // 1. Resolve search options
  const targetTypes = options?.types || ["Lead", "Account", "Contact", "Opportunity"];
  const threshold = options?.threshold ?? 0.1;

  const results: SearchResult[] = [];

  // 2. Fetch custom field definitions to search custom fields dynamically
  const fieldDefs = await dbStore.fieldDefinitions.findMany().catch(() => []);

  // helper to get text/picklist fields for a given object type
  const getSearchFields = (objType: string, baseFields: string[]): string[] => {
    const customFields = fieldDefs
      .filter((def) => def.objectType === objType && (def.dataType === "text" || def.dataType === "picklist"))
      .map((def) => def.apiName);
    return [...baseFields, ...customFields];
  };

  // 3. Search and aggregate matching records
  if (targetTypes.includes("Lead")) {
    const leads = await dbStore.leads.findMany();
    const searchFields = getSearchFields("leads", ["email", "company"]);
    const matched = fuzzySearchRecords(leads, query, searchFields, threshold);
    for (const m of matched) {
      results.push({ record: m.record, recordType: "Lead", score: m.score });
    }
  }

  if (targetTypes.includes("Account")) {
    const accounts = await dbStore.accounts.findMany();
    const searchFields = getSearchFields("accounts", ["name", "domain"]);
    const matched = fuzzySearchRecords(accounts, query, searchFields, threshold);
    for (const m of matched) {
      results.push({ record: m.record, recordType: "Account", score: m.score });
    }
  }

  if (targetTypes.includes("Contact")) {
    const contacts = await dbStore.contacts.findMany();
    const searchFields = getSearchFields("contacts", ["firstName", "lastName", "email"]);
    const matched = fuzzySearchRecords(contacts, query, searchFields, threshold);
    for (const m of matched) {
      results.push({ record: m.record, recordType: "Contact", score: m.score });
    }
  }

  if (targetTypes.includes("Opportunity")) {
    const opportunities = await dbStore.opportunities.findMany();
    const searchFields = getSearchFields("opportunities", ["stage"]);
    const matched = fuzzySearchRecords(opportunities, query, searchFields, threshold);
    for (const m of matched) {
      results.push({ record: m.record, recordType: "Opportunity", score: m.score });
    }
  }

  // 4. Sort aggregated results by score descending
  results.sort((a, b) => b.score - a.score);

  return results;
}
```

## 2. Hono API Routes (`apps/api/src/index.ts`)

- **GET `/api/search`**:
  - Authenticated via the `tenantAuth` middleware.
  - Takes query parameter `q` (required search term).
  - Takes optional parameter `types` (comma-separated list, e.g. `types=Lead,Account`).
  - Takes optional parameter `threshold` (numeric, e.g. `threshold=0.2`).
  - Returns a JSON response containing `{ success: true, data: SearchResult[] }`.
