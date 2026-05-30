import { validateOpportunityApprovalSubmission } from "@crm/core";
import { dbStore } from "@crm/db";
import { Hono } from "hono";
import { type Env, tenantAuth } from "../../middleware/tenantAuth";

export const approvalsApp = new Hono<Env>();
export const opportunitiesApprovalsApp = new Hono<Env>();

// ── approvalsApp Endpoints ─────────────────────────────────────────

approvalsApp.post("/:id/decide", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const tenant = c.get("tenant");
  const body = await c.req.json().catch(() => ({}));
  const { status, comments } = body;

  if (status !== "Approved" && status !== "Rejected") {
    return c.json(
      { error: "Invalid status decision. Must be 'Approved' or 'Rejected'." },
      400,
    );
  }

  // Find the approval step under RLS context
  const step = await dbStore.opportunityApprovalSteps.findOne(id);
  if (!step) {
    return c.json({ error: "Approval step not found" }, 404);
  }

  if (step.status !== "Pending") {
    return c.json({ error: "Approval step has already been decided" }, 400);
  }

  // Validate the approver's role matches exactly
  if (tenant.roleId !== step.approverRoleId) {
    return c.json(
      {
        error:
          "Forbidden: You do not have the required role to decide this step",
      },
      403,
    );
  }

  // Update step status
  const updatedStep = await dbStore.opportunityApprovalSteps.update(id, {
    status,
    decidedByUserId: tenant.userId,
    comments: comments || null,
    decidedAt: new Date(),
  });

  // Load the main approval record
  const approval = await dbStore.opportunityApprovals.findOne(step.approvalId);
  if (!approval) {
    return c.json({ error: "Approval record not found" }, 404);
  }

  // Load all steps for this approval
  const allSteps = await dbStore.opportunityApprovalSteps.findMany();
  const approvalSteps = allSteps.filter(
    (s) => s.approvalId === step.approvalId,
  );

  let newApprovalStatus = "Pending";
  if (status === "Rejected") {
    newApprovalStatus = "Rejected";
  } else {
    const allApproved = approvalSteps.every((s) => {
      if (s.id === id) return true;
      return s.status === "Approved";
    });
    if (allApproved) {
      newApprovalStatus = "Approved";
    }
  }

  let updatedApproval = approval;
  if (newApprovalStatus !== "Pending") {
    updatedApproval =
      (await dbStore.opportunityApprovals.update(step.approvalId, {
        status: newApprovalStatus,
      })) || approval;

    const opportunity = await dbStore.opportunities.findOne(
      approval.opportunityId,
    );
    if (opportunity) {
      const nextStage =
        newApprovalStatus === "Approved" ? "Closed Won" : "Closed Lost";
      await dbStore.opportunities.update(opportunity.id, { stage: nextStage });

      await dbStore.opportunityStageHistory.insert({
        orgId: tenant.orgId,
        opportunityId: opportunity.id,
        fromStage: opportunity.stage,
        toStage: nextStage,
        amount: opportunity.amount,
        changedById: tenant.userId,
      });

      await dbStore.auditLogs.insert({
        orgId: tenant.orgId,
        recordId: opportunity.id,
        recordType: "Opportunity",
        action: "update",
        userId: tenant.userId,
        changes: {
          stage: { before: opportunity.stage, after: nextStage },
        },
      });
    }
  }

  await dbStore.auditLogs.insert({
    orgId: tenant.orgId,
    recordId: step.id,
    recordType: "OpportunityApprovalStep",
    action: "decide",
    userId: tenant.userId,
    changes: null,
  });

  return c.json({
    success: true,
    data: {
      approval: updatedApproval,
      step: updatedStep,
    },
  });
});

// ── opportunitiesApprovalsApp Endpoints (mounted under opportunitiesApp) ──

opportunitiesApprovalsApp.post(
  "/:id/submit-approval",
  tenantAuth,
  async (c) => {
    const id = c.req.param("id");
    const tenant = c.get("tenant");
    const opportunity = await dbStore.opportunities.findOne(id);
    if (!opportunity) {
      return c.json({ error: "Opportunity not found" }, 404);
    }

    // Ensure only one pending approval exists for an opportunity at any time
    const approvals = await dbStore.opportunityApprovals.findMany();
    const existingPending = approvals.find(
      (a) => a.opportunityId === id && a.status === "Pending",
    );
    if (existingPending) {
      return c.json(
        { error: "Opportunity already has a pending approval submission" },
        400,
      );
    }

    // Core validation check
    const validation = validateOpportunityApprovalSubmission(opportunity);
    if (!validation.success) {
      return c.json({ error: validation.error }, 400);
    }

    // Insert approval record
    const approval = await dbStore.opportunityApprovals.insert({
      orgId: tenant.orgId,
      opportunityId: id,
      submitterId: tenant.userId,
      status: "Pending",
    });

    // Create standard multi-stage approval steps
    const step1 = await dbStore.opportunityApprovalSteps.insert({
      orgId: tenant.orgId,
      approvalId: approval.id,
      stepName: "Manager Review",
      approverRoleId: "role-manager",
      status: "Pending",
      decidedByUserId: null,
      comments: null,
      decidedAt: null,
    });

    const step2 = await dbStore.opportunityApprovalSteps.insert({
      orgId: tenant.orgId,
      approvalId: approval.id,
      stepName: "VP Review",
      approverRoleId: "role-vp",
      status: "Pending",
      decidedByUserId: null,
      comments: null,
      decidedAt: null,
    });

    // Log submission audit log
    await dbStore.auditLogs.insert({
      orgId: tenant.orgId,
      recordId: approval.id,
      recordType: "OpportunityApproval",
      action: "submit",
      userId: tenant.userId,
      changes: null,
    });

    return c.json({
      success: true,
      data: {
        ...approval,
        steps: [step1, step2],
      },
    });
  },
);

opportunitiesApprovalsApp.get("/:id/approvals", tenantAuth, async (c) => {
  const id = c.req.param("id");
  const opportunity = await dbStore.opportunities.findOne(id);
  if (!opportunity) {
    return c.json({ error: "Opportunity not found" }, 404);
  }

  const allApprovals = await dbStore.opportunityApprovals.findMany();
  const opportunityApprovals = allApprovals.filter(
    (a) => a.opportunityId === id,
  );

  const allSteps = await dbStore.opportunityApprovalSteps.findMany();

  const data = opportunityApprovals.map((approval) => {
    const steps = allSteps.filter((s) => s.approvalId === approval.id);
    return {
      ...approval,
      steps,
    };
  });

  return c.json({ success: true, data });
});
