# Spec 052 — API Security Hardening: Secure Headers, Rate Limiting, CORS, Error Handler

## Description & Impact

The Hono API surface currently has no `secureHeaders` middleware, no rate limiting, wide-open `cors()`, and no centralized `app.onError` handler. This spec closes the most critical production-readiness security gaps identified in the Cycle 8 audit.

**Impact:** Prevents XSS via missing CSP/X-Frame-Options, blocks brute-force via rate limiting, restricts cross-origin abuse, and avoids leaking stack traces via unhandled errors.

## Definition of Done

- [ ] `secureHeaders()` middleware applied globally in `apps/api/src/index.ts`.
- [ ] In-memory sliding-window rate limiter middleware in `apps/api/src/middleware/rateLimiter.ts` (configurable per-route: default 100 req/min per IP; auth routes 10 req/min).
- [ ] CORS restricted to `process.env.CORS_ORIGIN` (default `*` in dev, explicit in prod).
- [ ] Centralized `app.onError()` handler returning structured JSON `{ error, status }` without leaking stack traces in production.
- [ ] `.env.example` updated with `CORS_ORIGIN` and `RATE_LIMIT_PER_MIN` variables.
- [ ] Integration tests verifying: (a) secure headers present, (b) rate limiter returns 429, (c) error handler returns JSON.
- [ ] `pnpm run agent:check` green.

## Approach

### Files to modify
- `apps/api/src/index.ts` — add middleware + error handler
- `apps/api/src/middleware/rateLimiter.ts` — new file
- `.env.example` — add new vars
- `packages/testing/src/api-security.test.ts` — new test file

### Pattern
Use Hono's built-in `secureHeaders` from `hono/secure-headers`. Implement a simple in-memory sliding window rate limiter using `Map<string, { count, windowStart }>` — no Redis dependency needed for the foundation. The rate limiter uses `c.req.header('x-forwarded-for')` or remote IP as key.

## Test Strategy
- Unit test the rate limiter with rapid sequential calls to confirm 429 on burst.
- Integration test that secure headers are present on responses.
- Integration test that `app.onError` returns JSON with correct status codes.

## Depends on
None (additive middleware).
