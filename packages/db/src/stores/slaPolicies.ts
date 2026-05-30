import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBSlaPolicy } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const slaPoliciesStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.slaPolicies.filter((p) => p.orgId === orgId);
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const policy = store.slaPolicies.find((p) => p.id === id);
    if (policy && policy.orgId !== orgId) {
      return null;
    }
    return policy || null;
  },
  insert: async (
    policy: Omit<DBSlaPolicy, "id" | "createdAt"> & {
      createdAt?: Date;
    },
  ) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(policy);
    const newPolicy: DBSlaPolicy = {
      ...policy,
      id: genId("sla"),
      createdAt: policy.createdAt || new Date(),
    };
    store.slaPolicies.push(newPolicy);
    return newPolicy;
  },
  update: async (
    id: string,
    updates: Partial<Omit<DBSlaPolicy, "id" | "orgId" | "createdAt">>,
  ) => {
    const _orgId = getActiveOrgId();
    const index = store.slaPolicies.findIndex((p) => p.id === id);
    if (index === -1) return null;
    assertTenantOwns(store.slaPolicies[index]);
    store.slaPolicies[index] = {
      ...store.slaPolicies[index],
      ...updates,
    };
    return store.slaPolicies[index];
  },
};
