import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBEsignatureRequest } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const esignatureRequestsStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.esignatureRequests.filter((r) => r.orgId === orgId);
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const req = store.esignatureRequests.find((r) => r.id === id);
    if (req && req.orgId !== orgId) {
      return null;
    }
    return req || null;
  },
  insert: async (
    req: Omit<DBEsignatureRequest, "id" | "sentAt" | "completedAt"> & {
      sentAt?: Date;
      completedAt?: Date | null;
    },
  ) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(req);
    const newReq: DBEsignatureRequest = {
      ...req,
      id: genId("esign"),
      sentAt: req.sentAt || new Date(),
      completedAt: req.completedAt || null,
    };
    store.esignatureRequests.push(newReq);
    return newReq;
  },
  update: async (
    id: string,
    updates: Partial<Omit<DBEsignatureRequest, "id" | "orgId">>,
  ) => {
    const _orgId = getActiveOrgId();
    const index = store.esignatureRequests.findIndex((r) => r.id === id);
    if (index === -1) return null;
    assertTenantOwns(store.esignatureRequests[index]);
    store.esignatureRequests[index] = {
      ...store.esignatureRequests[index],
      ...updates,
    };
    return store.esignatureRequests[index];
  },
};
