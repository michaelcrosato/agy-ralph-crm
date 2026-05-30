import { defineObject } from "@crm/metadata";
import type { TenantContext } from "../index";

export function mapFieldToSchema(field: any) {
  switch (field.type) {
    case "string":
    case "rich_text":
      return { type: "string" };
    case "number":
      return { type: "number" };
    case "boolean":
      return { type: "boolean" };
    case "date":
      return { type: "string", description: "ISO date string" };
    case "lookup":
      return {
        type: "object",
        properties: {
          entity_type: { type: "string" },
          entity_id: { type: "string" },
        },
        required: ["entity_type", "entity_id"],
      };
    case "picklist":
      return { type: "string", enum: field.options || [] };
    case "multi_picklist":
      return {
        type: "array",
        items: { type: "string", enum: field.options || [] },
      };
    default:
      return { type: "string" };
  }
}

export function getCustomObjectTools(customTypes: any[]): any[] {
  const dynamicTools: any[] = [];

  for (const customType of customTypes) {
    const objName = customType.name.toLowerCase();
    const properties: Record<string, any> = {};
    const required: string[] = [];
    for (const field of customType.fieldsJson) {
      properties[field.apiName] = mapFieldToSchema(field);
      if (field.required) {
        required.push(field.apiName);
      }
    }

    dynamicTools.push(
      {
        name: `crm_get_${objName}`,
        description: `Retrieve ${customType.name} custom record details by ID.`,
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string" },
          },
          required: ["id"],
        },
      },
      {
        name: `crm_list_${objName}`,
        description: `List all ${customType.name} custom records.`,
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: `crm_create_${objName}`,
        description: `Create a new ${customType.name} custom record.`,
        inputSchema: {
          type: "object",
          properties,
          ...(required.length > 0 ? { required } : {}),
        },
      },
      {
        name: `crm_update_${objName}`,
        description: `Update an existing ${customType.name} custom record.`,
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string" },
            ...properties,
          },
          required: ["id"],
        },
      },
      {
        name: `crm_delete_${objName}`,
        description: `Delete a ${customType.name} custom record by ID.`,
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string" },
          },
          required: ["id"],
        },
      },
    );
  }

  return dynamicTools;
}

export async function handleCustomTool(
  name: string,
  args: any,
  dbStore: any,
  tenantContext: TenantContext,
  customTypes: any[],
): Promise<any> {
  for (const customType of customTypes) {
    const objName = customType.name.toLowerCase();
    if (name === `crm_get_${objName}`) {
      const record = await dbStore.customEntityRecords.findOne(args.id);
      if (!record || record.typeId !== customType.id) {
        return {
          content: [{ type: "text", text: "Record not found" }],
          isError: true,
        };
      }
      return {
        content: [{ type: "text", text: JSON.stringify(record) }],
      };
    }
    if (name === `crm_list_${objName}`) {
      const allRecords = await dbStore.customEntityRecords.findMany();
      const records = allRecords.filter((r: any) => r.typeId === customType.id);
      return {
        content: [{ type: "text", text: JSON.stringify(records) }],
      };
    }
    if (name === `crm_create_${objName}`) {
      const definition = defineObject({
        name: customType.name,
        fields: customType.fieldsJson,
      });
      const validation = definition.validateRecord(args);
      if (!validation.success) {
        return {
          content: [
            {
              type: "text",
              text: `Validation failed: ${validation.errors?.join(", ")}`,
            },
          ],
          isError: true,
        };
      }
      const record = await dbStore.customEntityRecords.insert({
        orgId: tenantContext.orgId,
        typeId: customType.id,
        data: validation.data as Record<string, unknown>,
      });
      return {
        content: [{ type: "text", text: JSON.stringify(record) }],
      };
    }
    if (name === `crm_update_${objName}`) {
      const record = await dbStore.customEntityRecords.findOne(args.id);
      if (!record || record.typeId !== customType.id) {
        return {
          content: [{ type: "text", text: "Record not found" }],
          isError: true,
        };
      }
      const definition = defineObject({
        name: customType.name,
        fields: customType.fieldsJson,
      });
      const { id, ...updates } = args;
      const mergedData = { ...(record.data || {}), ...updates };
      const validation = definition.validateRecord(mergedData);
      if (!validation.success) {
        return {
          content: [
            {
              type: "text",
              text: `Validation failed: ${validation.errors?.join(", ")}`,
            },
          ],
          isError: true,
        };
      }
      const updated = await dbStore.customEntityRecords.update(args.id, {
        data: validation.data as Record<string, unknown>,
      });
      return {
        content: [{ type: "text", text: JSON.stringify(updated) }],
      };
    }
    if (name === `crm_delete_${objName}`) {
      const record = await dbStore.customEntityRecords.findOne(args.id);
      if (!record || record.typeId !== customType.id) {
        return {
          content: [{ type: "text", text: "Record not found" }],
          isError: true,
        };
      }
      const success = await dbStore.customEntityRecords.delete(args.id);
      return {
        content: [{ type: "text", text: JSON.stringify({ success }) }],
      };
    }
  }
  return undefined;
}
