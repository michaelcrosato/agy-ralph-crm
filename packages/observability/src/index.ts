export type { OtelInitOptions } from "./otel";
export { initOtel, shutdownOtel } from "./otel";
export { withSpan, withTenantSpan } from "./spans";
export const OBSERVABILITY_VERSION = "0.1.0";
