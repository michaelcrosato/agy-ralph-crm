import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBTicketComment } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const ticketCommentsStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.ticketComments.filter((c) => c.orgId === orgId);
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const comment = store.ticketComments.find((c) => c.id === id);
    if (comment && comment.orgId !== orgId) {
      return null;
    }
    return comment || null;
  },
  insert: async (
    comment: Omit<DBTicketComment, "id" | "createdAt"> & {
      createdAt?: Date;
    },
  ) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(comment);
    const newComment: DBTicketComment = {
      ...comment,
      id: genId("tcom"),
      createdAt: comment.createdAt || new Date(),
    };
    store.ticketComments.push(newComment);
    return newComment;
  },
};
