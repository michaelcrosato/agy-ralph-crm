# Spec 0138: Lead Conversion Field Mapping Engine Requirements

## Functional Requirements

### 1. Database Schema & Persistence (`lead_conversion_mappings`)
* Define the database table `lead_conversion_mappings` with fields:
  - `id`: Unique identifier (UUID, primary key, auto-generated).
  - `orgId`: Tenant organization reference (UUID, references `organizations.id`, cascade delete, not null).
  - `sourceLeadField`: The field path on the Lead (Text, not null). Can be standard (e.g. `email`) or custom (e.g. `custom.industry`).
  - `targetObjectType`: The target destination model (Text, not null). Must validate to "accounts", "contacts", or "opportunities".
  - `targetField`: The field path on the target object (Text, not null). Can be standard (e.g. `domain`) or custom (e.g. `custom.industry`).
  - `createdAt`: Timestamp (default `now()`, not null).

### 2. Core Calculations (`convertLeadWithMappings`)
* Add a pure function `convertLeadWithMappings` under `packages/core/src/index.ts`.
* **Input**:
  - `lead`: The source Lead record.
  - `opportunityName`: Optional name for the opportunity.
  - `opportunityAmount`: Optional amount for the opportunity.
  - `mappings`: Array of mapping configurations (each containing `sourceLeadField`, `targetObjectType`, and `targetField`).
* **Output**:
  - `ConvertedEntities`: The Account, Contact, and Opportunity entity payloads with all standard and custom mapped fields resolved.
* **Rules**:
  - Resolve values from standard Lead fields or nested `custom` object keys depending on prefix.
  - Apply resolved values to target fields. If target field starts with `custom.`, map to the custom JSONB sub-properties. Otherwise, map to the standard fields of the target entity.

### 3. REST API Endpoints in `apps/api/src/index.ts`
* All endpoints MUST be secured with the `tenantAuth` middleware to enforce active tenant contexts.
* **GET `/api/lead-conversions/mappings`**:
  - Query and return all field mappings configured for the active organization.
* **POST `/api/lead-conversions/mappings`**:
  - Validate request body: `sourceLeadField`, `targetObjectType`, and `targetField` are required and must not be empty. `targetObjectType` must be one of "accounts", "contacts", or "opportunities".
  - Save the new mapping record.
  - Write a `create_conversion_mapping` audit log.
  - Return the created mapping record with status `201 Created`.
* **DELETE `/api/lead-conversions/mappings/:id`**:
  - Retrieve target mapping record. Return `404` if not found or organization mismatch.
  - Delete mapping record from the database.
  - Write a `delete_conversion_mapping` audit log.
  - Return status `200 OK` with success indicator.
* **Updated POST `/api/leads/:id/convert`**:
  - Fetch organization conversion mappings.
  - Call the core mapping engine to build target payloads.
  - Insert Account, Contact, and Opportunity using the resolved payloads.
  - Return success indicator and created IDs.

### 4. Row-Level Security & Tenant Isolation
* Queries and mutations MUST strictly operate within the active tenant organization context.
* A user from Tenant A MUST NEVER be able to query, create, delete, or trigger conversions using mapping rules belonging to Tenant B.
