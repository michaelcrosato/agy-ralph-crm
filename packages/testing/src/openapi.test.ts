import { describe, expect, it } from "vitest";
import { createTestApp } from "./_harness";

const app = createTestApp();

describe("OpenAPI and Scalar Documentation (spec 017)", () => {
  it("GET /openapi.json returns a valid OpenAPI 3.1.0 document", async () => {
    const res = await app.request("/openapi.json");
    expect(res.status).toBe(200);

    const doc = await res.json();
    expect(doc).toBeDefined();
    expect(doc.openapi).toBe("3.1.0");
    expect(doc.info.title).toBe("CRM API");
    expect(doc.info.version).toBe("0.1.0");

    // Assert that the documented health path exists
    expect(doc.paths["/health"]).toBeDefined();
    expect(doc.paths["/health"].get).toBeDefined();
    expect(doc.paths["/health"].get.responses["200"]).toBeDefined();

    // Assert that the documented leads paths exist
    expect(doc.paths["/api/leads"]).toBeDefined();
    expect(doc.paths["/api/leads"].get).toBeDefined();
    expect(doc.paths["/api/leads"].get.responses["200"]).toBeDefined();

    expect(doc.paths["/api/leads/{id}"]).toBeDefined();
    expect(doc.paths["/api/leads/{id}"].get).toBeDefined();
    expect(doc.paths["/api/leads/{id}"].get.responses["200"]).toBeDefined();
  });

  it("GET /docs serves Scalar API reference UI", async () => {
    const res = await app.request("/docs");
    expect(res.status).toBe(200);

    const text = await res.text();
    expect(text).toContain("<script");
    expect(text).toContain("scalar");
  });
});
