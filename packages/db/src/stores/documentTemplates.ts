import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBDocumentTemplate } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const documentTemplatesStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.documentTemplates.filter((t) => t.orgId === orgId);
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const t = store.documentTemplates.find((x) => x.id === id);
    if (t && t.orgId !== orgId) return null;
    return t || null;
  },
  insert: async (template: Omit<DBDocumentTemplate, "id" | "createdAt">) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(template);
    const newTemplate: DBDocumentTemplate = {
      ...template,
      id: genId("template"),
      createdAt: new Date(),
    };
    store.documentTemplates.push(newTemplate);
    return newTemplate;
  },
};
