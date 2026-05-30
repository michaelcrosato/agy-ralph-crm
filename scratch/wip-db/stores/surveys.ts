import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBSurvey } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const surveysStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.surveys.filter((s) => s.orgId === orgId);
  },
  findOne: async (id: string) => {
    const orgId = getActiveOrgId();
    const survey = store.surveys.find((s) => s.id === id);
    if (survey && survey.orgId !== orgId) {
      return null;
    }
    return survey || null;
  },
  insert: async (
    survey: Omit<DBSurvey, "id" | "createdAt"> & {
      createdAt?: Date;
    },
  ) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(survey);
    const newSurvey: DBSurvey = {
      ...survey,
      id: genId("survey"),
      createdAt: survey.createdAt || new Date(),
    };
    store.surveys.push(newSurvey);
    return newSurvey;
  },
  update: async (
    id: string,
    updates: Partial<Omit<DBSurvey, "id" | "orgId">>,
  ) => {
    const _orgId = getActiveOrgId();
    const index = store.surveys.findIndex((s) => s.id === id);
    if (index === -1) return null;
    assertTenantOwns(store.surveys[index]);
    store.surveys[index] = {
      ...store.surveys[index],
      ...updates,
    };
    return store.surveys[index];
  },
};
