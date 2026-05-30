import { getActiveOrgId } from "./_tenant";

/**
 * Single chokepoint for RLS ownership assertion. Currently used as a
 * defense-in-depth wrapper inside store CRUD operations; once spec 014
 * lands real Postgres RLS policies, this stays as the application-level
 * guard against accidentally bypassing `withTenant`.
 *
 * Throws `RLS Isolation Violation: Tenant mismatch.` on cross-tenant access.
 *
 * @param entity - Any record with an `orgId` field.
 */
export function assertTenantOwns(entity: { orgId: string }): void {
  const active = getActiveOrgId();
  if (entity.orgId !== active) {
    throw new Error("RLS Isolation Violation: Tenant mismatch.");
  }
}
