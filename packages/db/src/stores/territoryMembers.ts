import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBTerritoryMember } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const territoryMembersStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.territoryMembers.filter((m) => m.orgId === orgId);
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const m = store.territoryMembers.find((x) => x.id === id);
    if (m && m.orgId !== orgId) return null;
    return m || null;
  },
  insert: async (member: Omit<DBTerritoryMember, "id">) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(member);
    const newMember: DBTerritoryMember = {
      ...member,
      id: genId("member"),
    };
    store.territoryMembers.push(newMember);
    return newMember;
  },
  delete: async (id: string) => {
    const _orgId = getActiveOrgId();
    const index = store.territoryMembers.findIndex((m) => m.id === id);
    if (index === -1) return false;
    assertTenantOwns(store.territoryMembers[index]);
    store.territoryMembers.splice(index, 1);
    return true;
  },
};
