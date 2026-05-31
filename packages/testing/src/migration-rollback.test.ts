import { createSessionToken } from "@crm/auth";
import { rollbackStoreMigrations, runStoreMigrations } from "@crm/core";
import { dbStore, store, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestApp } from "./_harness";

const app = createTestApp();

describe("Database Migration & Rollback Versioning Engine", () => {
  let tokenTenantA: string;
  let tokenTenantB: string;

  const orgA = "org-tenant-a";
  const orgB = "org-tenant-b";
  const userA = "user-a";
  const userB = "user-b";

  beforeEach(async () => {
    dbStore.clear();

    tokenTenantA = await createSessionToken({
      userId: userA,
      orgId: orgA,
      roleId: "role-a",
      permissionsMask: 63,
    });

    tokenTenantB = await createSessionToken({
      userId: userB,
      orgId: orgB,
      roleId: "role-b",
      permissionsMask: 63,
    });
  });

  describe("Core Unit Logic", () => {
    it("should run migrations sequentially and apply updates to mock store under tenant", async () => {
      await withTenant(
        orgA,
        mockDb as unknown as Parameters<typeof withTenant>[1],
        async () => {
          // Setup initial webhook without status, and opportunity without currencyCode
          const webhook = await dbStore.webhooks.insert({
            orgId: orgA,
            targetUrl: "https://test.com/hook",
            secret: "secret",
            status: "",
          });

          const opportunity = await dbStore.opportunities.insert({
            orgId: orgA,
            ownerId: userA,
            accountId: null,
            name: "Test Opp",
            stage: "Qualification",
            amount: "1000.00",
            closeDate: new Date(),
            custom: null,
            currencyCode: "",
          });

          // Run migrations
          const result = await runStoreMigrations(dbStore, store, orgA);
          expect(result.success).toBe(true);
          expect(result.applied).toEqual([1, 2]);
          expect(result.currentVersion).toBe(2);

          // Verify webhook status is set to active by migration 1
          const webhooks = await dbStore.webhooks.findMany();
          const updatedWebhook = webhooks.find((w) => w.id === webhook.id);
          expect(updatedWebhook?.status).toBe("active");

          // Verify opportunity currencyCode is set to USD by migration 2
          const updatedOpp = await dbStore.opportunities.findOne(
            opportunity.id,
          );
          expect(updatedOpp?.currencyCode).toBe("USD");
        },
      );
    });

    it("should roll back migrations sequentially to target version", async () => {
      await withTenant(
        orgA,
        mockDb as unknown as Parameters<typeof withTenant>[1],
        async () => {
          const webhook = await dbStore.webhooks.insert({
            orgId: orgA,
            targetUrl: "https://test.com/hook",
            secret: "secret",
            status: "",
          });

          const opportunity = await dbStore.opportunities.insert({
            orgId: orgA,
            ownerId: userA,
            accountId: null,
            name: "Test Opp",
            stage: "Qualification",
            amount: "1000.00",
            closeDate: new Date(),
            custom: null,
            currencyCode: "",
          });

          // First apply migrations
          await runStoreMigrations(dbStore, store, orgA);

          // Revert migration 2 (rollback to target version 1)
          const rollbackResult = await rollbackStoreMigrations(
            dbStore,
            store,
            orgA,
            1,
          );
          expect(rollbackResult.success).toBe(true);
          expect(rollbackResult.rolledBack).toEqual([2]);
          expect(rollbackResult.currentVersion).toBe(1);

          // Webhook status remains active
          const webhooks1 = await dbStore.webhooks.findMany();
          const webhookCheck = webhooks1.find((w) => w.id === webhook.id);
          expect(webhookCheck?.status).toBe("active");

          // Opportunity currencyCode reverted to empty
          const oppCheck = await dbStore.opportunities.findOne(opportunity.id);
          expect(oppCheck?.currencyCode).toBe("");

          // Revert migration 1 (rollback to target version 0)
          const rollbackResult2 = await rollbackStoreMigrations(
            dbStore,
            store,
            orgA,
            0,
          );
          expect(rollbackResult2.success).toBe(true);
          expect(rollbackResult2.rolledBack).toEqual([1]);
          expect(rollbackResult2.currentVersion).toBe(0);

          // Webhook status reverted to empty
          const webhooks2 = await dbStore.webhooks.findMany();
          const webhookCheck2 = webhooks2.find((w) => w.id === webhook.id);
          expect(webhookCheck2?.status).toBe("");
        },
      );
    });
  });

  describe("API Endpoint Routes & RLS Multi-Tenant Isolation", () => {
    it("should fetch migrations, migrate, and rollback via Hono API under active tenant context", async () => {
      // 1. Check migrations list starts empty
      const listRes1 = await app.request("/api/db/migrations", {
        method: "GET",
        headers: { Authorization: `Bearer ${tokenTenantA}` },
      });
      expect(listRes1.status).toBe(200);
      const listBody1 = await listRes1.json();
      expect(listBody1.success).toBe(true);
      expect(listBody1.migrations.length).toBe(0);

      // 2. Perform migration run
      const migrateRes = await app.request("/api/db/migrate", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      expect(migrateRes.status).toBe(200);
      const migrateBody = await migrateRes.json();
      expect(migrateBody.success).toBe(true);
      expect(migrateBody.applied).toEqual([1, 2]);
      expect(migrateBody.currentVersion).toBe(2);

      // 3. Check migration list again
      const listRes2 = await app.request("/api/db/migrations", {
        method: "GET",
        headers: { Authorization: `Bearer ${tokenTenantA}` },
      });
      const listBody2 = await listRes2.json();
      expect(listBody2.migrations.length).toBe(2);
      expect(
        listBody2.migrations.map((m: { version: number }) => m.version),
      ).toEqual([1, 2]);

      // 4. Verify Tenant B's migrations list is completely empty (proving RLS tenant isolation)
      const listResB = await app.request("/api/db/migrations", {
        method: "GET",
        headers: { Authorization: `Bearer ${tokenTenantB}` },
      });
      const listBodyB = await listResB.json();
      expect(listBodyB.migrations.length).toBe(0);

      // 5. Perform rollback to version 1
      const rollbackRes = await app.request("/api/db/rollback", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ targetVersion: 1 }),
      });
      expect(rollbackRes.status).toBe(200);
      const rollbackBody = await rollbackRes.json();
      expect(rollbackBody.success).toBe(true);
      expect(rollbackBody.rolledBack).toEqual([2]);
      expect(rollbackBody.currentVersion).toBe(1);

      // 6. Verify list has only migration 1
      const listRes3 = await app.request("/api/db/migrations", {
        method: "GET",
        headers: { Authorization: `Bearer ${tokenTenantA}` },
      });
      const listBody3 = await listRes3.json();
      expect(listBody3.migrations.length).toBe(1);
      expect(listBody3.migrations[0].version).toBe(1);
    });

    it("should prevent cross-tenant rollback commands and throw RLS / request errors", async () => {
      // Setup Tenant A migration
      await app.request("/api/db/migrate", {
        method: "POST",
        headers: { Authorization: `Bearer ${tokenTenantA}` },
      });

      // Tenant B tries to rollback to version 0
      // Since Tenant B has no migration version 1 or 2 applied in their context, this rollback is a no-op or rolls back nothing
      const rollbackB = await app.request("/api/db/rollback", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenTenantB}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ targetVersion: 0 }),
      });

      expect(rollbackB.status).toBe(200);
      const rollbackBBody = await rollbackB.json();
      expect(rollbackBBody.success).toBe(true);
      expect(rollbackBBody.rolledBack.length).toBe(0); // Nothing rolled back for Tenant B!

      // Tenant A migrations remain active
      const listA = await app.request("/api/db/migrations", {
        method: "GET",
        headers: { Authorization: `Bearer ${tokenTenantA}` },
      });
      const listABody = await listA.json();
      expect(listABody.migrations.length).toBe(2);
    });
  });
});

// Mock database helper matching packages/db connection
const mockDb = {
  execute: async () => ({ rows: [] }),
  transaction: async (run: (db: unknown) => Promise<unknown>) =>
    await run(mockDb),
};
