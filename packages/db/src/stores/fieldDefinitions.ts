import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBFieldDefinition } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const fieldDefinitionsStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.fieldDefinitions.filter((def) => def.orgId === orgId);
  },
  insert: async (def: Omit<DBFieldDefinition, "id">) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(def);
    const newDef: DBFieldDefinition = {
      ...def,
      id: genId("field"),
    };
    store.fieldDefinitions.push(newDef);
    return newDef;
  },
};
