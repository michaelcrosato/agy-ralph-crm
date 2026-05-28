# Phase 3: Metadata Customization Engine & Analytical Reporting - Implementation Plan

## Code Generation Steps

### Step 1: Database Table Extensions
Modify `packages/db/src/schema.ts` to add the core tables:
* `fieldDefinitions`
* `layoutDefinitions`

Export all schemas cleanly from `packages/db/src/index.ts`.

### Step 2: Dynamic Input Validation Engine
Implement the metadata validation functions inside `packages/metadata/src/index.ts`. It parses `Record<string, unknown>` and asserts correct typing against `FieldDefinition[]`.

### Step 3: Layout Metadata Formatter
Implement layout compiler formats inside `packages/metadata/src/index.ts` to organize custom field items into ordered UI groups.

### Step 4: Verification Tests
Create `packages/testing/src/metadata.test.ts` to verify that dynamic validation correctly checks numeric boundaries, picklist options, boolean mappings, and returns descriptive error paths.

### Step 5: Verify & Push
Run `pnpm verify` and `pnpm test` to ensure Phase 3 compiles and executes cleanly.
