# Specification: Sleek Glassmorphism CRM Dashboard Portal - Implementation Plan

## 1. Sequence of File Changes

### Step 1: Expose Auth API Endpoint & CORS in Hono
- Add `cors` from `hono/cors` and mount it on the root Hono app in `apps/api/src/index.ts`.
- Implement `POST /api/auth/token` using `createSessionToken` from `@crm/auth`.
- If Node execution mode is direct, ensure Hono listens on port `3001` using `@hono/node-server`.

### Step 2: Build CSS Theme in Web App
- Create `apps/web/src/app/theme.css` (or define in `index.css`/`globals.css` style layouts).
- Populate modern CSS properties containing glassmorphic gradients, blurred backgrounds, Outfit font setups, and layout variables.

### Step 3: Implement Dashboard Portal
- Refactor `apps/web/src/app/page.tsx` as a Client Component.
- Hook into state variables managing auth tokens, selected tenant workspaces, search queries, leads, contacts, opportunities, and statistics.
- Fetch workspace data on tenant change, adding bearer headers to Hono calls.
- Implement inline lead conversion modal/trigger pointing to Hono convert routes.
- Implement a responsive fuzzy autocomplete search bar.
- Draw stunning glowing SVG data visualizations inside glassmorphism panels.

### Step 4: Write Integration & Verification Tests
- Create `packages/testing/src/dashboard-api.test.ts` to test `/api/auth/token` endpoint.
- Verify CORS and routing integration using Hono request mock calls.

### Step 5: Verify the Monorepo
- Execute `pnpm verify` ensuring zero lint, typecheck, or test failures.
