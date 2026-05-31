export interface EnrichedAIAttributes {
  aiSummary: string;
  icpScore: number;
  competitorMentions: string[];
}

/**
 * Deterministic offline AI enrichment rule engine for Contacts and Leads.
 * Evaluates record properties to compute aiSummary, icpScore, and competitorMentions.
 */
export function enrichRecordAttributes(
  entityType: string,
  record: any,
): EnrichedAIAttributes {
  const custom = record.custom || {};
  const email = (record.email || "").toLowerCase();
  const firstName = record.firstName || "";
  const lastName = record.lastName || "";
  const name = record.name || `${firstName} ${lastName}`.trim() || "Unknown";
  const company = (record.company || record.name || "").toLowerCase();

  // 1. Synthesize aiSummary
  let summary = "";
  if (entityType.toLowerCase() === "lead") {
    const status = record.status || "Open";
    summary = `Enriched Lead: ${name} at ${record.company || "Unknown Company"}, status is ${status}.`;
  } else if (entityType.toLowerCase() === "contact") {
    summary = `Enriched Contact: ${name} (email: ${email || "unspecified"}).`;
  } else {
    summary = `Enriched ${entityType}: ${name}.`;
  }

  // Add notes or other custom fields if present
  if (custom.notes) {
    summary += ` Notes: ${custom.notes}`;
  }

  // 2. Compute icpScore (0 to 100)
  let icpScore = 50; // default baseline

  const isTechDomain =
    email.endsWith(".tech") ||
    email.endsWith(".io") ||
    email.endsWith(".ai") ||
    email.endsWith(".co");
  const isPersonalDomain =
    email.endsWith("gmail.com") ||
    email.endsWith("yahoo.com") ||
    email.endsWith("hotmail.com");

  if (isTechDomain) {
    icpScore += 25;
  } else if (isPersonalDomain) {
    icpScore -= 15;
  }

  const companyKeywords = [
    "software",
    "tech",
    "saas",
    "finance",
    "systems",
    "ai",
    "solutions",
  ];
  const isTechCompany = companyKeywords.some((keyword) =>
    company.includes(keyword),
  );

  if (isTechCompany) {
    icpScore += 20;
  }

  const lowIcpKeywords = ["retail", "hobby", "shop", "local", "store"];
  const isLowIcp = lowIcpKeywords.some((keyword) => company.includes(keyword));

  if (isLowIcp) {
    icpScore -= 20;
  }

  // Clamp score between 0 and 100
  icpScore = Math.max(0, Math.min(100, icpScore));

  // 3. Extract competitorMentions
  const competitors = [
    { key: "hubspot", display: "HubSpot" },
    { key: "salesforce", display: "Salesforce" },
    { key: "twenty", display: "Twenty" },
    { key: "pipedrive", display: "Pipedrive" },
    { key: "zoho", display: "Zoho" },
  ];

  const competitorMentions: string[] = [];
  const textToScan =
    `${company} ${email} ${name} ${custom.notes || ""} ${record.status || ""}`.toLowerCase();

  for (const comp of competitors) {
    if (textToScan.includes(comp.key)) {
      competitorMentions.push(comp.display);
    }
  }

  return {
    aiSummary: summary,
    icpScore,
    competitorMentions,
  };
}
