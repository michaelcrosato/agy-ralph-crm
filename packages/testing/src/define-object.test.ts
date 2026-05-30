import {
  CustomObjectRegistry,
  defineObject,
  ObjectDefinitionError,
  type ObjectSpec,
} from "@crm/metadata";
import { describe, expect, it } from "vitest";

const projectSpec: ObjectSpec = {
  name: "Project",
  fields: [
    { apiName: "title", type: "string", required: true, max: 100 },
    { apiName: "budget", type: "number", min: 0 },
    { apiName: "active", type: "boolean" },
    { apiName: "dueDate", type: "date" },
    {
      apiName: "stage",
      type: "picklist",
      options: ["planning", "active", "done"],
    },
    { apiName: "tags", type: "multi_picklist", options: ["a", "b", "c"] },
    { apiName: "owner", type: "lookup", lookupEntity: "Contact" },
    { apiName: "notes", type: "rich_text" },
  ],
};

describe("Spec 031: defineObject() SDK", () => {
  it("validates a well-formed record across all field types", () => {
    const def = defineObject(projectSpec);
    const res = def.validateRecord({
      title: "Launch",
      budget: 5000,
      active: true,
      dueDate: "2026-02-01",
      stage: "active",
      tags: ["a", "c"],
      owner: { entity_type: "Contact", entity_id: "c-1" },
      notes: "<b>hi</b>",
    });
    expect(res.success).toBe(true);
  });

  it("rejects type mismatches with field-level errors", () => {
    const def = defineObject(projectSpec);
    const res = def.validateRecord({ title: "X", budget: "not-a-number" });
    expect(res.success).toBe(false);
    expect(res.errors?.some((e) => e.startsWith("budget"))).toBe(true);
  });

  it("enforces required fields", () => {
    const def = defineObject(projectSpec);
    expect(def.validateRecord({ budget: 1 }).success).toBe(false);
    expect(def.validateRecord({ title: "ok" }).success).toBe(true);
  });

  it("enforces picklist + multi_picklist options", () => {
    const def = defineObject(projectSpec);
    expect(def.validateRecord({ title: "x", stage: "nope" }).success).toBe(
      false,
    );
    expect(def.validateRecord({ title: "x", tags: ["a", "zzz"] }).success).toBe(
      false,
    );
    expect(def.validateRecord({ title: "x", tags: ["a", "b"] }).success).toBe(
      true,
    );
  });

  it("validates lookup shape, number bounds, and date strings", () => {
    const def = defineObject(projectSpec);
    expect(
      def.validateRecord({ title: "x", owner: { entity_type: "Contact" } })
        .success,
    ).toBe(false);
    expect(def.validateRecord({ title: "x", budget: -5 }).success).toBe(false);
    expect(
      def.validateRecord({ title: "x", dueDate: "not-a-date" }).success,
    ).toBe(false);
  });

  it("rejects unknown fields (no garbage into JSONB)", () => {
    const def = defineObject(projectSpec);
    expect(def.validateRecord({ title: "x", bogus: 1 }).success).toBe(false);
  });

  it("rejects malformed specs", () => {
    expect(() =>
      defineObject({
        name: "1bad",
        fields: [{ apiName: "a", type: "string" }],
      }),
    ).toThrow(ObjectDefinitionError);
    expect(() => defineObject({ name: "X", fields: [] })).toThrow(
      ObjectDefinitionError,
    );
    expect(() =>
      defineObject({ name: "X", fields: [{ apiName: "p", type: "picklist" }] }),
    ).toThrow(/options/);
    expect(() =>
      defineObject({ name: "X", fields: [{ apiName: "l", type: "lookup" }] }),
    ).toThrow(/lookupEntity/);
    expect(() =>
      defineObject({
        name: "X",
        fields: [
          { apiName: "a", type: "string" },
          { apiName: "a", type: "number" },
        ],
      }),
    ).toThrow(/Duplicate/);
  });

  it("registers definitions per tenant with isolation + caching", () => {
    const reg = new CustomObjectRegistry();
    const def = reg.register("tenant-a", projectSpec);
    expect(reg.get("tenant-a", "Project")).toBe(def);
    expect(reg.get("tenant-b", "Project")).toBeUndefined();
    expect(reg.list("tenant-a").map((d) => d.name)).toEqual(["Project"]);
  });
});
