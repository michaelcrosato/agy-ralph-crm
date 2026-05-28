# Specification: Activities & Chronological Task Timelines REST API - Requirements

## Functional Requirements
1. **Database Schema & Store Extensions:**
   - Extend the relational mock store in `packages/db` with `activities` and `activityLinks` structures.
   - Activities must support types: `task`, `call`, `note`, `email`.
   - Activity links must support target types: `Account`, `Contact`, `Lead`, `Opportunity`.
2. **REST API Endpoints:**
   - `POST /api/activities` - Creates a new activity under the tenant, and maps linkages to CRM records via optional `links` parameter (array of `{ targetType, targetId }`).
   - `GET /api/activities/:id` - Retrieves a specific activity by ID.
   - `GET /api/activities/timeline/:targetType/:targetId` - Gathers and returns all activities linked to the specified record, sorted reverse chronologically (`createdAt` desc).

## Security & Isolation Requirements
1. **RLS Tenant Isolation:**
   - All operations must enforce active tenant filtering. Linking to or viewing activities of other organizations is strictly blocked.
2. **Verification Requirements:**
   - Add integration tests verifying correct CRUD behavior, link creation, and timeline sequence ordering.
