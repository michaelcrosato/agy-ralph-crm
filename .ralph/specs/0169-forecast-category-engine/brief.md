# Task 0169: Opportunity Forecast Category Mapping & Category-Based Forecasting Engine - Brief

## Objective
Establish an Opportunity Forecast Category Mapping & Category-Based Forecasting Engine for the CRM Core system. This enables administrators to define mappings between opportunity stages and enterprise forecast categories ("Omitted", "Pipeline", "Best Case", "Commit", "Closed"), and allows representatives and managers to retrieve sales forecasts aggregated by these category groups for active planning periods under tenant RLS isolation.

## Core Value
- **Forecast Category Governance**: Standardizes opportunity stage tracking into standardized enterprise forecasting categories (Omitted, Pipeline, Best Case, Commit, Closed).
- **Dynamic Category Forecasting**: Computes aggregated actual and weighted opportunity pipelines grouped by forecast categories, providing leadership with clearer visibility into the sales pipeline.
- **Tenant Context and RLS Protection**: Ensures all mappings, opportunity assignments, and category aggregations are partitioned and guarded by active tenant row-level security.
