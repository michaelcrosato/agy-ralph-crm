# Task 0161: Public Web-to-Ticket Capture API - Design

## 1. API Definition

### Endpoint
`POST /api/public/web-to-ticket`

### Request Header
`Content-Type: application/json`

### Request Payload Schema
```json
{
  "orgId": "UUID",
  "subject": "string",
  "body": "string",
  "email": "string",
  "firstName": "string (optional)",
  "lastName": "string (optional, defaults to 'Web Contact')",
  "priority": "Low | Medium | High | Urgent (optional, defaults to 'Medium')",
  "assignedToId": "UUID (optional)",
  "custom": {
    "custom_field_api_name": "value"
  }
}
```

### Success Response (Status 201 Created)
```json
{
  "success": true,
  "data": {
    "id": "ticket-uuid",
    "orgId": "org-uuid",
    "contactId": "contact-uuid",
    "subject": "string",
    "status": "Open",
    "priority": "Medium",
    "assignedToId": "user-uuid",
    "createdAt": "date-string"
  },
  "contactCreated": true | false
}
```

### Error Responses
- **400 Bad Request**: Missing mandatory fields or non-existent `orgId`.
- **400 Bad Request**: Custom fields validation failed.

---

## 2. Core Processing Sequence

The endpoint logic operates inside an asynchronous wrapper executing these operations sequentially:

```mermaid
sequenceDiagram
    participant WebClient as External Client
    participant API as public/web-to-ticket Router
    participant TenantCtx as Tenant Context Wrapper
    participant DB as Multi-Tenant DB Store
    participant RouterEngine as Ticket Routing Engine
    
    WebClient->>API: POST /api/public/web-to-ticket (payload)
    API->>API: Validate mandatory parameters (orgId, subject, body, email)
    API->>TenantCtx: withTenant(orgId, mockDb, fn)
    activate TenantCtx
    TenantCtx->>DB: Check if orgId exists
    Note over TenantCtx,DB: All subsequent DB operations run under orgId RLS
    
    TenantCtx->>DB: Search for contact where email = payload.email
    alt Contact exists
        DB-->>TenantCtx: Return existing contact
    else Contact does not exist
        TenantCtx->>DB: Insert new contact (firstName, lastName, email)
        DB-->>TenantCtx: Return new contact
        TenantCtx->>DB: Insert Contact Audit Log
    end
    
    alt Custom fields present
        TenantCtx->>DB: Fetch ticket field definitions
        TenantCtx->>TenantCtx: Validate custom fields
    end

    TenantCtx->>DB: Fetch active ticket assignment rules & entries
    alt Assignment rule matched
        TenantCtx->>RouterEngine: evaluateTicketAssignment(ticket, entries)
        RouterEngine-->>TenantCtx: Return newAssignedToId
        TenantCtx->>DB: Update lastAssignedIndex on matched entry
    else No rule matched / exists
        TenantCtx->>TenantCtx: Fallback to payload.assignedToId or system user
    end
    
    TenantCtx->>DB: Insert new ticket (orgId, contactId, subject, body, priority, assignedToId)
    DB-->>TenantCtx: Return new ticket
    
    TenantCtx->>DB: Insert Ticket Audit Log
    TenantCtx->>TenantCtx: Trigger Outbound Webhooks (ticket.created)
    
    TenantCtx-->>API: Return ticket & contactCreated flag
    deactivate TenantCtx
    API-->>WebClient: 201 Created (ticket info)
```

---

## 3. Data Integrity & RLS Verification
- **Dynamic Context Binding**: Because the API is public, it skips the normal `tenantAuth` middleware which sets context based on authentication tokens. Instead, the endpoint itself sets the tenant context using `withTenant(orgId, mockDb, ...)` before calling any store method.
- **Strict Store Level Assertions**: All mock store methods (`dbStore.contacts`, `dbStore.tickets`, `dbStore.auditLogs`, etc.) verify `getActiveOrgId() === record.orgId` on insert and filter by `orgId` on query, automatically blocking any cross-tenant reading or writing.
