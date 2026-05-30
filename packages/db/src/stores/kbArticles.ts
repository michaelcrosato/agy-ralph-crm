import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBKbArticle } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const kbArticlesStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.kbArticles.filter((a) => a.orgId === orgId);
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const article = store.kbArticles.find((a) => a.id === id);
    if (article && article.orgId !== orgId) {
      return null;
    }
    return article || null;
  },
  insert: async (
    article: Omit<DBKbArticle, "id" | "createdAt" | "viewCount"> & {
      createdAt?: Date;
      viewCount?: number;
    },
  ) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(article);
    const newArticle: DBKbArticle = {
      ...article,
      id: genId("kbart"),
      viewCount: article.viewCount || 0,
      createdAt: article.createdAt || new Date(),
    };
    store.kbArticles.push(newArticle);
    return newArticle;
  },
  update: async (
    id: string,
    updates: Partial<Omit<DBKbArticle, "id" | "orgId" | "createdAt">>,
  ) => {
    const _orgId = getActiveOrgId();
    const index = store.kbArticles.findIndex((a) => a.id === id);
    if (index === -1) return null;
    assertTenantOwns(store.kbArticles[index]);
    store.kbArticles[index] = {
      ...store.kbArticles[index],
      ...updates,
    };
    return store.kbArticles[index];
  },
};
