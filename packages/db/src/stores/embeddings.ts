import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBEmbedding } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const embeddingsStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.embeddings.filter((emb) => emb.orgId === orgId);
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const emb = store.embeddings.find((e) => e.id === id);
    if (emb && emb.orgId !== orgId) {
      return null;
    }
    return emb || null;
  },
  insert: async (
    emb: Omit<DBEmbedding, "id" | "createdAt"> & { id?: string },
  ) => {
    assertTenantOwns(emb);
    const newEmb: DBEmbedding = {
      ...emb,
      id: emb.id || genId("embed"),
      createdAt: new Date(),
    };
    store.embeddings.push(newEmb);
    return newEmb;
  },
  update: async (
    id: string,
    updates: Partial<Omit<DBEmbedding, "id" | "orgId" | "createdAt">>,
  ) => {
    const index = store.embeddings.findIndex((e) => e.id === id);
    if (index === -1) return null;
    assertTenantOwns(store.embeddings[index]);
    store.embeddings[index] = { ...store.embeddings[index], ...updates };
    return store.embeddings[index];
  },
  delete: async (id: string) => {
    const index = store.embeddings.findIndex((e) => e.id === id);
    if (index === -1) return false;
    assertTenantOwns(store.embeddings[index]);
    store.embeddings.splice(index, 1);
    return true;
  },
};
