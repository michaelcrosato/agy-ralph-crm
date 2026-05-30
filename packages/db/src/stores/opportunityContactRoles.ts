import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBOpportunityContactRole } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const opportunityContactRolesStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.opportunityContactRoles.filter((r) => r.orgId === orgId);
  },
  findForOpportunity: async (opportunityId: string) => {
    const orgId = getActiveOrgId();
    return store.opportunityContactRoles.filter(
      (r) => r.opportunityId === opportunityId && r.orgId === orgId,
    );
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const r = store.opportunityContactRoles.find((x) => x.id === id);
    if (r && r.orgId !== orgId) return null;
    return r || null;
  },
  insert: async (role: Omit<DBOpportunityContactRole, "id" | "createdAt">) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(role);
    const newRole: DBOpportunityContactRole = {
      ...role,
      id: genId("ocr"),
      createdAt: new Date(),
    };
    store.opportunityContactRoles.push(newRole);
    return newRole;
  },
  update: async (
    id: string,
    updates: Partial<
      Omit<DBOpportunityContactRole, "id" | "orgId" | "createdAt">
    >,
  ) => {
    const _orgId = getActiveOrgId();
    const index = store.opportunityContactRoles.findIndex((r) => r.id === id);
    if (index === -1) return null;
    assertTenantOwns(store.opportunityContactRoles[index]);
    store.opportunityContactRoles[index] = {
      ...store.opportunityContactRoles[index],
      ...updates,
    };
    return store.opportunityContactRoles[index];
  },
  delete: async (id: string) => {
    const _orgId = getActiveOrgId();
    const index = store.opportunityContactRoles.findIndex((r) => r.id === id);
    if (index === -1) return false;
    assertTenantOwns(store.opportunityContactRoles[index]);
    store.opportunityContactRoles.splice(index, 1);
    return true;
  },
};
