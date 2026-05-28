# Specification: Opportunities Pipeline & Stage Management REST API - Requirements

## Functional Requirements
1. **REST API Endpoints:**
   - `GET /api/opportunities` - Retrieves all opportunities for the active organization, filtered by active tenant context.
   - `GET /api/opportunities/:id` - Retrieves a specific opportunity by ID, returning a 404 error if not found or if RLS filters it out.
   - `POST /api/opportunities` - Creates a new sales opportunity under the active tenant, requiring `name`, `stage`, and `accountId`.
   - `PATCH /api/opportunities/:id` - Partially updates an opportunity's fields (`name`, `stage`, `amount`, `closeDate`).
2. **Workflow Automation Integration:**
   - Changing an opportunity's `stage` via the `PATCH` endpoint MUST automatically trigger any registered tenant workflows matching the `opportunity.stage_changed` event.
   
## Security & Isolation Requirements
1. **Multi-Tenant Isolation:**
   - Tenants MUST NOT be able to view, query, create, or update opportunities belonging to another organization.
   - Attempts to access other organization opportunities must return `404 Not Found` (or `401/403` where relevant) to prevent resource enumeration.
2. **Integration Verification:**
   - Create integration tests verifying basic CRUD operations, tenant RLS isolation, and workflow trigger execution when an opportunity stage transitions.
