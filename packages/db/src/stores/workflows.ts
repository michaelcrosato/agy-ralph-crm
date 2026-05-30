import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBWorkflow } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const workflowsStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.workflows.filter((w) => w.orgId === orgId);
  },
  insert: async (w: Omit<DBWorkflow, "id">) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(w);
    const newWorkflow: DBWorkflow = {
      ...w,
      id: genId("workflow"),
    };
    store.workflows.push(newWorkflow);
    return newWorkflow;
  },
};
