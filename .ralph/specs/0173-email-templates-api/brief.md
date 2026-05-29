# Specification: Email HTML Templates & Merge Fields Engine API - Brief

## 1. Functional Objective
This feature introduces an enterprise-grade Email HTML Templates & Personalization Merge Engine for CRM communications.
It allows tenants to define reusable email templates with custom HTML/text bodies containing dynamic merge fields (e.g. `{{Lead.company}}`, `{{Contact.firstName}}`, `{{Lead.custom.score}}`).
Users can then compile these templates dynamically by referencing specific Lead, Account, Contact, or Opportunity records. The engine resolves the merge fields using the target record's standard and custom properties under active tenant RLS bounds.

## 2. Technical Scope
- **Tenancy Isolation**: Email templates must be stored and queried strictly within active tenant RLS bounds.
- **REST Endpoints**:
  - `POST /api/metadata/email-templates` - Register/create a reusable email template.
  - `GET /api/metadata/email-templates` - List active email templates for the tenant.
  - `DELETE /api/metadata/email-templates/:id` - Delete an active email template.
  - `POST /api/metadata/email-templates/:id/compile` - Compile the template's subject and body using active records.
- **Compile Engine**:
  - Implement a merge fields template compiler in the core business logic layer.
  - Support `{{Lead.Field}}`, `{{Contact.Field}}`, `{{Account.Field}}`, `{{Opportunity.Field}}`, and their custom JSONB fields `{{Object.custom.Field}}`.
- **Verification**: Integration tests asserting RLS isolation, correct merge field resolution for standard and custom fields, and invalid record handling.
