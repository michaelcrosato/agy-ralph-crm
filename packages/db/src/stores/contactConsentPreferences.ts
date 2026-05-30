import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBContactConsentPreference } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const contactConsentPreferencesStore = {
  findMany: async (recordType?: "lead" | "contact", recordId?: string) => {
    const orgId = getActiveOrgId();
    return store.contactConsentPreferences.filter(
      (p) =>
        p.orgId === orgId &&
        (!recordType || p.recordType === recordType) &&
        (!recordId || p.recordId === recordId),
    );
  },
  upsert: async (
    preference: Omit<
      DBContactConsentPreference,
      "id" | "createdAt" | "updatedAt"
    >,
  ) => {
    const orgId = getActiveOrgId();
    assertTenantOwns(preference);
    const existingIndex = store.contactConsentPreferences.findIndex(
      (x) =>
        x.recordType === preference.recordType &&
        x.recordId === preference.recordId &&
        x.channel === preference.channel &&
        x.orgId === orgId,
    );
    const now = new Date();
    if (existingIndex > -1) {
      store.contactConsentPreferences[existingIndex] = {
        ...store.contactConsentPreferences[existingIndex],
        status: preference.status,
        source: preference.source,
        updatedById: preference.updatedById,
        updatedAt: now,
      };
      return store.contactConsentPreferences[existingIndex];
    }
    const newPref: DBContactConsentPreference = {
      ...preference,
      id: genId("consent"),
      createdAt: now,
      updatedAt: now,
    };
    store.contactConsentPreferences.push(newPref);
    return newPref;
  },
};
