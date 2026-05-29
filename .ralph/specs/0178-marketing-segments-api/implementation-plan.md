# Specification: Marketing Segments & Dynamic Lists API - Implementation Plan

## 1. Step-by-Step Code Generation Sequence

1. **Database Schema Extension**:
   - Update `packages/db/src/schema.ts` to add the `marketingSegments` table.
   - Update `packages/db/src/index.ts` to declare `DBMarketingSegment` interfaces, add `marketingSegments` to the list of stores, and implement standard CRUD/find operations on `dbStore`.

2. **Core Domain Evaluation Logic**:
   - Update `packages/core/src/index.ts` to export `evaluateSegmentCriteria` and `resolveSegmentMembers` functions. Add dynamic evaluation support for custom fields.

3. **Hono REST Routes**:
   - Update `apps/api/src/index.ts` to import `resolveSegmentMembers` and add the `/api/segments` endpoints:
     - `POST /api/segments`
     - `GET /api/segments`
     - `GET /api/segments/:id`
     - `DELETE /api/segments/:id`
     - `GET /api/segments/:id/members`

4. **Integration Test Scaffolding**:
   - Create `packages/testing/src/marketing-segments.test.ts`. Write comprehensive assertions matching dynamic criteria filters, custom fields, and tenant RLS isolation.

5. **Verification Pipeline**:
   - Run `pnpm verify` to ensure the entire workspace compiles, format constraints check out cleanly, and all tests pass with flying colors.
