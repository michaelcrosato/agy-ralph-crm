# Phase 6: Performance Optimization & Testing Matrix - Design

## Context Memory Budget Definition

We will define the budget specification inside `bench/budget.json`:

```json
{
  "maxContextTokens": 32768,
  "maxFileLinesStandard": 400,
  "performanceTargets": {
    "queryTimeMsLimit": 50,
    "leadConversionTimeMsLimit": 100
  }
}
```

## Mock Seeding Engine Contracts

In `packages/testing/src/index.ts`:
* Export standard mock generators:
```typescript
export interface MockSeedConfig {
  accountCount: number;
  contactCount: number;
  leadCount: number;
}

export function generateSeedData(config: MockSeedConfig): {
  accounts: Array<{ name: string; domain: string }>;
  contacts: Array<{ firstName: string; lastName: string; email: string }>;
  leads: Array<{ company: string; email: string; status: string }>;
};
```
