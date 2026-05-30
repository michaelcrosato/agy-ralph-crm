import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBTicketMacro } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const ticketMacrosStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.ticketMacros.filter((m) => m.orgId === orgId);
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const macro = store.ticketMacros.find((m) => m.id === id);
    if (macro && macro.orgId !== orgId) {
      return null;
    }
    return macro || null;
  },
  insert: async (
    macro: Omit<DBTicketMacro, "id" | "createdAt"> & {
      createdAt?: Date;
    },
  ) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(macro);
    const newMacro: DBTicketMacro = {
      ...macro,
      id: genId("tmac"),
      createdAt: macro.createdAt || new Date(),
    };
    store.ticketMacros.push(newMacro);
    return newMacro;
  },
};
