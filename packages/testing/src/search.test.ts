import {
  computeTrigramSimilarity,
  fuzzySearchRecords,
  generateTrigrams,
} from "@crm/search";
import { describe, expect, it } from "vitest";

describe("Trigram Fuzzy Search Core Engine Tests", () => {
  it("should successfully split strings into normalized trigrams", () => {
    const trigrams = generateTrigrams("Okta");
    // "okta" normalized is "  okta  "
    // Trigrams: "  o", " ok", "okt", "kta", "ta ", "a  "
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

    // Search query matches Acme Enterprise Software most closely
    const resultsName = fuzzySearchRecords(records, "enterprise", ["name"]);
    expect(resultsName.length).toBe(1);
    expect(resultsName[0].record.id).toBe("1");
    expect(resultsName[0].score).toBeGreaterThan(0.3);

    // Search query matches SaaS industry
    const resultsIndustry = fuzzySearchRecords(records, "saas", ["industry"]);
    expect(resultsIndustry.length).toBe(1);
    expect(resultsIndustry[0].record.id).toBe("1");

    // Search query matches Security and SaaS slightly due to letter groupings
    const resultsFuzzy = fuzzySearchRecords(records, "saas", [
      "name",
      "industry",
    ]);
    expect(resultsFuzzy.length).toBeGreaterThanOrEqual(1);
  });
});
