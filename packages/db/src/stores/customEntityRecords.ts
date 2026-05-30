import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBCustomEntityRecord } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const customEntityRecordsStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.customEntityRecords.filter((rec) => rec.orgId === orgId);
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const record = store.customEntityRecords.find((r) => r.id === id);
    if (record && record.orgId !== orgId) {
      return null;
    }
    return record || null;
  },
  insert: async (
    record: Omit<DBCustomEntityRecord, "id" | "createdAt" | "updatedAt"> & {
      id?: string;
    },
  ) => {
    assertTenantOwns(record);
    const newRecord: DBCustomEntityRecord = {
      ...record,
      id: record.id || genId("cerec"),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    store.customEntityRecords.push(newRecord);
    return newRecord;
  },
  update: async (
    id: string,
    updates: Partial<
      Omit<DBCustomEntityRecord, "id" | "orgId" | "createdAt" | "updatedAt">
    >,
  ) => {
    const index = store.customEntityRecords.findIndex((r) => r.id === id);
    if (index === -1) return null;
    assertTenantOwns(store.customEntityRecords[index]);
    store.customEntityRecords[index] = {
      ...store.customEntityRecords[index],
      ...updates,
      updatedAt: new Date(),
    };
    return store.customEntityRecords[index];
  },
  delete: async (id: string) => {
    const index = store.customEntityRecords.findIndex((r) => r.id === id);
    if (index === -1) return false;
    assertTenantOwns(store.customEntityRecords[index]);
    store.customEntityRecords.splice(index, 1);
    return true;
  },
};
