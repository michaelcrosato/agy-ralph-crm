# Specification: Campaign ROI & Performance Analytics API - Requirements

## 1. Functional Requirements
- **Metrics Computation**: Provide a clear performance breakdown for any campaign:
  - `totalMembers`: Total count of `campaignMembers` associated with the campaign.
  - `respondedMembers`: Count of `campaignMembers` where `status === "Responded"`.
  - `wonOpportunitiesCount`: Count of unique won opportunities (stage `"Closed Won"`) that have a `campaignInfluence` entry linked to the campaign.
  - `wonRevenueShareSum`: Decimal/numerical sum of all `revenueShare` allocations from those won opportunities.
  - `netValue`: Calculation of `wonRevenueShareSum - actualCost`.
  - `roi`: ROI percentage computed as `(netValue / actualCost) * 100`. Returns `0.0` if `actualCost` is `<= 0`. Round the percentage value to 2 decimal places.
- **Null & Default Safe**: Handle missing or zero costs properly without dividing by zero or throwing runtime exceptions.
- **REST Endpoints**:
  - `GET /api/campaigns/:id/roi` - Retrieve ROI breakdown for a campaign. Returns `404` if the campaign does not exist or belongs to another tenant.

## 2. Multi-Tenant RLS & Security Requirements
- **RLS Boundary**: An organization must never be allowed to access, query, or calculate ROI for a campaign belonging to another tenant org.
- **Data Isolation**: All queries for campaign members, influences, and opportunities must be constrained to the active tenant context using `withTenant`.

## 3. Performance & Verification
- **Compilation**: Must build cleanly without TypeScript compiler errors.
- **Formatting**: Must comply with Biome linting and formatting rules.
- **Integration Tests**: Provide a comprehensive integration test suite validating:
  - Calculation math correctness with various cost, membership, and won/lost influence parameters.
  - Perfect RLS isolation boundaries, proving that one tenant cannot access another tenant's campaign ROI stats.
