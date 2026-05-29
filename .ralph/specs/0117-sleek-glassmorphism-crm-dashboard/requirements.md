# Specification: Sleek Glassmorphism CRM Dashboard Portal - Requirements

## 1. Functional Requirements

### 1.1 Aesthetic and Visual System
- **REQ-1.1.1**: The web shell must implement a modern "glassmorphism" look (semi-transparent backgrounds, blur backdrops, fine borders, soft glowing drop-shadows).
- **REQ-1.1.2**: Style tokens must use CSS variables configured under a global stylesheet, loading Outfit and Inter fonts.
- **REQ-1.1.3**: Interactive UI cards, buttons, and inputs must use subtle transition micro-animations (e.g. `all 0.2s cubic-bezier(0.4, 0, 0.2, 1)`).

### 1.2 Multi-Tenant Workspace Selector
- **REQ-1.2.1**: The system must provide a visual workspace dropdown selector to switch between active tenants.
- **REQ-1.2.2**: The selector must support at least two mock organizations:
  - **Tenant A**: Acme Corporation (`org-acme-corp`, User A `user-acme`)
  - **Tenant B**: Tech Startups LLC (`org-tech-llc`, User B `user-tech`)
- **REQ-1.2.3**: Choosing a tenant must query a mock authorization route to retrieve a signed JWT token, which is stored in client state (and/or localStorage) and attached to all subsequent request headers as `Authorization: Bearer <token>`.
- **REQ-1.2.4**: Changing the workspace must clear the current dashboard state and reload data strictly from the newly selected tenant context.

### 1.3 Dashboard Metrics & SVG Charts
- **REQ-1.3.1**: The main dashboard screen must calculate and show:
  - **Total Pipeline Value** (sum of opportunity amounts).
  - **Total Active Leads Count**.
  - **Total Active Contacts Count**.
- **REQ-1.3.2**: The dashboard must render a beautiful, responsive SVG chart representing lead status distributions.
- **REQ-1.3.3**: The dashboard must render an opportunity pipeline chart displaying stage values using CSS grids or custom SVG bars with colorful glowing gradients.

### 1.4 Dynamic Records Grid & Lead Conversion
- **REQ-1.4.1**: Tabbed view to display the lists of active **Leads** and **Contacts** fetched from `/api/leads` and `/api/contacts`.
- **REQ-1.4.2**: Unconverted leads must expose an inline "Convert" button. Clicking this must trigger a conversion modal/action calling `/api/leads/:id/convert` with mock arguments.
- **REQ-1.4.3**: Converting a lead must immediately update the local state, removing the lead from the active leads table or changing its status, and updating accounts/contacts lists.

### 1.5 Real-Time Fuzzy Search
- **REQ-1.5.1**: Provide a global search bar at the top of the portal.
- **REQ-1.5.2**: Typing in the search bar must fetch matching records in real-time from `/api/search?q=<query>`.
- **REQ-1.5.3**: Results must show type-specific badges (e.g., Lead, Account, Contact, Opportunity) in a drop-down autocomplete modal.

## 2. Technical & Verification Requirements
- **REQ-2.1**: Next.js 16 Workspace integration with zero compile-time TypeScript errors.
- **REQ-2.2**: The frontend shell must compile cleanly using standard Next.js build constraints (`pnpm build`).
- **REQ-2.3**: Expose mock auth endpoints in the Hono API (`POST /api/auth/token`) to support retrieving signed tokens on the fly.
- **REQ-2.4**: Run integration and visual checks using Vitest.
