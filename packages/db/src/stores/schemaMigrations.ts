import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBSchemaMigration } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const schemaMigrationsStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.schemaMigrations.filter((m) => m.orgId === orgId);
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const m = store.schemaMigrations.find((x) => x.id === id);
    if (m && m.orgId !== orgId) {
      return null;
    }
    return m || null;
  },
  insert: async (
    migration: Omit<DBSchemaMigration, "id" | "appliedAt"> & {
      appliedAt?: Date;
    },
  ) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(migration);
    const newMigration: DBSchemaMigration = {
      ...migration,
      id: genId("mig"),
      appliedAt: migration.appliedAt || new Date(),
    };
    store.schemaMigrations.push(newMigration);
    return newMigration;
  },
  delete: async (id: string) => {
    const _orgId = getActiveOrgId();
    const index = store.schemaMigrations.findIndex((x) => x.id === id);
    if (index === -1) return false;
    assertTenantOwns(store.schemaMigrations[index]);
    store.schemaMigrations.splice(index, 1);
    return true;
  },
};
