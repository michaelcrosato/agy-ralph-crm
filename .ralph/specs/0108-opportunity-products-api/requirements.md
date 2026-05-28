# Specification: Opportunity Products, Products & Pricebooks API - Requirements

## 1. Functional Requirements

### 1.1 Product Catalog Management
- **REQ-1.1.1:** The system must support creating, retrieving, and listing Products.
- **REQ-1.1.2:** A Product record must contain: `id` (UUID), `orgId` (UUID), `name` (text), `sku` (text, optional), `description` (text, optional), and `isActive` (boolean).
- **REQ-1.1.3:** RLS isolation must apply to all Product operations.

### 1.2 Pricebooks & Entries
- **REQ-1.2.1:** The system must support creating, retrieving, and listing Pricebooks.
- **REQ-1.2.2:** A Pricebook record must contain: `id` (UUID), `orgId` (UUID), `name` (text), `description` (text, optional), `isActive` (boolean), and `isStandard` (boolean).
- **REQ-1.2.3:** The system must support creating Pricebook Entries associating a Product with a Pricebook.
- **REQ-1.2.4:** A Pricebook Entry record must contain: `id` (UUID), `orgId` (UUID), `pricebookId` (UUID), `productId` (UUID), `unitPrice` (text/numeric representation), and `isActive` (boolean).

### 1.3 Opportunity Line Items (Opportunity Products)
- **REQ-1.3.1:** The system must support adding, updating, retrieving, listing, and deleting line items for a specific Opportunity.
- **REQ-1.3.2:** An Opportunity Product record must contain: `id` (UUID), `orgId` (UUID), `opportunityId` (UUID), `pricebookEntryId` (UUID), `quantity` (integer), `unitPrice` (text/numeric representation), and `totalPrice` (text/numeric representation, computed as `quantity * unitPrice`).

### 1.4 Automatic Opportunity Amount Rollup
- **REQ-1.4.1:** Whenever an Opportunity Product line item is created, updated, or deleted, the parent Opportunity's `amount` field must be automatically recalculated.
- **REQ-1.4.2:** The parent Opportunity's `amount` field must equal the sum of the `totalPrice` values of all its linked Opportunity Products.
- **REQ-1.4.3:** If all line items are deleted from an Opportunity, the Opportunity's `amount` field must be updated to `"0"`.
- **REQ-1.4.4:** The rollup calculation must run inside a pure core utility to ensure deterministic testability.

## 2. Non-Functional & Security Requirements
- **REQ-2.1:** Strict multi-tenant Row-Level Security (RLS) isolation: users must never be able to access, create, or modify products, pricebooks, entries, or opportunity line items belonging to another tenant organization.
- **REQ-2.2:** Compile-time type-safety: all database records, request inputs, and API responses must have strict TypeScript types.
- **REQ-2.3:** Full test coverage: unit tests for pure core utilities and integration tests for Hono REST endpoints.
