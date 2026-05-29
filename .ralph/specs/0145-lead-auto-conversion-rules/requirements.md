# Specification: Lead Auto-Conversion Rules & Criteria Engine - Requirements

## 1. Functional Requirements
- **Rule Definition**: Users must be able to create, read, and toggle Lead Auto-Conversion Rules per tenant.
- **Criteria Types**: Support criteria matched against:
  - Lead Score (e.g. `{"field": "score", "operator": "greater_or_equal", "value": 90}`)
  - Lead Status (e.g. `{"field": "status", "operator": "equals", "value": "Qualified"}`)
- **Action Execution**: When criteria are satisfied:
  - Automatically create a `DBAccount` named after the lead's company (fallback to email-based name).
  - Automatically create a `DBContact` mapping first/last name, email, and owner.
  - Optionally create a `DBOpportunity` if `createOpportunity` is checked on the rule, with default closing period and stage.
  - Link the converted IDs (`convertedAccountId`, `convertedContactId`) on the Lead record and mark it converted.
- **Ownership Alignment**: The newly created Account, Contact, and Opportunity must inherit the lead's current owner or fallback to the first active user.
- **Downstream Webhooks & Audit Logs**:
  - Insert audit logs for the newly created account, contact, and opportunity, as well as the converted lead.
  - Dispatch a `lead.converted` outbound webhook asynchronously with the details of all generated records.

## 2. Multi-Tenant RLS & Security Requirements
- **RLS Boundary**: No organization can view or execute another organization's auto-conversion rules.
- **Tenant Context wrapping**: The automatic conversion transaction must run entirely wrapped inside `withTenant(orgId, mockDb, ...)` to ensure that no database leakage is possible, and any failure rolls back all generated records.

## 3. Performance & Verification
- **Compilation**: Must build cleanly without typescript compiler errors.
- **Formatting**: Must comply with Biome linting and formatting rules.
- **Integration Tests**: Provide a comprehensive integration test suite validating:
  - Rule CRUD and RLS isolation.
  - Successful auto-conversion when updating a lead to meet criteria.
  - Correct creation and relation of Account, Contact, and Opportunity records.
  - Validation of audit trail insertion and webhook dispatch.
