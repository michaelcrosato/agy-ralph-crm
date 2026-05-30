import { detectFolderLoop } from "@crm/core";
import { dbStore } from "@crm/db";
import { Hono } from "hono";
import { type Env, tenantAuth } from "../../middleware/tenantAuth";

export const foldersApp = new Hono<Env>();

foldersApp.post("/folders", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { name, parentFolderId } = body;

  if (!name) {
    return c.json({ success: false, error: "Folder name is required" }, 400);
  }

  // 1. Verify parent folder if provided
  if (parentFolderId) {
    const parentFolder =
      await dbStore.marketingSequenceFolders.findOne(parentFolderId);
    if (!parentFolder) {
      return c.json({ success: false, error: "Parent folder not found" }, 400);
    }
  }

  // 2. Check for unique name under same parent
  const allFolders = await dbStore.marketingSequenceFolders.findMany();
  const duplicateName = allFolders.some(
    (f) =>
      f.name.toLowerCase() === name.toLowerCase() &&
      f.parentFolderId === (parentFolderId || null),
  );
  if (duplicateName) {
    return c.json(
      {
        success: false,
        error: "A folder with this name already exists in this location",
      },
      400,
    );
  }

  const folder = await dbStore.marketingSequenceFolders.insert({
    orgId: tenant.orgId,
    name,
    parentFolderId: parentFolderId || null,
  });

  return c.json({ success: true, folder });
});

foldersApp.patch("/folders/:id", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const { name, parentFolderId } = body;

  const folder = await dbStore.marketingSequenceFolders.findOne(id);
  if (!folder) {
    return c.json({ success: false, error: "Folder not found" }, 404);
  }

  const updates: Record<string, unknown> = {};

  if (parentFolderId !== undefined) {
    if (parentFolderId !== null) {
      // a. Verify parent exists
      const parentFolder =
        await dbStore.marketingSequenceFolders.findOne(parentFolderId);
      if (!parentFolder) {
        return c.json(
          { success: false, error: "Parent folder not found" },
          400,
        );
      }
      // b. Detect loops using core function
      const allFolders = await dbStore.marketingSequenceFolders.findMany();
      const hasLoop = detectFolderLoop(
        id,
        parentFolderId,
        allFolders.map((f) => ({
          id: f.id,
          parentFolderId: f.parentFolderId,
        })),
      );
      if (hasLoop) {
        return c.json(
          { success: false, error: "Recursive folder loop detected" },
          400,
        );
      }
      updates.parentFolderId = parentFolderId;
    } else {
      updates.parentFolderId = null;
    }
  }

  if (name) {
    // Check uniqueness
    const parentIdToCheck =
      parentFolderId !== undefined ? parentFolderId : folder.parentFolderId;
    const allFolders = await dbStore.marketingSequenceFolders.findMany();
    const duplicateName = allFolders.some(
      (f) =>
        f.id !== id &&
        f.name.toLowerCase() === name.toLowerCase() &&
        f.parentFolderId === (parentIdToCheck || null),
    );
    if (duplicateName) {
      return c.json(
        {
          success: false,
          error: "A folder with this name already exists in this location",
        },
        400,
      );
    }
    updates.name = name;
  }

  const updated = await dbStore.marketingSequenceFolders.update(id, updates);
  return c.json({ success: true, folder: updated });
});

foldersApp.get("/folders", tenantAuth, async (c) => {
  const folders = await dbStore.marketingSequenceFolders.findMany();
  return c.json({ success: true, data: folders });
});
