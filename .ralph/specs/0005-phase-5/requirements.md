# Phase 5: Managed First-Party Core Extensions - Requirements

## Functional Requirements
1. **Ticketing Extension Module:** `modules/service-lite` must export functions to handle `tickets` (create, resolve, update) separate from the sales core.
2. **Model Context Protocol (MCP) Server:** Standardized tools (`crm_get_account`, `crm_list_contacts`) allowing AI assistants to query CRM databases safely.

## Security & Verification Requirements
1. **First-party Modular Isolation Verification:** Prove that the `service-lite` module introduces system ticketing capabilities cleanly without mutating core sales files.
2. **TypeScript / Lint Compilation:** All code must compile cleanly via `pnpm verify` with zero warnings or errors.
