import { createSessionToken } from "@crm/auth";
import { dbStore, mockDb, withTenant } from "@crm/db";
import {
  TrigramIndex,
  computeLevenshteinDistance,
  computeLevenshteinSimilarity,
  computeTrigramSimilarity,
  fuzzySearchRecords,
  generateTrigrams,
  globalFuzzySearch,
} from "@crm/search";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../../../apps/api/src/index";

describe("Trigram Fuzzy Search Core Engine Tests", () => {
  it("should successfully split strings into normalized trigrams", () => {
    const trigrams = generateTrigrams("Okta");
    expect(trigrams.length).toBe(6);
    expect(trigrams).toContain("okt");
    expect(trigrams).toContain("kta");
  });

  it("should correctly compute similarity coefficients between strings", () => {
    const simExact = computeTrigramSimilarity(
      "Single Sign On",
      "Single Sign On",
    );
    expect(simExact).toBe(1.0);

    const simClose = computeTrigramSimilarity("Database Backups", "db backups");
    expect(simClose).toBeGreaterThan(0.2);

    const simDifferent = computeTrigramSimilarity(
      "Billing Dispute",
      "Okta Integration",
    );
    expect(simDifferent).toBeLessThan(0.1);
  });

  it("should handle empty or punctuation-only strings robustly without false matches", () => {
    const emptyTrigrams = generateTrigrams("");
    expect(emptyTrigrams.length).toBe(0);

    const punctTrigrams = generateTrigrams("!!! @#$");
    expect(punctTrigrams.length).toBe(0);

    const simEmpty = computeTrigramSimilarity("!!!", "@@@");
    expect(simEmpty).toBe(0);

    const simPunctToText = computeTrigramSimilarity("!!!", "Database");
    expect(simPunctToText).toBe(0);
  });

  it("should dynamically search and rank records based on fuzzy matching scores", () => {
    const records = [
      { id: "1", name: "Acme Enterprise Software", industry: "SaaS" },
      { id: "2", name: "Apex Health System", industry: "Healthcare" },
      { id: "3", name: "Okta Identity Management", industry: "Security" },
    ];

    const resultsName = fuzzySearchRecords(records, "enterprise", ["name"]);
    expect(resultsName.length).toBe(1);
    expect(resultsName[0].record.id).toBe("1");
    expect(resultsName[0].score).toBeGreaterThan(0.3);

    const resultsIndustry = fuzzySearchRecords(records, "saas", ["industry"]);
    expect(resultsIndustry.length).toBe(1);
    expect(resultsIndustry[0].record.id).toBe("1");
  });
});

