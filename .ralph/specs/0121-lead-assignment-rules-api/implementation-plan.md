# Task 0121: Lead Assignment Rules & Auto-Routing Engine - Implementation Plan

## Phase 1: Database Schema Expansion
1. Edit `packages/db/src/schema.ts` to add the `leadAssignmentRules` and `leadAssignmentRuleEntries` tables.
2. Edit `packages/db/src/index.ts` to export the new schemas, define mock store collections for them, and extend the mock store database schema with RLS enforcement.

## Phase 2: Core Routing Engine Implementation
1. Add `CriteriaCondition`, `RuleEntryInput`, `RoutingMatchResult`, and `evaluateLeadAssignment` to `packages/core/src/index.ts`.
2. Implement robust criteria matching that handles standard fields and custom JSONB fields properly.
3. Build circular index mapping for Round-Robin assignments.

## Phase 3: REST API Middleware & Endpoint Integration
1. Edit `apps/api/src/index.ts` to register endpoints for lead assignment rules management and lead routing execution.
2. Ensure active tenant context propagates properly and RLS is strictly enforced (Tenant A cannot see Tenant B's rules).
3. Ensure an audit trail record is written when a lead is successfully auto-routed.

## Phase 4: Verification & Integration Testing
1. Add `packages/testing/src/lead-assignment.test.ts` to fully assert multi-tenant isolation, Direct and Round-Robin assignments, criteria evaluations, and audit logs.
2. Run `pnpm verify` to confirm workspace compiles cleanly and all test suites pass.
