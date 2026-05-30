import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBMembership } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const membershipsStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.memberships.filter((m) => m.orgId === orgId);
  },
  insert: async (membership: Omit<DBMembership, "id">) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(membership);
    const newMembership: DBMembership = {
      ...membership,
      id: genId("membership"),
    };
    store.memberships.push(newMembership);
    return newMembership;
  },
};
