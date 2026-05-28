# Web Application Layer Local Constraints (AGENTS.md)

This path-scoped file outlines UI execution guidelines and constraints for the Next.js 16 Web shell.

## Local Constraints
- **Zero Business Logic in UI:** All CRM routing and application logic must remain in `packages/core` or `apps/api`. The web shell strictly manages presentation, navigation, and user context.
- **Server Action Prohibition:** Next.js Server Actions are explicitly barred from execution. Inter-service data communication must rely entirely on tRPC or the Hono API routes.
- **Style Consistency:** Rely on `@crm/ui` design tokens and components. No custom ad-hoc styling outside vanilla CSS custom properties defined in `@crm/ui/theme.css`.
- **E2E Testing:** Playwright configurations in `/e2e` cover critical web paths. Ensure new interactive elements contain distinct programmatic IDs.
