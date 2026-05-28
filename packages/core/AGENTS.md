# Core Pure Domain Constraints (AGENTS.md)

This path-scoped file outlines code rules and design boundaries for the pure domain logic.

## Local Constraints
- **Pure Functions Only:** The core domain package should contain stateless, pure business validation logic, Zod contracts, and domain interfaces.
- **Zero I/O Dependencies:** Core functions must never make direct database queries, network requests, or read local files. They receive configurations and records as structured input parameters.
- **No Side-Effects:** Lead conversion, stage changes, or account creation operations must be structured as state transitions returning updated models and audit-ready event definitions rather than performing mutating database operations directly.
