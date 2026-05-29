# Specification: Opportunity Teams & Collaborative Roles API - Requirements

## 1. Functional Requirements

### 1.1 Opportunity Teams Management
- **REQ-1.1.1**: The system must allow creating opportunity team members.
- **REQ-1.1.2**: An Opportunity Team record must contain: `id` (UUID/string), `orgId` (UUID/string), `opportunityId` (UUID/string), `userId` (UUID/string), `role` (text), `createdAt` (Date).
- **REQ-1.1.3**: The supported roles must be: `Opportunity Owner`, `Sales Representative`, `Sales Engineer`, `Executive Sponsor`, and `Other`.
- **REQ-1.1.4**: RLS tenant isolation must govern all opportunity team operations.

### 1.2 REST API Endpoints
- **REQ-1.2.1**: `GET /api/opportunities/:id/team` - List all team members associated with an Opportunity under tenant isolation.
- **REQ-1.2.2**: `POST /api/opportunities/:id/team` - Add a new team member or update their role on the Opportunity. Requires body parameters: `userId` (UUID/string) and `role` (text).
- **REQ-1.2.3**: `DELETE /api/opportunities/:id/team/:userId` - Remove a team member from the Opportunity.
- **REQ-1.2.4**: All modifications (adds, updates, deletions) must create a corresponding `audit_logs` entry under the `opportunities` record ID.

## 2. Security & Verification Requirements
- **REQ-2.1**: Strict tenant RLS: a tenant must never be allowed to view, add, or delete opportunity team members belonging to another organization.
- **REQ-2.2**: Complete TypeScript compilation with zero errors.
- **REQ-2.3**: Comprehensive Vitest validation confirming role validation, audit trails, and multi-tenant RLS checks.
