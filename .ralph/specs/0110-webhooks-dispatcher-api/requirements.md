# Specification: Multi-Tenant Outbound REST Webhooks Dispatcher - Requirements

## 1. Functional Requirements

### 1.1 Webhook Subscriptions Management
- **REQ-1.1.1**: The system must support creating, retrieving, and listing Webhook subscription records.
- **REQ-1.1.2**: A Webhook subscription must contain: `id` (UUID), `orgId` (UUID), `targetUrl` (text), `secret` (text, optional for HMAC validation), and `status` (text, default "active").

### 1.2 Webhook Deliveries Ledger
- **REQ-1.2.1**: The system must record a history log for every event dispatched.
- **REQ-1.2.2**: A Delivery log record must contain: `id` (UUID), `orgId` (UUID), `webhookId` (UUID), `event` (text), `statusCode` (integer), `payload` (text/JSON string), and `createdAt` (timestamp).

### 1.3 Event Notification Trigger & Signing
- **REQ-1.3.1**: The dispatcher must dynamically sign webhook payloads using a HMAC-SHA256 signature if a secret is provided, placing it in `X-CRM-Signature` headers.
- **REQ-1.3.2**: Event triggers must automatically initiate webhook dispatching on lead creation, lead conversion, opportunity modifications, and ticketing updates.
- **REQ-1.3.3**: Webhook execution must run asynchronously, safely logging simulated outcomes (mocking standard HTTP 200 or 500 response codes).

### 1.4 REST API Endpoints
- **REQ-1.4.1**: `POST /api/webhooks` - Register a new tenant outbound webhook.
- **REQ-1.4.2**: `GET /api/webhooks` - List active webhooks for the tenant.
- **REQ-1.4.3**: `GET /api/webhooks/deliveries` - Query chronological delivery logs for auditing.

## 2. Non-Functional & Security Requirements
- **REQ-2.1**: Tenant Isolation: a tenant must never see delivery logs or active subscriptions from other organizations.
- **REQ-2.2**: High Reliability: webhook errors or down-stream timeout failures must never block database transactions or Hono handler execution.
