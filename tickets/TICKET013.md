# TICKET013: OpenTelemetry Collector Service & Grafana Performance Dashboard

## Details
- **Status**: completed
- **Priority**: Medium
- **Goal**: Configure a local OpenTelemetry Collector, Prometheus, Jaeger, and Grafana stack in a `docker-compose.yaml` to aggregate and visualize live API telemetry.
- **Context**: TD-004 describes establishing local enterprise-grade production observability.

---

## Scope

### In Scope
- Create `docker-compose.yaml` in repository root containing services: `otel-collector`, `prometheus`, `jaeger`, `grafana`.
- Configure `otel-collector-config.yaml` to collect HTTP OTLP metrics and traces and export to Prometheus/Jaeger.
- Configure `prometheus.yml` for scraping metrics from the collector.
- Auto-provision Prometheus and Jaeger datasources in Grafana.
- Design a pre-configured Grafana performance dashboard displaying memory telemetry, route request rates, latency, and system load.
- Expose endpoints: Jaeger UI (16686), Grafana (3000 or custom like 3010 to prevent colliding with Next.js dashboard port), Prometheus (9090).
- Ensure 100% build and linter compliance.

### Out of Scope
- Production hosting/deployments of the monitoring stack.

---

## Steps to Execute
1. Define services and configuration mappings in `docker-compose.yaml`.
2. Create `otel-collector-config.yaml` detailing receivers, processors, and exporters.
3. Create `prometheus.yml` specifying the OTel Collector scrape target.
4. Create Grafana auto-provisioning folders and datasource specifications.
5. Create a pre-configured dashboard JSON file under `grafana/dashboards/crm-dashboard.json`.
6. Document usage details inside a new developer observability guide or updates.
7. Verify 100% Biome linting and workspace compile gates.

---

## Acceptance Criteria
- [x] `docker-compose.yaml` successfully provisions all four services correctly.
- [x] OTel collector configuration routes OTLP HTTP/gRPC traces and metrics cleanly.
- [x] Grafana auto-provisions Prometheus and Jaeger as datasources cleanly on startup.
- [x] No local port collisions exist (Grafana mounted on `3010` since Next.js runs on `3000`).
- [x] Biome checks and typescript build are entirely green.
