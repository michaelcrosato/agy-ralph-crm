import { validateHexColor } from "@crm/core";
import { dbStore } from "@crm/db";
import { Hono } from "hono";
import { type Env, tenantAuth } from "../../middleware/tenantAuth";

export const tagsApp = new Hono<Env>();

tagsApp.post("/tags", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { name, color } = body;

  if (!name || !color) {
    return c.json(
      { success: false, error: "Name and color are required" },
      400,
    );
  }

  if (!validateHexColor(color)) {
    return c.json(
      { success: false, error: "Invalid hex color code format" },
      400,
    );
  }

  const allTags = await dbStore.marketingSequenceTags.findMany();
  const duplicate = allTags.some(
    (t) => t.name.toLowerCase() === name.toLowerCase(),
  );
  if (duplicate) {
    return c.json({ success: false, error: "Tag already exists" }, 400);
  }

  const tag = await dbStore.marketingSequenceTags.insert({
    orgId: tenant.orgId,
    name,
    color,
  });

  return c.json({ success: true, tag });
});

tagsApp.get("/tags", tenantAuth, async (c) => {
  const tags = await dbStore.marketingSequenceTags.findMany();
  return c.json({ success: true, data: tags });
});

tagsApp.post("/:id/tags", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { tagId } = body;

  if (!tagId) {
    return c.json({ success: false, error: "tagId is required" }, 400);
  }

  const sequence = await dbStore.marketingSequences.findOne(sequenceId);
  if (!sequence) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }

  const tag = await dbStore.marketingSequenceTags.findOne(tagId);
  if (!tag) {
    return c.json({ success: false, error: "Tag not found" }, 404);
  }

  const existingMappings =
    await dbStore.marketingSequenceTagMappings.findForSequence(sequenceId);
  const alreadyMapped = existingMappings.some((m) => m.tagId === tagId);
  if (alreadyMapped) {
    return c.json({
      success: true,
      message: "Tag already mapped to sequence",
    });
  }

  const mapping = await dbStore.marketingSequenceTagMappings.insert({
    orgId: tenant.orgId,
    sequenceId,
    tagId,
  });

  return c.json({ success: true, mapping });
});

tagsApp.delete("/:id/tags/:tagId", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const tagId = c.req.param("tagId");

  const deleted =
    await dbStore.marketingSequenceTagMappings.deleteForSequenceAndTag(
      sequenceId,
      tagId,
    );
  if (!deleted) {
    return c.json({ success: false, error: "Mapping not found" }, 404);
  }

  return c.json({
    success: true,
    message: "Tag detached from sequence successfully",
  });
});
