# Specification: Sales Pipeline Stalled Alerts API - Verification

## 1. Local Workspace Checks
To verify that this feature compiles correctly and passes formatting/type checking out-of-the-box, run:
```bash
pnpm verify
```

## 2. Test Execution Suite
To run the specific integration and unit tests written for this feature, execute:
```bash
pnpm test -t "Stalled Deals"
```

## 3. Global Test suite Verification
Assert that no downstream regression breaks other modules inside the CRM workspace by executing:
```bash
pnpm test
```
