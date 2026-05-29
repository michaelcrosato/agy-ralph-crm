import { createSessionToken } from "@crm/auth";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../../../apps/api/src/index";

interface ApprovalStep {
  id: string;
  stepName: string;
  approverRoleId: string;
  status: string;
}

describe("Multi-Stage Opportunity Approval Processes (Approval Trees)", () => {
  let tokenTenantA: string;
  let tokenTenantB: string;
  let tokenManagerA: string;
  let tokenVpA: string;

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

    tokenManagerA = await createSessionToken({
      userId: "manager-a",
      orgId: orgA,
      roleId: "role-manager",
      permissionsMask: 7,
    });

    tokenVpA = await createSessionToken({
      userId: "vp-a",
      orgId: orgA,
      roleId: "role-vp",
      permissionsMask: 7,
    });
  });

  it("should successfully submit an opportunity for approval, set stages, track decisions, and auto-transition to Closed Won", async () => {
    // 1. Create a valid sales opportunity for Tenant A
    let oppIdA = "";
    await withTenant(orgA, mockDb, async () => {
      const opp = await dbStore.opportunities.insert({
        orgId: orgA,
        ownerId: "user-a",
        accountId: null,
        name: "Enterprise Software License",
        stage: "Prospecting",
        amount: "50000.00",
        closeDate: new Date(),
        custom: null,
      });
      oppIdA = opp.id;
    });

    // 2. Submit the opportunity for approval
    const submitRes = await app.request(
      `/api/opportunities/${oppIdA}/submit-approval`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      },
    );

    expect(submitRes.status).toBe(200);
    const submitBody = await submitRes.json();
    expect(submitBody.success).toBe(true);
    expect(submitBody.data.id).toBeDefined();
    expect(submitBody.data.status).toBe("Pending");
    expect(submitBody.data.steps.length).toBe(2);

    const approvalId = submitBody.data.id;
    const managerStep = submitBody.data.steps.find(
      (s: ApprovalStep) => s.stepName === "Manager Review",
    );
    const vpStep = submitBody.data.steps.find(
      (s: ApprovalStep) => s.stepName === "VP Review",
    );

    expect(managerStep).toBeDefined();
    expect(managerStep.status).toBe("Pending");
    expect(managerStep.approverRoleId).toBe("role-manager");

    expect(vpStep).toBeDefined();
    expect(vpStep.status).toBe("Pending");
    expect(vpStep.approverRoleId).toBe("role-vp");

    // 3. Query history -> returns the submission details
    const historyRes = await app.request(
      `/api/opportunities/${oppIdA}/approvals`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      },
    );
    expect(historyRes.status).toBe(200);
    const historyBody = await historyRes.json();
    expect(historyBody.success).toBe(true);
    expect(historyBody.data.length).toBe(1);
    expect(historyBody.data[0].id).toBe(approvalId);
    expect(historyBody.data[0].steps.length).toBe(2);

    // 4. Try to decide VP step with manager token -> 403 Forbidden
    const invalidDecideRes = await app.request(
      `/api/approvals/${vpStep.id}/decide`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenManagerA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: "Approved",
          comments: "VP review skipped",
        }),
      },
    );
    expect(invalidDecideRes.status).toBe(403);

    // 5. Decide Manager Review -> Approve
    const decideManagerRes = await app.request(
      `/api/approvals/${managerStep.id}/decide`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenManagerA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: "Approved",
          comments: "Looks very promising.",
        }),
      },
    );
    expect(decideManagerRes.status).toBe(200);
    const decideManagerBody = await decideManagerRes.json();
    expect(decideManagerBody.success).toBe(true);
    expect(decideManagerBody.data.step.status).toBe("Approved");
    expect(decideManagerBody.data.step.comments).toBe("Looks very promising.");
    expect(decideManagerBody.data.approval.status).toBe("Pending"); // Overall still pending VP

    // 6. Try to decide Manager step again -> 400 Bad Request
    const doubleDecideRes = await app.request(
      `/api/approvals/${managerStep.id}/decide`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenManagerA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "Approved" }),
      },
    );
    expect(doubleDecideRes.status).toBe(400);

    // 7. Decide VP Review -> Approve (completing approval loop)
    const decideVpRes = await app.request(
      `/api/approvals/${vpStep.id}/decide`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenVpA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: "Approved",
          comments: "Approved for deployment.",
        }),
      },
    );
    expect(decideVpRes.status).toBe(200);
    const decideVpBody = await decideVpRes.json();
    expect(decideVpBody.success).toBe(true);
    expect(decideVpBody.data.approval.status).toBe("Approved");

    // 8. Assert that opportunity stage auto-transitioned to Closed Won
    await withTenant(orgA, mockDb, async () => {
      const updatedOpp = await dbStore.opportunities.findOne(oppIdA);
      expect(updatedOpp?.stage).toBe("Closed Won");

      // Verify audit trail recorded submission, decisions, and stage updates
      const audits = await dbStore.auditLogs.findMany();
      const oppAudits = audits.filter((a) => a.recordId === oppIdA);
      expect(
        oppAudits.some(
          (a) =>
            a.action === "update" && a.changes?.stage?.after === "Closed Won",
        ),
      ).toBe(true);
    });
  });

  it("should auto-transition opportunity to Closed Lost if any step is Rejected", async () => {
    // 1. Create opportunity for Tenant A
    let oppId = "";
    await withTenant(orgA, mockDb, async () => {
      const opp = await dbStore.opportunities.insert({
        orgId: orgA,
        ownerId: "user-a",
        accountId: null,
        name: "Risk Assessment Deal",
        stage: "Negotiation",
        amount: "15000.00",
        closeDate: new Date(),
        custom: null,
      });
      oppId = opp.id;
    });

    // 2. Submit approval
    const submitRes = await app.request(
      `/api/opportunities/${oppId}/submit-approval`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      },
    );
    const submitBody = await submitRes.json();
    const managerStep = submitBody.data.steps.find(
      (s: ApprovalStep) => s.stepName === "Manager Review",
    );

    // 3. Reject at Manager Review stage
    const decideRes = await app.request(
      `/api/approvals/${managerStep.id}/decide`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenManagerA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: "Rejected",
          comments: "Deal budget too low.",
        }),
      },
    );

    expect(decideRes.status).toBe(200);
    const decideBody = await decideRes.json();
    expect(decideBody.success).toBe(true);
    expect(decideBody.data.approval.status).toBe("Rejected");

    // 4. Assert that opportunity transitioned to Closed Lost
    await withTenant(orgA, mockDb, async () => {
      const updatedOpp = await dbStore.opportunities.findOne(oppId);
      expect(updatedOpp?.stage).toBe("Closed Lost");
    });
  });

  it("should block submissions for closed or invalid-amount opportunities", async () => {
    // 1. Opportunity already closed
    let closedOppId = "";
    await withTenant(orgA, mockDb, async () => {
      const opp = await dbStore.opportunities.insert({
        orgId: orgA,
        ownerId: "user-a",
        accountId: null,
        name: "Closed Opportunity",
        stage: "Closed Won",
        amount: "100.00",
        closeDate: new Date(),
        custom: null,
      });
      closedOppId = opp.id;
    });

    const closedRes = await app.request(
      `/api/opportunities/${closedOppId}/submit-approval`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      },
    );
    expect(closedRes.status).toBe(400);
    const closedBody = await closedRes.json();
    expect(closedBody.error).toContain("Opportunity is already closed");

    // 2. Opportunity with invalid/zero amount
    let zeroOppId = "";
    await withTenant(orgA, mockDb, async () => {
      const opp = await dbStore.opportunities.insert({
        orgId: orgA,
        ownerId: "user-a",
        accountId: null,
        name: "Zero Opportunity",
        stage: "Prospecting",
        amount: "0.00",
        closeDate: new Date(),
        custom: null,
      });
      zeroOppId = opp.id;
    });

    const zeroRes = await app.request(
      `/api/opportunities/${zeroOppId}/submit-approval`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      },
    );
    expect(zeroRes.status).toBe(400);
    const zeroBody = await zeroRes.json();
    expect(zeroBody.error).toContain(
      "Opportunity must have an amount greater than zero",
    );
  });

  it("should strictly enforce multi-tenant RLS isolation rules", async () => {
    // 1. Create Tenant A opportunity and approval submission
    let oppIdA = "";
    let approvalIdA = "";
    let stepIdA = "";

    await withTenant(orgA, mockDb, async () => {
      const opp = await dbStore.opportunities.insert({
        orgId: orgA,
        ownerId: "user-a",
        accountId: null,
        name: "Tenant A Deal",
        stage: "Qualification",
        amount: "25000.00",
        closeDate: new Date(),
        custom: null,
      });
      oppIdA = opp.id;
    });

    const submitRes = await app.request(
      `/api/opportunities/${oppIdA}/submit-approval`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      },
    );
    const submitBody = await submitRes.json();
    approvalIdA = submitBody.data.id;
    stepIdA = submitBody.data.steps[0].id;

    // 2. Tenant B requests history of Tenant A opportunity -> 404 (isolated)
    const getResB = await app.request(
      `/api/opportunities/${oppIdA}/approvals`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
        },
      },
    );
    expect(getResB.status).toBe(404);

    // 3. Tenant B tries to decide step of Tenant A approval -> 404 (isolated by active tenant RLS transaction context)
    const decideResB = await app.request(`/api/approvals/${stepIdA}/decide`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantB}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "Approved" }),
    });
    expect(decideResB.status).toBe(404);
  });
});
