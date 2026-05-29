# Specification: CPQ PDF Generator - Requirements

## 1. Functional Requirements

### 1.1 CPQ Pricing & Discount Engine
- **REQ-1.1.1**: The system must calculate discounts dynamically based on quantity tiers for opportunity line items:
  - **Tier 1**: Quantity 1-9: 0% discount.
  - **Tier 2**: Quantity 10-49: 10% discount.
  - **Tier 3**: Quantity 50-99: 15% discount.
  - **Tier 4**: Quantity 100+: 20% discount.
- **REQ-1.1.2**: The CPQ engine must allow applying a custom manual discount percentage at the calculation step, which takes precedence or adds to the tiered discount (maximum of either tiered or manual discount).
- **REQ-1.1.3**: The pricing calculations must return: `subtotal`, `discountAmount`, and `totalPrice`.

### 1.2 Quote Compilation
- **REQ-1.2.1**: The system must assemble opportunity line items (associated with the opportunity via `opportunityProducts`) into a clean, modern HTML tabular layout.
- **REQ-1.2.2**: The HTML template compiler must support variables:
  - `{{Account.name}}`
  - `{{Opportunity.name}}`
  - `{{Opportunity.amount}}`
  - `{{Date}}`
  - `{{LineItemsTable}}`
- **REQ-1.2.3**: If the user provides a `templateId`, the system must retrieve the template from the database. Otherwise, it must fall back to a beautifully structured standard default HTML template.

### 1.3 REST API Endpoints
- **REQ-1.3.1**: `POST /api/opportunities/:id/quote` - Generate a new quote.
  - Optional body parameters: `templateId` (UUID/string), `customDiscountPercentage` (number).
  - Calculates discounts, compiles the quote, inserts a record into `mergedDocuments` representing the generated quote, and returns the generated HTML and calculations.
- **REQ-1.3.2**: `GET /api/opportunities/:id/quote` - Retrieve the current quote document and calculation parameters for the Opportunity.

## 2. Security & Verification Requirements
- **REQ-2.1**: Strict tenant RLS: a tenant must never be allowed to view opportunity lines, create quotes, or retrieve quotes belonging to another organization.
- **REQ-2.2**: Complete TypeScript compilation with zero errors.
- **REQ-2.3**: Comprehensive Vitest validation confirming CPQ pricing arithmetic and multi-tenant RLS checks.
