import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBContact } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const contactsStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.contacts.filter((c) => c.orgId === orgId);
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const c = store.contacts.find((x) => x.id === id);
    if (c && c.orgId !== orgId) {
      return null;
    }
    return c || null;
  },
  insert: async (c: Omit<DBContact, "id">) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(c);
    const newContact: DBContact = {
      ...c,
      reportsToId: c.reportsToId || null,
      id: genId("contact"),
    };
    store.contacts.push(newContact);
    return newContact;
  },
  update: async (
    id: string,
    updates: Partial<Omit<DBContact, "id" | "orgId">>,
  ) => {
    const _orgId = getActiveOrgId();
    const index = store.contacts.findIndex((c) => c.id === id);
    if (index === -1) return null;
    assertTenantOwns(store.contacts[index]);
    store.contacts[index] = { ...store.contacts[index], ...updates };
    return store.contacts[index];
  },
  findDirectReports: async (reportsToId: string) => {
    const orgId = getActiveOrgId();
    return store.contacts.filter(
      (c) => c.orgId === orgId && c.reportsToId === reportsToId,
    );
  },
  findParentPath: async (contactId: string) => {
    const orgId = getActiveOrgId();
    const path: DBContact[] = [];
    const visited = new Set<string>();

    const target = store.contacts.find(
      (c) => c.id === contactId && c.orgId === orgId,
    );
    if (!target) return [];

    let currentParentId = target.reportsToId;
    while (currentParentId) {
      if (visited.has(currentParentId)) break;
      visited.add(currentParentId);

      const parent = store.contacts.find(
        (c) => c.id === currentParentId && c.orgId === orgId,
      );
      if (!parent) break;
      path.push(parent);
      currentParentId = parent.reportsToId;
    }
    return path;
  },
  delete: async (id: string) => {
    const _orgId = getActiveOrgId();
    const index = store.contacts.findIndex((c) => c.id === id);
    if (index === -1) return false;
    assertTenantOwns(store.contacts[index]);
    store.contacts.splice(index, 1);
    return true;
  },
};
