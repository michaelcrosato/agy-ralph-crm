# Spec 069 — TD-004: OpenTelemetry Collector & Grafana Observability Dashboard

## Description & Impact

Establish a local production-grade observability and performance monitoring infrastructure:
- Define `docker-compose.yaml` in the workspace root orchestrating OTel Collector, Prometheus, Jaeger, and Grafana.
- Configure `otel-collector-config.yaml` with receivers, processors, and exporters routing metrics/traces correctly.
- Scrape OTel metrics inside Prometheus via a global `prometheus.yml` configuration.
- Auto-provision Prometheus and Jaeger datasources in Grafana.
- Provision a preloaded performance dashboard `crm-dashboard.json` displaying live memory allocations, event loop delays, API request rates, and latency.

**Impact:** Provides instant developer visibility into live API request volumes, backend latency, memory leakage, and traces, elevating the monorepo to enterprise production posture.

## Definition of Done

- [ ] Create `docker-compose.yaml` at root containing `otel-collector`, `prometheus`, `jaeger`, `grafana` services.
- [ ] Create stable OTel routing in `otel-collector-config.yaml`.
- [ ] Create Prometheus scraper config in `prometheus.yml`.
- [ ] Auto-provision datasources in `grafana/provisioning/datasources/datasources.yaml`.
- [ ] Auto-provision dashboards mapping in `grafana/provisioning/dashboards/dashboards.yaml`.
- [ ] Build the performance dashboard file `grafana/dashboards/crm-dashboard.json`.
- [ ] Run `pnpm verify` successfully to ensure no Biome configuration or linter errors exist.

## Approach

### Files modified or created
- `docker-compose.yaml`
- `otel-collector-config.yaml`
- `prometheus.yml`
- `grafana/provisioning/datasources/datasources.yaml`
- `grafana/provisioning/dashboards/dashboards.yaml`
- `grafana/dashboards/crm-dashboard.json`
- `plan/specs/069_otel_grafana_observability.md`

## Test Strategy
- Ensure Docker compose configurations parse successfully using standard config syntax.
- Verify linter formatting and typescript compiler success.
