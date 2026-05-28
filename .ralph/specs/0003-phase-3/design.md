# Phase 3: Metadata Customization Engine & Analytical Reporting - Design

## Database Schema (Drizzle ORM)

We will define `field_definitions` and `layout_definitions` in `packages/db/src/schema.ts`:

* **`fieldDefinitions`**
  * `id`: uuid (primary key)
  * `orgId`: uuid (tenant link)
  * `objectType`: text (e.g., "accounts", "contacts", "leads")
  * `apiName`: text (unique api name, e.g., "custom_net_worth")
  * `label`: text
  * `dataType`: text (e.g., "text", "number", "boolean", "picklist")
  * `validationRules`: jsonb (e.g., min, max, options)

* **`layoutDefinitions`**
  * `id`: uuid (primary key)
  * `orgId`: uuid
  * `objectType`: text
  * `sections`: jsonb (structured list of form sections and ordered field arrays)

## Metadata Validator & Compiler Contracts

In `packages/metadata/src/index.ts`:
* Validate dynamic inputs:
```typescript
export interface FieldDefinition {
  apiName: string;
  dataType: "text" | "number" | "boolean" | "picklist";
  validationRules?: {
    min?: number;
    max?: number;
    options?: string[];
  };
}

export function validateCustomFields(
  fields: Record<string, unknown>,
  definitions: FieldDefinition[]
): { success: boolean; errors?: string[] };
```
