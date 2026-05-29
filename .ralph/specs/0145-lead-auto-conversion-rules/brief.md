# Specification: Lead Auto-Conversion Rules & Criteria Engine - Brief

## 1. Functional Objective
This feature introduces automated lead conversion to the CRM core system. In standard commercial CRM architectures, manual lead conversion can be slow. Automating this process when a lead is qualified (e.g. through lead scoring rules reaching a threshold or specific picklist status changes) is a major commercial accelerator. 

The engine will evaluate incoming leads and lead updates against active Auto-Conversion Rules. If a lead meets the rule criteria (e.g., Lead Score >= 90), the system will automatically convert the lead into a corresponding Account, Contact, and optionally an Opportunity under the active tenant's Row-Level Security (RLS) context. It will also copy custom field mappings, set correct owners, log immutable audit trails, and trigger outbound webhooks.

## 2. Technical Scope
- **Database Schema**: Add `lead_auto_conversion_rules` table under `packages/db` containing criteria conditions and options (like whether to generate opportunities).
- **Core Rules Engine**: Create a core evaluator `evaluateLeadAutoConversion` in `packages/core` that validates if a lead record satisfies the defined rule criteria (handling numeric/score and text-based status criteria).
- **REST Endpoints**: Expose endpoints for managing auto-conversion rules (`GET`, `POST /api/leads/auto-conversion-rules`) and triggering lead updates with automatic evaluation.
- **Tenant RLS & Security**: Ensure all rule queries and subsequent account/contact/opportunity creations are tightly bound to the current tenant's active context via `withTenant`.
- **Downstream Operations**: Generate proper `audit_logs` entries, evaluate Lead Assignment Rules for the new records if applicable, and trigger outbound webhooks (`lead.converted`, `account.created`, `contact.created`, `opportunity.created`).
