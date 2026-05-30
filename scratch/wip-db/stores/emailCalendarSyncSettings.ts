import { genId } from "../_ids";
import { assertTenantOwns } from "../_rls";
import type { DBEmailCalendarSyncSettings } from "../_store";
import { store } from "../_store";
import { getActiveOrgId } from "../_tenant";

export const emailCalendarSyncSettingsStore = {
  findMany: async () => {
    const orgId = getActiveOrgId();
    return store.emailCalendarSyncSettings.filter((s) => s.orgId === orgId);
  },
  findByUser: async (userId: string) => {
    const orgId = getActiveOrgId();
    return (
      store.emailCalendarSyncSettings.find(
        (s) => s.userId === userId && s.orgId === orgId,
      ) || null
    );
  },
  insert: async (
    settings: Omit<
      DBEmailCalendarSyncSettings,
      "id" | "createdAt" | "updatedAt"
    >,
  ) => {
    const _orgId = getActiveOrgId();
    assertTenantOwns(settings);
    const now = new Date();
    const newSettings: DBEmailCalendarSyncSettings = {
      ...settings,
      id: genId("settings"),
      createdAt: now,
      updatedAt: now,
    };
    store.emailCalendarSyncSettings.push(newSettings);
    return newSettings;
  },
  update: async (
    id: string,
    updates: Partial<
      Omit<
        DBEmailCalendarSyncSettings,
        "id" | "orgId" | "userId" | "createdAt" | "updatedAt"
      >
    >,
  ) => {
    const _orgId = getActiveOrgId();
    const index = store.emailCalendarSyncSettings.findIndex((s) => s.id === id);
    if (index === -1) return null;
    assertTenantOwns(store.emailCalendarSyncSettings[index]);
    store.emailCalendarSyncSettings[index] = {
      ...store.emailCalendarSyncSettings[index],
      ...updates,
      updatedAt: new Date(),
    };
    return store.emailCalendarSyncSettings[index];
  },
};
