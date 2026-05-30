import { z } from "zod";

/** No-code custom-object field types (spec 031). */
export type CustomFieldType =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "lookup"
  | "picklist"
  | "multi_picklist"
  | "rich_text";

export interface CustomFieldSpec {
  apiName: string;
  type: CustomFieldType;
  required?: boolean;
  /** Allowed values for `picklist` / `multi_picklist`. */
  options?: string[];
  /** Target entity name for `lookup`. */
  lookupEntity?: string;
  /** Bounds for `number` (value) / `string` (length). */
  min?: number;
  max?: number;
}

export interface ObjectSpec {
  name: string;
  fields: CustomFieldSpec[];
}

export class ObjectDefinitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ObjectDefinitionError";
  }
}

export interface RecordValidationResult {
  success: boolean;
  data?: Record<string, unknown>;
  errors?: string[];
}

export interface CustomObjectDefinition {
  name: string;
  fields: CustomFieldSpec[];
  recordSchema: z.ZodTypeAny;
  validateRecord(data: unknown): RecordValidationResult;
}

const IDENTIFIER = /^[A-Za-z][A-Za-z0-9_]*$/;

function fieldSchema(field: CustomFieldSpec): z.ZodTypeAny {
  let schema: z.ZodTypeAny;
  switch (field.type) {
    case "string":
    case "rich_text": {
      let s = z.string();
      if (field.min !== undefined) s = s.min(field.min);
      if (field.max !== undefined) s = s.max(field.max);
      schema = s;
      break;
    }
    case "number": {
      let n = z.number();
      if (field.min !== undefined) n = n.min(field.min);
      if (field.max !== undefined) n = n.max(field.max);
      schema = n;
      break;
    }
    case "boolean":
      schema = z.boolean();
      break;
    case "date":
      schema = z.string().refine((v) => !Number.isNaN(Date.parse(v)), {
        message: "must be a valid date string",
      });
      break;
    case "lookup":
      schema = z.object({
        entity_type: z.string(),
        entity_id: z.string(),
      });
      break;
    case "picklist":
      schema = z.enum(field.options as [string, ...string[]]);
      break;
    case "multi_picklist":
      schema = z.array(z.enum(field.options as [string, ...string[]]));
      break;
    default:
      schema = z.unknown();
  }
  return field.required ? schema : schema.optional();
}

function assertValidSpec(spec: ObjectSpec): void {
  if (!spec.name || !IDENTIFIER.test(spec.name)) {
    throw new ObjectDefinitionError(
      `Object name must be an identifier, got '${spec.name}'`,
    );
  }
  if (!spec.fields || spec.fields.length === 0) {
    throw new ObjectDefinitionError(
      `Object '${spec.name}' must declare at least one field`,
    );
  }
  const seen = new Set<string>();
  for (const f of spec.fields) {
    if (!f.apiName || !IDENTIFIER.test(f.apiName)) {
      throw new ObjectDefinitionError(
        `Field apiName must be an identifier, got '${f.apiName}'`,
      );
    }
    if (seen.has(f.apiName)) {
      throw new ObjectDefinitionError(`Duplicate field apiName '${f.apiName}'`);
    }
    seen.add(f.apiName);
    if (
      (f.type === "picklist" || f.type === "multi_picklist") &&
      (!f.options || f.options.length === 0)
    ) {
      throw new ObjectDefinitionError(
        `Field '${f.apiName}' (${f.type}) requires non-empty options`,
      );
    }
    if (f.type === "lookup" && !f.lookupEntity) {
      throw new ObjectDefinitionError(
        `Field '${f.apiName}' (lookup) requires a lookupEntity`,
      );
    }
  }
}

/**
 * Compile an object spec into a reusable definition: validates the spec, derives
 * a Zod record schema from the field types (unknown keys rejected), and exposes a
 * `validateRecord` helper. The schema is compiled once and reused.
 */
export function defineObject(spec: ObjectSpec): CustomObjectDefinition {
  assertValidSpec(spec);
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const field of spec.fields) {
    shape[field.apiName] = fieldSchema(field);
  }
  const recordSchema = z.object(shape).strict();

  return {
    name: spec.name,
    fields: spec.fields,
    recordSchema,
    validateRecord(data: unknown): RecordValidationResult {
      const result = recordSchema.safeParse(data);
      if (result.success) {
        return { success: true, data: result.data as Record<string, unknown> };
      }
      return {
        success: false,
        errors: result.error.issues.map(
          (issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`,
        ),
      };
    },
  };
}

/**
 * In-memory registry of custom-object definitions keyed by `(tenantId, name)`,
 * with the compiled schema cached on the definition. A persistence-backed
 * registry can implement the same interface over `custom_entity_types`.
 */
export class CustomObjectRegistry {
  private readonly defs = new Map<string, CustomObjectDefinition>();

  private key(tenantId: string, name: string): string {
    return `${tenantId}::${name}`;
  }

  register(tenantId: string, spec: ObjectSpec): CustomObjectDefinition {
    const def = defineObject(spec);
    this.defs.set(this.key(tenantId, def.name), def);
    return def;
  }

  get(tenantId: string, name: string): CustomObjectDefinition | undefined {
    return this.defs.get(this.key(tenantId, name));
  }

  list(tenantId: string): CustomObjectDefinition[] {
    const prefix = `${tenantId}::`;
    const out: CustomObjectDefinition[] = [];
    for (const [k, def] of this.defs) {
      if (k.startsWith(prefix)) out.push(def);
    }
    return out;
  }
}
