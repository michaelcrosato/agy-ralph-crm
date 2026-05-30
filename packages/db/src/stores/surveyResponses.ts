import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBSurveyResponse } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const surveyResponsesStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.surveyResponses.filter((r) => r.orgId === orgId);
  },
  findBySurvey: async (surveyId: string) => {
    const orgId = getActiveOrgId();
    return store.surveyResponses.filter(
      (r) => r.surveyId === surveyId && r.orgId === orgId,
    );
  },
  findByTicket: async (ticketId: string) => {
    const orgId = getActiveOrgId();
    return store.surveyResponses.filter(
      (r) => r.ticketId === ticketId && r.orgId === orgId,
    );
  },
  insert: async (
    res: Omit<DBSurveyResponse, "id" | "createdAt"> & {
      createdAt?: Date;
    },
  ) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(res);
    const newRes: DBSurveyResponse = {
      ...res,
      ticketId: res.ticketId || null,
      id: genId("sres"),
      createdAt: res.createdAt || new Date(),
    };
    store.surveyResponses.push(newRes);
    return newRes;
  },
};
