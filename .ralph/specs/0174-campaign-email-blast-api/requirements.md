# Specification: Campaign Email Blast API - Requirements

## 1. Functional Requirements

### 1.1 Campaign Retrieval and Validation
- The campaign specified by `:id` must exist and belong to the active tenant.
- If the campaign is not found or belongs to a different tenant, the API must return a `404 Not Found` error.

### 1.2 Input Parameters & Validation
- The endpoint must accept:
  - `templateId` (string, UUID): The email template to compile and send.
  - `senderEmail` (string): The email address to populate as the `from` sender.
- If `templateId` is missing, the API must return `400 Bad Request`.
- If `senderEmail` is missing or is not a valid email format, the API must return `400 Bad Request`.
- The template specified by `templateId` must exist and belong to the active tenant. If not found or tenant-mismatched, return `404 Not Found`.

### 1.3 Bulk Processing & Merge Field Compilation
- Fetch all campaign members associated with the campaign.
- Filter out campaign members who are already processed or let them be sent (if they have no email or if we only send to members). Typically, we send to all members in the campaign. Let's send to all campaign members who have a `leadId` or `contactId`.
- For each campaign member:
  - If `leadId` is set, load the corresponding `Lead` record under tenant RLS context.
  - If `contactId` is set, load the corresponding `Contact` record under tenant RLS context.
    - If the Contact is linked to an Account, fetch the `Account` record.
    - Fetch the most recently closed/created `Opportunity` associated with that Account (if any) to resolve opportunity merge fields.
  - Call `compileEmailTemplate` to produce personalized subject and body.
  - Retrieve the target email address (the Lead or Contact's email).
  - Create a new activity record of type `"email"` in `dbStore.activities`:
    - `creatorId`: Active user ID.
    - `subject`: Compiled subject.
    - `body`: Compiled body.
    - `custom`: `{ from: senderEmail, to: [targetEmail], cc: [], bcc: [] }`.
  - Create activity links in `dbStore.activityLinks` connecting the new activity log to:
    - The target `Lead` or `Contact` (recipient).
    - The `Campaign` itself (targetType: `"Campaign"`).
    - The `Account` (if present).
    - The `Opportunity` (if present).
  - Update the campaign member's `status` to `"Sent"`.
  - Create a new audit trail log entry for the created Activity log record.

### 1.4 API Response
- On successful completion, return a `200 OK` response with:
  - `success`: `true`
  - `processedCount`: Number of successfully processed and emailed campaign members.
  - `emailLogs`: Array of the newly created Activity log records.

## 2. Non-Functional & Security Requirements

### 2.1 Multi-Tenant RLS Security
- **Strict Tenancy Boundaries**: The engine must never read records belonging to another tenant or mutate/update members belonging to another tenant.
- Any attempt to compile templates or fetch related objects using IDs from a different tenant must result in those fields resolving as empty, or blocking the execution, ensuring zero data leak.

### 2.2 Error Handling
- The entire bulk blast should run in an transaction-like safe state. Since our mock DB is memory-based, we'll process each member sequentially, gracefully handling cases where some members don't have emails (log them with empty/null emails, or skip them if email is missing, but log the rest). Let's skip members who have no email address defined, or default to an empty string. Let's skip campaign members who do not have an email address associated with them and count them as skipped, or process them with empty/default if appropriate. Let's log activities for those with emails.
