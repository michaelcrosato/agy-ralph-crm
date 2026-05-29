# Specification: Marketing Sequence Task Actions - Requirements

## 1. Functional Requirements

### 1.1 Task Sequence Steps Creation
- **REQ-1.1.1**: The system must allow creating sequence steps of type `task`.
- **REQ-1.1.2**: A Task step must support:
  - `stepType`: "task"
  - `taskSubject`: A valid, non-empty text string for the created activity's subject.
  - `taskBody`: An optional text string containing a custom description/body template with merge variables.
  - `taskDueDays`: An optional integer representing the number of days after step execution when the task is due.
- **REQ-1.1.3**: When creating a `task` step, the `templateId` and `webhookUrl` parameters must be optional and can be `null`.
- **REQ-1.1.4**: Standard step parameters such as `stepNumber`, `delayDays`, and `waitCondition` must be fully supported on task steps.

### 1.2 Task Step Execution & Activity Creation
- **REQ-1.2.1**: When `executePendingSequenceSteps` runs, if a step is of type `task`, the system must skip email sending and webhook dispatching, and instead automatically create a new activity of type `"task"`.
- **REQ-1.2.2**: The created activity must:
  - Have `orgId` matching the sequence membership.
  - Have `type` set to `"task"`.
  - Have `subject` set to the personalized `taskSubject` (supporting recipient merge tags).
  - Have `body` set to the personalized `taskBody` if provided (supporting recipient merge tags).
  - Have `dueDate` set to `currentTime` plus `taskDueDays` (if provided, otherwise defaulted to `currentTime`).
  - Have `creatorId` set to the default system ID: `"00000000-0000-0000-0000-000000000000"`.
  - Have `ownerId` matching the `ownerId` of the enrolled Lead or Contact record (or defaulted to `"00000000-0000-0000-0000-000000000000"` if not found).
- **REQ-1.2.3**: The system must automatically insert an `activityLinks` entry linking the newly created activity to the corresponding Lead or Contact record (`targetType` set to `"lead"` or `"contact"`, and `targetId` set to the `recordId`).
- **REQ-1.2.4**: After creating the activity and link, the sequence membership status and step advancement logic must behave identically to email/webhook steps, updating `currentStepNumber` and setting `nextExecutionAt` based on delay days.

## 2. Security & Verification Requirements
- **REQ-2.1**: Strict tenant RLS: a tenant must never be allowed to create task sequence steps, trigger automated task creations, or access created activity logs belonging to another organization.
- **REQ-2.2**: Complete TypeScript compilation with zero errors.
- **REQ-2.3**: Integration test coverage asserting task sequence step creation, processing, CRM activity and link persistence, and tenant RLS isolation.
