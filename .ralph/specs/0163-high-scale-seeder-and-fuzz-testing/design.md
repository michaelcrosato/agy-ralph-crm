# Task 0163: High Scale Seeder and Fuzz Testing Engine - Design

## 1. Types & Data Structures

### Seed Configuration Schema
```typescript
export interface HighScaleSeedConfig {
  accountCount: number;
  contactCount: number;
  leadCount: number;
  opportunityCount: number;
}
```

### Fuzz Report Schema
```typescript
export interface FuzzRunReport {
  success: boolean;
  totalRuns: number;
  failures: {
    route: string;
    payload: unknown;
    error: string;
  }[];
}
```

## 2. API Specifications

### POST `/api/admin/seed`
- **Headers**: `Authorization: Bearer <token>`
- **Request Body**:
```json
{
  "accountCount": 1000,
  "contactCount": 2000,
  "leadCount": 1500,
  "opportunityCount": 500
}
```
- **Response**: `200 OK`
```json
{
  "success": true,
  "message": "Seeded 5000 records successfully for org-123"
}
```

### POST `/api/admin/fuzz`
- **Headers**: `Authorization: Bearer <token>`
- **Response**: `200 OK`
```json
{
  "success": true,
  "report": {
    "totalRuns": 100,
    "failures": []
  }
}
```

## 3. Row-Level Security Enforcements
- All seeding and fuzzing endpoints MUST use the `tenantAuth` middleware.
- In-memory database store insertions MUST check the active tenant via `getActiveOrgId()`.
