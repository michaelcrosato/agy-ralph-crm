# Task 004: Interactive tRPC CRM Leads Panel / Sleek Glassmorphism CRM Dashboard Portal

## 1. Description
This feature transforms the blank Next.js 16 landing page in `apps/web` into a highly interactive, enterprise-grade, glassmorphic CRM Dashboard. Users will be able to switch between tenants (mock context tokens), perform global fuzzy searches, visualize sales metrics (lead counts and pipeline opportunity value) with beautiful SVG charts, construct dynamic tables of leads/contacts, and execute inline lead conversions, all governed by active tenant row-level isolation.

## 2. Acceptance Criteria (DoD)
- [ ] Expose mock auth endpoints in the Hono API (`POST /api/auth/token`) to support retrieving signed tokens on the fly.
- [ ] Mount Hono CORS middleware so that the Next.js development server running on another origin can query Hono.
- [ ] Create sleek glassmorphism dashboard UI under `apps/web/src/app/page.tsx` loaded with Outfit and Inter typography and modern dark/light CSS glow rules.
- [ ] Render dynamic SVG visualizations for pipeline value (grouped by stage) and lead metrics (grouped by status).
- [ ] Implement global fuzzy autocomplete search calling Hono `/api/search` in real-time.
- [ ] Construct dynamic lists of Leads and Contacts, with inline "Convert Lead" action updating state instantly via Hono `/api/leads/:id/convert`.
- [ ] Expose workspace tenant dropdown selector to switch between Tenants (Acme Corp and Tech Startups LLC) clearing and re-fetching data context securely.
- [ ] Add integration and API tests execution in `packages/testing/src/dashboard-api.test.ts` verifying `/api/auth/token` and CORS integration.
- [ ] Complete verify suite runs cleanly (`pnpm verify`).

## 3. Implementation Approach
- Update `apps/api/src/index.ts` to include CORS middleware and mount `POST /api/auth/token`.
- Refactor `apps/web/src/app/page.tsx` as a Client Component implementing mock tenant tokens state, SVG chart components, search panel, and lists of Leads/Contacts with inline convert action.
- Ensure all calls to Hono API attach `Authorization: Bearer <token>` in request headers.

## 4. Technical Specifications
- **Effort**: 1 session (High)
- **Dependencies**: TASK001, TASK002, TASK003.
- **Likely Files**:
  - `apps/api/src/index.ts`
  - `apps/web/src/app/page.tsx`
  - `packages/testing/src/dashboard-api.test.ts`
