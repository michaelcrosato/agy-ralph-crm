import { createSessionToken } from "@crm/auth";
import { dbStore, mockDb, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../../../apps/api/src/index";

describe("E-Signature Requests and Document Signing API", () => {
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

  it("should successfully manage E-Signature requests under strict RLS isolation", async () => {
    let oppIdA = "";
    let contractIdA = "";

    // 1. Setup mock opportunity and contract for Tenant A
    await withTenant(orgA, mockDb, async () => {
      const opp = await dbStore.opportunities.insert({
        orgId: orgA,
        ownerId: "user-a",
        accountId: null,
        campaignId: null,
        stage: "Prospecting",
        amount: "5000.00",
        closeDate: null,
        custom: null,
      });
      oppIdA = opp.id;

      const contract = await dbStore.contracts.insert({
        orgId: orgA,
        accountId: "account-123",
        opportunityId: opp.id,
        contractAmount: "5000.00",
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: "Draft",
      });
      contractIdA = contract.id;
    });

    // 2. Create E-Signature request linked to Opportunity
    const createOppRes = await app.request("/api/sales/esignature/requests", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        documentName: "Sales Agreement Opportunity A",
        signerEmail: "signer@partner.com",
        opportunityId: oppIdA,
      }),
    });

    expect(createOppRes.status).toBe(200);
    const oppBody = await createOppRes.json();
    expect(oppBody.success).toBe(true);
    expect(oppBody.data.id).toBeDefined();
    expect(oppBody.data.status).toBe("sent");
    expect(oppBody.data.opportunityId).toBe(oppIdA);
    expect(oppBody.data.contractId).toBeNull();

    const requestId = oppBody.data.id;

    // 3. Create E-Signature request linked to Contract
    const createContractRes = await app.request(
      "/api/sales/esignature/requests",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          documentName: "NDA Contract A",
          signerEmail: "signer2@partner.com",
          contractId: contractIdA,
        }),
      },
    );

    expect(createContractRes.status).toBe(200);
    const contractBody = await createContractRes.json();
    expect(contractBody.success).toBe(true);
    expect(contractBody.data.contractId).toBe(contractIdA);

    // 4. Query requests list for Tenant A
    const listResA = await app.request("/api/sales/esignature/requests", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
      },
    });

    expect(listResA.status).toBe(200);
    const listBodyA = await listResA.json();
    expect(listBodyA.success).toBe(true);
    expect(listBodyA.data.length).toBe(2);

    // 5. Query requests list for Tenant B -> empty list due to RLS
    const listResB = await app.request("/api/sales/esignature/requests", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantB}`,
      },
    });

    expect(listResB.status).toBe(200);
    const listBodyB = await listResB.json();
    expect(listBodyB.success).toBe(true);
    expect(listBodyB.data.length).toBe(0);

    // 6. Tenant B attempts to transition Tenant A's request -> fails with 404 (due to RLS isolation)
    const simulateResB = await app.request("/api/sales/esignature/simulate", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantB}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requestId,
        action: "view",
      }),
    });

    expect(simulateResB.status).toBe(404);
  });

  it("should enforce strict state transition logic through simulation", async () => {
    let oppIdA = "";
    let requestId = "";

    await withTenant(orgA, mockDb, async () => {
      const opp = await dbStore.opportunities.insert({
        orgId: orgA,
        ownerId: "user-a",
        accountId: null,
        campaignId: null,
        stage: "Prospecting",
        amount: "5000.00",
        closeDate: null,
        custom: null,
      });
      oppIdA = opp.id;

      const req = await dbStore.esignatureRequests.insert({
        orgId: orgA,
        documentName: "NDA",
        signerEmail: "signer@acme.com",
        status: "sent",
        opportunityId: opp.id,
        contractId: null,
      });
      requestId = req.id;
    });

    // 1. Direct transition from sent to signed is prohibited
    const badTrans1 = await app.request("/api/sales/esignature/simulate", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requestId,
        action: "sign",
      }),
    });
    expect(badTrans1.status).toBe(400);

    // 2. Successful view transition
    const viewRes = await app.request("/api/sales/esignature/simulate", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requestId,
        action: "view",
      }),
    });
    expect(viewRes.status).toBe(200);
    const viewBody = await viewRes.json();
    expect(viewBody.data.status).toBe("viewed");
    expect(viewBody.data.completedAt).toBeNull();

    // 3. Successful sign transition
    const signRes = await app.request("/api/sales/esignature/simulate", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requestId,
        action: "sign",
      }),
    });
    expect(signRes.status).toBe(200);
    const signBody = await signRes.json();
    expect(signBody.data.status).toBe("signed");
    expect(signBody.data.completedAt).not.toBeNull();

    // 4. Subsequent transitions from signed are prohibited
    const badTrans2 = await app.request("/api/sales/esignature/simulate", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requestId,
        action: "decline",
      }),
    });
    expect(badTrans2.status).toBe(400);
  });

  it("should reject request creation if both opportunityId and contractId are missing", async () => {
    const res = await app.request("/api/sales/esignature/requests", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        documentName: "NDA",
        signerEmail: "test@partner.com",
      }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain(
      "must be linked to an Opportunity or Contract",
    );
  });

  it("should reject request creation with invalid signer email format", async () => {
    const res = await app.request("/api/sales/esignature/requests", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        documentName: "NDA",
        signerEmail: "invalid-email",
        opportunityId: "opp-123",
      }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Invalid signer email");
  });
});
