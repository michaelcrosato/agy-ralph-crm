import { enrollSegmentInSequence, resolveSegmentMembers } from "@crm/core";
import { dbStore } from "@crm/db";
import { Hono } from "hono";
import { type Env, tenantAuth } from "../../middleware/tenantAuth";

export const segmentsApp = new Hono<Env>();

segmentsApp.post("/", tenantAuth, async (c) => {
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { name, description, objectType, criteria } = body;

  if (!name) {
    return c.json({ success: false, error: "Segment name is required" }, 400);
  }

  if (!objectType || (objectType !== "lead" && objectType !== "contact")) {
    return c.json(
      { success: false, error: "objectType must be lead or contact" },
      400,
    );
  }

  if (!criteria || !Array.isArray(criteria)) {
    return c.json(
      { success: false, error: "criteria is required and must be an array" },
      400,
    );
  }

  const segment = await dbStore.marketingSegments.insert({
    orgId: tenant.orgId,
    name,
    description: description || "",
    objectType,
    criteria,
  });

  return c.json({ success: true, segment });
});

segmentsApp.get("/", tenantAuth, async (c) => {
  const segments = await dbStore.marketingSegments.findMany();
  return c.json({ success: true, data: segments });
});

segmentsApp.get("/:id", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const segment = await dbStore.marketingSegments.findOne(id);
  if (!segment) {
    return c.json({ success: false, error: "Segment not found" }, 404);
  }
  return c.json({ success: true, segment });
});

segmentsApp.delete("/:id", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const success = await dbStore.marketingSegments.delete(id);
  if (!success) {
    return c.json(
      { success: false, error: "Segment not found or delete failed" },
      404,
    );
  }
  return c.json({ success: true });
});

segmentsApp.get("/:id/members", tenantAuth, async (c) => {
  const segmentId = c.req.param("id");
  const tenant = c.get("tenant");

  try {
    const members = await resolveSegmentMembers(
      dbStore,
      tenant.orgId,
      segmentId,
    );
    return c.json({ success: true, data: members });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json(
      {
        success: false,
        error: msg || "Failed to resolve segment members",
      },
      404,
    );
  }
});

segmentsApp.post("/:id/enroll-sequence", tenantAuth, async (c) => {
  const segmentId = c.req.param("id");
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { sequenceId } = body;

  if (!sequenceId) {
    return c.json({ success: false, error: "sequenceId is required" }, 400);
  }

  try {
    const result = await enrollSegmentInSequence(
      dbStore,
      tenant.orgId,
      segmentId,
      sequenceId,
    );
    return c.json({ success: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json(
      {
        success: false,
        error: msg || "Failed to enroll segment in sequence",
      },
      400,
    );
  }
});
