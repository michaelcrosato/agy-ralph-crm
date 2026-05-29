# Specification: Campaign Email Open & Click Tracking API - Design

## 1. Database Schema
We introduce the `emailTrackers` schema.

```typescript
export const emailTrackers = pgTable("email_trackers", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  activityId: uuid("activity_id").notNull().references(() => activities.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  openCount: integer("open_count").notNull().default(0),
  clickCount: integer("click_count").notNull().default(0),
  lastOpenedAt: timestamp("last_opened_at"),
  lastClickedAt: timestamp("last_clicked_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

## 2. REST Endpoints

### Create Tracker
- **Method**: `POST`
- **Path**: `/api/emails/:activityId/tracker`
- **Controller Logic**:
  - Verify that the email activity exists and belongs to the active tenant.
  - Generate a secure tracking token (e.g. `tr-${Math.random().toString(36).substring(2, 11)}`).
  - Insert a new `emailTracker` record.

### Get Tracker Stats
- **Method**: `GET`
- **Path**: `/api/emails/:activityId/tracker`
- **Controller Logic**:
  - Verify the activity belongs to the active tenant.
  - Return the tracker record or 404.

### Public Open Tracker
- **Method**: `GET`
- **Path**: `/api/public/emails/track/open/:token`
- **Controller Logic**:
  - Find the tracker by token (requires bypassing active tenant check since it's a public webhook, but must operate securely).
  - If found:
    - Update `openCount = openCount + 1` and `lastOpenedAt = new Date()`.
  - Return `Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64")` (1x1 transparent GIF).
  - Set Header `Content-Type: image/gif`.

### Public Click Tracker
- **Method**: `GET`
- **Path**: `/api/public/emails/track/click/:token`
- **Controller Logic**:
  - Find the tracker by token.
  - If found:
    - Update `clickCount = clickCount + 1` and `lastClickedAt = new Date()`.
  - Redirect to the `target` query parameter URL.
