# Specification: Email HTML Templates & Merge Fields Engine API - Requirements

## 1. Functional Requirements

### 1.1 Email Template CRUD
- Tenants must be able to create, view, list, and delete email templates.
- An email template consists of:
  - `name`: A descriptive name for the template (e.g. "Lead Nurturing Welcome").
  - `subject`: The subject line template supporting merge fields (e.g. "Welcome to Ralph, {{Contact.firstName}}!").
  - `body`: The HTML or plain text body template supporting merge fields (e.g. "Hi {{Contact.firstName}}, thanks for registering {{Lead.company}}.").
- Email templates are private to each tenant organization.

### 1.2 Merge Fields Compilation Engine
- The merge engine must replace placeholders formatted as `{{Object.Field}}` with resolved values from the respective record context.
- Supported objects:
  - `Lead` -> `{{Lead.company}}`, `{{Lead.status}}`, `{{Lead.email}}`
  - `Contact` -> `{{Contact.firstName}}`, `{{Contact.lastName}}`, `{{Contact.email}}`
  - `Account` -> `{{Account.name}}`, `{{Account.domain}}`
  - `Opportunity` -> `{{Opportunity.name}}`, `{{Opportunity.stage}}`, `{{Opportunity.amount}}`
- Support lookup of custom properties in dynamic JSONB fields, formatted as `{{Object.custom.Field}}` (e.g., `{{Lead.custom.score}}`).
- Unresolved or missing fields should be replaced with an empty string `""` to prevent placeholder leaks.

### 1.3 Tenant Security (RLS)
- Templates must be fully isolated by `orgId`. A tenant cannot create, fetch, compile, or delete another tenant's email templates.
- Compiling templates must only load records (Leads, Contacts, Accounts, Opportunities) that belong to the active tenant's context.

---

## 2. Interface Requirements

### 2.1 REST API Routes
- **`POST /api/metadata/email-templates`**
  - Payload: `{ name: string, subject: string, body: string }`
  - Response: Saved email template object with generated UUID and `orgId`.
- **`GET /api/metadata/email-templates`**
  - Response: Array of email templates for the active tenant.
- **`DELETE /api/metadata/email-templates/:id`**
  - Response: `{ success: boolean }`
- **`POST /api/metadata/email-templates/:id/compile`**
  - Payload: `{ leadId?: string, contactId?: string, accountId?: string, opportunityId?: string }`
  - Response: `{ compiledSubject: string, compiledBody: string }`
