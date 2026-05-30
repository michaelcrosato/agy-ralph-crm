import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBLayoutDefinition } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const layoutDefinitionsStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.layoutDefinitions.filter((layout) => layout.orgId === orgId);
  },
  findOne: async (objectType: string) => {
    const orgId = getActiveOrgId();
    const layout = store.layoutDefinitions.find(
      (lay) => lay.objectType === objectType && lay.orgId === orgId,
    );
    return layout || null;
  },
  insert: async (layout: Omit<DBLayoutDefinition, "id">) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(layout);
    const newLayout: DBLayoutDefinition = {
      ...layout,
      id: genId("layout"),
    };
    store.layoutDefinitions.push(newLayout);
    return newLayout;
  },
};
