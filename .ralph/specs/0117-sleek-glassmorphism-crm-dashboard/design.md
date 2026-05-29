# Specification: Sleek Glassmorphism CRM Dashboard Portal - Design

## 1. Relational API Interfaces

### 1.1 Auth Endpoint
Expose a new API route in Hono `/api/auth/token` supporting token collection:
- **Route**: `POST /api/auth/token`
- **Request Body**:
  ```typescript
  interface AuthRequest {
    userId: string;
    orgId: string;
    roleId: string;
    permissionsMask: number;
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "token": "eyJhbGciOiJIUzI1NiIsIn..."
  }
  ```

### 1.2 Hono CORS Integration
Ensure Hono mounts `cors()` so the Next.js development server running on another origin can query Hono.

## 2. Next.js 16 Presentation System

### 2.1 CSS Custom Properties (Theme System)
Define glassmorphic styling parameters in global styles:
- **Fonts**: `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;500;600;700;800&display=swap')`
- **Colors**:
  - `--glass-bg`: `rgba(15, 23, 42, 0.45)` (Deep slate dark mode slate base)
  - `--glass-border`: `rgba(255, 255, 255, 0.08)`
  - `--glass-glow`: `rgba(99, 102, 241, 0.15)` (Indigo glow spotlight)
  - `--accent-gradient`: `linear-gradient(135deg, #818cf8 0%, #c084fc 100%)`
  - `--text-primary`: `#f8fafc`
  - `--text-secondary`: `#94a3b8`
- **Backdrop Filters**: `backdrop-filter: blur(16px) saturate(180%)`

### 2.2 Dashboard Architecture
Create a highly interactive Next.js Client Component (`page.tsx`) mapping state:
1. `token`: Current active JWT token.
2. `tenant`: Currently selected workspace (`org-acme-corp` | `org-tech-llc`).
3. `searchQuery`: Current fuzzy search query.
4. `searchResults`: Fuzzy matching results from `/api/search`.
5. `leads`: List of current tenant leads.
6. `contacts`: List of current tenant contacts.
7. `opportunities`: List of current opportunities.
8. `loading`: Boolean loading status.
9. `convertingLeadId`: String ID of the lead currently undergoing conversion.

### 2.3 SVG Data Visualizations
- **Pipeline Gauge**: Responsive SVG showing opportunity pipeline totals. Render a sleek semi-circle arc indicator or an elegant SVG vertical bar chart with dynamic height and bright neon gradient fills.
- **Lead Metrics**: Pie/doughnut chart simulated via a single SVG path stroke dashboard, or dynamic progress bars matching status codes.
