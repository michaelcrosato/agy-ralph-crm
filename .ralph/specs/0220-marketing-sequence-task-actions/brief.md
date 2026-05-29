# Specification: Marketing Sequence Task Actions - Brief

## 1. Functional Objective
This feature introduces automated follow-up Task creation steps to marketing sequences (Task 0220). While standard sequence steps deliver automated emails or trigger outbound webhooks, users will now be able to add custom task steps. When a recipient processes a sequence task step, the system will automatically generate a new follow-up CRM Task (`activities` table of type `"task"`) for the owner of the lead/contact, populated with dynamic merge fields (e.g. lead name, phone, etc.) and calculate its due date under strict multi-tenant Row-Level Security (RLS) isolation.

## 2. Technical Scope
- **Tenancy Isolation**: Sequence step configurations and created CRM activities must integrate cleanly with organization scopes under tenant contexts.
- **REST Endpoints**:
  - `POST /api/sequences/:id/steps` - Expose step creation supporting `stepType: "task"`, `taskSubject`, `taskBody`, and `taskDueDays`.
- **Pure Core Logic**: 
  - Extend `executePendingSequenceSteps` to process steps of type `"task"`.
  - Perform dynamic variable personalization on the task subject and description/body using the sequence membership recipient context.
  - Automatically create the corresponding CRM Activity in `activities` with standard properties: `type: "task"`, `subject`, `body`, `dueDate`, `creatorId` (system user), and `ownerId` (matching the Lead's or Contact's ownerId, or defaulting to a system placeholder).
  - Create the corresponding activity link in `activityLinks` to link the new task directly to the recipient record (Lead or Contact).
- **Verification**: Complete unit and integration test coverage verifying task step execution, automated task creation, activity linking, and absolute RLS tenant isolation.
