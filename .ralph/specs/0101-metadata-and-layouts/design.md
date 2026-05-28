# Specification: Metadata API & Dynamic Field Customization - Design

## Database Storage Expansion
We will expand the in-memory `dbStore` inside `packages/db/src/index.ts` to include:
- `fieldDefinitions` persistent array storing `DBFieldDefinition`:
  ```typescript
  export interface DBFieldDefinition {
    id: string;
    orgId: string;
    objectType: string;
    apiName: string;
    label: string;
    dataType: "text" | "number" | "boolean" | "picklist";
    validationRules: {
      min?: number;
      max?: number;
      options?: string[];
    } | null;
  }
  ```
- `layoutDefinitions` persistent array storing `DBLayoutDefinition`:
  ```typescript
  export interface DBLayoutDefinition {
    id: string;
    orgId: string;
    objectType: string;
    sections: {
      title: string;
      fields: string[];
    }[];
  }
  ```
- Standard RLS isolation find/insert methods on `dbStore.fieldDefinitions` and `dbStore.layoutDefinitions`.

## Dynamic Field Validation Flow
1. When `POST /api/leads` is invoked, query `dbStore.fieldDefinitions.findMany()` under the active tenant context.
2. Filter definitions where `objectType === "leads"`.
3. If custom fields are present in the request body, execute:
   ```typescript
   const validation = validateCustomFields(customInput, definitions);
   ```
4. If `validation.success` is `false`, return a `400` response containing `validation.errors`.

## Form Layout Compilation Flow
- When `GET /api/metadata/layouts/:objectType` is called:
  1. Retrieve the registered layout definition from `dbStore.layoutDefinitions`. If not found, use a default fallback layout.
  2. Retrieve all custom field API names registered for the given `objectType`.
  3. Compile the final layout using `compileFormLayout(customFieldNames, layout)`.
  4. Return the compiled layout section blocks.
