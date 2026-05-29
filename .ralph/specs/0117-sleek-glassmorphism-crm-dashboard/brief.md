# Specification: Sleek Glassmorphism CRM Dashboard Portal - Brief

## 1. Functional Objective
This feature transforms the blank Next.js 16 landing page in `apps/web` into a highly interactive, enterprise-grade, glassmorphic CRM Dashboard. Users will be able to switch between tenants (mock context tokens), perform global fuzzy searches, visualize sales metrics (lead counts and pipeline opportunity value) with beautiful SVG charts, construct dynamic tables of leads/contacts, and execute inline lead conversions, all governed by active tenant row-level isolation.

## 2. Technical Scope
- **Interactive UI Console**: A beautiful visual interface built with next-generation premium aesthetics (curated glassmorphism, HSL dark/light modes, gradients, outfit typography, micro-interactions).
- **Workspace Selector**: Dropdown to switch between mock tenants (e.g. Acme Corp and Beta LLC) by dynamically requesting and saving valid token authentication states in local client state.
- **REST API Integration**: Complete connection to Hono backend endpoints under active tenant isolation.
- **Fuzzy Search Integration**: Direct interaction with `/api/search` displaying formatted matching Leads, Accounts, Contacts, and Opportunities in real-time.
- **Interactive SVG Charts**: Scalable SVG dashboard graphs displaying:
  1. Lead counts grouped by Status.
  2. Opportunity Pipeline value grouped by Stage.
- **Dynamic Tables & Lead Converter**: List current Leads and Contacts, with inline "Convert Lead" action which posts to `/api/leads/:id/convert` and immediately updates the state.
