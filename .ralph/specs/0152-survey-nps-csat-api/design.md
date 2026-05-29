# Specification: Customer Satisfaction (CSAT) & NPS Survey Engine - Design

## 1. Relational Database Mapping

We will add the two new database tables: `surveys` and `survey_responses`.

### 1.1 surveys Schema
```sql
CREATE TABLE surveys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- "csat" | "nps"
    status TEXT NOT NULL DEFAULT 'draft', -- "draft" | "active" | "closed"
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### 1.2 survey_responses Schema
```sql
CREATE TABLE survey_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    score INTEGER NOT NULL,
    comment TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

## 2. In-Memory Store & Schema Updates

### 2.1 Database Schema (`packages/db/src/schema.ts`)
```typescript
export const surveys = pgTable("surveys", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull(), // "csat" | "nps"
  status: text("status").notNull().default("draft"), // "draft" | "active" | "closed"
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const surveyResponses = pgTable("survey_responses", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  surveyId: uuid("survey_id").notNull().references(() => surveys.id, { onDelete: "cascade" }),
  contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "set null" }),
  score: integer("score").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

### 2.2 Database Memory Store (`packages/db/src/index.ts`)
Add `DBSurvey` and `DBSurveyResponse` interfaces:
```typescript
export interface DBSurvey {
  id: string;
  orgId: string;
  name: string;
  type: "csat" | "nps";
  status: "draft" | "active" | "closed";
  createdAt: Date;
}

export interface DBSurveyResponse {
  id: string;
  orgId: string;
  surveyId: string;
  contactId: string | null;
  score: number;
  comment: string | null;
  createdAt: Date;
}
```

Add them to the global `store` and `dbStore` wrappers, ensuring tenant-based filtering and RLS validation checks are executed natively.

## 3. Core Logic Specifications (`packages/core/src/index.ts`)

### 3.1 Response Validation
```typescript
export function validateSurveyResponse(
  score: number,
  type: "csat" | "nps",
): { isValid: boolean; error?: string } {
  if (!Number.isInteger(score)) {
    return { isValid: false, error: "Score must be an integer." };
  }
  if (type === "csat") {
    if (score < 1 || score > 5) {
      return { isValid: false, error: "CSAT score must be between 1 and 5." };
    }
  } else if (type === "nps") {
    if (score < 0 || score > 10) {
      return { isValid: false, error: "NPS score must be between 0 and 10." };
    }
  } else {
    return { isValid: false, error: "Invalid survey type." };
  }
  return { isValid: true };
}
```

### 3.2 Metrics Calculation
```typescript
export interface SurveyMetricsResult {
  count: number;
  averageScore: string; // 2 decimal places
  scorePercentage: number; // percentage CSAT / integer NPS
}

export function calculateSurveyMetrics(
  responses: { score: number }[],
  type: "csat" | "nps",
): SurveyMetricsResult {
  const count = responses.length;
  if (count === 0) {
    return {
      count: 0,
      averageScore: "0.00",
      scorePercentage: 0,
    };
  }

  const sum = responses.reduce((acc, curr) => acc + curr.score, 0);
  const averageScore = (sum / count).toFixed(2);

  let scorePercentage = 0;
  if (type === "csat") {
    const satisfied = responses.filter((r) => r.score >= 4).length;
    scorePercentage = Math.round((satisfied / count) * 10000) / 100;
  } else if (type === "nps") {
    const promoters = responses.filter((r) => r.score >= 9).length;
    const detractors = responses.filter((r) => r.score <= 6).length;
    const promoterPct = promoters / count;
    const detractorPct = detractors / count;
    scorePercentage = Math.round((promoterPct - detractorPct) * 100);
  }

  return {
    count,
    averageScore,
    scorePercentage,
  };
}
```
