import type { DBSchemaMigration, DBStoreMigration } from "../../types";

export const registeredMigrations: DBStoreMigration[] = [
  {
    version: 1,
    name: "Initialize Default Webhook Status",
    up: async (store: Record<string, unknown[]>, orgId: string) => {
      const webhooks =
        (store.webhooks as { orgId: string; status: string }[] | undefined) ||
        [];
      const tenantWebhooks = webhooks.filter((w) => w.orgId === orgId);
      for (const w of tenantWebhooks) {
        if (!w.status) {
          w.status = "active";
        }
      }
    },
    down: async (store: Record<string, unknown[]>, orgId: string) => {
      const webhooks =
        (store.webhooks as { orgId: string; status: string }[] | undefined) ||
        [];
      const tenantWebhooks = webhooks.filter((w) => w.orgId === orgId);
      for (const w of tenantWebhooks) {
        if (w.status === "active") {
          w.status = "";
        }
      }
    },
  },
  {
    version: 2,
    name: "Initialize Default Opportunity Currencies",
    up: async (store: Record<string, unknown[]>, orgId: string) => {
      const opportunities =
        (store.opportunities as
          | { orgId: string; currencyCode?: string }[]
          | undefined) || [];
      const tenantOpps = opportunities.filter((o) => o.orgId === orgId);
      for (const o of tenantOpps) {
        if (!o.currencyCode) {
          o.currencyCode = "USD";
        }
      }
    },
    down: async (store: Record<string, unknown[]>, orgId: string) => {
      const opportunities =
        (store.opportunities as
          | { orgId: string; currencyCode?: string }[]
          | undefined) || [];
      const tenantOpps = opportunities.filter((o) => o.orgId === orgId);
      for (const o of tenantOpps) {
        if (o.currencyCode === "USD") {
          o.currencyCode = "";
        }
      }
    },
  },
];

export async function runStoreMigrations(
  dbStore: {
    schemaMigrations: {
      findMany: () => Promise<DBSchemaMigration[]>;
      insert: (m: {
        orgId: string;
        version: number;
        name: string;
      }) => Promise<DBSchemaMigration>;
    };
  },
  rawStore: Record<string, unknown[]>,
  orgId: string,
  targetVersion?: number,
): Promise<{ success: boolean; applied: number[]; currentVersion: number }> {
  const appliedMigrations = await dbStore.schemaMigrations.findMany();
  const appliedVersions = new Set(appliedMigrations.map((m) => m.version));

  const pending = registeredMigrations
    .filter((m) => !appliedVersions.has(m.version))
    .filter((m) => targetVersion === undefined || m.version <= targetVersion)
    .sort((a, b) => a.version - b.version);

  const applied: number[] = [];
  for (const migration of pending) {
    await migration.up(rawStore, orgId);
    await dbStore.schemaMigrations.insert({
      orgId,
      version: migration.version,
      name: migration.name,
    });
    applied.push(migration.version);
  }

  const allApplied = await dbStore.schemaMigrations.findMany();
  const currentVersion = allApplied.reduce(
    (max: number, m: DBSchemaMigration) => Math.max(max, amVal(m.version)),
    0,
  );

  function amVal(v: number): number {
    return typeof v === "number" ? v : Number(v) || 0;
  }

  return {
    success: true,
    applied,
    currentVersion,
  };
}

export async function rollbackStoreMigrations(
  dbStore: {
    schemaMigrations: {
      findMany: () => Promise<DBSchemaMigration[]>;
      delete: (id: string) => Promise<boolean>;
    };
  },
  rawStore: Record<string, unknown[]>,
  orgId: string,
  targetVersion: number,
): Promise<{ success: boolean; rolledBack: number[]; currentVersion: number }> {
  const appliedMigrations = await dbStore.schemaMigrations.findMany();

  const toRollback = registeredMigrations
    .filter((m) => appliedMigrations.some((am) => am.version === m.version))
    .filter((m) => m.version > targetVersion)
    .sort((a, b) => b.version - a.version);

  const rolledBack: number[] = [];
  for (const migration of toRollback) {
    await migration.down(rawStore, orgId);
    const am = appliedMigrations.find((x) => x.version === migration.version);
    if (am) {
      await dbStore.schemaMigrations.delete(am.id);
    }
    rolledBack.push(migration.version);
  }

  const allApplied = await dbStore.schemaMigrations.findMany();
  const currentVersion = allApplied.reduce(
    (max: number, m: DBSchemaMigration) => Math.max(max, amVal(m.version)),
    0,
  );

  function amVal(v: number): number {
    return typeof v === "number" ? v : Number(v) || 0;
  }

  return {
    success: true,
    rolledBack,
    currentVersion,
  };
}
