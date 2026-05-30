import {
  archiveMarketingSequence,
  cloneMarketingSequence,
  purgeMarketingSequence,
} from "@crm/core";
import { type DBMarketingSequence, dbStore } from "@crm/db";
import { Hono } from "hono";
import { type Env, tenantAuth } from "../../middleware/tenantAuth";

export const crudApp = new Hono<Env>();

crudApp.get("/", tenantAuth, async (c) => {
  const folderId = c.req.query("folderId");
  const tagId = c.req.query("tagId");

  let sequences = await dbStore.marketingSequences.findMany();

  if (folderId) {
    sequences = sequences.filter((s) => s.folderId === folderId);
  }

  if (tagId) {
    const mappings = await dbStore.marketingSequenceTagMappings.findMany();
    const sequenceIdsWithTag = mappings
      .filter((m) => m.tagId === tagId)
      .map((m) => m.sequenceId);
    sequences = sequences.filter((s) => sequenceIdsWithTag.includes(s.id));
  }

  return c.json({ success: true, data: sequences });
});

crudApp.get("/:id", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const sequence = await dbStore.marketingSequences.findOne(id);
  if (!sequence) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }

  const mappings =
    await dbStore.marketingSequenceTagMappings.findForSequence(id);
  const tags = [];
  for (const m of mappings) {
    const tag = await dbStore.marketingSequenceTags.findOne(m.tagId);
    if (tag) tags.push(tag);
  }

  let folderName = null;
  if (sequence.folderId) {
    const folder = await dbStore.marketingSequenceFolders.findOne(
      sequence.folderId,
    );
    if (folder) folderName = folder.name;
  }

  return c.json({
    success: true,
    data: {
      ...sequence,
      folderName,
      tags,
    },
  });
});

crudApp.post("/", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const {
    name,
    description,
    status,
    allowReenrollment,
    reenrollmentMinDays,
    dailySendLimit,
    senderType,
    senderUserId,
    folderId,
  } = body;

  if (!name) {
    return c.json({ success: false, error: "Sequence name is required" }, 400);
  }

  if (folderId) {
    const folder = await dbStore.marketingSequenceFolders.findOne(folderId);
    if (!folder) {
      return c.json({ success: false, error: "Folder not found" }, 400);
    }
  }

  let parsedLimit: number | null = null;
  if (dailySendLimit !== undefined && dailySendLimit !== null) {
    const num = Number(dailySendLimit);
    if (!Number.isInteger(num) || num <= 0) {
      return c.json(
        { success: false, error: "dailySendLimit must be a positive integer" },
        400,
      );
    }
    parsedLimit = num;
  }

  let resolvedSenderType = "system";
  if (senderType !== undefined && senderType !== null) {
    if (
      senderType !== "system" &&
      senderType !== "owner" &&
      senderType !== "specific"
    ) {
      return c.json(
        {
          success: false,
          error: "senderType must be one of 'system', 'owner', or 'specific'",
        },
        400,
      );
    }
    resolvedSenderType = senderType;
  }

  let resolvedSenderUserId: string | null = null;
  if (resolvedSenderType === "specific") {
    if (!senderUserId) {
      return c.json(
        {
          success: false,
          error: "senderUserId is required when senderType is 'specific'",
        },
        400,
      );
    }
    const activeMembers = await dbStore.memberships.findMany();
    const isValidMember = activeMembers.some((m) => m.userId === senderUserId);
    if (!isValidMember) {
      return c.json(
        {
          success: false,
          error:
            "Invalid senderUserId: user does not belong to your organization",
        },
        400,
      );
    }
    resolvedSenderUserId = senderUserId;
  }

  const seq = await dbStore.marketingSequences.insert({
    orgId: tenant.orgId,
    name,
    description: description || "",
    status: status || "draft",
    allowReenrollment: allowReenrollment === true,
    reenrollmentMinDays: reenrollmentMinDays
      ? Number(reenrollmentMinDays)
      : null,
    dailySendLimit: parsedLimit,
    senderType: resolvedSenderType,
    senderUserId: resolvedSenderUserId,
    folderId: folderId || null,
  });

  return c.json({ success: true, sequence: seq });
});

