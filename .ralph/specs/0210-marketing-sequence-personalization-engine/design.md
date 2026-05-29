# Specification: Marketing Sequence Personalization Engine - Design

## 1. Core Logic Design

We will implement a new helper function `personalizeEmailTemplate` in `packages/core/src/index.ts`.

### 1.1 Parsing Rules

#### 1. Conditional Logic
We match conditional blocks using the following regex pattern:
`/{%\s*if\s+([a-zA-Z0-9.]+)\s*%}(.*?)(?:{%\s*else\s*%}(.*?))?{%\s*endif\s*%}/gs`

- Group 1: The condition pathway (e.g. `lead.company`).
- Group 2: The content to render if the condition evaluates to truthy.
- Group 3: The content to render if the condition evaluates to falsy (optional).

The pathway is resolved against the recipient context:
- If the value is a non-empty string, a number, or true (and not null/undefined/"[N/A]"/""), the condition is truthy.
- Otherwise, it is falsy.

#### 2. Placeholder Filters
We match placeholders using the following regex pattern:
`/\{\{\s*([a-zA-Z0-9.]+)(?:\s*(?:\|\s*[^}]+)+)?\s*\}\}/g`

To support chaining, we capture the entire tag content and split it by `|`.
- The first segment is the path (e.g. `lead.firstName`).
- Subsequent segments are filters (e.g. `default("there")`, `uppercase`, `lowercase`).

##### Supported Filters:
- `default("fallback")`: If the resolved value is null, undefined, empty string `""`, or `"[N/A]"`, it is replaced by `"fallback"`. We extract the literal string inside quotes.
- `uppercase`: Converts the value to uppercase.
- `lowercase`: Converts the value to lowercase.

### 1.2 Integration with compileEmailTemplate
We refactor `compileEmailTemplate` to pass the template to the new personalizer:
```typescript
export function compileEmailTemplate(
  template: EmailTemplateInput,
  context: {
    lead?: Record<string, unknown> | null;
    account?: Record<string, unknown> | null;
    contact?: Record<string, unknown> | null;
    opportunity?: Record<string, unknown> | null;
  },
): { subject: string; body: string } {
  return personalizeEmailTemplate(template, context);
}
```

## 2. API Endpoint Design

We expose a preview route in Hono:
- `POST /api/sequences/preview`
  - Auth middleware extracts session token and populates tenant context.
  - Fetches the contact or lead record using `dbStore.leads.findOne(recordId)` or `dbStore.contacts.findOne(recordId)` under the active tenant context `withTenant`.
  - Executes `compileEmailTemplate` and returns JSON:
    ```json
    {
      "subject": "Resolved Subject",
      "body": "Resolved Body"
    }
    ```
