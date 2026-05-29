# Spec 0124: Campaigns & Campaign Members API Requirements

## Functional Requirements

### 1. Campaign Management
* Users must be able to create, read, update, and delete marketing campaigns.
* Campaigns must support tracking the following attributes:
  * `name`: String (Required)
  * `status`: Planned, Active, Completed, Aborted
  * `type`: Email, Webinar, Conference, Direct Mail, Other
  * `isActive`: Boolean flag (integer 0 or 1 in DB)
  * `startDate`: Timestamp
  * `endDate`: Timestamp
  * `budgetedCost`: Decimal/Numeric (stored as text string)
  * `actualCost`: Decimal/Numeric (stored as text string)
  * `expectedRevenue`: Decimal/Numeric (stored as text string)

### 2. Campaign Members Management
* Campaign members represent Leads or Contacts associated with a specific Campaign.
* A campaign member must link to EITHER a Lead or a Contact.
* Campaign members must track:
  * `campaignId`: Reference to campaign
  * `leadId`: Nullable reference to lead
  * `contactId`: Nullable reference to contact
  * `status`: Member status (e.g., "Sent", "Responded", "Registered")
* The API must prevent duplicate members (e.g. adding the same Lead to the same Campaign twice).

### 3. Campaign Attribution & ROI Calculations
* Opportunities must support a nullable `campaignId` representing the primary campaign source.
* The system must compute the following campaign statistics:
  * `totalMembers`: Total count of associated Leads and Contacts.
  * `respondedMembers`: Count of members with a status of "Responded" (case-insensitive check or configurable).
  * `responseRate`: Percentage of responded members vs. total members.
  * `totalClosedWonRevenue`: Sum of `amount` from all Closed Won opportunities that reference this `campaignId`.
  * `roi`: Net ROI calculated as `(totalClosedWonRevenue - actualCost) / actualCost * 100` (or simplified ROI calculation if actualCost is 0).

## Row-Level Security (RLS) Requirements
* All queries and mutations for campaigns and campaign members must be bound to the current tenant (`orgId`).
* Any cross-tenant data access (e.g., attempting to add another tenant's contact as a campaign member, or reading another tenant's campaign) must throw an immediate RLS Isolation Violation.
