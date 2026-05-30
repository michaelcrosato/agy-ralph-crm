import { assertTenantOwns, mockDb, withTenant } from "@crm/db";
import { describe, expect, it } from "vitest";

describe("packages/db RLS helpers (spec 012)", () => {
  it("assertTenantOwns succeeds when entity.orgId matches active tenant", async () => {
    await withTenant("org-a", mockDb, async () => {
      expect(() => assertTenantOwns({ orgId: "org-a" })).not.toThrow();
    });
  });

  it("assertTenantOwns throws on cross-tenant access", async () => {
    await withTenant("org-a", mockDb, async () => {
      expect(() => assertTenantOwns({ orgId: "org-b" })).toThrowError(
        /Tenant mismatch/,
      );
    });
  });

  it("assertTenantOwns throws when no tenant context is set", () => {
    expect(() => assertTenantOwns({ orgId: "org-a" })).toThrowError(
      /Tenant context not set/,
    );
  });
});
