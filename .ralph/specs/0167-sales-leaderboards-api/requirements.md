# Task 0167: Sales Leaderboards & Quota Attainment API - Requirements

## Functional Requirements

1. **Leaderboard Aggregation**:
   - Compile closed-won opportunity totals grouped by representative (`ownerId`) for a given tenant organization.
   - Sum opportunity amounts only for opportunities in the "Closed Won" stage.
   - Filter opportunities by a period string matching their `closeDate` (supporting monthly `YYYY-MM` and quarterly `YYYY-QX` formats).

2. **Quota Comparison**:
   - For each representative, fetch their quota target amount for the corresponding period.
   - If no quota target exists for the representative in that period, default the target to `0.00`.

3. **Quota Attainment & Ranking**:
   - Calculate quota attainment percentage: `(totalClosedWon / quotaTarget) * 100`.
   - Default attainment percentage to `0` if quota target is `0` or negative.
   - Rank representatives descending based on `attainmentPercentage`, then descending by `totalClosedWon`.
   - Assign consecutive ranks starting from 1 (e.g., 1, 2, 3).

4. **Multi-Tenant / RLS Enforcement**:
   - The leaderboard compilation, user lists, and quotas must be evaluated within the active tenant context (`orgId`).
   - It must be impossible for Org A to query, view, or aggregate opportunities, users, or quotas belonging to Org B.

5. **REST API Endpoint**:
   - Expose endpoint `GET /api/leaderboards` that accepts an optional query parameter `period` (defaults to the current month in `YYYY-MM` format if omitted).
   - Return a JSON object containing the `period` and the sorted array of ranked representative objects with fields: `userId`, `userName`, `totalClosedWon`, `quotaTarget`, `attainmentPercentage`, and `rank`.
