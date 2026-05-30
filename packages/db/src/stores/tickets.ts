import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBTicket } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const ticketsStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.tickets.filter((t) => t.orgId === orgId);
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const ticket = store.tickets.find((t) => t.id === id);
    if (ticket && ticket.orgId !== orgId) {
      return null;
    }
    return ticket || null;
  },
  insert: async (ticket: Omit<DBTicket, "id" | "createdAt">) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(ticket);
    const newTicket: DBTicket = {
      ...ticket,
      id: genId("ticket"),
      status: ticket.status || "Open",
      priority: ticket.priority || "Medium",
      createdAt: new Date(),
    };
    store.tickets.push(newTicket);
    return newTicket;
  },
  update: async (
    id: string,
    updates: Partial<Omit<DBTicket, "id" | "orgId" | "createdAt">>,
  ) => {
    const _orgId = getActiveOrgId();
    const index = store.tickets.findIndex((t) => t.id === id);
    if (index === -1) return null;
    assertTenantOwns(store.tickets[index]);
    store.tickets[index] = { ...store.tickets[index], ...updates };
    return store.tickets[index];
  },
};
