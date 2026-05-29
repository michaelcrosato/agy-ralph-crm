# Specification: Marketing Sequence Step Performance Analytics API - Brief

## 1. Functional Objective
This feature integrates email tracking with marketing sequences and introduces an analytics engine for marketing campaigns. The system will automatically register email tracking tokens for all outgoing marketing sequence messages, track reader open/click events, and compile structured sequence performance reports aggregating conversion, completion, bounce, and engagement metrics.

## 2. Technical Scope
- **Email Tracking Integration**: Update the sequence step execution routine to automatically provision `email_trackers` for all dispatched sequence emails.
- **Tenancy Isolation**: Sequence query aggregation, email logs, and stats calculations must strictly enforce RLS tenant isolation using AsyncLocalStorage context.
- **REST Endpoints**:
  - `GET /api/sequences/:id/analytics` - Computes and returns structural performance analytics for a sequence and its steps.
- **Verification**: Thorough integration tests validating email tracker auto-generation, stats aggregation logic, and strict row-level security isolation.
