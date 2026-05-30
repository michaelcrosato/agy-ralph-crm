/**
 * Semantic-search layer (spec 036) — the vector math + a deterministic mock
 * embedding provider, transport- and storage-agnostic.
 *
 * The pgvector table, HNSW index, embedder worker, and `/api/search/semantic`
 * route wire on top of this; tests use the mock provider (no credentials, no PG).
 */

export interface EmbeddingProvider {
  readonly dimensions: number;
  embed(text: string): number[];
}

export interface SemanticDoc {
  id: string;
  text: string;
  metadata?: Record<string, unknown>;
}

export interface SemanticHit {
  id: string;
  score: number;
  metadata?: Record<string, unknown>;
}

/** Cosine similarity in [-1, 1]; 0 when either vector has zero magnitude. */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`vector length mismatch: ${a.length} vs ${b.length}`);
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Deterministic offline embedding provider: the same text always maps to the
 * same unit vector (FNV-1a seed → mulberry32 PRNG → L2-normalized). Suitable for
 * tests and as the `EMBEDDINGS_PROVIDER=mock` default.
 */
export function createMockEmbeddingProvider(
  dimensions = 1536,
): EmbeddingProvider {
  return {
    dimensions,
    embed(text: string): number[] {
      let seed = 2166136261 >>> 0;
      for (let i = 0; i < text.length; i++) {
        seed ^= text.charCodeAt(i);
        seed = Math.imul(seed, 16777619) >>> 0;
      }
      const vector = new Array<number>(dimensions);
      let norm = 0;
      let state = seed >>> 0;
      for (let i = 0; i < dimensions; i++) {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        const value = r * 2 - 1;
        vector[i] = value;
        norm += value * value;
      }
      const magnitude = Math.sqrt(norm) || 1;
      for (let i = 0; i < dimensions; i++) vector[i] /= magnitude;
      return vector;
    },
  };
}

/** Rank a corpus against a query by cosine similarity, highest first. */
export function semanticSearch(
  provider: EmbeddingProvider,
  query: string,
  corpus: SemanticDoc[],
  limit = 10,
): SemanticHit[] {
  const queryVector = provider.embed(query);
  return corpus
    .map((doc) => ({
      id: doc.id,
      score: cosineSimilarity(queryVector, provider.embed(doc.text)),
      metadata: doc.metadata,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(0, limit));
}

/** In-memory ANN stand-in: precomputed vectors searched by cosine (mirrors the pgvector path). */
export class VectorIndex {
  private readonly entries: {
    id: string;
    vector: number[];
    metadata?: Record<string, unknown>;
  }[] = [];

  add(id: string, vector: number[], metadata?: Record<string, unknown>): void {
    this.entries.push({ id, vector, metadata });
  }

  search(query: number[], limit = 10): SemanticHit[] {
    return this.entries
      .map((entry) => ({
        id: entry.id,
        score: cosineSimilarity(query, entry.vector),
        metadata: entry.metadata,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(0, limit));
  }

  get size(): number {
    return this.entries.length;
  }
}
