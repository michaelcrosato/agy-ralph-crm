import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBStageForecastMapping } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const stageForecastMappingsStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.stageForecastMappings.filter((m) => m.orgId === orgId);
  },
  upsert: async (m: Omit<DBStageForecastMapping, "id">) => {
    const orgId = getActiveOrgId();
    assertTenantOwns(m);
    const existingIndex = store.stageForecastMappings.findIndex(
      (x) => x.orgId === orgId && x.stage === m.stage,
    );
    if (existingIndex !== -1) {
      store.stageForecastMappings[existingIndex].forecastCategory =
        m.forecastCategory;
      return store.stageForecastMappings[existingIndex];
    }
    const newMapping: DBStageForecastMapping = {
      ...m,
      id: genId("sfm"),
    };
    store.stageForecastMappings.push(newMapping);
    return newMapping;
  },
};
