# Spec 0138: Lead Conversion Field Mapping Engine Design

## Database Schema & Storage Types

### Schema Definition (`packages/db/src/schema.ts`)
```typescript
export const leadConversionMappings = pgTable("lead_conversion_mappings", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  sourceLeadField: text("source_lead_field").notNull(),
  targetObjectType: text("target_object_type").notNull(), // "accounts" | "contacts" | "opportunities"
  targetField: text("target_field").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

### Store Intermediary Types (`packages/db/src/index.ts`)
```typescript
export interface DBLeadConversionMapping {
  id: string;
  orgId: string;
  sourceLeadField: string;
  targetObjectType: "accounts" | "contacts" | "opportunities";
  targetField: string;
  createdAt: Date;
}
```

## Core Calculations API (`packages/core/src/index.ts`)

```typescript
export interface LeadConversionMappingInput {
  sourceLeadField: string;
  targetObjectType: "accounts" | "contacts" | "opportunities";
  targetField: string;
}

export interface ConvertLeadWithMappingsInput {
  lead: LeadRecord;
  opportunityName?: string;
  opportunityAmount?: string;
  mappings: LeadConversionMappingInput[];
}

export function convertLeadWithMappings(
  input: ConvertLeadWithMappingsInput
): ConvertedEntities {
  const { lead, opportunityName, opportunityAmount, mappings } = input;
  const entities = convertLead({ lead, opportunityName, opportunityAmount });

  for (const mapping of mappings) {
    const { sourceLeadField, targetObjectType, targetField } = mapping;

    // Helper to resolve value from lead
    let value: unknown = undefined;
    if (sourceLeadField.startsWith("custom.")) {
      const fieldKey = sourceLeadField.substring("custom.".length);
      value = (lead.custom as Record<string, unknown> | null)?.[fieldKey];
    } else {
      value = (lead as unknown as Record<string, unknown>)[sourceLeadField];
    }

    if (value === undefined || value === null) {
      continue;
    }

    // Resolve target entity
    const targetEntity = entities[targetObjectType];
    if (!targetEntity) {
      continue;
    }

    // Set value on target entity
    if (targetField.startsWith("custom.")) {
      const fieldKey = targetField.substring("custom.".length);
      if (!targetEntity.custom) {
        targetEntity.custom = {};
      }
      (targetEntity.custom as Record<string, unknown>)[fieldKey] = value;
    } else {
      (targetEntity as unknown as Record<string, unknown>)[targetField] = String(value);
    }
  }

  return entities;
}
```

## REST API Interface

### Endpoints
1. `GET /api/lead-conversions/mappings`
   - Headers: `Authorization: Bearer <session-token>`
   - Response: `200 OK` -> `{ success: true, data: DBLeadConversionMapping[] }`

2. `POST /api/lead-conversions/mappings`
   - Headers: `Authorization: Bearer <session-token>`
   - Body:
     ```json
     {
       "sourceLeadField": "custom.industry",
       "targetObjectType": "accounts",
       "targetField": "custom.industry_segment"
     }
     ```
   - Response: `201 Created` -> `{ success: true, data: DBLeadConversionMapping }`

3. `DELETE /api/lead-conversions/mappings/:id`
   - Headers: `Authorization: Bearer <session-token>`
   - Response: `200 OK` -> `{ success: true }`
