import { createSessionToken } from "@crm/auth";
import { dbStore, mockDb, store, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../../../apps/api/src/index";

describe("Customer Satisfaction (CSAT) & NPS Survey Engine API", () => {
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

  it("should successfully manage surveys and responses under strict RLS isolation", async () => {
    // 1. Create a survey campaign for Tenant A
    const createResA = await app.request("/api/sales/surveys", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Q2 Customer Feedback CSAT",
        type: "csat",
        status: "active",
      }),
    });

    expect(createResA.status).toBe(200);
    const bodyA = await createResA.json();
    expect(bodyA.success).toBe(true);
    expect(bodyA.data.id).toBeDefined();
    expect(bodyA.data.name).toBe("Q2 Customer Feedback CSAT");
    expect(bodyA.data.type).toBe("csat");
    expect(bodyA.data.status).toBe("active");

    const surveyId = bodyA.data.id;

    // 2. Query surveys for Tenant A -> should return 1 survey
    const listResA = await app.request("/api/sales/surveys", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
      },
    });

    expect(listResA.status).toBe(200);
    const listBodyA = await listResA.json();
    expect(listBodyA.success).toBe(true);
    expect(listBodyA.data.length).toBe(1);

    // 3. Query surveys for Tenant B -> should return empty list (RLS isolation)
    const listResB = await app.request("/api/sales/surveys", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenTenantB}`,
      },
    });

    expect(listResB.status).toBe(200);
    const listBodyB = await listResB.json();
    expect(listBodyB.success).toBe(true);
    expect(listBodyB.data.length).toBe(0);

    // 4. Tenant B attempts to submit response to Tenant A's survey -> should fail (404 Survey Not Found due to RLS)
    const responseResB = await app.request("/api/sales/surveys/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantB}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        surveyId,
        score: 5,
      }),
    });

    expect(responseResB.status).toBe(404);
  });

  it("should enforce validation constraints on survey type and status", async () => {
    // 1. Block survey creation with invalid type
    const badTypeRes = await app.request("/api/sales/surveys", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Bad Survey",
        type: "invalid-type",
      }),
    });
    expect(badTypeRes.status).toBe(400);

    // 2. Create a draft survey campaign
    const draftRes = await app.request("/api/sales/surveys", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Draft CSAT Survey",
        type: "csat",
        status: "draft",
      }),
    });
    expect(draftRes.status).toBe(200);
    const draftSurvey = await draftRes.json();
    const draftSurveyId = draftSurvey.data.id;

    // 3. Submitting response to draft survey is blocked
    const responseToDraftRes = await app.request(
      "/api/sales/surveys/responses",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          surveyId: draftSurveyId,
          score: 5,
        }),
      },
    );
    expect(responseToDraftRes.status).toBe(400);
    const draftErr = await responseToDraftRes.json();
    expect(draftErr.error).toContain("is not active");
  });

  it("should enforce strict CSAT score boundary rules", async () => {
    let surveyId = "";
    await withTenant(orgA, mockDb, async () => {
      const survey = await dbStore.surveys.insert({
        orgId: orgA,
        name: "CSAT Feed",
        type: "csat",
        status: "active",
      });
      surveyId = survey.id;
    });

    // 1. Reject score too high (6)
    const tooHighRes = await app.request("/api/sales/surveys/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        surveyId,
        score: 6,
      }),
    });
    expect(tooHighRes.status).toBe(400);

    // 2. Reject score too low (0)
    const tooLowRes = await app.request("/api/sales/surveys/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        surveyId,
        score: 0,
      }),
    });
    expect(tooLowRes.status).toBe(400);

    // 3. Reject fractional score (4.5)
    const floatRes = await app.request("/api/sales/surveys/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        surveyId,
        score: 4.5,
      }),
    });
    expect(floatRes.status).toBe(400);

    // 4. Accept valid score (4)
    const validRes = await app.request("/api/sales/surveys/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        surveyId,
        score: 4,
        comment: "Excellent support",
      }),
    });
    expect(validRes.status).toBe(200);
    const validBody = await validRes.json();
    expect(validBody.success).toBe(true);
    expect(validBody.data.score).toBe(4);
    expect(validBody.data.comment).toBe("Excellent support");
  });

  it("should enforce strict NPS score boundary rules", async () => {
    let surveyId = "";
    await withTenant(orgA, mockDb, async () => {
      const survey = await dbStore.surveys.insert({
        orgId: orgA,
        name: "NPS Feed",
        type: "nps",
        status: "active",
      });
      surveyId = survey.id;
    });

    // 1. Reject score too high (11)
    const tooHighRes = await app.request("/api/sales/surveys/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        surveyId,
        score: 11,
      }),
    });
    expect(tooHighRes.status).toBe(400);

    // 2. Reject score too low (-1)
    const tooLowRes = await app.request("/api/sales/surveys/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        surveyId,
        score: -1,
      }),
    });
    expect(tooLowRes.status).toBe(400);

    // 3. Accept valid promoter score (10)
    const validRes = await app.request("/api/sales/surveys/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenTenantA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        surveyId,
        score: 10,
      }),
    });
    expect(validRes.status).toBe(200);
  });

  it("should correctly compute survey metrics for CSAT and NPS", async () => {
    let csatSurveyId = "";
    let npsSurveyId = "";

    await withTenant(orgA, mockDb, async () => {
      const csat = await dbStore.surveys.insert({
        orgId: orgA,
        name: "CSAT Survey",
        type: "csat",
        status: "active",
      });
      csatSurveyId = csat.id;

      const nps = await dbStore.surveys.insert({
        orgId: orgA,
        name: "NPS Survey",
        type: "nps",
        status: "active",
      });
      npsSurveyId = nps.id;
    });

    // 1. Check empty survey metrics -> should return zero defaults
    const emptyMetricsRes = await app.request(
      `/api/sales/surveys/${csatSurveyId}/metrics`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      },
    );
    expect(emptyMetricsRes.status).toBe(200);
    const emptyMetricsBody = await emptyMetricsRes.json();
    expect(emptyMetricsBody.data.count).toBe(0);
    expect(emptyMetricsBody.data.averageScore).toBe("0.00");
    expect(emptyMetricsBody.data.scorePercentage).toBe(0);

    // 2. Submit CSAT responses: [5, 4, 3, 2] -> average 3.50, satisfied (>=4) count 2 out of 4 (50%)
    const csatScores = [5, 4, 3, 2];
    for (const score of csatScores) {
      await app.request("/api/sales/surveys/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ surveyId: csatSurveyId, score }),
      });
    }

    const csatMetricsRes = await app.request(
      `/api/sales/surveys/${csatSurveyId}/metrics`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      },
    );
    expect(csatMetricsRes.status).toBe(200);
    const csatMetricsBody = await csatMetricsRes.json();
    expect(csatMetricsBody.data.count).toBe(4);
    expect(csatMetricsBody.data.averageScore).toBe("3.50");
    expect(csatMetricsBody.data.scorePercentage).toBe(50);

    // 3. Submit NPS responses: Promoters [10, 9], Detractors [6], Passives [8, 7]
    // Total count = 5. Promoters count = 2 (40%), Detractors count = 1 (20%), Passives count = 2
    // NPS = 40% - 20% = 20
    const npsScores = [10, 9, 6, 8, 7];
    for (const score of npsScores) {
      await app.request("/api/sales/surveys/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ surveyId: npsSurveyId, score }),
      });
    }

    const npsMetricsRes = await app.request(
      `/api/sales/surveys/${npsSurveyId}/metrics`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      },
    );
    expect(npsMetricsRes.status).toBe(200);
    const npsMetricsBody = await npsMetricsRes.json();
    expect(npsMetricsBody.data.count).toBe(5);
    expect(npsMetricsBody.data.averageScore).toBe("8.00");
    expect(npsMetricsBody.data.scorePercentage).toBe(20);
  });
});
