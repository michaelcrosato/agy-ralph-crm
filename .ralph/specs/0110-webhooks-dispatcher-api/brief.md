# Specification: Multi-Tenant Outbound REST Webhooks Dispatcher - Brief

## Objective
Implement a multi-tenant outbound REST webhook subscription and dispatcher framework. This enables integration clients to subscribe to CRM events (e.g., `lead.created`, `lead.converted`, `opportunity.stage_changed`, `ticket.resolved`), register endpoints, authenticate payloads with HMAC signing, dispatch mock/simulated deliveries, and view delivery history ledgers under active tenant Row-Level Security (RLS) isolation.

## Core Boundaries
- **Webhook Dispatcher Engine**: Outbound parsing, header signature signing, and dispatch simulations must reside in `packages/webhooks`.
- **Database Schema**: Extensions for `webhook_deliveries` store mappings must reside in `packages/db`.
- **REST API Endpoints**: Outbound subscriptions `/api/webhooks` and delivery history query routes `/api/webhooks/deliveries` must reside in `apps/api`.