describe("Global Multi-Field Trigram Search Integration & RLS Tests", () => {
  let tokenTenantA: string;
  let tokenTenantB: string;

  const orgA = "org-tenant-a";
  const orgB = "org-tenant-b";

  beforeEach(async () => {
    dbStore.clear();

    tokenTenantA = await createSessionToken({
      userId: "user-a",
      orgId: orgA,
      roleId: "role-a",
      permissionsMask: 7,
    });

    tokenTenantB = await createSessionToken({
      userId: "user-b",
      orgId: orgB,
      roleId: "role-b",
      permissionsMask: 7,
    });

    // Seed Tenant A records
    await withTenant(orgA, mockDb, async () => {
      await dbStore.leads.insert({
        orgId: orgA,
        ownerId: "user-a",
        status: "New",
        email: "lead.alpha@example.com",
        company: "Alpha Innovators",
        convertedAccountId: null,
        convertedContactId: null,
        custom: null,
      });

      await dbStore.accounts.insert({
        orgId: orgA,
        ownerId: "user-a",
        name: "Acme Corp Ltd",
        domain: "acme.com",
        custom: null,
      });

      await dbStore.contacts.insert({
        orgId: orgA,
        ownerId: "user-a",
        accountId: null,
        firstName: "Jane",
        lastName: "Doe",
        email: "jane.doe@acme.com",
        custom: null,
      });

      await dbStore.opportunities.insert({
        orgId: orgA,
        ownerId: "user-a",
        accountId: null,
        name: "Enterprise Software License Deal",
        stage: "Negotiation Stage",
        amount: "50000.00",
        closeDate: null,
        custom: null,
      });
    });

    // Seed Tenant B records (similar names to ensure matching works but RLS partitions)
    await withTenant(orgB, mockDb, async () => {
      await dbStore.accounts.insert({
        orgId: orgB,
        ownerId: "user-b",
        name: "Acme Partners Inc",
        domain: "acmepartners.com",
        custom: null,
      });
    });
  });

  describe("Tenant RLS Isolation on global search", () => {
    it("should query across multiple entity types under Tenant A context", async () => {
      await withTenant(orgA, mockDb, async () => {
        // Query "Acme" -> matches Jane Doe's email and Acme Corp Ltd
        const searchResults = await globalFuzzySearch("acme", { dbStore });
        expect(searchResults.length).toBeGreaterThanOrEqual(2);

        const recordTypes = searchResults.map((r) => r.recordType);
        expect(recordTypes).toContain("Account");
        expect(recordTypes).toContain("Contact");

        // The Account match should be Acme Corp Ltd, not Acme Partners Inc
        const accountMatch = searchResults.find(
          (r) => r.recordType === "Account",
        );
        expect(accountMatch?.record.name).toBe("Acme Corp Ltd");

        // Verify that B's account is absolutely NOT returned to A
        const bAccountMatch = searchResults.find(
          (r) => r.record.name === "Acme Partners Inc",
        );
        expect(bAccountMatch).toBeUndefined();
      });
    });

    it("should throw error if global search is called without active tenant context", async () => {
      await expect(globalFuzzySearch("acme", { dbStore })).rejects.toThrow(
        "RLS Isolation Violation",
      );
    });
  });

  describe("Custom fields searching support", () => {
    it("should match based on picklist and text custom fields defined on the active tenant", async () => {
      await withTenant(orgA, mockDb, async () => {
        // 1. Create a custom field definition for Accounts
        await dbStore.fieldDefinitions.insert({
          orgId: orgA,
          objectType: "accounts",
          apiName: "nickname",
          label: "Nickname",
          dataType: "text",
          validationRules: null,
        });

        // 2. Create an account with nickname "Bigtrip"
        await dbStore.accounts.insert({
          orgId: orgA,
          ownerId: "user-a",
          name: "Trip Software Inc",
          domain: "trip.com",
          custom: { nickname: "Bigtrip" },
        });

        // 3. Search for "Bigtrip" -> should match our new account
        const searchResults = await globalFuzzySearch("bigtrip", { dbStore });
        expect(searchResults.length).toBe(1);
        expect(searchResults[0].recordType).toBe("Account");
        expect(searchResults[0].record.name).toBe("Trip Software Inc");
      });
    });
  });

  describe("API Route Integration GET /api/search", () => {
    it("should enforce authentication on search API", async () => {
      const res = await app.request("/api/search?q=acme", {
        method: "GET",
      });
      expect(res.status).toBe(401);
    });

    it("should fetch ranked and isolated matches for Tenant A", async () => {
      const res = await app.request("/api/search?q=acme", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.length).toBeGreaterThanOrEqual(2);
      expect(body.data[0].score).toBeGreaterThanOrEqual(body.data[1].score);

      // Verify strict separation
      const names = body.data.map(
        (r: { record: { name?: string; firstName?: string } }) =>
          r.record.name || r.record.firstName,
      );
      expect(names).toContain("Acme Corp Ltd");
      expect(names).not.toContain("Acme Partners Inc");
    });

    it("should filter by type if types parameter is provided", async () => {
      const res = await app.request("/api/search?q=acme&types=Contact", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(
        body.data.every(
          (r: { recordType: string }) => r.recordType === "Contact",
        ),
      ).toBe(true);
    });
  });

  describe("API Route Integration GET /api/search/fuzzy", () => {
    it("should enforce authentication on fuzzy search API", async () => {
      const res = await app.request("/api/search/fuzzy?q=acme", {
        method: "GET",
      });
      expect(res.status).toBe(401);
    });

    it("should fetch ranked and isolated matches for Tenant A on fuzzy search", async () => {
      const res = await app.request("/api/search/fuzzy?q=acme", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.length).toBeGreaterThanOrEqual(2);

      // Verify strict separation
      const names = body.data.map(
        (r: { record: { name?: string; firstName?: string } }) =>
          r.record.name || r.record.firstName,
      );
      expect(names).toContain("Acme Corp Ltd");
      expect(names).not.toContain("Acme Partners Inc");
    });

    it("should handle partial casing and slight typo matches using hybrid Levenshtein search", async () => {
      // "Acme" with slight typo: "acmee" or "acm"
      const res = await app.request("/api/search/fuzzy?q=acmee", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenTenantA}`,
        },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.length).toBeGreaterThanOrEqual(1);
      expect(body.data[0].record.name).toBe("Acme Corp Ltd");
    });
  });

  describe("Direct Levenshtein Distance & TrigramIndex Unit Tests", () => {
    it("should compute exact Levenshtein distances correctly", () => {
      expect(computeLevenshteinDistance("kitten", "sitting")).toBe(3);
      expect(computeLevenshteinDistance("book", "back")).toBe(2);
      expect(computeLevenshteinDistance("acme", "acme")).toBe(0);
      expect(computeLevenshteinDistance("", "test")).toBe(4);
    });

    it("should compute Levenshtein similarity percentages accurately", () => {
      expect(computeLevenshteinSimilarity("acme", "acme")).toBe(1.0);
      expect(computeLevenshteinSimilarity("acme", "acmee")).toBe(0.8); // distance 1, max len 5
      expect(computeLevenshteinSimilarity("acme", "xyz")).toBe(0.0);
    });

    it("should successfully build and query a TrigramIndex directly", () => {
      const records = [
        { id: "1", name: "Apple Inc", category: "Tech" },
        { id: "2", name: "Banana Corp", category: "Fruit" },
      ];
      const index = new TrigramIndex(records, ["name", "category"]);

      const searchFruit = index.search("Fruit");
      expect(searchFruit.length).toBe(1);
      expect(searchFruit[0].record.id).toBe("2");

      const searchAppleTypo = index.search("aple"); // slight typo
      expect(searchAppleTypo.length).toBe(1);
      expect(searchAppleTypo[0].record.id).toBe("1");
    });
  });
});
