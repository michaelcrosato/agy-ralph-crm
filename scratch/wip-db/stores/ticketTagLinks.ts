import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBTicketTagLink } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const ticketTagLinksStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.ticketTagLinks.filter((l) => l.orgId === orgId);
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const link = store.ticketTagLinks.find((l) => l.id === id);
    if (link && link.orgId !== orgId) {
      return null;
    }
    return link || null;
  },
  insert: async (
    link: Omit<DBTicketTagLink, "id" | "createdAt"> & {
      createdAt?: Date;
    },
  ) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(link);
    const newLink: DBTicketTagLink = {
      ...link,
      id: genId("tlink"),
      createdAt: link.createdAt || new Date(),
    };
    store.ticketTagLinks.push(newLink);
    return newLink;
  },
  delete: async (id: string) => {
    const _orgId = getActiveOrgId();
    const index = store.ticketTagLinks.findIndex((l) => l.id === id);
    if (index === -1) return false;
    assertTenantOwns(store.ticketTagLinks[index]);
    store.ticketTagLinks.splice(index, 1);
    return true;
  },
};
