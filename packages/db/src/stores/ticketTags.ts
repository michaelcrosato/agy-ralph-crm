import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBTicketTag } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const ticketTagsStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.ticketTags.filter((t) => t.orgId === orgId);
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const tag = store.ticketTags.find((t) => t.id === id);
    if (tag && tag.orgId !== orgId) {
      return null;
    }
    return tag || null;
  },
  insert: async (
    tag: Omit<DBTicketTag, "id" | "createdAt"> & {
      createdAt?: Date;
    },
  ) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(tag);
    const newTag: DBTicketTag = {
      ...tag,
      id: genId("ttag"),
      createdAt: tag.createdAt || new Date(),
    };
    store.ticketTags.push(newTag);
    return newTag;
  },
};
