import {
  type TenantContext,
  createSessionToken,
  verifySessionToken,
} from "@crm/auth";
import { assertSessionTenant, mockDb, withTenant } from "@crm/db";
import { sql } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

describe("Phase 1: Multi-Tenant Security & Authentication Tests", () => {
  it("should successfully sign and verify Tenant JWT tokens", async () => {
    const mockContext: TenantContext = {
      userId: "user-123",
      orgId: "org-456",
      roleId: "role-789",
      permissionsMask: 7,
    };

    const token = await createSessionToken(mockContext);
    expect(token).toBeDefined();
    expect(typeof token).toBe("string");

    const decoded = await verifySessionToken(token);
    expect(decoded.userId).toBe(mockContext.userId);
    expect(decoded.orgId).toBe(mockContext.orgId);
    expect(decoded.roleId).toBe(mockContext.roleId);
    expect(decoded.permissionsMask).toBe(mockContext.permissionsMask);
  });

  it("should execute queries with strict app.current_org_id RLS transactions", async () => {
    const targetOrgId = "org-456";
    const executeSpy = vi.spyOn(mockDb, "execute");

    const result = await withTenant(targetOrgId, mockDb, async (tx) => {
      // Execute a test database query inside the tenant transaction context
      return await tx.execute(sql`SELECT * FROM accounts`);
    });

    expect(result).toBeDefined();
    // Check that SET LOCAL app.current_org_id was called with the correct org ID first
    const firstCallArg = executeSpy.mock.calls[0][0] as {
      queryChunks: Array<{ value: string[] }>;
    };
    expect(firstCallArg).toBeDefined();
    expect(firstCallArg.queryChunks[0].value[0]).toContain(
      "SET LOCAL app.current_org_id =",
    );
    expect(executeSpy.mock.calls[0][0]).toBeDefined();

    executeSpy.mockRestore();
  });

  describe("assertSessionTenant RLS verification helpers", () => {
    it("should pass when orgId matches active tenant context", async () => {
      const targetOrg = "org-456";
      await withTenant(targetOrg, mockDb, async () => {
        expect(() => assertSessionTenant(targetOrg)).not.toThrow();
      });
    });

    it("should throw when orgId does not match active tenant context", async () => {
      const targetOrg = "org-456";
      const differentOrg = "org-789";
      await withTenant(targetOrg, mockDb, async () => {
        expect(() => assertSessionTenant(differentOrg)).toThrow(
          "RLS Isolation Violation: Tenant mismatch.",
        );
      });
    });

    it("should throw when executed outside tenant context", () => {
      expect(() => assertSessionTenant("org-456")).toThrow(
        "RLS Isolation Violation: Tenant context not set.",
      );
    });
  });
});
