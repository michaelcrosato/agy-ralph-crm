# Specification: Campaign Email Blast API - Design

## 1. Database Schema Extensions

We will extend the `DBActivityLink` interface and type definition in `packages/db/src/index.ts` to allow `"Campaign"` as a valid `targetType`:

```typescript
export interface DBActivityLink {
  id: string;
  orgId: string;
  activityId: string;
  targetType: "Account" | "Contact" | "Lead" | "Opportunity" | "Campaign";
  targetId: string;
}
```

No new database tables are needed, as we utilize:
- `dbStore.campaigns`
- `dbStore.campaignMembers`
- `dbStore.emailTemplates`
- `dbStore.activities` (with type `"email"`)
- `dbStore.activityLinks`

## 2. API Endpoint Design

We will add a new Hono POST route in `apps/api/src/index.ts`:

```typescript
app.post("/api/campaigns/:id/email-blast", tenantAuth, async (c) => { ... })
```

### Flow Logic:
1. Extract campaign `:id` from route parameters.
2. Verify active tenant auth session and extract `orgId` and `userId`.
3. Fetch the campaign record:
   ```typescript
   const campaign = await dbStore.campaigns.findOne(campaignId);
   if (!campaign) {
     return c.json({ error: "Campaign not found" }, 404);
   }
   ```
4. Parse request JSON body for `templateId` and `senderEmail`.
5. Validate `templateId` and `senderEmail` format using standard email regex.
6. Fetch the email template:
   ```typescript
   const template = await dbStore.emailTemplates.findOne(templateId);
   if (!template) {
     return c.json({ error: "Email template not found" }, 404);
   }
   ```
7. Fetch all members associated with the campaign:
   ```typescript
   const members = await dbStore.campaignMembers.findForCampaign(campaignId);
   ```
8. Loop through each member:
   - Check if `leadId` or `contactId` is present.
   - If `leadId` is set:
     - Fetch the lead record. If null, skip.
     - Target email is `lead.email`.
     - Compile template context: `{ lead }`.
   - If `contactId` is set:
     - Fetch the contact record. If null, skip.
     - Target email is `contact.email`.
     - Compile template context: `{ contact }`.
     - If contact has `accountId` set, fetch Account record and add `{ account }` to context.
       - Query all opportunities, filter by `accountId`, sort by closeDate or createdAt descending, and pick the latest one to add `{ opportunity }` to context.
   - If target email is missing or invalid, skip this member.
   - Call `compileEmailTemplate(template, context)`.
   - Insert Activity:
     ```typescript
     const act = await dbStore.activities.insert({
       orgId: tenant.orgId,
       creatorId: tenant.userId,
       type: "email",
       subject: compiled.subject,
       body: compiled.body,
       dueDate: null,
       custom: {
         from: senderEmail,
         to: [targetEmail],
         cc: [],
         bcc: [],
       },
     });
     ```
   - Insert Activity Links:
     - Link to recipient (Lead or Contact).
     - Link to Campaign (targetType: `"Campaign"`).
     - Link to Account (if present).
     - Link to Opportunity (if present).
   - Update Campaign Member status to `"Sent"`:
     ```typescript
     await dbStore.campaignMembers.update(member.id, { status: "Sent" });
     ```
   - Insert Audit Log entry:
     ```typescript
     await dbStore.auditLogs.insert({
       orgId: tenant.orgId,
       recordId: act.id,
       recordType: "EmailLog",
       action: "create",
       userId: tenant.userId,
       changes: null,
     });
     ```
9. Return `{ success: true, processedCount, emailLogs }`.
