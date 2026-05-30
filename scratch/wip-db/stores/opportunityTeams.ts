import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBOpportunityTeamMember } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const opportunityTeamsStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.opportunityTeams.filter((t) => t.orgId === orgId);
  },
  findForOpportunity: async (opportunityId: string) => {
    const orgId = getActiveOrgId();
    return store.opportunityTeams.filter(
      (t) => t.opportunityId === opportunityId && t.orgId === orgId,
    );
  },
  insert: async (member: Omit<DBOpportunityTeamMember, "id" | "createdAt">) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(member);
    const newMember: DBOpportunityTeamMember = {
      ...member,
      id: genId("team"),
      createdAt: new Date(),
    };
    store.opportunityTeams.push(newMember);
    return newMember;
  },
  addOrUpdateMember: async (
    opportunityId: string,
    userId: string,
    role: string,
  ) => {
    const orgId = getActiveOrgId();
    // Verify opportunity belongs to organization
    const opportunity = store.opportunities.find((o) => o.id === opportunityId);
    if (!opportunity || opportunity.orgId !== orgId) {
      throw new Error(
        "RLS Isolation Violation: Opportunity not found or tenant mismatch.",
      );
    }
    const index = store.opportunityTeams.findIndex(
      (t) =>
        t.opportunityId === opportunityId &&
        t.userId === userId &&
        t.orgId === orgId,
    );
    if (index !== -1) {
      store.opportunityTeams[index] = {
        ...store.opportunityTeams[index],
        role,
      };
      return store.opportunityTeams[index];
    }
    const newMember: DBOpportunityTeamMember = {
      id: genId("team"),
      orgId,
      opportunityId,
      userId,
      role,
      createdAt: new Date(),
    };
    store.opportunityTeams.push(newMember);
    return newMember;
  },
  removeMember: async (opportunityId: string, userId: string) => {
    const orgId = getActiveOrgId();
    const index = store.opportunityTeams.findIndex(
      (t) =>
        t.opportunityId === opportunityId &&
        t.userId === userId &&
        t.orgId === orgId,
    );
    if (index === -1) return;
    store.opportunityTeams.splice(index, 1);
  },
};
