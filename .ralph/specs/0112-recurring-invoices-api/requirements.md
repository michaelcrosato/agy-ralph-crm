# Specification: Recurring Invoicing & Subscription Billing API - Requirements

## 1. Functional Requirements

### 1.1 Subscription Plans Management
- **REQ-1.1.1**: The system must allow creating subscription records.
- **REQ-1.1.2**: A Subscription record must contain: `id` (UUID/string), `orgId` (UUID/string), `accountId` (UUID/string), `planName` (text, e.g. "Pro", "Enterprise"), `status` (text, e.g. "active", "cancelled"), `billingPeriod` (text: "monthly" | "annually"), `unitPrice` (text/numeric representation), `quantity` (integer), `startDate` (Date), `endDate` (Date | null).
- **REQ-1.1.3**: RLS tenant isolation must govern all subscription operations.

### 1.2 Invoice Generation
- **REQ-1.2.1**: The system must support generating invoices based on active subscriptions.
- **REQ-1.2.2**: An Invoice record must contain: `id` (UUID/string), `orgId` (UUID/string), `subscriptionId` (UUID/string), `accountId` (UUID/string), `amount` (text/numeric representation), `dueDate` (Date), `status` (text: "Unpaid" | "Paid").
- **REQ-1.2.3**: If a subscription is pro-rated, the calculation must happen in a core business logic helper.

### 1.3 REST API Endpoints
- **REQ-1.3.1**: `POST /api/subscriptions` - Register a subscription for an Account.
- **REQ-1.3.2**: `GET /api/subscriptions` - Fetch tenant subscription records.
- **REQ-1.3.3**: `POST /api/invoices/generate` - Trigger invoice generation. Looks up active subscriptions without generated invoices for the current period and creates corresponding invoice records.
- **REQ-1.3.4**: `GET /api/invoices` - Query billing invoices under tenant isolation context.

## 2. Security & Verification Requirements
- **REQ-2.1**: Strict tenant RLS: a tenant must never be allowed to view subscriptions, trigger invoices, or view billing history belonging to another organization.
- **REQ-2.2**: Complete TypeScript compilation with zero errors.
- **REQ-2.3**: Comprehensive Vitest validation confirming pro-rated math and multi-tenant RLS checks.
