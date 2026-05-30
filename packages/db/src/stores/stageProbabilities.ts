import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBStageProbability } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const stageProbabilitiesStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.stageProbabilities.filter((sp) => sp.orgId === orgId);
  },
  upsert: async (sp: Omit<DBStageProbability, "id">) => {
    const orgId = getActiveOrgId();
    assertTenantOwns(sp);
    const existingIndex = store.stageProbabilities.findIndex(
      (x) => x.orgId === orgId && x.stage === sp.stage,
    );
    if (existingIndex !== -1) {
      store.stageProbabilities[existingIndex].probability = sp.probability;
      return store.stageProbabilities[existingIndex];
    }
    const newSp: DBStageProbability = {
      ...sp,
      id: genId("sp"),
    };
    store.stageProbabilities.push(newSp);
    return newSp;
  },
};
