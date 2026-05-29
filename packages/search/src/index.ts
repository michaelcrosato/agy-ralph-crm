export const SEARCH_VERSION = "0.1.0";

export interface SearchResult {
  record: Record<string, unknown>;
  recordType:
    | "Lead"
    | "Account"
    | "Contact"
    | "Opportunity"
    | "Ticket"
    | "Activity";
  score: number;
}

// Helper to generate trigrams for a string
export function generateTrigrams(str: string): string[] {
  const cleaned = str.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!cleaned) return [];
  const normalized = `  ${cleaned}  `;
  const trigrams: string[] = [];
  for (let i = 0; i < normalized.length - 2; i++) {
    trigrams.push(normalized.substring(i, i + 3));
  }
  return trigrams;
}

// Compute Jaccard similarity index based on trigram intersection
export function computeTrigramSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const trigramsA = new Set(generateTrigrams(a));
  const trigramsB = new Set(generateTrigrams(b));

  const intersection = new Set([...trigramsA].filter((x) => trigramsB.has(x)));
  const union = new Set([...trigramsA, ...trigramsB]);

  return union.size > 0 ? intersection.size / union.size : 0;
}

// Search across a list of records for a query string, returning matched items sorted by score
export function fuzzySearchRecords(
  records: Record<string, unknown>[],
  query: string,
  searchFields: string[],
  threshold = 0.1,
): { record: Record<string, unknown>; score: number }[] {
  if (!query) {
    return records.map((r) => ({ record: r, score: 1 }));
  }

  const results = records
    .map((rec) => {
      let maxScore = 0;
      for (const field of searchFields) {
        let val = rec[field];
        if (val === undefined && rec.custom && typeof rec.custom === "object") {
          const customObj = rec.custom as Record<string, unknown>;
          val = customObj[field];
        }
        if (val !== undefined && val !== null) {
          const score = computeTrigramSimilarity(String(val), query);
          if (score > maxScore) {
            maxScore = score;
          }
        }
      }
      return { record: rec, score: maxScore };
    })
    .filter((res) => res.score >= threshold);

  results.sort((a, b) => b.score - a.score);

  return results;
}
