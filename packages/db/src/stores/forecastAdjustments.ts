import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBForecastAdjustment } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const forecastAdjustmentsStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.forecastAdjustments.filter((fa) => fa.orgId === orgId);
  },
  insert: async (fa: Omit<DBForecastAdjustment, "id" | "createdAt">) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(fa);
    const newFa: DBForecastAdjustment = {
      ...fa,
      id: genId("fa"),
      createdAt: new Date(),
    };
    store.forecastAdjustments.push(newFa);
    return newFa;
  },
};