crudApp.patch("/:id", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const {
    name,
    description,
    status,
    allowReenrollment,
    reenrollmentMinDays,
    dailySendLimit,
    senderType,
    senderUserId,
    folderId,
  } = body;

  const seq = await dbStore.marketingSequences.findOne(sequenceId);
  if (!seq) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (status !== undefined) updates.status = status;
  if (folderId !== undefined) {
    if (folderId !== null) {
      const folder = await dbStore.marketingSequenceFolders.findOne(folderId);
      if (!folder) {
        return c.json({ success: false, error: "Folder not found" }, 400);
      }
      updates.folderId = folderId;
    } else {
      updates.folderId = null;
    }
  }

  if (allowReenrollment !== undefined)
    updates.allowReenrollment = allowReenrollment === true;
  if (reenrollmentMinDays !== undefined) {
    updates.reenrollmentMinDays = reenrollmentMinDays
      ? Number(reenrollmentMinDays)
      : null;
  }
  if (dailySendLimit !== undefined) {
    if (dailySendLimit !== null) {
      const num = Number(dailySendLimit);
      if (!Number.isInteger(num) || num <= 0) {
        return c.json(
          {
            success: false,
            error: "dailySendLimit must be a positive integer",
          },
          400,
        );
      }
      updates.dailySendLimit = num;
    } else {
      updates.dailySendLimit = null;
    }
  }

  let resolvedSenderType =
    (updates.senderType as string) || seq.senderType || "system";
  if (senderType !== undefined) {
    if (
      senderType !== "system" &&
      senderType !== "owner" &&
      senderType !== "specific"
    ) {
      return c.json(
        {
          success: false,
          error: "senderType must be one of 'system', 'owner', or 'specific'",
        },
        400,
      );
    }
    updates.senderType = senderType;
    resolvedSenderType = senderType;
  }

  if (senderUserId !== undefined) {
    updates.senderUserId = senderUserId;
  }

  const finalSenderUserId =
    updates.senderUserId !== undefined
      ? (updates.senderUserId as string | null)
      : seq.senderUserId;
  if (resolvedSenderType === "specific") {
    if (!finalSenderUserId) {
      return c.json(
        {
          success: false,
          error: "senderUserId is required when senderType is 'specific'",
        },
        400,
      );
    }
    const activeMembers = await dbStore.memberships.findMany();
    const isValidMember = activeMembers.some(
      (m) => m.userId === finalSenderUserId,
    );
    if (!isValidMember) {
      return c.json(
        {
          success: false,
          error:
            "Invalid senderUserId: user does not belong to your organization",
        },
        400,
      );
    }
  } else {
    if (senderType !== undefined) {
      updates.senderUserId = null;
    }
  }

  const updated = await dbStore.marketingSequences.update(
    sequenceId,
    updates as Partial<
      Omit<DBMarketingSequence, "id" | "orgId" | "createdAt" | "updatedAt">
    >,
  );
  return c.json({ success: true, sequence: updated });
});

crudApp.post("/:id/clone", tenantAuth, async (c) => {
  const originalId = c.req.param("id");
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { name } = body;

  const originalSequence = await dbStore.marketingSequences.findOne(originalId);
  if (!originalSequence) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }

  const newName = name || `${originalSequence.name} - Copy`;

  try {
    const cloned = await cloneMarketingSequence(
      dbStore,
      originalId,
      newName,
      tenant.orgId,
    );
    return c.json({ success: true, sequence: cloned });
  } catch (err) {
    const error = err as Error;
    return c.json({ success: false, error: error.message }, 400);
  }
});

crudApp.post("/:id/archive", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const tenant = c.get("tenant");

  const sequence = await dbStore.marketingSequences.findOne(sequenceId);
  if (!sequence) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }

  try {
    const archived = await archiveMarketingSequence(
      dbStore,
      sequenceId,
      tenant.orgId,
    );
    return c.json({ success: true, sequence: archived });
  } catch (err) {
    const error = err as Error;
    return c.json({ success: false, error: error.message }, 400);
  }
});

crudApp.delete("/:id/purge", tenantAuth, async (c) => {
  const sequenceId = c.req.param("id");
  const tenant = c.get("tenant");

  const sequence = await dbStore.marketingSequences.findOne(sequenceId);
  if (!sequence) {
    return c.json({ success: false, error: "Sequence not found" }, 404);
  }

  try {
    await purgeMarketingSequence(dbStore, sequenceId, tenant.orgId);
    return c.json({ success: true, message: "Sequence purged successfully" });
  } catch (err) {
    const error = err as Error;
    return c.json({ success: false, error: error.message }, 400);
  }
});
