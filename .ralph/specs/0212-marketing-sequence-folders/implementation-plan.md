# Specification: Marketing Sequence Folders & Tag Categorization - Implementation Plan

## 1. Phase 1: Core Logic
- Append `validateHexColor` and `detectFolderLoop` core methods to `packages/core/src/index.ts`.
- Run typecheck in `packages/core` to confirm syntax correctness.

## 2. Phase 2: Schema & Mock Store
- Add `marketingSequenceFolders`, `marketingSequenceTags`, and `marketingSequenceTagMappings` schemas to `packages/db/src/schema.ts`. Add optional `folderId` column to `marketingSequences`.
- Expose `DBMarketingSequenceFolder`, `DBMarketingSequenceTag`, and `DBMarketingSequenceTagMapping` interfaces and corresponding CRUD methods inside `dbStore` inside `packages/db/src/index.ts`.
- Ensure `dbStore.clear()` clears all folders, tags, and tag mappings.

## 3. Phase 3: Hono Routes
- Mount the folders and tags CRUD endpoints under `apps/api/src/index.ts`.
- Add active tenant verification and RLS isolation checks on inputs/outputs.
- Update `/api/sequences` endpoints to handle updates to `folderId` and support querying/filtering.

## 4. Phase 4: Verification Suite
- Create integration test suite `packages/testing/src/marketing-sequence-folders.test.ts`.
- Run `pnpm verify` to confirm building, lint checks, and testing compile clean.
