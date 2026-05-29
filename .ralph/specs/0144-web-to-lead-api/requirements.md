# Specification: Public Web-to-Lead Capture API - Requirements

## 1. Functional Requirements
- **Unauthenticated Entrypoint**: The endpoint must accept incoming POST requests without an `Authorization` header.
- **Payload Requirements**: The request payload must contain:
  - `orgId` (UUID/string): Target tenant organization identifier.
  - `lastName` (string): Last name of the lead (mandatory).
  - `email` (string): Email of the lead (mandatory).
  - `firstName` (string, optional): First name.
  - `company` (string, optional): Company name.
  - `custom` (object, optional): Custom field key-value pairs matching defined metadata fields.
  - `ownerId` (string, optional): Requested fallback owner if assignment rules do not match.
- **Automated Routing**:
  - The engine must fetch active Lead Assignment Rules for the tenant.
  - If a rule is active, evaluate incoming lead data against the rule entries.
  - If a match occurs, assign the lead to the specified user and update the round-robin index if appropriate.
  - If no match occurs or no rule exists, assign the lead to the requested `ownerId` if valid, or fallback to the first active user of the organization.
- **Dynamic Field Validation**: If `custom` metadata fields are submitted, validate them against the tenant's defined custom field rules using `validateCustomFields`. If validation fails, return 400 Bad Request.

## 2. Tenancy & Security Requirements
- **Dynamic RLS Activation**: Although the endpoint is public, database execution must be safely isolated. The handler MUST look up the organization by `orgId` first, verify its status is active, and then wrap all database calls in a transaction using `withTenant(orgId, mockDb, async () => { ... })`.
- **Cross-Tenant Prevention**: A request containing Tenant A's `orgId` must NEVER insert records, access rules, or query users belonging to Tenant B. Tenancy isolation must remain absolute.

## 3. Auditing & Lifecycle Triggers
- **Audit Trails**: Upon successful lead insertion, a record must be created in `audit_logs` tracking the creation action. The `userId` of the audit entry should be the system default user, the assigned owner, or a generic placeholder (e.g. `user-system` or `user-a` depending on the environment).
- **Outbound Webhooks**: Dispatch a `lead.created` event asynchronously to all active webhook subscriptions for the target tenant org.
