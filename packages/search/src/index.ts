import type { dbStore as DbStoreType } from "@crm/db";

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

// Support typing distance scoring algorithms (Levenshtein)
export function computeLevenshteinDistance(a: string, b: string): number {
  const lenA = a.length;
  const lenB = b.length;
  if (lenA === 0) return lenB;
  if (lenB === 0) return lenA;

  const matrix: number[][] = [];
  for (let i = 0; i <= lenA; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= lenB; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= lenA; i++) {
    for (let j = 1; j <= lenB; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost, // substitution
      );
    }
  }
  return matrix[lenA][lenB];
}

// Compute word-by-word or global Levenshtein similarity to handle typing distance scoring with typing fuzziness
export function computeLevenshteinSimilarity(a: string, b: string): number {
  const cleanA = a.toLowerCase().trim();
  const cleanB = b.toLowerCase().trim();
  if (!cleanA && !cleanB) return 1;
  if (!cleanA || !cleanB) return 0;
  const distance = computeLevenshteinDistance(cleanA, cleanB);
  const maxLength = Math.max(cleanA.length, cleanB.length);
  return maxLength > 0 ? 1 - distance / maxLength : 0;
}

// Handle multi-word search fields gracefully by evaluating Levenshtein similarity on word boundaries
export function computeFuzzyWordLevenshteinSimilarity(
  fieldVal: string,
  query: string,
): number {
  const queryClean = query.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!queryClean) return 0;

  const words = fieldVal
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9]/g, ""))
    .filter(Boolean);
  if (words.length === 0) return 0;

  let maxWordSim = 0;
  for (const word of words) {
    const distance = computeLevenshteinDistance(word, queryClean);
    const maxLength = Math.max(word.length, queryClean.length);
    const sim = maxLength > 0 ? 1 - distance / maxLength : 0;
    if (sim > maxWordSim) {
      maxWordSim = sim;
    }
  }

  // Also calculate global Levenshtein similarity for exact or complete-phrase matching
  const globalFieldClean = fieldVal.toLowerCase().replace(/[^a-z0-9]/g, "");
  const globalDistance = computeLevenshteinDistance(
    globalFieldClean,
    queryClean,
  );
  const globalMaxLength = Math.max(globalFieldClean.length, queryClean.length);
  const globalSim =
    globalMaxLength > 0 ? 1 - globalDistance / globalMaxLength : 0;

  return Math.max(maxWordSim, globalSim);
}

// Combine trigram Jaccard and Levenshtein similarity indices
export function computeHybridSimilarity(
  fieldVal: string,
  query: string,
): number {
  const trigramSim = computeTrigramSimilarity(fieldVal, query);
  const levSimRaw = computeFuzzyWordLevenshteinSimilarity(fieldVal, query);
  // Apply a minimum similarity threshold for Levenshtein typo-matching (e.g. 0.70)
  // to avoid false-positive matches for totally different words.
  const levSim = levSimRaw >= 0.7 ? levSimRaw : 0;
  return Math.max(trigramSim, levSim);
}

// High-Performance Trigram Matching Index
export class TrigramIndex<T extends Record<string, unknown>> {
  private index = new Map<string, Set<number>>();
  private records: T[] = [];
  private searchFields: string[];

  constructor(records: T[], searchFields: string[]) {
    this.records = records;
    this.searchFields = searchFields;
    this.buildIndex();
  }

  private buildIndex() {
    for (let i = 0; i < this.records.length; i++) {
      const rec = this.records[i];
      for (const field of this.searchFields) {
        let val = rec[field];
        if (val === undefined && rec.custom && typeof rec.custom === "object") {
          const customObj = rec.custom as Record<string, unknown>;
          val = customObj[field];
        }
        if (val !== undefined && val !== null) {
          const trigrams = generateTrigrams(String(val));
          for (const tg of trigrams) {
            if (!this.index.has(tg)) {
              this.index.set(tg, new Set());
            }
            this.index.get(tg)?.add(i);
          }
        }
      }
    }
  }

