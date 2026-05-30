import type { Context, Next } from "hono";

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const store = new Map<string, RateLimitEntry>();

// Cleanup old entries every 60 seconds to prevent memory growth
const CLEANUP_INTERVAL_MS = 60_000;
let lastCleanup = Date.now();

function cleanupStaleEntries(windowMs: number) {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, entry] of store) {
    if (now - entry.windowStart > windowMs * 2) {
      store.delete(key);
    }
  }
}

function getClientKey(c: Context): string {
  return (
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
    c.req.header("x-real-ip") ||
    "unknown"
  );
}

export function rateLimiter(
  maxRequests: number,
  windowMs = 60_000,
  keyPrefix: string = "",
) {
  const limit = Number(process.env.RATE_LIMIT_PER_MIN) || maxRequests;
  const limiterId = keyPrefix || Math.random().toString(36).substring(2, 15);

  return async (c: Context, next: Next) => {
    const clientIp = getClientKey(c);
    const key = `${limiterId}:${clientIp}`;
    const now = Date.now();

    cleanupStaleEntries(windowMs);

    const entry = store.get(key);

    if (!entry || now - entry.windowStart >= windowMs) {
      // New window
      store.set(key, { count: 1, windowStart: now });
      c.header("RateLimit-Limit", String(limit));
      c.header("RateLimit-Remaining", String(limit - 1));
      await next();
      return;
    }

    entry.count++;

    if (entry.count > limit) {
      const retryAfter = Math.ceil((entry.windowStart + windowMs - now) / 1000);
      c.header("RateLimit-Limit", String(limit));
      c.header("RateLimit-Remaining", "0");
      c.header("Retry-After", String(retryAfter));
      return c.json({ error: "Too Many Requests", retryAfter }, 429);
    }

    c.header("RateLimit-Limit", String(limit));
    c.header("RateLimit-Remaining", String(limit - entry.count));
    await next();
  };
}

/**
 * Reset the rate limiter store. Only used in tests.
 */
export function resetRateLimiterStore() {
  store.clear();
}
