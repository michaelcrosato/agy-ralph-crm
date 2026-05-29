# Task 0165: Database Migration & Rollback Engine - Implementation Plan

## 1. DB Schema & Store Update
- Modify `packages/db/src/schema.ts` to add `schemaMigrations` pgTable.
- Modify `packages/db/src/index.ts` to:
  - Add `DBSchemaMigration` interface.
  - Add `schemaMigrations` array to the global in-memory `store` object.
  - Implement `dbStore.schemaMigrations` CRUD functions (`findMany`, `findOne`, `insert`).
  - Add `schemaMigrations` array reset to `store.clear()`.

## 2. Core Migration Logic
- Modify `packages/core/src/index.ts` to:
  - Export interface `DBStoreMigration`.
  - Add `registeredMigrations` list with 2 core migrations (e.g. Migration 1: Default status updater, Migration 2: Column/tag initializer).
  - Implement `runStoreMigrations(dbStore: any, targetVersion?: number)` to fetch currently applied versions, sort missing versions, run `up`, and record the run in `schemaMigrations`.
  - Implement `rollbackStoreMigrations(dbStore: any, targetVersion: number)` to fetch applied migrations, sort in reverse, run `down`, and delete matching migration runs.

## 3. REST API Integration
- Update `apps/api/src/index.ts` to register:
  - `GET /api/db/migrations` using `tenantAuth` middleware.
  - `POST /api/db/migrate` using `tenantAuth` middleware.
  - `POST /api/db/rollback` using `tenantAuth` middleware.

## 4. Tests Implementation
- Create `packages/testing/src/migration-rollback.test.ts` to assert:
  - Running migrations sequentially from version 0.
  - Rolling back migrations sequentially to version 0 or 1.
  - RLS checks asserting migration tables are tenant isolated or managed.
