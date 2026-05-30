export const DOCUMENTS_VERSION = "0.1.0";

// Resolves a deep key pathway against a context object, supporting standard properties
// and dynamic custom JSONB fields.
export function compileTemplate(
  templateText: string,
  context: Record<string, unknown>,
): string {
  if (!templateText) return "";

  // Regex matches any tag enclosed within double curly brackets, e.g., {{Account.name}}
  return templateText.replace(/\{\{(.*?)\}\}/g, (_match, tagContent) => {
    const pathway = tagContent.trim().split(".");

    let currentVal: unknown = context;

    for (const key of pathway) {
      if (currentVal && typeof currentVal === "object") {
        const obj = currentVal as Record<string, unknown>;
        let nextVal = obj[key];

        // Fallback checks for dynamic custom fields within the standard CRM 'custom' JSONB container
        if (
          nextVal === undefined &&
          obj.custom &&
          typeof obj.custom === "object"
        ) {
          const customObj = obj.custom as Record<string, unknown>;
          nextVal = customObj[key];
        }

        currentVal = nextVal;
      } else {
        currentVal = undefined;
        break;
      }
    }

    if (currentVal !== undefined && currentVal !== null) {
      if (currentVal instanceof Date) {
        return currentVal.toISOString().substring(0, 10);
      }
      return String(currentVal);
    }

    // Default fallback replacement for missing tag configurations
    return "[N/A]";
  });
}
