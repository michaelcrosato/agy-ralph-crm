import { incrementArticleViewCount, validateArticleStatus } from "@crm/core";
import { dbStore } from "@crm/db";
import { Hono } from "hono";
import { type Env, tenantAuth } from "../../middleware/tenantAuth";

export const kbRouter = new Hono<Env>();

kbRouter.post("/kb/categories", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { name, description } = body;

  if (!name || typeof name !== "string" || name.trim() === "") {
    return c.json({ error: "Missing or empty required field: 'name'" }, 400);
  }

  const newCategory = await dbStore.kbCategories.insert({
    orgId: tenant.orgId,
    name: name.trim(),
    description: description || null,
  });

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: newCategory.id,
    recordType: "kb_categories",
    action: "create",
    userId: tenant.userId,
    changes: {
      name: { before: null, after: newCategory.name },
    },
  });

  return c.json({ success: true, data: newCategory }, 201);
});

kbRouter.get("/kb/categories", tenantAuth, async (c) => {
  const categories = await dbStore.kbCategories.findMany();
  return c.json({ success: true, data: categories });
});

kbRouter.post("/kb/articles", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { title, content, status, categoryId } = body;

  if (!title || typeof title !== "string" || title.trim() === "") {
    return c.json({ error: "Missing or empty required field: 'title'" }, 400);
  }
  if (!content || typeof content !== "string" || content.trim() === "") {
    return c.json({ error: "Missing or empty required field: 'content'" }, 400);
  }
  if (!status || !validateArticleStatus(status)) {
    return c.json(
      { error: "Invalid status. Must be 'Draft' or 'Published'" },
      400,
    );
  }
  if (!categoryId) {
    return c.json({ error: "Missing required field: 'categoryId'" }, 400);
  }

  const category = await dbStore.kbCategories.findOne(categoryId);
  if (!category) {
    return c.json({ error: "Category not found" }, 404);
  }

  const newArticle = await dbStore.kbArticles.insert({
    orgId: tenant.orgId,
    categoryId,
    title: title.trim(),
    content: content.trim(),
    status: status as "Draft" | "Published",
    viewCount: 0,
    authorId: tenant.userId,
  });

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: newArticle.id,
    recordType: "kb_articles",
    action: "create",
    userId: tenant.userId,
    changes: {
      title: { before: null, after: newArticle.title },
      status: { before: null, after: newArticle.status },
    },
  });

  return c.json({ success: true, data: newArticle }, 201);
});

kbRouter.get("/kb/articles", tenantAuth, async (c) => {
  const categoryId = c.req.query("categoryId");
  const status = c.req.query("status");

  let articles = await dbStore.kbArticles.findMany();

  if (categoryId) {
    articles = articles.filter((a) => a.categoryId === categoryId);
  }
  if (status) {
    articles = articles.filter((a) => a.status === status);
  }

  return c.json({ success: true, data: articles });
});

kbRouter.put("/kb/articles/:id", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const { title, content, status, categoryId } = body;

  const article = await dbStore.kbArticles.findOne(id);
  if (!article) {
    return c.json({ error: "Article not found" }, 404);
  }

  const updates: Record<string, unknown> = {};
  const changes: Record<string, { before: unknown; after: unknown }> = {};

  if (title !== undefined) {
    if (typeof title !== "string" || title.trim() === "") {
      return c.json({ error: "Invalid title value" }, 400);
    }
    updates.title = title.trim();
    changes.title = { before: article.title, after: updates.title };
  }

  if (content !== undefined) {
    if (typeof content !== "string" || content.trim() === "") {
      return c.json({ error: "Invalid content value" }, 400);
    }
    updates.content = content.trim();
  }

  if (status !== undefined) {
    if (!validateArticleStatus(status)) {
      return c.json(
        { error: "Invalid status value. Must be 'Draft' or 'Published'" },
        400,
      );
    }
    updates.status = status;
    changes.status = { before: article.status, after: updates.status };
  }

  if (categoryId !== undefined) {
    const category = await dbStore.kbCategories.findOne(categoryId);
    if (!category) {
      return c.json({ error: "Category not found" }, 404);
    }
    updates.categoryId = categoryId;
    changes.categoryId = { before: article.categoryId, after: categoryId };
  }

  if (Object.keys(updates).length === 0) {
    return c.json({ error: "No update fields provided" }, 400);
  }

  const updated = await dbStore.kbArticles.update(id, updates);

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: id,
    recordType: "kb_articles",
    action: "update",
    userId: tenant.userId,
    changes,
  });

  return c.json({ success: true, data: updated });
});

kbRouter.post("/kb/articles/:id/view", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const article = await dbStore.kbArticles.findOne(id);
  if (!article) {
    return c.json({ error: "Article not found" }, 404);
  }

  const newViewCount = incrementArticleViewCount(article.viewCount);
  const updated = await dbStore.kbArticles.update(id, {
    viewCount: newViewCount,
  });

  return c.json({ success: true, data: updated });
});
