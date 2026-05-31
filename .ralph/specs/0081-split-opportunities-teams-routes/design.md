# Spec 081 Design

## Decomposed Router Architecture

The new routes under `apps/api/src/routes/opportunities/teams/` will be structured as follows:

```
apps/api/src/routes/opportunities/teams/
├── index.ts              # Composes and exports opportunitiesTeamsApp
├── splits.ts             # Splits endpoints (GET/POST/DELETE splits)
├── contact-roles.ts      # Contact roles endpoints (GET/POST/PUT/DELETE contact-roles)
├── campaign-influence.ts # Campaign influence endpoints (GET/POST/DELETE influence)
├── competitors.ts        # Competitors endpoints (GET/POST/PUT/DELETE competitors)
└── team-members.ts       # Team members endpoints (GET/POST/DELETE team)
```

## Mounting and Types
The barrel entrypoint `index.ts` will re-export `opportunitiesTeamsApp` to avoid modifying any parent route mounts. All sub-apps are mounted on the root `/` of their sub-routers to preserve the parent routing context prefix correctly.
