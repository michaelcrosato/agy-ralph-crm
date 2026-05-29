import { createSessionToken } from "@crm/auth";
import { dbStore, mockDb, store, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../../../apps/api/src/index";

describe("Support Knowledge Base (Articles & Categories) Engine API", () => {
  let tokenTenantA: string;
  let tokenTenantB: string;

  const orgA = "org-tenant-a";
  const orgB = "org-tenant-b";

  beforeEach(async () => {
    dbStore.clear();

    tokenTenantA = await createSessionToken({
      userId: "user-a",
      orgId: orgA,
      roleId: "role-a",
      permissionsMask: 7,
    });

    tokenTenantB = await createSessionToken({
      userId: "user-b",
      orgId: orgB,
      roleId: "role-b",
      permissionsMask: 7,
    });
  });

  it("should successfully manage KB categories and articles under strict RLS isolation", async () => {
    // 1. Create a Category for Tenant A
    const createCategoryRes = await app.request("/api/service/kb/categories", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "General Troubleshooting",
        description: "Articles for basic troubleshooting guidelines",
      }),
    });

    expect(createCategoryRes.status).toBe(201);
    const categoryBody = await createCategoryRes.json();
    expect(categoryBody.success).toBe(true);
    expect(categoryBody.data.id).toBeDefined();
    expect(categoryBody.data.name).toBe("General Troubleshooting");

    const categoryId = categoryBody.data.id;

    // 2. Query Categories for Tenant A
    const listCategoriesResA = await app.request("/api/service/kb/categories", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
      },
    });

    expect(listCategoriesResA.status).toBe(200);
    const listCatBodyA = await listCategoriesResA.json();
    expect(listCatBodyA.success).toBe(true);
    expect(listCatBodyA.data.length).toBe(1);

    // 3. Query Categories for Tenant B -> should return 0 (RLS isolation)
    const listCategoriesResB = await app.request("/api/service/kb/categories", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantB}`,
      },
    });

    expect(listCategoriesResB.status).toBe(200);
    const listCatBodyB = await listCategoriesResB.json();
    expect(listCatBodyB.success).toBe(true);
    expect(listCatBodyB.data.length).toBe(0);

    // 4. Create an Article for Tenant A (Draft status)
    const createArticleRes1 = await app.request("/api/service/kb/articles", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: "How to Reset Password",
        content: "Step 1: Click forgot password. Step 2: Follow instructions.",
        status: "Draft",
        categoryId,
      }),
    });

    expect(createArticleRes1.status).toBe(201);
    const articleBody1 = await createArticleRes1.json();
    expect(articleBody1.success).toBe(true);
    expect(articleBody1.data.id).toBeDefined();
    expect(articleBody1.data.status).toBe("Draft");
    expect(articleBody1.data.viewCount).toBe(0);

    const articleId = articleBody1.data.id;

    // 5. Create a second Article for Tenant A (Published status)
    const createArticleRes2 = await app.request("/api/service/kb/articles", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: "Setting up Two-Factor Authentication",
        content:
          "To enable 2FA, navigate to Account Settings and click Security.",
        status: "Published",
        categoryId,
      }),
    });

    expect(createArticleRes2.status).toBe(201);
    const articleBody2 = await createArticleRes2.json();
    expect(articleBody2.success).toBe(true);

    // 6. Query Articles for Tenant A without filters
    const listArticlesResA = await app.request("/api/service/kb/articles", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
      },
    });

    expect(listArticlesResA.status).toBe(200);
    const listArtBodyA = await listArticlesResA.json();
    expect(listArtBodyA.success).toBe(true);
    expect(listArtBodyA.data.length).toBe(2);

    // 7. Query Articles for Tenant A filtered by status = "Published"
    const listArticlesResFiltered = await app.request(
      "/api/service/kb/articles?status=Published",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      },
    );

    expect(listArticlesResFiltered.status).toBe(200);
    const listArtBodyFiltered = await listArticlesResFiltered.json();
    expect(listArtBodyFiltered.success).toBe(true);
    expect(listArtBodyFiltered.data.length).toBe(1);
    expect(listArtBodyFiltered.data[0].title).toBe(
      "Setting up Two-Factor Authentication",
    );

    // 8. Tenant B queries articles -> should return 0 (RLS isolation)
    const listArticlesResB = await app.request("/api/service/kb/articles", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantB}`,
      },
    });

    expect(listArticlesResB.status).toBe(200);
    const listArtBodyB = await listArticlesResB.json();
    expect(listArtBodyB.success).toBe(true);
    expect(listArtBodyB.data.length).toBe(0);

    // 9. Increment view count for Tenant A's article
    const viewRes = await app.request(
      `/api/service/kb/articles/${articleId}/view`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      },
    );

    expect(viewRes.status).toBe(200);
    const viewBody = await viewRes.json();
    expect(viewBody.success).toBe(true);
    expect(viewBody.data.viewCount).toBe(1);

    // 10. Tenant B tries to increment view count of Tenant A's article -> should fail (404 Article not found due to RLS)
    const viewResB = await app.request(
      `/api/service/kb/articles/${articleId}/view`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
        },
      },
    );
    expect(viewResB.status).toBe(404);

    // 11. Update the article details (Tenant A)
    const updateRes = await app.request(
      `/api/service/kb/articles/${articleId}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: "Published",
          title: "How to Reset Password (Updated)",
        }),
      },
    );

    expect(updateRes.status).toBe(200);
    const updateBody = await updateRes.json();
    expect(updateBody.success).toBe(true);
    expect(updateBody.data.status).toBe("Published");
    expect(updateBody.data.title).toBe("How to Reset Password (Updated)");

    // 12. Tenant B tries to update Tenant A's article -> should fail (404 due to RLS)
    const updateResB = await app.request(
      `/api/service/kb/articles/${articleId}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: "Draft",
        }),
      },
    );
    expect(updateResB.status).toBe(404);

    // 13. Verify Audit Logs exist in Tenant A's context
    await withTenant(orgA, mockDb, async () => {
      const logs = await dbStore.auditLogs.findMany();
      const catLog = logs.find((l) => l.recordType === "kb_categories");
      const artLog = logs.filter((l) => l.recordType === "kb_articles");

      expect(catLog).toBeDefined();
      expect(catLog?.action).toBe("create");

      expect(artLog.length).toBeGreaterThanOrEqual(2); // create and update
      const updateLog = artLog.find((l) => l.action === "update");
      expect(updateLog).toBeDefined();
      expect(updateLog?.changes?.status?.after).toBe("Published");
    });
  });
});
