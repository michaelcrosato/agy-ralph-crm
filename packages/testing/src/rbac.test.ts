import { createSessionToken, Permission } from "@crm/auth";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestApp } from "./_harness";

const app = createTestApp();

describe("Deep RBAC (Role-Based Access Control) Enforcement Suite (Spec 068)", () => {
  const orgId = "org-rbac-test";

  beforeEach(async () => {
    await dbStore.clear();
  });

  it("should permit READ operations and deny WRITE/DELETE for READ_RECORDS permission only (mask: 1)", async () => {
    const token = await createSessionToken({
      userId: "user-read-only",
      orgId,
      roleId: "role-reader",
      permissionsMask: Permission.READ_RECORDS, // 1
    });

    const headers = { Authorization: `Bearer ${token}` };

    // 1. GET should be allowed (returns 200)
    const getRes = await app.request("/api/accounts", { headers });
    expect(getRes.status).toBe(200);

    // 2. POST should be blocked (returns 403)
    const postRes = await app.request("/api/accounts", {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "Rbac Corp" }),
    });
    expect(postRes.status).toBe(403);
    const postBody = await postRes.json();
    expect(postBody.error).toContain("Forbidden");

    // 3. DELETE should be blocked (returns 403)
    const deleteRes = await app.request("/api/accounts/some-id", {
      method: "DELETE",
      headers,
    });
    expect(deleteRes.status).toBe(403);
  });

  it("should deny READ and permit WRITE operations for WRITE_RECORDS permission only (mask: 2)", async () => {
    const token = await createSessionToken({
      userId: "user-write-only",
      orgId,
      roleId: "role-writer",
      permissionsMask: Permission.WRITE_RECORDS, // 2
    });

    const headers = { Authorization: `Bearer ${token}` };

    // 1. GET should be blocked (returns 403)
    const getRes = await app.request("/api/accounts", { headers });
    expect(getRes.status).toBe(403);

    // 2. POST should not return 403 (should pass RBAC and reach body validation returning 400 due to empty body)
    const postRes = await app.request("/api/accounts", {
      method: "POST",
      headers,
      body: JSON.stringify({}),
    });
    expect(postRes.status).toBe(400); // 400 is body validation failure, proving RBAC check passed successfully!
  });

  it("should completely block users with ZERO permissions (mask: 0)", async () => {
    const token = await createSessionToken({
      userId: "user-none",
      orgId,
      roleId: "role-none",
      permissionsMask: 0,
    });

    const headers = { Authorization: `Bearer ${token}` };

    const getRes = await app.request("/api/accounts", { headers });
    expect(getRes.status).toBe(403);

    const postRes = await app.request("/api/accounts", {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "Blocked" }),
    });
    expect(postRes.status).toBe(403);
  });

  it("should block standard CRUD users from administrative metadata routes (mask: 7)", async () => {
    const token = await createSessionToken({
      userId: "user-crud-only",
      orgId,
      roleId: "role-crud",
      permissionsMask:
        Permission.READ_RECORDS |
        Permission.WRITE_RECORDS |
        Permission.DELETE_RECORDS, // 7
    });

    const headers = { Authorization: `Bearer ${token}` };

    // GET /api/accounts passes
    const getRes = await app.request("/api/accounts", { headers });
    expect(getRes.status).toBe(200);

    // POST /api/metadata/fields is blocked (requires MANAGE_METADATA)
    const metaRes = await app.request("/api/metadata/fields", {
      method: "POST",
      headers,
      body: JSON.stringify({}),
    });
    expect(metaRes.status).toBe(403);

    // POST /api/admin/seed is blocked (requires MANAGE_USERS)
    const adminRes = await app.request("/api/admin/seed", {
      method: "POST",
      headers,
      body: JSON.stringify({}),
    });
    expect(adminRes.status).toBe(403);
  });

  it("should permit metadata operations for users with MANAGE_METADATA permission (mask: 23)", async () => {
    const token = await createSessionToken({
      userId: "user-metadata-admin",
      orgId,
      roleId: "role-metadata",
      permissionsMask:
        Permission.READ_RECORDS |
        Permission.WRITE_RECORDS |
        Permission.DELETE_RECORDS |
        Permission.MANAGE_METADATA, // 23
    });

    const headers = { Authorization: `Bearer ${token}` };

    // POST /api/metadata/fields should bypass RBAC and fail on params validation (returning 400)
    const metaRes = await app.request("/api/metadata/fields", {
      method: "POST",
      headers,
      body: JSON.stringify({}),
    });
    expect(metaRes.status).toBe(400); // 400 proves RBAC check bypassed successfully!
  });

  it("should permit seeding operations for users with MANAGE_USERS permission (mask: 15)", async () => {
    const token = await createSessionToken({
      userId: "user-user-admin",
      orgId,
      roleId: "role-admin",
      permissionsMask:
        Permission.READ_RECORDS |
        Permission.WRITE_RECORDS |
        Permission.DELETE_RECORDS |
        Permission.MANAGE_USERS, // 15
    });

    const headers = { Authorization: `Bearer ${token}` };

    // POST /api/admin/seed should bypass RBAC and succeed
    const adminRes = await app.request("/api/admin/seed", {
      method: "POST",
      headers,
      body: JSON.stringify({ accountCount: 1 }),
    });
    expect(adminRes.status).toBe(200);
  });
});
