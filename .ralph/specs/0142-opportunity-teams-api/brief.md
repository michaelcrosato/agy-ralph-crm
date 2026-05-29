# Specification: Opportunity Teams & Collaborative Roles API - Brief

## 1. Functional Objective
This feature introduces Opportunity Teams and Collaborative Roles to the modular CRM core database and API routing layer. The system will support assigning team members (e.g. Sales Representative, Sales Engineer, Executive Sponsor) to dynamic sales opportunities, allowing collaborative credit allocation, better pipeline transparency, and robust security management.

## 2. Technical Scope
- **Tenancy Isolation**: The opportunity teams store must integrate fully with the tenant context and `AsyncLocalStorage` RLS context.
- **Pure Core Logic**: Core validation of opportunity team members and roles will reside in `@crm/core`.
- **REST Endpoints**:
  - `GET /api/opportunities/:id/team` - Retrieve opportunity team members.
  - `POST /api/opportunities/:id/team` - Add or update a team member.
  - `DELETE /api/opportunities/:id/team/:userId` - Remove a team member.
- **Verification**: Complete unit and integration test coverage verifying multi-tenant isolation, role validation, audit trail entries, and API routing.
