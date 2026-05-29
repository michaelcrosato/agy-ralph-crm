# Specification: Marketing Sequence Email Granular Click Events & UTM Tracking - Design

## 1. Database Schema Design
We will introduce a new table `emailClickEvents` (`email_click_events`) in `packages/db/src/schema.ts` and export it:

```typescript
export const emailClickEvents = pgTable("email_click_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  trackerId: uuid("tracker_id")
    .notNull()
    .references(() => emailTrackers.id, { onDelete: "cascade" }),
  clickedUrl: text("clicked_url").notNull(),
  ipAddress: text("ip_address").notNull(),
  userAgent: text("user_agent").notNull(),
  utmSource: text("utm_source"),
  utmMedium: text("utm_medium"),
  utmCampaign: text("utm_campaign"),
  utmTerm: text("utm_term"),
  utmContent: text("utm_content"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

We will also update `packages/db/src/index.ts` to include the `emailClickEvents` table within the in-memory db store simulation.

## 2. UTM Parsing Helper in `@crm/core`
We will implement a simple parser inside `packages/core/src/index.ts`:

```typescript
export function parseUtmParams(urlStr: string) {
  try {
    const url = new URL(urlStr);
    return {
      utmSource: url.searchParams.get("utm_source") || null,
      utmMedium: url.searchParams.get("utm_medium") || null,
      utmCampaign: url.searchParams.get("utm_campaign") || null,
      utmTerm: url.searchParams.get("utm_term") || null,
      utmContent: url.searchParams.get("utm_content") || null,
    };
  } catch {
    // If URL is relative or invalid, we fallback to manual parsing or return nulls
    const getParam = (name: string) => {
      const match = urlStr.match(new RegExp(`[?&]${name}=([^&#]*)`));
      return match ? decodeURIComponent(match[1]) : null;
    };
    return {
      utmSource: getParam("utm_source"),
      utmMedium: getParam("utm_medium"),
      utmCampaign: getParam("utm_campaign"),
      utmTerm: getParam("utm_term"),
      utmContent: getParam("utm_content"),
    };
  }
}
```

## 3. Endpoints & Controller Logic

### 3.1 Public Endpoint (`GET /api/public/emails/track/click/:token`)
We will update this existing endpoint in `apps/api/src/index.ts`:
1. Retrieve client IP (headers `x-forwarded-for` or `cf-connecting-ip` or fallback `"127.0.0.1"`).
2. Retrieve User Agent (header `user-agent` or fallback `"Unknown"`).
3. If a `target` is present:
   - Call the UTM parsing helper `parseUtmParams(target)`.
   - Create a granular click event in `dbStore.emailClickEvents` under the `withTenant` block.
4. Continue standard tracking updates, audit logs, sequence actions execution, and redirection.

### 3.2 Retrieval Endpoint (`GET /api/emails/trackers/:trackerId/clicks`)
Expose a new endpoint:
1. Load the tracker from `dbStore.emailTrackers.findOne(trackerId)`.
2. If tracker doesn't exist, return `404 Not Found`.
3. Verify tracker's `orgId` matches the active organization context. If not, return `403 Forbidden` (or `404 Not Found` for security/isolation).
4. Fetch all click events in `dbStore.emailClickEvents` matching `trackerId` and sort them descending by `createdAt`.
5. Return events as a JSON array under `"clicks"`.
