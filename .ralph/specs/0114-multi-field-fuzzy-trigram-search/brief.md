# Specification: Multi-Field Fuzzy Trigram Search - Brief

## 1. Functional Objective
This feature expands the existing trigram search engine to provide a unified global search endpoint `/api/search` capable of querying across multiple record types—Leads, Accounts, Contacts, and Opportunities—within a single query. The search aggregator will rank matched records by their Jaccard similarity score, support filtering results by specific record types, and enforce absolute Row-Level Security (RLS) tenant isolation.

## 2. Technical Scope
- **Tenancy Isolation**: The search aggregator must query records from the multi-tenant RLS store inside active `AsyncLocalStorage` tenant context, ensuring users can never search for or find records belonging to other tenants.
- **Search Aggregation Engine**: Reside in `@crm/search` packages, utilizing the existing trigram computation logic. It will aggregate search results from multiple entities, normalized to a unified `SearchResult` layout, sorted by Jaccard similarity score in descending order.
- **REST Endpoints**:
  - `GET /api/search` - Retrieve a ranked list of matched entities based on a query parameter `q`. Supports optional filtering by parameter `type` (e.g. `Lead,Account`) and a similarity score `threshold` parameter.
- **Verification**: Complete integration tests asserting exact search scoring, correct global ranking, multi-type search aggregation, and strict tenant RLS isolation.
