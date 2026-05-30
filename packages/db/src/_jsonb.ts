import { validateCustomFields as metaValidateCustomFields } from "@crm/metadata";

export class JsonbValidationError extends Error {
  public errors: string[];
  constructor(errors: string[]) {
    super(`JSONB Validation Failed: ${errors.join("; ")}`);
    this.name = "JsonbValidationError";
    this.errors = errors;
  }
}

export async function validateCustomFields(
  tenantId: string,
  entity: string,
  payload: Record<string, unknown>,
) {
  if (process.env.JSONB_VALIDATION === "off") {
    return;
  }

  // Lazy import to prevent circular dependency with packages/db/src/index.ts
  const { dbStore } = await import("./index.js");

  const allDefs = await dbStore.fieldDefinitions.findMany();
  const defs = allDefs.filter(
    (def: any) => def.orgId === tenantId && def.objectType === entity,
  );

  if (defs.length === 0) {
    return;
  }

  const result = metaValidateCustomFields(payload, defs as any);
  if (!result.success) {
    throw new JsonbValidationError(
      result.errors || ["Unknown validation failure"],
    );
  }
}
