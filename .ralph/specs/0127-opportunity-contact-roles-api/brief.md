# Spec 0127: Opportunity Contact Roles API Brief

## Objective
Enable tracking of key stakeholders and contacts associated with a Sales Opportunity in the CRM Core. An opportunity is rarely closed by a single individual; sales teams need to understand who the Decision Makers, Influencers, and Technical Buyers are. This feature provides a robust, multi-tenant Row-Level Security (RLS) isolated engine to assign contacts to opportunities with specific roles, designate a single "Primary" contact, and manage these relationships securely via a clean REST API.

## Scope
* **Core Business Logic**: Implement a pure function (`setPrimaryOpportunityContactRole`) that manages and enforces the single-primary stakeholder invariant for an opportunity.
* **Database & Store Actions**: Update `packages/db` to define `opportunityContactRoles` schema and store, enforcing active tenant RLS isolation and providing standard CRUD operations.
* **REST API Endpoints**:
  - `GET /api/opportunities/:id/contact-roles`: Query all contact roles for a specific opportunity under tenant isolation.
  - `POST /api/opportunities/:id/contact-roles`: Assign a contact to an opportunity with a specified role (and optional primary status).
  - `PUT /api/opportunities/:id/contact-roles/:roleId`: Update a contact role or change primary status, ensuring any other primary contact on the opportunity is demoted.
  - `DELETE /api/opportunities/:id/contact-roles/:roleId`: Remove a contact role assignment from an opportunity.
* **Audit Trail & Webhooks**: Log detailed audit trail entries tracking assignment, updates, and removals of contact roles, and trigger appropriate outbound webhook events (`opportunity.contact_role.created`, `opportunity.contact_role.updated`, `opportunity.contact_role.deleted`).
* **Row-Level Security**: Guarantee complete tenant isolation—preventing any cross-tenant leakage where one tenant can view or mutate contact roles belonging to another.
