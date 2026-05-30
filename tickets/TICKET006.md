# TICKET006: Dynamic Picklist Dependency Validation

## Details
- **Status**: completed
- **Priority**: Medium
- **Goal**: Implement server-side check hooks for Hono REST API mapping rules to reject Lead creation if custom picklist dependent values violate organization validation metadata.
- **Context**: Prevents data pollution when agents or users submit invalid text payloads that violate state-city or industry-subindustry relationships.

---

## Scope

### In Scope
- Inspect `picklistDependencies` records defined under the active tenant's metadata.
- Update `/api/leads` and `/api/contacts` post/put endpoints in `apps/api/src/index.ts` to execute `enforcePicklistDependencies`.
- If a picklist field violates constraints, return `400 Bad Request` with an exact error message reporting the invalid pairing.
- Develop Vitest suite `packages/testing/src/picklist-dependency-validation.test.ts`.

### Out of Scope
- Frontend client-side select rendering updates.

---

## Technical Mappings

- **Likely Files**:
  - `apps/api/src/index.ts`
  - `packages/testing/src/picklist-dependency-validation.test.ts`

---

## Steps to Execute
1. Integrate `enforcePicklistDependencies` check routines within POST/PUT Lead controller blocks.
2. Formulate proper JSON payload rejection error responses.
3. Confirm workspace code compilation with `pnpm verify`.
4. Run targeted tests via `npx vitest run packages/testing/src/picklist-dependency-validation.test.ts`.

---

## Acceptance Criteria
- [x] Mismatched dependent picklist values (e.g. state "California", city "Seattle") reject Lead creation with code `400`.
- [x] Valid dependent values (e.g. state "California", city "San Francisco") persist successfully.
- [x] Verification validation enforces strict tenant organization boundaries.

---

## Commands
```bash
npx vitest run packages/testing/src/picklist-dependency-validation.test.ts
pnpm verify
```

---

## Risks & Notes
- **Risk**: Complex dependency hierarchies dragging down write response latency.
- **Note**: Optimize lookup maps in-memory for cached layouts validation.
