# Specification: Marketing Sequence Step Performance Analytics API - Requirements

## 1. Functional Requirements

### 1.1 Outbound Email Tracking for Sequences
- **REQ-1.1.1**: Every email activity generated during marketing sequence step execution (`executePendingSequenceSteps`) must automatically create an associated `email_trackers` record.
- **REQ-1.1.2**: The email tracker must be initialized with a unique tracking token and starting counts set to zero.

### 1.2 Sequence Analytics Engine
- **REQ-1.2.1**: The system must provide a pure calculation routine (`calculateSequenceAnalytics`) that compiles sequence engagement metrics.
- **REQ-1.2.2**: The calculated analytics must include sequence-level aggregates:
  - `totalEnrolled` (number of memberships ever enrolled).
  - `statusCounts` (breakdown of active, completed, unsubscribed, and error statuses).
  - `overallOpenRate` (percentage of tracked emails that were opened).
  - `overallClickRate` (percentage of tracked emails that were clicked).
- **REQ-1.2.3**: The analytics must also include step-level details for each step in the sequence:
  - `stepNumber` and `stepName` (or step template name).
  - `sentCount` (total emails dispatched for this step).
  - `openCount` (total opens recorded for these emails).
  - `clickCount` (total clicks recorded for these emails).
  - `openRate` and `clickRate` percentages.

### 1.3 REST API Endpoint
- **REQ-1.3.1**: `GET /api/sequences/:id/analytics` - Computes and returns the sequence performance report for the authenticated tenant org.
- **REQ-1.3.2**: Returns `404` if the sequence does not exist or belongs to another tenant.

## 2. Security & Verification Requirements
- **REQ-2.1**: Strict multi-tenant isolation: A tenant must never be allowed to fetch sequence analytics, membership data, or tracking records belonging to another organization.
- **REQ-2.2**: Complete TypeScript compatibility with zero build or compile-time warnings.
- **REQ-2.3**: Comprehensive Vitest validation confirming correct percentage calculations, email tracker creation during execution, and absolute RLS tenant isolation.
