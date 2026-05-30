import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { NodeSDK } from "@opentelemetry/sdk-node";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";

export interface OtelInitOptions {
  serviceName: string;
  serviceVersion?: string;
  /** OTLP/HTTP endpoint root (e.g. http://localhost:4318). Traces → /v1/traces, metrics → /v1/metrics. */
  endpoint?: string;
  /** Optional deployment environment tag (dev / staging / prod). */
  env?: string;
}

let sdk: NodeSDK | null = null;

/**
 * Boots OpenTelemetry with HTTP auto-instrumentation + OTLP/HTTP export.
 * Disabled when env var `OTEL_DISABLED=1`. Safe to call repeatedly — only
 * the first call actually starts the SDK.
 */
export function initOtel(options: OtelInitOptions): NodeSDK | null {
  if (process.env.OTEL_DISABLED === "1") return null;
  if (sdk) return sdk;

  const endpoint =
    options.endpoint ||
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT ||
    "http://localhost:4318";

  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: options.serviceName,
    [ATTR_SERVICE_VERSION]: options.serviceVersion ?? "0.1.0",
    "deployment.environment":
      options.env ?? process.env.NODE_ENV ?? "development",
  });

  sdk = new NodeSDK({
    resource,
    traceExporter: new OTLPTraceExporter({ url: `${endpoint}/v1/traces` }),
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({ url: `${endpoint}/v1/metrics` }),
      exportIntervalMillis: 10_000,
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        // Disable fs/dns instrumentation — too noisy for an API workload.
        "@opentelemetry/instrumentation-fs": { enabled: false },
        "@opentelemetry/instrumentation-dns": { enabled: false },
      }),
    ],
  });

  sdk.start();
  return sdk;
}

/** Graceful shutdown — call from SIGTERM handlers. */
export async function shutdownOtel(): Promise<void> {
  if (!sdk) return;
  await sdk.shutdown();
  sdk = null;
}
