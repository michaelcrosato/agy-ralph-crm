import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBWebhookDlq } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const webhookDlqStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.webhookDlq.filter((d) => d.orgId === orgId);
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const d = store.webhookDlq.find((x) => x.id === id);
    if (d && d.orgId !== orgId) return null;
    return d || null;
  },
  insert: async (d: Omit<DBWebhookDlq, "id" | "failedAt">) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(d);
    const newDlq: DBWebhookDlq = {
      ...d,
      id: genId("dlq"),
      failedAt: new Date(),
    };
    store.webhookDlq.push(newDlq);
    return newDlq;
  },
};
