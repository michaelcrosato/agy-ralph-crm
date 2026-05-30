import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBMergedDocument } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const mergedDocumentsStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.mergedDocuments.filter((d) => d.orgId === orgId);
  },
  insert: async (merged: Omit<DBMergedDocument, "id" | "createdAt">) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(merged);
    const newMerged: DBMergedDocument = {
      ...merged,
      id: genId("merged"),
      createdAt: new Date(),
    };
    store.mergedDocuments.push(newMerged);
    return newMerged;
  },
};
