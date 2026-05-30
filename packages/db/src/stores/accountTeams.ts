import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBAccountTeamMember } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const accountTeamsStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.accountTeams.filter((t) => t.orgId === orgId);
  },
  findForAccount: async (accountId: string) => {
    const orgId = getActiveOrgId();
    return store.accountTeams.filter(
      (t) => t.accountId === accountId && t.orgId === orgId,
    );
  },
  insert: async (member: Omit<DBAccountTeamMember, "id" | "createdAt">) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(member);
    const newMember: DBAccountTeamMember = {
      ...member,
      id: genId("team"),
      createdAt: new Date(),
    };
    store.accountTeams.push(newMember);
    return newMember;
  },
  addOrUpdateMember: async (
    accountId: string,
    userId: string,
    role: string,
  ) => {
    const orgId = getActiveOrgId();
    // Verify account belongs to organization
    const account = store.accounts.find((a) => a.id === accountId);
    if (!account || account.orgId !== orgId) {
      throw new Error(
        "RLS Isolation Violation: Account not found or tenant mismatch.",
      );
    }
    const index = store.accountTeams.findIndex(
      (t) =>
        t.accountId === accountId && t.userId === userId && t.orgId === orgId,
    );
    if (index !== -1) {
      store.accountTeams[index] = {
        ...store.accountTeams[index],
        role,
      };
      return store.accountTeams[index];
    }
    const newMember: DBAccountTeamMember = {
      id: genId("team"),
      orgId,
      accountId,
      userId,
      role,
      createdAt: new Date(),
    };
    store.accountTeams.push(newMember);
    return newMember;
  },
  removeMember: async (accountId: string, userId: string) => {
    const orgId = getActiveOrgId();
    const index = store.accountTeams.findIndex(
      (t) =>
        t.accountId === accountId && t.userId === userId && t.orgId === orgId,
    );
    if (index === -1) return;
    store.accountTeams.splice(index, 1);
  },
};
