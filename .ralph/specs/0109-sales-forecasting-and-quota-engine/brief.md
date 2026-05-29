# Specification: Sales Forecasting & Quota Engine - Brief

## Objective
Implement a production-grade Sales Forecasting and Quota Attainment Engine. The engine must track sales quotas/targets for users and organizations, map sales opportunity stages to customizable win probabilities, calculate weighted opportunity pipelines, aggregate forecasts by time period, and compute quota attainment percentages under strict Row-Level Security (RLS) tenant isolation.

## Core Boundaries
- **Forecasting Calculations**: All pure forecasting, weighted math, and quota aggregation logic must reside in a new workspace package `packages/forecasting`.
- **Database Schema**: Extension tables for `quotas` and custom `stage_probabilities` must reside in `packages/db`.
- **REST API Endpoints**: Endpoints for managing quotas, updating stage probabilities, and generating forecast aggregates must reside in `apps/api`.
- **Isolation Checks**: All operations must enforce active tenant RLS bounds.