  public search(
    query: string,
    threshold = 0.1,
  ): { record: T; score: number }[] {
    if (!query) {
      return this.records.map((r) => ({ record: r, score: 1 }));
    }

    const queryTrigrams = generateTrigrams(query);
    if (queryTrigrams.length === 0) {
      return [];
    }

    const candidateIndices = new Set<number>();
    for (const tg of queryTrigrams) {
      const matched = this.index.get(tg);
      if (matched) {
        for (const idx of matched) {
          candidateIndices.add(idx);
        }
      }
    }

    const results: { record: T; score: number }[] = [];
    for (const idx of candidateIndices) {
      const rec = this.records[idx];
      let maxScore = 0;
      for (const field of this.searchFields) {
        let val = rec[field];
        if (val === undefined && rec.custom && typeof rec.custom === "object") {
          const customObj = rec.custom as Record<string, unknown>;
          val = customObj[field];
        }
        if (val !== undefined && val !== null) {
          const score = computeHybridSimilarity(String(val), query);
          if (score > maxScore) {
            maxScore = score;
          }
        }
      }
      if (maxScore >= threshold) {
        results.push({ record: rec, score: maxScore });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results;
  }
}

// Search across a list of records for a query string, returning matched items sorted by score using high-performance index
export function fuzzySearchRecords(
  records: Record<string, unknown>[],
  query: string,
  searchFields: string[],
  threshold = 0.1,
): { record: Record<string, unknown>; score: number }[] {
  const index = new TrigramIndex(records, searchFields);
  return index.search(query, threshold);
}

export interface GlobalSearchOptions {
  types?: ("Lead" | "Account" | "Contact" | "Opportunity")[];
  threshold?: number;
  dbStore: typeof DbStoreType;
}

export async function globalFuzzySearch(
  query: string,
  options: GlobalSearchOptions,
): Promise<SearchResult[]> {
  const targetTypes = options.types || [
    "Lead",
    "Account",
    "Contact",
    "Opportunity",
  ];
  const threshold = options.threshold ?? 0.1;
  const dbStore = options.dbStore;

  const results: SearchResult[] = [];

  // Fetch all field definitions to find searchable custom fields dynamically
  const fieldDefs = await dbStore.fieldDefinitions.findMany().catch(() => []);

  const getSearchFields = (objType: string, baseFields: string[]): string[] => {
    const customFields = fieldDefs
      .filter(
        (def) =>
          def.objectType === objType &&
          (def.dataType === "text" || def.dataType === "picklist"),
      )
      .map((def) => def.apiName);
    return [...baseFields, ...customFields];
  };

  if (targetTypes.includes("Lead")) {
    const leads = await dbStore.leads.findMany();
    const searchFields = getSearchFields("leads", ["email", "company"]);
    const matched = fuzzySearchRecords(
      leads as unknown as Record<string, unknown>[],
      query,
      searchFields,
      threshold,
    );
    for (const m of matched) {
      results.push({
        record: m.record,
        recordType: "Lead",
        score: m.score,
      });
    }
  }

  if (targetTypes.includes("Account")) {
    const accounts = await dbStore.accounts.findMany();
    const searchFields = getSearchFields("accounts", ["name", "domain"]);
    const matched = fuzzySearchRecords(
      accounts as unknown as Record<string, unknown>[],
      query,
      searchFields,
      threshold,
    );
    for (const m of matched) {
      results.push({
        record: m.record,
        recordType: "Account",
        score: m.score,
      });
    }
  }

  if (targetTypes.includes("Contact")) {
    const contacts = await dbStore.contacts.findMany();
    const searchFields = getSearchFields("contacts", [
      "firstName",
      "lastName",
      "email",
    ]);
    const matched = fuzzySearchRecords(
      contacts as unknown as Record<string, unknown>[],
      query,
      searchFields,
      threshold,
    );
    for (const m of matched) {
      results.push({
        record: m.record,
        recordType: "Contact",
        score: m.score,
      });
    }
  }

  if (targetTypes.includes("Opportunity")) {
    const opportunities = await dbStore.opportunities.findMany();
    const searchFields = getSearchFields("opportunities", ["stage"]);
    const matched = fuzzySearchRecords(
      opportunities as unknown as Record<string, unknown>[],
      query,
      searchFields,
      threshold,
    );
    for (const m of matched) {
      results.push({
        record: m.record,
        recordType: "Opportunity",
        score: m.score,
      });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}

export interface HybridSearchOptions extends GlobalSearchOptions {
  limit?: number;
}

export interface HybridSearchResult extends SearchResult {
  rrfScore: number;
}

export function getSearchEmbeddingProvider() {
  const processEnv = (globalThis as any).process?.env || {};
  const providerType = processEnv.EMBEDDINGS_PROVIDER || "mock";
  if (providerType === "openai") {
    const apiKey = processEnv.OPENAI_API_KEY;
    if (apiKey) {
      return {
        dimensions: 1536,
        async embed(text: string): Promise<number[]> {
          const response = await fetch("https://api.openai.com/v1/embeddings", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              input: text,
              model: "text-embedding-3-small",
            }),
          });
          if (!response.ok) {
            throw new Error(`OpenAI API failed: ${response.statusText}`);
          }
          const body = (await response.json()) as any;
          return body.data[0].embedding;
        },
      };
    }
  }
  return {
    dimensions: 1536,
    async embed(text: string): Promise<number[]> {
      const { createMockEmbeddingProvider } = await import("./semantic.js");
      return createMockEmbeddingProvider(1536).embed(text);
    },
  };
}

export async function globalHybridSearch(
  query: string,
  options: HybridSearchOptions,
): Promise<HybridSearchResult[]> {
  const targetTypes = options.types || [
    "Lead",
    "Account",
    "Contact",
    "Opportunity",
  ];
  const dbStore = options.dbStore;
  const limit = options.limit ?? 10;

  // 1. Perform Lexical Fuzzy Search
  const lexicalResults = await globalFuzzySearch(query, options);

  // 2. Perform Semantic Search
  const { getActiveOrgId } = await import("@crm/db");
  const orgId = getActiveOrgId();

  const provider = getSearchEmbeddingProvider();
  const queryVector = await provider.embed(query);

  const allEmbeddings = await dbStore.embeddings.findMany();
  const filtered = allEmbeddings.filter(
    (e: any) => e.orgId === orgId && targetTypes.includes(e.entityType as any),
  );

  const { cosineSimilarity } = await import("./semantic.js");
  const semanticHits = filtered
    .map((e: any) => ({
      entityId: e.entityId,
      entityType: e.entityType as
        | "Lead"
        | "Account"
        | "Contact"
        | "Opportunity",
      score: cosineSimilarity(queryVector as number[], e.embedding),
    }))
    .sort((a, b) => b.score - a.score);

  // 3. Map ranks for Reciprocal Rank Fusion (RRF)
  const rankMap = new Map<
    string,
    {
      record: Record<string, unknown>;
      recordType: string;
      lexicalRank?: number;
      semanticRank?: number;
    }
  >();

  // Add lexical ranks
  lexicalResults.forEach((res, index) => {
    const key = `${res.recordType}::${res.record.id}`;
    rankMap.set(key, {
      record: res.record,
      recordType: res.recordType,
      lexicalRank: index + 1,
    });
  });

  // Add semantic ranks
  for (let index = 0; index < semanticHits.length; index++) {
    const hit = semanticHits[index];
    const key = `${hit.entityType}::${hit.entityId}`;
    let existing = rankMap.get(key);
    if (!existing) {
      let record: any = null;
      if (hit.entityType === "Account") {
        record = await dbStore.accounts.findOne(hit.entityId);
      } else if (hit.entityType === "Contact") {
        record = await dbStore.contacts.findOne(hit.entityId);
      } else if (hit.entityType === "Lead") {
        record = await dbStore.leads.findOne(hit.entityId);
      } else if (hit.entityType === "Opportunity") {
        record = await dbStore.opportunities.findOne(hit.entityId);
      }
      if (record) {
        existing = {
          record: record as Record<string, unknown>,
          recordType: hit.entityType,
          semanticRank: index + 1,
        };
        rankMap.set(key, existing);
      }
    } else {
      existing.semanticRank = index + 1;
    }
  }

  // 4. Compute RRF Scores
  const k = 60;
  const fusedResults: HybridSearchResult[] = [];
  for (const [_, val] of rankMap.entries()) {
    const lexicalRank = val.lexicalRank;
    const semanticRank = val.semanticRank;

    const rrfScore =
      (lexicalRank ? 1.0 / (k + lexicalRank) : 0.0) +
      (semanticRank ? 1.0 / (k + semanticRank) : 0.0);

    fusedResults.push({
      record: val.record,
      recordType: val.recordType as any,
      score: rrfScore,
      rrfScore,
    });
  }

  // Sort and limit
  fusedResults.sort((a, b) => b.rrfScore - a.rrfScore);
  return fusedResults.slice(0, limit);
}

export * from "./semantic.js";
