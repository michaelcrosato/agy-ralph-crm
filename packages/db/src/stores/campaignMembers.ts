import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBCampaignMember } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const campaignMembersStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.campaignMembers.filter((m) => m.orgId === orgId);
  },
  findForCampaign: async (campaignId: string) => {
    const orgId = getActiveOrgId();
    return store.campaignMembers.filter(
      (m) => m.campaignId === campaignId && m.orgId === orgId,
    );
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const m = store.campaignMembers.find((x) => x.id === id);
    if (m && m.orgId !== orgId) return null;
    return m || null;
  },
  insert: async (member: Omit<DBCampaignMember, "id" | "createdAt">) => {
    const orgId = getActiveOrgId();
    assertTenantOwns(member);
    // Check for duplicates
    const exists = store.campaignMembers.some(
      (m) =>
        m.campaignId === member.campaignId &&
        m.orgId === orgId &&
        ((member.leadId && m.leadId === member.leadId) ||
          (member.contactId && m.contactId === member.contactId)),
    );
    if (exists) {
      throw new Error("Duplicate campaign member registration.");
    }
    const newMember: DBCampaignMember = {
      ...member,
      id: genId("member"),
      createdAt: new Date(),
    };
    store.campaignMembers.push(newMember);
    return newMember;
  },
  update: async (
    id: string,
    updates: Partial<
      Omit<
        DBCampaignMember,
        "id" | "orgId" | "campaignId" | "leadId" | "contactId" | "createdAt"
      >
    >,
  ) => {
    const _orgId = getActiveOrgId();
    const index = store.campaignMembers.findIndex((m) => m.id === id);
    if (index === -1) return null;
    assertTenantOwns(store.campaignMembers[index]);
    store.campaignMembers[index] = {
      ...store.campaignMembers[index],
      ...updates,
    };
    return store.campaignMembers[index];
  },
  delete: async (id: string) => {
    const _orgId = getActiveOrgId();
    const index = store.campaignMembers.findIndex((m) => m.id === id);
    if (index === -1) return false;
    assertTenantOwns(store.campaignMembers[index]);
    store.campaignMembers.splice(index, 1);
    return true;
  },
};
