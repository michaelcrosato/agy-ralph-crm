import { dbStore, JsonbValidationError, mockDb, withTenant } from "@crm/db";
import { beforeEach, describe, expect, it } from "vitest";

describe("JSONB Runtime Validation (spec 025)", () => {
  const tenantId = "org-validation-test";
  const userId = "user-validation-test";

  beforeEach(async () => {
    // Clear database before each test
    await dbStore.clear();
  });

  it("should validate and succeed on valid payloads, and reject invalid ones for Leads, Accounts, and Opportunities", async () => {
    await withTenant(tenantId, mockDb, async () => {
      // 1. Seed custom field definitions
      // Lead custom text field
      await dbStore.fieldDefinitions.insert({
        orgId: tenantId,
        objectType: "leads",
        apiName: "custom_text",
        label: "Custom Text",
        dataType: "text",
      });

      // Account custom number field with validation rules (min: 10, max: 100)
      await dbStore.fieldDefinitions.insert({
        orgId: tenantId,
        objectType: "accounts",
        apiName: "custom_num",
        label: "Custom Number",
        dataType: "number",
        validationRules: { min: 10, max: 100 },
      });

      // Opportunity custom picklist field with options
      await dbStore.fieldDefinitions.insert({
        orgId: tenantId,
        objectType: "opportunities",
        apiName: "custom_pick",
        label: "Custom Picklist",
        dataType: "picklist",
        validationRules: { options: ["OptionA", "OptionB"] },
      });

      // --- TEST LEADS ---
      // A. Valid lead insert -> Success
      const validLead = await dbStore.leads.insert({
        orgId: tenantId,
        ownerId: userId,
        status: "New",
        email: "test@lead.com",
        company: "Acme",
        convertedAccountId: null,
        convertedContactId: null,
        custom: { custom_text: "Hello World" },
      });
      expect(validLead).toBeDefined();

      // B. Invalid lead insert (custom_text is number instead of string) -> Throw JsonbValidationError
      await expect(
        dbStore.leads.insert({
          orgId: tenantId,
          ownerId: userId,
          status: "New",
          email: "test@lead.com",
          company: "Acme",
          convertedAccountId: null,
          convertedContactId: null,
          custom: { custom_text: 42 },
        }),
      ).rejects.toThrow(JsonbValidationError);

      // --- TEST ACCOUNTS ---
      // A. Valid account insert -> Success
      const validAcc = await dbStore.accounts.insert({
        orgId: tenantId,
        ownerId: userId,
        name: "Acme Account",
        parentAccountId: null,
        custom: { custom_num: 50 },
      });
      expect(validAcc).toBeDefined();

      // B. Invalid account insert (custom_num is less than min) -> Throw
      await expect(
        dbStore.accounts.insert({
          orgId: tenantId,
          ownerId: userId,
          name: "Acme Account",
          parentAccountId: null,
          custom: { custom_num: 5 },
        }),
      ).rejects.toThrow(JsonbValidationError);

      // C. Invalid account insert (custom_num is greater than max) -> Throw
      await expect(
        dbStore.accounts.insert({
          orgId: tenantId,
          ownerId: userId,
          name: "Acme Account",
          parentAccountId: null,
          custom: { custom_num: 150 },
        }),
      ).rejects.toThrow(JsonbValidationError);

      // --- TEST OPPORTUNITIES ---
      // A. Valid opp insert -> Success
      const validOpp = await dbStore.opportunities.insert({
        orgId: tenantId,
        ownerId: userId,
        name: "Acme Opp",
        stage: "Qualification",
        amount: "5000.00",
        amountCorporate: "5000.00",
        currencyCode: "USD",
        accountId: null,
        custom: { custom_pick: "OptionA" },
      });
      expect(validOpp).toBeDefined();

      // B. Invalid opp insert (custom_pick value is not in options) -> Throw
      await expect(
        dbStore.opportunities.insert({
          orgId: tenantId,
          ownerId: userId,
          name: "Acme Opp",
          stage: "Qualification",
          amount: "5000.00",
          amountCorporate: "5000.00",
          currencyCode: "USD",
          accountId: null,
          custom: { custom_pick: "OptionC" },
        }),
      ).rejects.toThrow(JsonbValidationError);
    });
  });
});
