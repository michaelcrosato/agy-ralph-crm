import { genId } from "@crm/db";
import { describe, expect, it } from "vitest";

describe("genId (uuid v7)", () => {
  it("produces 10,000 unique IDs", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 10_000; i++) {
      ids.add(genId("test"));
    }
    expect(ids.size).toBe(10_000);
  });

  it("encodes the prefix", () => {
    expect(genId("lead").startsWith("lead-")).toBe(true);
    expect(genId("account").startsWith("account-")).toBe(true);
  });

  it("emits time-ordered IDs (lexicographic order = generation order)", () => {
    const a = genId("seq");
    const b = genId("seq");
    expect(a < b || a === b).toBe(true);
  });
});
