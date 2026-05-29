# Specification: Marketing Sequence Personalization Engine - Brief

## 1. Functional Objective
To enable modern enterprise marketing teams to execute highly targeted and personalized outbound email campaigns, this feature introduces **Task 0210: Marketing Sequence Personalization Engine**.

This feature adds advanced personalization merge tags and conditional blocks to the sequence step execution, including:
1. **Dynamic Fallbacks**: Placeholders can specify default fallback values, e.g., `{{lead.firstName | default("there")}}` or `{{contact.firstName | default("friend")}}`.
2. **Transformational Filters**: Text case formatting transformation, e.g., `{{lead.company | uppercase}}` or `{{contact.lastName | lowercase}}`.
3. **Conditional Content Blocks**: Dynamic content based on simple conditional checks, e.g.:
   `{% if lead.company %}working at {{lead.company}}{% else %}your current company{% endif %}`
4. **Endpoint API Support**: Public and tenant-protected endpoints to dry-run or preview compiled templates with personalization data.

## 2. Technical Scope
- **Core personalizer in `packages/core`**:
  - Implement a new dynamic personalization compiler `personalizeEmailTemplate(template, context)` in `packages/core/src/index.ts`.
  - Refactor `compileEmailTemplate` to leverage `personalizeEmailTemplate` to automatically parse and render default values, case transforms, and IF/ELSE condition blocks.
- **REST Endpoints in `apps/api`**:
  - Expose `POST /api/sequences/preview` under `apps/api/src/index.ts` (tenant-protected) which accepts a template body/subject and target record to return a fully personalized compile result.
- **Integration & RLS Tests in `packages/testing`**:
  - Write comprehensive integration tests in `packages/testing/src/marketing-sequence-personalization.test.ts` asserting correct personalization rendering, nested paths, default fallback evaluation, uppercase/lowercase filter execution, condition block parsing, and strict tenant RLS isolation boundaries (e.g. Tenant A cannot preview Tenant B's contacts/leads or templates).
