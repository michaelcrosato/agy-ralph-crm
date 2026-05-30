import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBActivityLink } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const activityLinksStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.activityLinks.filter((link) => link.orgId === orgId);
  },
  insert: async (link: Omit<DBActivityLink, "id">) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(link);
    const newLink: DBActivityLink = {
      ...link,
      id: genId("link"),
    };
    store.activityLinks.push(newLink);
    return newLink;
  },
};
