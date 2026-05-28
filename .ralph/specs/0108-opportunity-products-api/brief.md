# Specification: Opportunity Products, Products & Pricebooks API - Brief

## Objective
Establish database stores, pure utility mapping/rollup functions inside `packages/core`, and Hono REST API endpoints inside `apps/api` for managing standard Products, Pricebooks, Pricebook Entries, and Opportunity Line Items (Opportunity Products). When line items are added, updated, or removed, the CRM will automatically calculate and update the total `amount` of the associated `Opportunity` record under strict tenant Row-Level Security (RLS) isolation.

## Boundaries & Constraints
- Database schemas for `products`, `pricebooks`, `pricebook_entries`, and `opportunity_products` reside in `packages/db`.
- Rollup calculation and validation logic reside in `packages/core`.
- REST API routes for product catalog management and opportunity product lines reside in `apps/api`.
- Modifying opportunity products must dynamically trigger a pure rollup computation that updates the parent opportunity's overall `amount` value.
- All operations must execute under verified session authorization and tenant RLS isolation contexts.
