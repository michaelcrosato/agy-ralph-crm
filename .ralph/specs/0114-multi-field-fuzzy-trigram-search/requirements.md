# Specification: Multi-Field Fuzzy Trigram Search - Requirements

## 1. Functional Requirements

### 1.1 Global Search Aggregation
- **REQ-1.1.1**: The search system must accept a text search query and search across multiple field boundaries within:
  - **Leads**: `email`, `company`, and any custom picklist/text fields.
  - **Accounts**: `name`, `domain`, and any custom picklist/text fields.
  - **Contacts**: `firstName`, `lastName`, `email`, and any custom picklist/text fields.
  - **Opportunities**: `stage`, and any custom picklist/text fields.
- **REQ-1.1.2**: Results must be returned as a unified structure containing:
  - `record`: The fully hydrated entity record.
  - `recordType`: One of `"Lead" | "Account" | "Contact" | "Opportunity"`.
  - `score`: The Jaccard similarity score (from 0 to 1).
- **REQ-1.1.3**: All search results must be sorted in descending order of similarity score.

### 1.2 Query Parameters & Filtering
- **REQ-1.2.1**: The API endpoint must accept a search string via the query parameter `q`. If `q` is empty or missing, it should return all visible entities (or a high-score empty match depending on query rules; by default, returning empty list or a fallback is acceptable).
- **REQ-1.2.2**: The endpoint must accept an optional `types` parameter as a comma-separated list of record types to search (e.g. `types=Lead,Account`). If missing, it must default to searching all supported record types.
- **REQ-1.2.3**: The endpoint must accept an optional `threshold` parameter to override the default trigram similarity matching threshold (defaulting to 0.1).

### 1.3 Tenant Context Isolation
- **REQ-1.3.1**: The search engine must enforce strict Row-Level Security (RLS). Under no circumstances can a user receive search matches from a tenant organization other than their authenticated tenant context.

## 2. Technical & Performance Requirements
- **REQ-2.1**: **Microsecond Execution**: Global search aggregation across in-memory tenant database instances should maintain fast lookup speeds.
- **REQ-2.2**: **TypeScript Compatibility**: Clean types representing the search request, fuzzy parameters, and aggregated result structure.
- **REQ-2.3**: **Bi-directional Integration**: The search results must be populated from the core `dbStore` stores under the tenant transaction context.
