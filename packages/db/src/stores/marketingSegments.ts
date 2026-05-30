import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBMarketingSegment } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const marketingSegmentsStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.marketingSegments.filter((c) => c.orgId === orgId);
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const c = store.marketingSegments.find((x) => x.id === id);
    if (c && c.orgId !== orgId) return null;
    return c || null;
  },
  insert: async (
    item: Omit<DBMarketingSegment, "id" | "createdAt" | "updatedAt">,
  ) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(item);
    const newItem: DBMarketingSegment = {
      ...item,
      id: genId("seg"),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    store.marketingSegments.push(newItem);
    return newItem;
  },
  update: async (
    id: string,
    updates: Partial<
      Omit<DBMarketingSegment, "id" | "orgId" | "createdAt" | "updatedAt">
    >,
  ) => {
    const _orgId = getActiveOrgId();
    const index = store.marketingSegments.findIndex((c) => c.id === id);
    if (index === -1) return null;
    assertTenantOwns(store.marketingSegments[index]);
    store.marketingSegments[index] = {
      ...store.marketingSegments[index],
      ...updates,
      updatedAt: new Date(),
    };
    return store.marketingSegments[index];
  },
  delete: async (id: string) => {
    const _orgId = getActiveOrgId();
    const index = store.marketingSegments.findIndex((c) => c.id === id);
    if (index === -1) return false;
    assertTenantOwns(store.marketingSegments[index]);
    store.marketingSegments.splice(index, 1);
    return true;
  },
};
