import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBEmailTemplate } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const emailTemplatesStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.emailTemplates.filter((t) => t.orgId === orgId);
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const t = store.emailTemplates.find((x) => x.id === id);
    if (t && t.orgId !== orgId) return null;
    return t || null;
  },
  insert: async (
    t: Omit<DBEmailTemplate, "id" | "createdAt" | "updatedAt">,
  ) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(t);
    const newTemplate: DBEmailTemplate = {
      ...t,
      id: genId("emailtpl"),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    store.emailTemplates.push(newTemplate);
    return newTemplate;
  },
  update: async (
    id: string,
    updates: Partial<
      Omit<DBEmailTemplate, "id" | "orgId" | "createdAt" | "updatedAt">
    >,
  ) => {
    const _orgId = getActiveOrgId();
    const index = store.emailTemplates.findIndex((x) => x.id === id);
    if (index === -1) return null;
    assertTenantOwns(store.emailTemplates[index]);
    store.emailTemplates[index] = {
      ...store.emailTemplates[index],
      ...updates,
      updatedAt: new Date(),
    };
    return store.emailTemplates[index];
  },
  delete: async (id: string) => {
    const _orgId = getActiveOrgId();
    const index = store.emailTemplates.findIndex((x) => x.id === id);
    if (index === -1) return false;
    assertTenantOwns(store.emailTemplates[index]);
    store.emailTemplates.splice(index, 1);
    return true;
  },
};
