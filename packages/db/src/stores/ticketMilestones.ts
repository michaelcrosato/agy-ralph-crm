import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBTicketMilestone } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const ticketMilestonesStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.ticketMilestones.filter((m) => m.orgId === orgId);
  },
  findByTicket: async (ticketId: string) => {
    const orgId = getActiveOrgId();
    return store.ticketMilestones.filter(
      (m) => m.ticketId === ticketId && m.orgId === orgId,
    );
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const milestone = store.ticketMilestones.find((m) => m.id === id);
    if (milestone && milestone.orgId !== orgId) {
      return null;
    }
    return milestone || null;
  },
  insert: async (
    milestone: Omit<DBTicketMilestone, "id" | "createdAt"> & {
      createdAt?: Date;
    },
  ) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(milestone);
    const newMilestone: DBTicketMilestone = {
      ...milestone,
      id: genId("milestone"),
      createdAt: milestone.createdAt || new Date(),
    };
    store.ticketMilestones.push(newMilestone);
    return newMilestone;
  },
  update: async (
    id: string,
    updates: Partial<Omit<DBTicketMilestone, "id" | "orgId" | "createdAt">>,
  ) => {
    const _orgId = getActiveOrgId();
    const index = store.ticketMilestones.findIndex((m) => m.id === id);
    if (index === -1) return null;
    assertTenantOwns(store.ticketMilestones[index]);
    store.ticketMilestones[index] = {
      ...store.ticketMilestones[index],
      ...updates,
    };
    return store.ticketMilestones[index];
  },
};
