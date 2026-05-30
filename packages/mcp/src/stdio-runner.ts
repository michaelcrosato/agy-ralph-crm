import { dbStore } from "@crm/db";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer } from "./index.js";

async function main() {
  const orgId = process.env.CRM_ORG_ID || "org-tenant-a";
  const userId = process.env.CRM_USER_ID || "user-system";

  const server = createMcpServer({
    tenantContext: { orgId, userId },
    dbStore,
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("CRM MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error inside stdio runner:", error);
  process.exit(1);
});
