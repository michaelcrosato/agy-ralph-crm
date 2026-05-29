# Specification: Workflow Event-Condition-Action (ECA) Upgrades - Requirements

## 1. Functional Requirements

### 1.1 Nested AND/OR Condition Engine
- **REQ-1.1.1**: The workflow engine must support nested, recursive logical conditions using `all` (logical AND) and `any` (logical OR) operators.
- **REQ-1.1.2**: Simple conditions must support operators: `equals`, `not_equals`, `greater_than`, `less_than`, and `contains`.
- **REQ-1.1.3**: The engine must remain backwards-compatible with legacy simple condition objects (non-nested structures).

### 1.2 Advanced Workflow Actions
- **REQ-1.2.1**: **Automated Task Creation (`task`)**:
  - The system must support creating a new task activity linked to the triggering record.
  - Configuration options must support setting the task `subject`, `body`, and an optional `dueDateOffsetDays` (calculated relative to `Date.now()`).
- **REQ-1.2.2**: **Picklist Field Updates (`field_update`)**:
  - The system must support updating record fields on the triggering record.
  - For example, an automation ruleset can transition an Opportunity stage to a configured picklist value upon matching criteria.
- **REQ-1.2.3**: **Slack-like Webhook Templates**:
  - Webhook actions must support rendering dynamic placeholder variables from the event payload using curly brackets `{field_name}` (e.g. `{name}`, `{amount}`).
  - Templating must apply to both the URL parameters and mock outbound payloads.

### 1.3 Tenant Context Propagation & RLS
- **REQ-1.3.1**: Task creation and field updates triggered by workflow events must execute inside the active `withTenant` context, enforcing RLS and generating correct audit trail entries automatically.
- **REQ-1.3.2**: A workflow trigger from one tenant must never evaluate, execute actions for, or mutate records of another tenant.

## 2. Verification & Safety Requirements
- **REQ-2.1**: Complete unit tests covering simple vs nested AND/OR condition evaluation.
- **REQ-2.2**: Integration tests validating REST registration, evaluation, and side-effects.
- **REQ-2.3**: Zero TypeScript compile-time errors and perfect Biome formatting.
