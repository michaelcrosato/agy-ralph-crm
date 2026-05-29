# Specification: Campaign Unsubscribe & Recipient Opt-Out API - Design

## 1. Relational Mechanics & Database Stores

We reuse the existing tables in `packages/db/src/schema.ts`:
- `emailTrackers` (contains `activityId`, `token`, `orgId`)
- `activityLinks` (contains `activityId`, `targetType` ["Lead" | "Contact"], `targetId`, `orgId`)
- `contactConsentPreferences` (contains `recordType` ["lead" | "contact"], `recordId`, `channel`, `status`, `source`, `orgId`)
- `auditLogs`

For mock db operations, `dbStore.contactConsentPreferences` will support:
- `findMany()`: Returns records matching `orgId`.
- `findOne(id)`: Returns single record matching `orgId`.
- `insert(preference)`: Inserts new preference under `orgId`.
- `update(id, updates)`: Updates existing preference under `orgId`.

## 2. API Endpoints Design

### Public Unsubscribe
- **Method**: `GET`
- **Path**: `/api/public/emails/unsubscribe/:token`
- **Handler Logic**:
  1. Retrieve the `token` parameter from path.
  2. Bypassing active token auth (as it is public), call `dbStore.emailTrackers.findByToken(token)`.
  3. If not found, return `c.json({ success: false, error: "Invalid tracking token" }, 404)`.
  4. With the found tracker, execute inside the tenant context:
     ```typescript
     await withTenant(tracker.orgId, mockDb, async () => {
       // 1. Find target recipients
       const allLinks = await dbStore.activityLinks.findMany();
       const recipients = allLinks.filter(
         (link) =>
           link.activityId === tracker.activityId &&
           (link.targetType === "Lead" || link.targetType === "Contact")
       );

       for (const recipient of recipients) {
         const type = recipient.targetType.toLowerCase() as "lead" | "contact";
         
         // 2. Check if preference already exists
         const allPrefs = await dbStore.contactConsentPreferences.findMany();
         const existing = allPrefs.find(
           (p) =>
             p.recordType === type &&
             p.recordId === recipient.targetId &&
             p.channel === "email"
         );

         if (existing) {
           await dbStore.contactConsentPreferences.update(existing.id, {
             status: "opt_out",
             source: "public_unsubscribe",
             updatedAt: new Date(),
           });
         } else {
           await dbStore.contactConsentPreferences.insert({
             orgId: tracker.orgId,
             recordType: type,
             recordId: recipient.targetId,
             channel: "email",
             status: "opt_out",
             source: "public_unsubscribe",
             updatedById: "00000000-0000-0000-0000-000000000000",
           });
         }

         // 3. Log audit log
         await dbStore.auditLogs.insert({
           orgId: tracker.orgId,
           recordId: recipient.targetId,
           recordType: "contact_consent_preferences",
           action: "upsert",
           userId: "00000000-0000-0000-0000-000000000000",
           changes: {
             status: { before: existing?.status || "pending", after: "opt_out" },
           },
         });
       }
     });
     ```
  5. Return a highly professional, beautifully styled HTML confirmation page:
     ```html
     <!DOCTYPE html>
     <html>
       <head>
         <meta charset="utf-8">
         <title>Unsubscribed Successfully</title>
         <style>
           body {
             font-family: 'Inter', -apple-system, sans-serif;
             background: #f3f4f6;
             display: flex;
             align-items: center;
             justify-content: center;
             height: 100vh;
             margin: 0;
           }
           .card {
             background: white;
             padding: 40px;
             border-radius: 12px;
             box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
             text-align: center;
             max-width: 400px;
           }
           h1 { color: #1f2937; font-size: 24px; margin-bottom: 8px; }
           p { color: #4b5563; font-size: 16px; margin-bottom: 24px; line-height: 1.5; }
         </style>
       </head>
       <body>
         <div class="card">
           <h1>Successfully Unsubscribed</h1>
           <p>Your email address has been opted out from our marketing and campaign communications.</p>
         </div>
       </body>
     </html>
     ```
