import { SpanStatusCode, trace } from "@opentelemetry/api";

const tracer = trace.getTracer("@crm/observability", "0.1.0");

/**
 * Wrap `fn` in a span named `name`. Records exceptions, sets status to
 * ERROR on throw, and always closes the span. The wrapped function
 * runs inside the new span's active context, so downstream spans nest.
 */
export async function withSpan<T>(
  name: string,
  fn: () => Promise<T>,
  attributes: Record<string, string | number | boolean> = {},
): Promise<T> {
  return tracer.startActiveSpan(name, { attributes }, async (span) => {
    try {
      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err) {
      span.recordException(err as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: err instanceof Error ? err.message : String(err),
      });
      throw err;
    } finally {
      span.end();
    }
  });
}

/**
 * Convenience wrapper that tags the span with the active tenant org id.
 * Use at the top of every request handler that has tenant context.
 */
export async function withTenantSpan<T>(
  orgId: string,
  name: string,
  fn: () => Promise<T>,
  extra: Record<string, string | number | boolean> = {},
): Promise<T> {
  return withSpan(name, fn, { ...extra, "tenant.org_id": orgId });
}
