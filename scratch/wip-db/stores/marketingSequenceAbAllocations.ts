import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBMarketingSequenceAbAllocation } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const marketingSequenceAbAllocationsStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.marketingSequenceAbAllocations.filter(
      (c) => c.orgId === orgId,
    );
  },
  findForMemberAndStep: async (membershipId: string, stepId: string) => {
    const orgId = getActiveOrgId();
    return (
      store.marketingSequenceAbAllocations.find(
        (m) =>
          m.membershipId === membershipId &&
          m.stepId === stepId &&
          m.orgId === orgId,
      ) || null
    );
  },
  insert: async (
    item: Omit<DBMarketingSequenceAbAllocation, "id" | "createdAt">,
  ) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(item);
    const newItem: DBMarketingSequenceAbAllocation = {
      ...item,
      id: genId("alloc"),
      createdAt: new Date(),
    };
    store.marketingSequenceAbAllocations.push(newItem);
    return newItem;
  },
};
