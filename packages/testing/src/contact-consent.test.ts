import { createSessionToken } from "@crm/auth";
import { validateCommunicationConsent } from "@crm/core";
import { dbStore, store } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../../../apps/api/src/index";

describe("Contact Consent & GDPR Compliance API Tests", () => {
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

  describe("Core Domain Logic Engine", () => {
    it("should correctly evaluate communication consent", () => {
      // 1. Opt In
      expect(
        validateCommunicationConsent({
          channel: "email",
          preferences: [
            {
              recordType: "contact",
              recordId: "contact-1",
              channel: "email",
              status: "opt_in",
            },
          ],
        }),
      ).toBe(true);

      // 2. Opt Out
      expect(
        validateCommunicationConsent({
          channel: "email",
          preferences: [
            {
              recordType: "contact",
              recordId: "contact-1",
              channel: "email",
              status: "opt_out",
            },
          ],
        }),
      ).toBe(false);

      // 3. Pending
      expect(
        validateCommunicationConsent({
          channel: "email",
          preferences: [
            {
              recordType: "contact",
              recordId: "contact-1",
              channel: "email",
              status: "pending",
            },
          ],
        }),
      ).toBe(false);

      // 4. Missing channel
      expect(
        validateCommunicationConsent({
          channel: "sms",
          preferences: [
            {
              recordType: "contact",
              recordId: "contact-1",
              channel: "email",
              status: "opt_in",
            },
          ],
        }),
      ).toBe(false);
    });
  });

  describe("REST API Endpoints & RLS Verification", () => {
    it("should reject unauthenticated requests with 401", async () => {
      const getRes = await app.request(
        "/api/consent?recordType=lead&recordId=some-id",
        {
          method: "GET",
        },
      );
      expect(getRes.status).toBe(401);

      const postRes = await app.request("/api/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(postRes.status).toBe(401);
    });

    it("should reject requests with invalid payload with 400", async () => {
      const getRes = await app.request("/api/consent", {
        method: "GET",
        headers: { Authorization: `Bearer ${tokenTenantA}` },
      });
      expect(getRes.status).toBe(400);

      const postRes = await app.request("/api/consent", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recordType: "invalid-type",
          recordId: "not-a-uuid",
        }),
      });
      expect(postRes.status).toBe(400);
    });

    it("should support managing and querying consent preferences under tenant RLS isolation", async () => {
      // 1. Create a Lead in Tenant A
      const leadARes = await app.request("/api/leads", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "lead-a@company-a.com",
          company: "Company A",
          status: "New",
        }),
      });
      expect(leadARes.status).toBe(200);
      const leadA = (await leadARes.json()).data;

      // 2. Create a Lead in Tenant B
      const leadBRes = await app.request("/api/leads", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "lead-b@company-b.com",
          company: "Company B",
          status: "New",
        }),
      });
      expect(leadBRes.status).toBe(200);
      const leadB = (await leadBRes.json()).data;

      // 3. Tenant A sets email consent to opt_in for Lead A
      const setConsentARes = await app.request("/api/consent", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recordType: "lead",
          recordId: leadA.id,
          channel: "email",
          status: "opt_in",
          source: "web_form",
        }),
      });
      expect(setConsentARes.status).toBe(200);
      const consentA = (await setConsentARes.json()).data;
      expect(consentA.id).toBeDefined();
      expect(consentA.status).toBe("opt_in");

      // 4. Tenant B tries to query Tenant A's Lead consent -> Returns 404 (due to Lead verification check failing RLS)
      const queryConsentBRes = await app.request(
        `/api/consent?recordType=lead&recordId=${leadA.id}`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${tokenTenantB}` },
        },
      );
      expect(queryConsentBRes.status).toBe(404);

      // 5. Tenant B tries to set consent for Tenant A's Lead A -> Returns 404 (due to Lead verification check failing RLS)
      const setConsentBOnARes = await app.request("/api/consent", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recordType: "lead",
          recordId: leadA.id,
          channel: "email",
          status: "opt_out",
          source: "manual",
        }),
      });
      expect(setConsentBOnARes.status).toBe(404);

      // 6. Tenant A queries consent for Lead A -> Returns 1 consent preference
      const queryConsentARes = await app.request(
        `/api/consent?recordType=lead&recordId=${leadA.id}`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${tokenTenantA}` },
        },
      );
      expect(queryConsentARes.status).toBe(200);
      const queryConsentA = (await queryConsentARes.json()).data;
      expect(queryConsentA.length).toBe(1);
      expect(queryConsentA[0].id).toBe(consentA.id);
      expect(queryConsentA[0].status).toBe("opt_in");

      // 7. Verify Audit Logs were correctly generated for Tenant A
      const auditsA = store.auditLogs.filter((log) => log.orgId === orgA);
      // Lead A creation (1), Consent A upsert (1)
      expect(auditsA.length).toBe(2);
      expect(auditsA[1].recordType).toBe("contact_consent_preferences");
      expect(auditsA[1].action).toBe("upsert");
    });
  });
});
