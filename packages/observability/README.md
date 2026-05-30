# @crm/observability

OpenTelemetry + pino bootstrap for the CRM monorepo.

## Surface

```ts
import {
  initOtel,
  shutdownOtel,
  createLogger,
  logger,
  withSpan,
  withTenantSpan,
} from "@crm/observability";

initOtel({ serviceName: "crm-api" });
const log = createLogger({ name: "api.leads" });

await withTenantSpan(orgId, "leads.list", async () => {
  const leads = await db.leads.findAll();
  log.info({ count: leads.length }, "leads listed");
  return leads;
});
```

## PII / logging rules

Pino is configured with a redaction list (`logger.ts#REDACTED_PATHS`)
covering: `password`, `token`, `secret`, `apiKey`, `email`, `phone`,
`ssn`, `creditCard`, plus `req.headers.authorization` and
`req.headers.cookie`. Any field whose path matches is censored to
`[REDACTED]` before emission.

**Hard rules — do not break:**
- Never log full request bodies. Log IDs and route templates only.
- Never log full user content (email bodies, ticket messages, etc.).
- Never log secrets — environment variables, API keys, tokens.
- Add new sensitive field names to `REDACTED_PATHS` when the schema grows.

## OTel auto-instrumentations

`initOtel` registers `getNodeAutoInstrumentations` (HTTP, pg, etc.) and
`PinoInstrumentation` — log records emitted via the pino loggers above
are automatically tagged with the active span's `trace_id` and
`span_id`, so dashboards can pivot log → trace in one click.

`@opentelemetry/instrumentation-fs` and `…-dns` are disabled (too noisy
for an API workload).

## Configuration env vars

| Var | Default | Notes |
| --- | --- | --- |
| `OTEL_DISABLED` | unset | Set to `1` to skip OTel init entirely. |
| `OTEL_SERVICE_NAME` | `crm-api` | Service name resource attribute. |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://localhost:4318` | OTLP/HTTP root. Traces → `/v1/traces`, metrics → `/v1/metrics`. |
| `LOG_LEVEL` | `info` | Pino log level (`trace` / `debug` / `info` / `warn` / `error`). |
