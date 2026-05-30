import { dbStore, pgDb, withTenant } from "@crm/db";
import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getTestPgContainer, isDockerAvailable } from "./pg-container";

describe.runIf(isDockerAvailable())(
  "PostgreSQL Database-level Row-Level Security (RLS) Policies (spec 014)",
  () => {
    const orgA = "org-rls-a";
    const orgB = "org-rls-b";

    beforeEach(async () => {
      const { connectionString } = await getTestPgContainer();
      process.env.DB_DRIVER = "pg";
      process.env.DB_URL = connectionString;

      await dbStore.clear();

      // Insert organizations to satisfy foreign key constraints
      await pgDb.execute(
        sql.raw(
          `INSERT INTO "organizations" ("id", "name", "status") VALUES ('${orgA}', 'Tenant RLS A', 'active'), ('${orgB}', 'Tenant RLS B', 'active') ON CONFLICT DO NOTHING`,
        ),
      );

      // Insert a default user to satisfy owner foreign key constraints
      await pgDb.execute(
        sql.raw(
          `INSERT INTO "users" ("id", "email", "password_hash", "status") VALUES ('user-a', 'default-user@example.com', 'hash', 'active') ON CONFLICT DO NOTHING`,
        ),
      );
    }, 60000);

    it("Cross-tenant SELECT returns 0 rows", async () => {
      // 1. Insert a lead under Tenant A
      let leadId = "";
      await withTenant(orgA, pgDb, async () => {
        const lead = await dbStore.leads.insert({
          email: "rls@example.com",
          company: "RLS Corp",
        });
        leadId = lead.id;
      });

      expect(leadId).toBeDefined();

      // 2. Query under Tenant B and expect 0 rows returned
      await withTenant(orgB, pgDb, async () => {
        const leads = await dbStore.leads.findMany();
        expect(leads.length).toBe(0);

        const singleLead = await dbStore.leads.findOne(leadId);
        expect(singleLead).toBeNull();
      });
    });

    it("Cross-tenant UPDATE affects 0 rows", async () => {
      // 1. Insert a lead under Tenant A
      let leadId = "";
      await withTenant(orgA, pgDb, async () => {
        const lead = await dbStore.leads.insert({
          email: "rls@example.com",
          company: "RLS Corp",
        });
        leadId = lead.id;
      });

      // 2. Attempt to update the lead under Tenant B -> should return null/affect 0 rows
      await withTenant(orgB, pgDb, async () => {
        const updated = await dbStore.leads.update(leadId, {
          company: "Hacked Company",
        });
        expect(updated).toBeNull();
      });

      // 3. Verify company remains unchanged under Tenant A
      await withTenant(orgA, pgDb, async () => {
        const lead = await dbStore.leads.findOne(leadId);
        expect(lead).not.toBeNull();
        expect(lead?.company).toBe("RLS Corp");
      });
    });

    it("Cross-tenant DELETE affects 0 rows", async () => {
      // 1. Insert a lead under Tenant A
      let leadId = "";
      await withTenant(orgA, pgDb, async () => {
        const lead = await dbStore.leads.insert({
          email: "rls@example.com",
          company: "RLS Corp",
        });
        leadId = lead.id;
      });

      // 2. Attempt to delete the lead under Tenant B -> should return false/affect 0 rows
      await withTenant(orgB, pgDb, async () => {
        const deleted = await dbStore.leads.delete(leadId);
        expect(deleted).toBe(false);
      });

      // 3. Verify lead still exists under Tenant A
      await withTenant(orgA, pgDb, async () => {
        const lead = await dbStore.leads.findOne(leadId);
        expect(lead).not.toBeNull();
      });
    });
  },
);
