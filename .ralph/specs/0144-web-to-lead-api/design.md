# Specification: Public Web-to-Lead Capture API - Design

## 1. API Route
- **Path**: `POST /api/public/web-to-lead`
- **Authentication**: None (skip `tenantAuth` middleware).
- **Request Body Zod Schema (Conceptual)**:
  ```typescript
  const webToLeadSchema = z.object({
    orgId: z.string().uuid(),
    lastName: z.string().min(1),
    email: z.string().email(),
    firstName: z.string().optional(),
    company: z.string().optional(),
    custom: z.record(z.any()).optional(),
    ownerId: z.string().uuid().optional(),
  });
  ```

## 2. Dynamic Tenancy & Context Wrapping
Because the route is public, the `tenantAuth` middleware is not executed. Instead, the handler will manually locate the organization and initialize the active context:
```typescript
app.post("/api/public/web-to-lead", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { orgId, lastName, email, firstName, company, custom, ownerId } = body;

  if (!orgId || !lastName || !email) {
    return c.json({ error: "Missing required fields (orgId, lastName, email)" }, 400);
  }

  // Fetch the target organization
  const org = await mockDb.execute(async () => {
    // Standard unisolated check to verify organization existence
    const organizations = await dbStore.organizations.findMany();
    return organizations.find((o) => o.id === orgId && o.status === "active");
  });

  if (!org) {
    return c.json({ error: "Invalid or inactive organization identifier" }, 400);
  }

  // Wrap all operations in the RLS tenant context
  return await withTenant(orgId, mockDb, async () => {
    // 1. Perform custom field validation
    // 2. Query users for fallback assignment
    // 3. Evaluate assignment rules using evaluateLeadAssignment
    // 4. Update round-robin lastAssignedIndex if appropriate
    // 5. Insert new lead
    // 6. Write audit log entry
    // 7. Fire webhook events
    // 8. Return response
  });
});
```

## 3. Assignment Rule Evaluation Integration
- The routing logic will query:
  - Active Lead Assignment Rule: `dbStore.leadAssignmentRules.findMany()` -> `isActive === 1`.
  - Rule entries: `dbStore.leadAssignmentRuleEntries.findMany()`.
- Route the lead:
  ```typescript
  const evalLead = {
    firstName: firstName || null,
    lastName: lastName,
    email: email,
    company: company || null,
    custom: custom || null,
  };
  const matchResult = evaluateLeadAssignment(evalLead, activeEntries);
  ```
- Owner fallback selection:
  - If `matchResult` matches: Use `matchResult.newOwnerId`.
  - Else if `ownerId` is provided: verify user exists in tenant org, and use it.
  - Else: Query `dbStore.users.findMany()` and assign the first available user.
