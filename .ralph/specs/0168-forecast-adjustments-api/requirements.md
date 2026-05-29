# Task 0168: Forecast Adjustments & Manager Target Overrides API - Requirements

## Functional Requirements

1. **Forecast Adjustments Table**:
   - Add a new db table/schema for tracking manager-level overrides and adjustments.
   - Support tracking adjustment type ("override_quota" | "override_weighted" | "manager_adjustment"), period (e.g. `2026-05`), target representative (`userId`), and adjustment amount.
   
2. **Forecast Integration & Overrides**:
   - Create a core calculation utility `calculateAdjustedForecast` that:
     - Applies manager overrides to individual representatives' quotas.
     - Adjusts weighted pipeline amounts based on manager adjustments for a given period.
     - Computes updated quota attainment percentages.

3. **REST API Endpoints**:
   - Expose `GET /api/forecasts/adjustments` listing all adjustments for the active tenant.
   - Expose `POST /api/forecasts/adjustments` to create a new forecast adjustment.
   - Expose `GET /api/forecasts/adjusted-summary` that returns an aggregated period forecast summary with all active adjustments applied.

4. **Multi-Tenant / RLS Enforcement**:
   - All operations must be verified within the active tenant context (`orgId`).
   - It must be impossible for Tenant A to query, view, or modify Tenant B's forecast adjustments or adjusted summary metrics.
