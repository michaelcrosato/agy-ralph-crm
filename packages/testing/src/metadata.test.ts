import {
  compileFormLayout,
  type FieldDefinition,
  type LayoutConfig,
  validateCustomFields,
} from "@crm/metadata";
import { describe, expect, it } from "vitest";

describe("Phase 3: Metadata Validator & Form Layout Engine Tests", () => {
  it("should validate text, numbers, booleans, and picklist parameters cleanly", () => {
    const definitions: FieldDefinition[] = [
      {
        apiName: "custom_net_worth",
        dataType: "number",
        validationRules: { min: 1000, max: 100000 },
      },
      { apiName: "custom_notes", dataType: "text" },
      { apiName: "custom_vip", dataType: "boolean" },
      {
        apiName: "custom_industry",
        dataType: "picklist",
        validationRules: { options: ["Tech", "Finance", "Healthcare"] },
      },
    ];

    // Case 1: All valid inputs
    const validInputs = {
      custom_net_worth: 50000,
      custom_notes: "Very high priority client",
      custom_vip: true,
      custom_industry: "Tech",
    };

    const resValid = validateCustomFields(validInputs, definitions);
    expect(resValid.success).toBe(true);
    expect(resValid.errors).toBeUndefined();

    // Case 2: Invalid inputs (out of bounds and type discrepancies)
    const invalidInputs = {
      custom_net_worth: 500, // below min (1000)
      custom_notes: 12345, // should be string
      custom_vip: "yes", // should be boolean
      custom_industry: "Auto", // invalid picklist option
    };

    const resInvalid = validateCustomFields(
      invalidInputs as Record<string, unknown>,
      definitions,
    );
    expect(resInvalid.success).toBe(false);
    expect(resInvalid.errors?.length).toBe(4);
    expect(resInvalid.errors).toContain(
      "Field 'custom_net_worth' must be at least 1000.",
    );
    expect(resInvalid.errors).toContain(
      "Field 'custom_notes' must be a string.",
    );
    expect(resInvalid.errors).toContain(
      "Field 'custom_vip' must be a boolean.",
    );
    expect(resInvalid.errors).toContain(
      "Field 'custom_industry' value must be one of: Tech, Finance, Healthcare.",
    );
  });

  it("should compile form layouts and push unassigned custom fields to a fallback section", () => {
    const activeLayout: LayoutConfig = {
      sections: [{ title: "Standard Info", fields: ["name", "email"] }],
    };

    const customFields = ["custom_net_worth", "custom_notes", "name"];

    const compiled = compileFormLayout(customFields, activeLayout);
    expect(compiled.sections.length).toBe(2);
    expect(compiled.sections[0].title).toBe("Standard Info");
    expect(compiled.sections[1].title).toBe("Additional Custom Fields");
    expect(compiled.sections[1].fields).toContain("custom_net_worth");
    expect(compiled.sections[1].fields).toContain("custom_notes");
    expect(compiled.sections[1].fields).not.toContain("name"); // Already in standard info section
  });
});
