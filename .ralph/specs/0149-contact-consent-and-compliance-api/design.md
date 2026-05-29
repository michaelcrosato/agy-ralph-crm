# Specification: Contact Consent & GDPR Compliance API - Design

## 1. Database Schema Additions

We will add a new table `contact_consent_preferences` to `packages/db/src/schema.ts` to manage granular opt-in/opt-out settings.

### Table: `contact_consent_preferences`
```typescript
export const contactConsentPreferences = pgTable(
  "contact_consent_preferences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    recordType: text("record_type").notNull(), // "lead" | "contact"
    recordId: uuid("record_id").notNull(),     // UUID reference to Lead or Contact
    channel: text("channel").notNull(),       // "email" | "sms" | "phone"
    status: text("status").notNull().default("pending"), // "opt_in" | "opt_out" | "pending"
    source: text("source").notNull(),         // e.g. "web_form", "manual", "api"
    updatedById: uuid("updated_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  }
);
```

## 2. In-Memory Store Expansion
We will also register `contactConsentPreferences` in the in-memory database store located in `packages/db/src/index.ts` to ensure compatibility with our test harness and the application DB layer:
- Add `contactConsentPreferences` array to the db client.
- Add queries/mutations to enable typical Drizzle operations (e.g. `select`, `insert`, `update`).

## 3. Core Domain Evaluation Engine (`packages/core`)
We will add standard interfaces and a pure calculation function to `packages/core/src/index.ts`.

### Interface Definition
```typescript
export interface ConsentPreference {
  recordType: "lead" | "contact";
  recordId: string;
  channel: "email" | "sms" | "phone";
  status: "opt_in" | "opt_out" | "pending";
}

export interface ConsentValidationInput {
  channel: "email" | "sms" | "phone";
  preferences: ConsentPreference[];
}
```

### Pure Function Signature
```typescript
export function validateCommunicationConsent(input: ConsentValidationInput): boolean {
  const matchingRule = input.preferences.find(p => p.channel === input.channel);
  if (!matchingRule) return false;
  return matchingRule.status === "opt_in";
}
```

## 4. API Endpoint Integration (`apps/api`)
We will register endpoints on our main Hono API in `apps/api/src/index.ts`:

### Endpoint Schema Validation
Use `zod` for payload validation:
```typescript
const consentUpsertSchema = z.object({
  recordType: z.enum(["lead", "contact"]),
  recordId: z.string().uuid(),
  channel: z.enum(["email", "sms", "phone"]),
  status: z.enum(["opt_in", "opt_out", "pending"]),
  source: z.string().min(1),
});
```

### Route Behavior
- **`GET /api/consent`**:
  Queries the database `contactConsentPreferences` filtering by the authenticated user's active tenant (`orgId`), matching `recordType` and `recordId`.
- **`POST /api/consent`**:
  Validates input payload.
  Checks if a preference record already exists for the tenant, recordType, recordId, and channel.
  If yes, updates the existing record with new `status`, `source`, `updatedById`, and `updatedAt`.
  If no, inserts a new preference record.
  Returns the upserted consent preference record.
