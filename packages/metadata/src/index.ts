export const METADATA_VERSION = "0.1.0";

export interface FieldDefinition {
  apiName: string;
  dataType: "text" | "number" | "boolean" | "picklist";
  validationRules?: {
    min?: number;
    max?: number;
    options?: string[];
  };
}

export interface LayoutSection {
  title: string;
  fields: string[];
}

export interface LayoutConfig {
  sections: LayoutSection[];
}

// validateCustomFields asserts that a custom fields input matches structural definition rules
export function validateCustomFields(
  fields: Record<string, unknown>,
  definitions: FieldDefinition[],
): { success: boolean; errors?: string[] } {
  const errors: string[] = [];

  for (const def of definitions) {
    const value = fields[def.apiName];

    if (value === undefined || value === null) {
      continue; // Allow optional null/undefined dynamic fields
    }

    if (def.dataType === "text") {
      if (typeof value !== "string") {
        errors.push(`Field '${def.apiName}' must be a string.`);
      }
    } else if (def.dataType === "number") {
      if (typeof value !== "number") {
        errors.push(`Field '${def.apiName}' must be a number.`);
      } else {
        if (
          def.validationRules?.min !== undefined &&
          value < def.validationRules.min
        ) {
          errors.push(
            `Field '${def.apiName}' must be at least ${def.validationRules.min}.`,
          );
        }
        if (
          def.validationRules?.max !== undefined &&
          value > def.validationRules.max
        ) {
          errors.push(
            `Field '${def.apiName}' must be at most ${def.validationRules.max}.`,
          );
        }
      }
    } else if (def.dataType === "boolean") {
      if (typeof value !== "boolean") {
        errors.push(`Field '${def.apiName}' must be a boolean.`);
      }
    } else if (def.dataType === "picklist") {
      if (typeof value !== "string") {
        errors.push(
          `Field '${def.apiName}' must be a string (picklist option).`,
        );
      } else if (
        def.validationRules?.options &&
        !def.validationRules.options.includes(value)
      ) {
        errors.push(
          `Field '${def.apiName}' value must be one of: ${def.validationRules.options.join(", ")}.`,
        );
      }
    }
  }

  return {
    success: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}

// compileFormLayout aggregates active custom fields and arranges them into section blocks
export function compileFormLayout(
  customFields: string[],
  activeLayout: LayoutConfig,
): LayoutConfig {
  // Deep clone active layout
  const compiledSections = activeLayout.sections.map((section) => ({
    title: section.title,
    fields: [...section.fields],
  }));

  // Append any custom fields not present in sections to a fallback "Custom Fields" section
  const configuredFields = new Set<string>();
  for (const section of activeLayout.sections) {
    for (const field of section.fields) {
      configuredFields.add(field);
    }
  }

  const unassignedFields = customFields.filter(
    (field) => !configuredFields.has(field),
  );

  if (unassignedFields.length > 0) {
    compiledSections.push({
      title: "Additional Custom Fields",
      fields: unassignedFields,
    });
  }

  return { sections: compiledSections };
}
