import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBKbCategory } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const kbCategoriesStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.kbCategories.filter((c) => c.orgId === orgId);
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const category = store.kbCategories.find((c) => c.id === id);
    if (category && category.orgId !== orgId) {
      return null;
    }
    return category || null;
  },
  insert: async (
    category: Omit<DBKbCategory, "id" | "createdAt"> & {
      createdAt?: Date;
    },
  ) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(category);
    const newCategory: DBKbCategory = {
      ...category,
      id: genId("kbcat"),
      createdAt: category.createdAt || new Date(),
    };
    store.kbCategories.push(newCategory);
    return newCategory;
  },
};
