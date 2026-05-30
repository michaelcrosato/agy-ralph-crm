import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBTicketEscalation } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const ticketEscalationsStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.ticketEscalations.filter((e) => e.orgId === orgId);
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const escalation = store.ticketEscalations.find((e) => e.id === id);
    if (escalation && escalation.orgId !== orgId) {
      return null;
    }
    return escalation || null;
  },
  insert: async (
    escalation: Omit<DBTicketEscalation, "id" | "createdAt"> & {
      createdAt?: Date;
    },
  ) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(escalation);
    const newEscalation: DBTicketEscalation = {
      ...escalation,
      id: genId("tesc"),
      createdAt: escalation.createdAt || new Date(),
    };
    store.ticketEscalations.push(newEscalation);
    return newEscalation;
  },
};
