import {
  cosineSimilarity,
  createMockEmbeddingProvider,
  semanticSearch,
  VectorIndex,
} from "@crm/search";
import { describe, expect, it } from "vitest";

describe("Spec 036: semantic search vector core", () => {
  it("computes cosine similarity (identical=1, orthogonal=0, opposite=-1)", () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 10);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 10);
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1, 10);
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
  });

  it("mock provider is deterministic, unit-norm, correct dimensions", () => {
    const p = createMockEmbeddingProvider(64);
    const a = p.embed("Acme Corp");
    const b = p.embed("Acme Corp");
    const c = p.embed("Globex");
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    expect(a.length).toBe(64);
    const norm = Math.sqrt(a.reduce((s, x) => s + x * x, 0));
    expect(norm).toBeCloseTo(1, 6);
  });

  it("ranks the exact-text match first", () => {
    const p = createMockEmbeddingProvider(128);
    const corpus = [
      { id: "1", text: "Globex Industries" },
      { id: "2", text: "Acme Corporation" },
      { id: "3", text: "Initech LLC" },
    ];
    const hits = semanticSearch(p, "Acme Corporation", corpus, 10);
    expect(hits[0].id).toBe("2");
    expect(hits[0].score).toBeCloseTo(1, 6);
  });

  it("respects the result limit", () => {
    const p = createMockEmbeddingProvider(32);
    const corpus = Array.from({ length: 20 }, (_, i) => ({
      id: String(i),
      text: `doc ${i}`,
    }));
    expect(semanticSearch(p, "doc 5", corpus, 5)).toHaveLength(5);
  });

  it("VectorIndex returns hits ranked by cosine similarity", () => {
    const p = createMockEmbeddingProvider(96);
    const index = new VectorIndex();
    index.add("a", p.embed("alpha"), { name: "alpha" });
    index.add("b", p.embed("beta"));
    expect(index.size).toBe(2);
    const hits = index.search(p.embed("alpha"), 2);
    expect(hits[0].id).toBe("a");
    expect(hits[0].score).toBeCloseTo(1, 6);
    expect(hits[0].metadata).toEqual({ name: "alpha" });
  });
});
