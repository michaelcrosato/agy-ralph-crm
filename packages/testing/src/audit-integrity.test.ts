import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { GENESIS_HASH, verifyAuditChain } from "@crm/audit";
import { dbStore, mockDb, pgDb, withTenant } from "@crm/db";
import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getTestPgContainer, isDockerAvailable } from "./pg-container";

describe("Audit Log Cryptographic Integrity & Chaining Pipeline", () => {
  const orgA = "org-audit-a";

  describe("In-Memory Mock Store Chaining", () => {
    beforeEach(async () => {
      process.env.DB_DRIVER = "mock";
      await dbStore.clear();
    });

    it("automatically chains mock store insertions chronologically per tenant", async () => {
      let log1: Record<string, any> | undefined;
      let log2: Record<string, any> | undefined;

      await withTenant(orgA, mockDb, async () => {
        log1 = await dbStore.auditLogs.insert({
          recordId: "rec-1",
          recordType: "Lead",
          action: "create",
          userId: "user-a",
          changes: null,
        });

        log2 = await dbStore.auditLogs.insert({
          recordId: "rec-1",
          recordType: "Lead",
          action: "update",
          userId: "user-a",
          changes: { status: { before: "New", after: "Contacted" } },
        });
      });

      expect(log1.seq).toBe(0);
      expect(log1.prevHash).toBe(GENESIS_HASH);
      expect(log1.hash).toBeDefined();
      expect(log1.hash).not.toBeNull();

      expect(log2.seq).toBe(1);
      expect(log2.prevHash).toBe(log1.hash);
      expect(log2.hash).toBeDefined();
      expect(log2.hash).not.toBeNull();

      // Verify chain via @crm/audit helper
      const logs = await withTenant(orgA, mockDb, async () => {
        return await dbStore.auditLogs.findMany();
      });

      const mappedLogs = logs.map((l) => ({
        orgId: l.orgId,
        recordId: l.recordId,
        recordType: l.recordType,
        action: l.action,
        userId: l.userId,
        changes: l.changes,
        createdAt:
          l.createdAt instanceof Date
            ? l.createdAt.toISOString()
            : new Date(l.createdAt).toISOString(),
        seq: l.seq ?? 0,
        prevHash: l.prevHash ?? "",
        hash: l.hash ?? "",
      }));

      const verification = verifyAuditChain(mappedLogs);
      expect(verification.valid).toBe(true);
    });

    it("tamper evidence detects direct modifications in mock memory", async () => {
      await withTenant(orgA, mockDb, async () => {
        await dbStore.auditLogs.insert({
          recordId: "rec-1",
          recordType: "Lead",
          action: "create",
          userId: "user-a",
          changes: null,
        });

        await dbStore.auditLogs.insert({
          recordId: "rec-1",
          recordType: "Lead",
          action: "update",
          userId: "user-a",
          changes: { status: { before: "New", after: "Contacted" } },
        });
      });

      const logs = await withTenant(orgA, mockDb, async () => {
        return await dbStore.auditLogs.findMany();
      });

      const mappedLogs = logs.map((l) => ({
        orgId: l.orgId,
        recordId: l.recordId,
        recordType: l.recordType,
        action: l.action,
        userId: l.userId,
        changes: l.changes,
        createdAt:
          l.createdAt instanceof Date
            ? l.createdAt.toISOString()
            : new Date(l.createdAt).toISOString(),
        seq: l.seq ?? 0,
        prevHash: l.prevHash ?? "",
        hash: l.hash ?? "",
      }));

      expect(verifyAuditChain(mappedLogs).valid).toBe(true);

      // Maliciously tamper with a record
      mappedLogs[0].action = "delete";
      expect(verifyAuditChain(mappedLogs).valid).toBe(false);
    });
  });

  describe.runIf(isDockerAvailable())(
    "PostgreSQL Container Chaining & RLS",
    () => {
      let connectionString = "";

      beforeEach(async () => {
        const containerInfo = await getTestPgContainer();
        connectionString = containerInfo.connectionString;
        process.env.DB_DRIVER = "pg";
        process.env.DB_URL = connectionString;

        await dbStore.clear();

        // Satisfy foreign key constraints
        await pgDb.execute(
          sql.raw(
            `INSERT INTO "organizations" ("id", "name", "status") VALUES 
          ('org-audit-a1', 'Tenant A1', 'active'), 
          ('org-audit-b1', 'Tenant B1', 'active'),
          ('org-audit-a2', 'Tenant A2', 'active'), 
          ('org-audit-b2', 'Tenant B2', 'active'),
          ('org-audit-a3', 'Tenant A3', 'active'), 
          ('org-audit-b3', 'Tenant B3', 'active') 
          ON CONFLICT DO NOTHING`,
          ),
        );

        await pgDb.execute(
          sql.raw(
            `INSERT INTO "users" ("id", "email", "password_hash", "status") VALUES ('user-a', 'default-user@example.com', 'hash', 'active') ON CONFLICT DO NOTHING`,
          ),
        );
      }, 60000);

      it("chains PG audit log insertions sequentially per organization", async () => {
        const oA = "org-audit-a1";
        const oB = "org-audit-b1";
        let log1: Record<string, any> | undefined;
        let log2: Record<string, any> | undefined;
        let log3: Record<string, any> | undefined;

        await withTenant(oA, pgDb, async () => {
          log1 = await dbStore.auditLogs.insert({
            recordId: "rec-pg-1",
            recordType: "Lead",
            action: "create",
            userId: "user-a",
            changes: null,
          });

          log2 = await dbStore.auditLogs.insert({
            recordId: "rec-pg-1",
            recordType: "Lead",
            action: "update",
            userId: "user-a",
            changes: { company: { before: "Old", after: "New" } },
          });
        });

        // Insert for tenant B to test tenant isolation
        await withTenant(oB, pgDb, async () => {
          log3 = await dbStore.auditLogs.insert({
            recordId: "rec-pg-2",
            recordType: "Contact",
            action: "create",
            userId: "user-a",
            changes: null,
          });
        });

        // Tenant A chain validations
        expect(log1?.seq).toBe(0);
        expect(log1?.prevHash).toBe(GENESIS_HASH);
        expect(log1?.hash).toBeDefined();

        expect(log2?.seq).toBe(1);
        expect(log2?.prevHash).toBe(log1?.hash);

        // Tenant B chain validations
        expect(log3?.seq).toBe(0); // Starts at 0 independently
        expect(log3?.prevHash).toBe(GENESIS_HASH);

        // Verify using CLI verification script (should pass exit code 0)
        const runVerification = () => {
          execSync("node scripts/agent/verify-audit-integrity.mjs", {
            cwd: resolve(__dirname, "../../.."),
            env: {
              ...process.env,
              DB_DRIVER: "pg",
              DB_URL: connectionString,
              TZ: "UTC",
            },
            stdio: "pipe",
          });
        };

        expect(runVerification).not.toThrow();
      });

      it("CLI integrity pipeline rejects altered rows in PostgreSQL", async () => {
        const oA = "org-audit-a2";
        let log1: Record<string, any> | undefined;

        await withTenant(oA, pgDb, async () => {
          log1 = await dbStore.auditLogs.insert({
            recordId: "rec-pg-1",
            recordType: "Lead",
            action: "create",
            userId: "user-a",
            changes: null,
          });

          await dbStore.auditLogs.insert({
            recordId: "rec-pg-1",
            recordType: "Lead",
            action: "update",
            userId: "user-a",
            changes: { company: { before: "Old", after: "New" } },
          });
        });

        // CLI check passes initially
        const runVerification = () => {
          execSync("node scripts/agent/verify-audit-integrity.mjs", {
            cwd: resolve(__dirname, "../../.."),
            env: {
              ...process.env,
              DB_DRIVER: "pg",
              DB_URL: connectionString,
              TZ: "UTC",
            },
            stdio: "pipe",
          });
        };
        expect(runVerification).not.toThrow();

        // Maliciously tamper the DB directly (bypassing the application RLS store layer)
        const db = pgDb;
        await db.execute(
          sql.raw(
            `UPDATE "audit_logs" SET "action" = 'delete' WHERE "id" = '${log1?.id}'`,
          ),
        );

        // Now CLI integrity check should fail and exit 1 (throwing error in execSync)
        expect(runVerification).toThrow();
      });

      it("CLI integrity pipeline rejects deleted links in PostgreSQL", async () => {
        const oA = "org-audit-a3";
        let log1: Record<string, any> | undefined;

        await withTenant(oA, pgDb, async () => {
          log1 = await dbStore.auditLogs.insert({
            recordId: "rec-pg-1",
            recordType: "Lead",
            action: "create",
            userId: "user-a",
            changes: null,
          });

          await dbStore.auditLogs.insert({
            recordId: "rec-pg-1",
            recordType: "Lead",
            action: "update",
            userId: "user-a",
            changes: { company: { before: "Old", after: "New" } },
          });
        });

        const runVerification = () => {
          execSync("node scripts/agent/verify-audit-integrity.mjs", {
            cwd: resolve(__dirname, "../../.."),
            env: {
              ...process.env,
              DB_DRIVER: "pg",
              DB_URL: connectionString,
              TZ: "UTC",
            },
            stdio: "pipe",
          });
        };
        expect(runVerification).not.toThrow();

        // Maliciously delete a node in the chain
        await pgDb.execute(
          sql.raw(`DELETE FROM "audit_logs" WHERE "id" = '${log1.id}'`),
        );

        // Now verify-audit-integrity.mjs should fail
        expect(runVerification).toThrow();
      });
    },
  );
});
