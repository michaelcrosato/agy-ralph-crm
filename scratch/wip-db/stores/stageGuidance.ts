import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBStageGuidance } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const stageGuidanceStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.stageGuidance.filter((g) => g.orgId === orgId);
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const g = store.stageGuidance.find((x) => x.id === id);
    if (g && g.orgId !== orgId) {
      return null;
    }
    return g || null;
  },
  insert: async (
    g: Omit<DBStageGuidance, "id" | "createdAt" | "updatedAt">,
  ) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(g);
    const newGuidance: DBStageGuidance = {
      ...g,
      id: genId("guidance"),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    store.stageGuidance.push(newGuidance);
    return newGuidance;
  },
  update: async (
    id: string,
    updates: Partial<
      Omit<DBStageGuidance, "id" | "orgId" | "createdAt" | "updatedAt">
    >,
  ) => {
    const _orgId = getActiveOrgId();
    const index = store.stageGuidance.findIndex((x) => x.id === id);
    if (index === -1) return null;
    assertTenantOwns(store.stageGuidance[index]);
    store.stageGuidance[index] = {
      ...store.stageGuidance[index],
      ...updates,
      updatedAt: new Date(),
    };
    return store.stageGuidance[index];
  },
  delete: async (id: string) => {
    const _orgId = getActiveOrgId();
    const index = store.stageGuidance.findIndex((x) => x.id === id);
    if (index === -1) return false;
    assertTenantOwns(store.stageGuidance[index]);
    store.stageGuidance.splice(index, 1);
    return true;
  },
};
