import type { HybridSearchResult } from "./index.js";

export interface RerankProvider {
  score(query: string, documents: string[]): Promise<number[]>;
}

/**
 * Format a text context string for a CRM record, combining all key searchable fields
 * and custom fields.
 */
export function formatRecordContext(
  recordType: string,
  record: Record<string, unknown>,
): string {
  const parts: string[] = [];

  if (recordType === "Lead") {
    if (record.firstName) parts.push(String(record.firstName));
    if (record.lastName) parts.push(String(record.lastName));
    if (record.email) parts.push(String(record.email));
    if (record.company) parts.push(String(record.company));
  } else if (recordType === "Account") {
    if (record.name) parts.push(String(record.name));
    if (record.domain) parts.push(String(record.domain));
  } else if (recordType === "Contact") {
    if (record.firstName) parts.push(String(record.firstName));
    if (record.lastName) parts.push(String(record.lastName));
    if (record.email) parts.push(String(record.email));
  } else if (recordType === "Opportunity") {
    if (record.name) parts.push(String(record.name));
    if (record.stage) parts.push(String(record.stage));
  }

  // Handle custom fields metadata safely
  if (record.custom && typeof record.custom === "object") {
    const customObj = record.custom as Record<string, unknown>;
    for (const [key, val] of Object.entries(customObj)) {
      if (val !== undefined && val !== null) {
        parts.push(`${key}: ${val}`);
      }
    }
  }

  return parts.join(" ");
}

/**
 * High-fidelity deterministic mock Cross-Encoder scorer.
 * Evaluates semantic concepts and token overlaps between query and document.
 */
export function createMockRerankProvider(): RerankProvider {
  // Simple conceptual synonym mapping for tests
  const concepts: Record<string, string> = {
    travel: "TRAVEL",
    trip: "TRAVEL",
    journey: "TRAVEL",
    holiday: "TRAVEL",
    vacation: "TRAVEL",
    flight: "TRAVEL",
    hotel: "TRAVEL",
    tour: "TRAVEL",

    finance: "FINANCE",
    financial: "FINANCE",
    tax: "FINANCE",
    accounting: "FINANCE",
    invoice: "FINANCE",
    money: "FINANCE",
    billing: "FINANCE",
    payment: "FINANCE",

    medical: "HEALTHCARE",
    health: "HEALTHCARE",
    clinic: "HEALTHCARE",
    doctor: "HEALTHCARE",
    hospital: "HEALTHCARE",
    wellness: "HEALTHCARE",
    therapy: "HEALTHCARE",

    software: "TECHNOLOGY",
    saas: "TECHNOLOGY",
    code: "TECHNOLOGY",
    programming: "TECHNOLOGY",
    application: "TECHNOLOGY",
    tech: "TECHNOLOGY",
    developer: "TECHNOLOGY",
  };

  return {
    async score(query: string, documents: string[]): Promise<number[]> {
      const qTokens = (query.toLowerCase().match(/[a-z0-9]+/g) ||
        []) as string[];

      const qConcepts = new Set<string>();
      for (const t of qTokens) {
        if (concepts[t]) {
          qConcepts.add(concepts[t]);
        }
      }

      return documents.map((doc) => {
        const docTokens = (doc.toLowerCase().match(/[a-z0-9]+/g) ||
          []) as string[];

        const docConcepts = new Set<string>();
        for (const t of docTokens) {
          if (concepts[t]) {
            docConcepts.add(concepts[t]);
          }
        }

        // Check if there is conceptual overlap
        let conceptMatch = false;
        for (const c of qConcepts) {
          if (docConcepts.has(c)) {
            conceptMatch = true;
            break;
          }
        }

        // Compute direct token overlap percentage
        let overlapCount = 0;
        const uniqueQ = new Set(qTokens);
        for (const qt of uniqueQ) {
          if (docTokens.includes(qt)) {
            overlapCount++;
          }
        }
        const overlapScore = uniqueQ.size > 0 ? overlapCount / uniqueQ.size : 0;

        let finalScore = 0.1;
        if (conceptMatch) {
          finalScore += 0.6; // High semantic conceptual relevance boost
          finalScore += overlapScore * 0.3;
        } else {
          finalScore += overlapScore * 0.4;
        }

        return Math.min(1.0, Math.max(0.0, finalScore));
      });
    },
  };
}

/**
 * Resolves the appropriate Cross-Encoder rerank provider based on env configuration.
 */
export function getSearchRerankProvider(): RerankProvider {
  const processEnv =
    (globalThis as unknown as { process?: { env?: Record<string, string> } })
      .process?.env || {};
  const providerType = processEnv.RERANK_PROVIDER || "mock";

  if (providerType === "cohere") {
    const apiKey = processEnv.COHERE_API_KEY;
    if (apiKey) {
      return {
        async score(query: string, documents: string[]): Promise<number[]> {
          if (documents.length === 0) return [];
          const response = await fetch("https://api.cohere.com/v1/rerank", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: "rerank-english-v3.0",
              query,
              documents,
              top_n: documents.length,
            }),
          });
          if (!response.ok) {
            throw new Error(`Cohere Rerank API failed: ${response.statusText}`);
          }
          interface CohereResponse {
            results: { index: number; relevance_score: number }[];
          }
          const body = (await response.json()) as CohereResponse;
          const scores = new Array<number>(documents.length).fill(0);
          for (const result of body.results) {
            scores[result.index] = result.relevance_score;
          }
          return scores;
        },
      };
    }
  }

  return createMockRerankProvider();
}

/**
 * Refines the top-N results of hybrid search using a Cross-Encoder reranker.
 */
export async function rerankSearchHits(
  query: string,
  hits: HybridSearchResult[],
  options?: { rerankLimit?: number },
): Promise<HybridSearchResult[]> {
  if (hits.length === 0) return [];

  const limit = options?.rerankLimit ?? 5;
  const toRerank = hits.slice(0, limit);
  const remaining = hits.slice(limit);

  try {
    const provider = getSearchRerankProvider();
    const documents = toRerank.map((h) =>
      formatRecordContext(h.recordType, h.record),
    );
    const scores = await provider.score(query, documents);

    const scoredHits = toRerank.map((hit, idx) => ({
      ...hit,
      // Cross-Encoder score overrides standard RRF score for ranking
      score: scores[idx] ?? hit.score,
    }));

    // Sort by new Cross-Encoder scores descending
    scoredHits.sort((a, b) => b.score - a.score);

    return [...scoredHits, ...remaining];
  } catch (error) {
    // Graceful fallback to original RRF candidate order when provider fails
    const processEnv =
      (globalThis as unknown as { process?: { env?: Record<string, string> } })
        .process?.env || {};
    if (processEnv.NODE_ENV !== "test") {
      console.warn(
        "Reranking failed, falling back to standard RRF results:",
        error,
      );
    }
    return hits;
  }
}
