# 020 — Next.js 16.0.0-alpha → 16.2 stable + Turbopack + React Compiler

**Phase:** 1 · **Priority:** Medium · **Status:** `[ ] Todo`

## Description & Expected Impact
`apps/web` runs on `next@16.0.0-alpha.0` (year-old prerelease). Next.js 16.2 ships: Turbopack as default bundler (2–5× faster prod builds, 10× faster Fast Refresh), React Compiler stable (auto-memoization, zero code change), redesigned error page, Server Function logs in terminal, DevTools MCP for AI agent integration. Build Adapters API alpha gives future deployment flexibility.

## Definition of Done & Acceptance Criteria
- [ ] `apps/web/package.json#next` → `^16.2.0`.
- [ ] `next.config.ts` confirms `turbopack: true` (default in 16.2 but explicit for documentation).
- [ ] React Compiler enabled via `experimental.reactCompiler: true` (16.2 makes it stable).
- [ ] `pnpm --filter web build` succeeds and reports Turbopack.
- [ ] Bundle size delta documented (likely smaller).
- [ ] No new build warnings beyond existing baseline.

## Implementation Approach
- Verify `react@^19` is compatible (yes; 16.2 requires React 19).
- Run codemod if shipped: `npx @next/codemod@canary upgrade latest`.
- Confirm app builds with Turbopack via `pnpm --filter web dev` and `pnpm --filter web build`.

## Test Strategy
- Build: `pnpm --filter web build` exits 0.
- Smoke: `pnpm --filter web dev` then load `/`, `/leads`, `/accounts` pages.

## Rollback
Pin back to `16.0.0-alpha.0`.

## References
- [Next.js 16 release](https://nextjs.org/blog/next-16)
- [Next.js 16.2 release](https://nextjs.org/blog/next-16-2)
