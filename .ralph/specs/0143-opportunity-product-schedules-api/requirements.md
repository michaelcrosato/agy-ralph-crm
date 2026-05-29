# Specification: Opportunity Product Schedules API - Requirements

## 1. Functional Requirements
- **Schedule Creation & Updates**: Users must be able to add individual schedules (Revenue or Quantity) to an active Opportunity Product. Each schedule must contain a date, type, amount/quantity, and optional description.
- **Straight-Line Generation**: The system must provide a utility to generate straight-line monthly schedules. For example, a $12,000 product line item split over 12 months should create 12 schedules of $1,000 each.
- **Audit Logging**: Any schedule creation, generation, or deletion must be captured in the immutable tenant audit ledger.
- **Validation**:
  - The date of each schedule must be valid.
  - The type of schedule must be either "revenue" or "quantity".
  - The total amount/quantity allocated in schedules must not exceed the Opportunity Product's total amount/quantity.
  - Invalid UUIDs or malformed inputs must return 400 Bad Request.

## 2. Security & Tenancy Requirements
- **Active Tenant RLS**: Row-Level Security must prevent cross-tenant leakage. A user in Tenant A must NEVER be able to read, update, or delete schedules belonging to Tenant B.
- **Authentication**: All endpoint requests must be validated using JWT session tokens.
- **No Orphaned Records**: Opportunity Product Schedules must cascade delete if the parent Opportunity Product or Opportunity is deleted.
