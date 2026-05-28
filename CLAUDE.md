# Verification Command Configuration (CLAUDE.md)

## Development Commands

* **Build Workspace**: `pnpm build`
* **Run Verification Pipeline**: `pnpm verify`
* **Run Linting**: `pnpm lint`
* **Run Tests**: `pnpm test`
* **Lint & Format**: `npx biome check --write .`

## Package Execution Constraints

Ensure every child package contains a discrete `verify`, `build`, and `test` script defined in its respective `package.json` to integrate with `turbo`.
