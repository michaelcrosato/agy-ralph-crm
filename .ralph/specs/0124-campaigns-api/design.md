# Spec 0124: Campaigns & Campaign Members API Design

## Database Schema (Drizzle representation)

### 1. `campaigns` Table
```typescript
export const campaigns = pgTable("campaigns", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  status: text("status").notNull().default("Planned"), // "Planned" | "Active" | "Completed" | "Aborted"
  type: text("type").notNull().default("Other"), // "Email" | "Webinar" | "Conference" | "Direct Mail" | "Other"
  isActive: integer("is_active").notNull().default(1), // 0 = inactive, 1 = active
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  budgetedCost: text("budgeted_cost").notNull().default("0.00"),
  actualCost: text("actual_cost").notNull().default("0.00"),
  expectedRevenue: text("expected_revenue").notNull().default("0.00"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

### 2. `campaign_members` Table
```typescript
export const campaignMembers = pgTable("campaign_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  campaignId: uuid("campaign_id")
    .notNull()
    .references(() => campaigns.id, { onDelete: "cascade" }),
  leadId: uuid("lead_id")
    .references(() => leads.id, { onDelete: "cascade" }),
  contactId: uuid("contact_id")
    .references(() => contacts.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("Sent"), // "Sent" | "Responded" | "Registered" etc.
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

### 3. `opportunities` Table Additions
* Add `campaignId` column referencing `campaigns.id` (nullable).

---

## Core Calculations Interface
```typescript
export interface CampaignStatsInput {
  budgetedCost: string;
  actualCost: string;
  expectedRevenue: string;
  members: { status: string }[];
  opportunities: { stage: string; amount: string | null }[];
}

export interface CampaignStatsResult {
  totalMembers: number;
  respondedMembers: number;
  responseRate: number; // percentage (e.g. 25.5)
  totalClosedWonRevenue: string;
  netRevenueRoi: string; // percentage ROI
}
```

---

## REST Endpoints
* `POST /api/campaigns` - Create a Campaign
* `GET /api/campaigns` - List Campaigns
* `GET /api/campaigns/:id` - Fetch Campaign by ID (with stats payload)
* `POST /api/campaigns/:id/members` - Add a member (Lead or Contact) to Campaign
* `GET /api/campaigns/:id/members` - List all members of a Campaign
