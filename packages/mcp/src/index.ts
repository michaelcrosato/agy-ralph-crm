import { mockDb, pgDb, withTenant } from "@crm/db";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { accountSchemas, handleAccountTool } from "./tools/accounts";
import { contactSchemas, handleContactTool } from "./tools/contacts";
import { getCustomObjectTools, handleCustomTool } from "./tools/custom";
import { handleLeadTool, leadSchemas } from "./tools/leads";
import {
  handleOpportunityTool,
  opportunitySchemas,
} from "./tools/opportunities";
import { handleServiceTool, serviceSchemas } from "./tools/service";

export interface TenantContext {
  orgId: string;
  userId?: string;
}

export interface McpServerOptions {
  tenantContext: TenantContext;
  dbStore: any;
  onActivityTriggered?: (
    orgId: string,
    event: string,
    payload: any,
  ) => Promise<void>;
}

export function createMcpServer(options: McpServerOptions) {
  const { tenantContext, dbStore } = options;
  const db = process.env.DB_DRIVER === "pg" ? pgDb : mockDb;

  const server = new Server(
    {
      name: "crm-mcp-server",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
      },
    },
  );

  // Helper to wrap handlers with strict tenant RLS isolation
  const wrap = <T>(fn: () => Promise<T>): Promise<T> => {
    return withTenant(tenantContext.orgId, db as any, fn);
  };

  // 1. Tool Schemas List
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const staticTools = [
      ...accountSchemas,
      ...contactSchemas,
      ...leadSchemas,
      ...opportunitySchemas,
      ...serviceSchemas,
    ];

    const customTypes = await wrap(async () =>
      dbStore.customEntityTypes.findMany(),
    );
    const dynamicTools = getCustomObjectTools(customTypes);

    return {
      tools: [...staticTools, ...dynamicTools],
    };
  });

  // 2. Tool Execution handlers
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name } = request.params;
    const args = (request.params.arguments || {}) as any;

    return await wrap(async () => {
      let res = await handleAccountTool(name, args, dbStore, tenantContext);
      if (res !== undefined) return res;

      res = await handleContactTool(name, args, dbStore, tenantContext);
      if (res !== undefined) return res;

      res = await handleLeadTool(name, args, dbStore, tenantContext);
      if (res !== undefined) return res;

      res = await handleOpportunityTool(name, args, dbStore, tenantContext);
      if (res !== undefined) return res;

      res = await handleServiceTool(
        name,
        args,
        dbStore,
        tenantContext,
        options,
      );
      if (res !== undefined) return res;

      const customTypes = await dbStore.customEntityTypes.findMany();
      res = await handleCustomTool(
        name,
        args,
        dbStore,
        tenantContext,
        customTypes,
      );
      if (res !== undefined) return res;

      throw new Error(`Unknown tool call: ${name}`);
    });
  });

  // 3. Resources List & Read handlers
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: [
        {
          uri: "crm://leads",
          name: "All Leads",
          mimeType: "application/json",
        },
        {
          uri: "crm://opportunities",
          name: "All Opportunities",
          mimeType: "application/json",
        },
      ],
    };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;

    return await wrap(async () => {
      if (uri === "crm://leads") {
        const res = await dbStore.leads.findMany();
        return {
          contents: [
            { uri, mimeType: "application/json", text: JSON.stringify(res) },
          ],
        };
      }
      if (uri.startsWith("crm://leads/")) {
        const leadId = uri.substring("crm://leads/".length);
        const res = await dbStore.leads.findOne(leadId);
        return {
          contents: [
            { uri, mimeType: "application/json", text: JSON.stringify(res) },
          ],
        };
      }
      if (uri === "crm://opportunities") {
        const res = await dbStore.opportunities.findMany();
        return {
          contents: [
            { uri, mimeType: "application/json", text: JSON.stringify(res) },
          ],
        };
      }
      if (uri.startsWith("crm://opportunities/")) {
        const oppId = uri.substring("crm://opportunities/".length);
        const res = await dbStore.opportunities.findOne(oppId);
        return {
          contents: [
            { uri, mimeType: "application/json", text: JSON.stringify(res) },
          ],
        };
      }
      throw new Error(`Resource not found: ${uri}`);
    });
  });

  // 4. Prompts List & Get handlers
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return {
      prompts: [
        {
          name: "crm_summarize_lead_pipeline",
          description: "Generate a pipeline analysis of current active leads.",
        },
        {
          name: "crm_draft_outreach_email",
          description:
            "Draft a personalized outreach email for a lead or contact.",
        },
        {
          name: "crm_qualify_opportunity",
          description:
            "Analyze dynamic custom criteria to qualify a pending opportunity.",
        },
      ],
    };
  });

  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name } = request.params;

    if (name === "crm_summarize_lead_pipeline") {
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: "Please query the active lead records, evaluate their custom field rules, and generate a summary highlighting hot targets vs stale leads.",
            },
          },
        ],
      };
    }
    if (name === "crm_draft_outreach_email") {
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: "Draft an engaging, personalized cold outreach email using active contact detail attributes.",
            },
          },
        ],
      };
    }
    if (name === "crm_qualify_opportunity") {
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: "Review opportunities close dates, custom pickup definitions, and amounts to recommend next stage progression targets.",
            },
          },
        ],
      };
    }

    throw new Error(`Prompt not found: ${name}`);
  });

  return server;
}

import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type {
  JSONRPCMessage,
  JSONRPCResponse,
} from "@modelcontextprotocol/sdk/types.js";

export class InMemoryTransport implements Transport {
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;

  sent: JSONRPCMessage[] = [];
  private pendingResolvers = new Map<
    string | number,
    (response: JSONRPCResponse) => void
  >();

  async start(): Promise<void> {}

  async send(message: JSONRPCMessage): Promise<void> {
    this.sent.push(message);
    if ("result" in message || "error" in message) {
      const id = message.id;
      if (id !== undefined && id !== null) {
        const resolver = this.pendingResolvers.get(id);
        if (resolver) {
          resolver(message as JSONRPCResponse);
          this.pendingResolvers.delete(id);
        }
      }
    }
  }

  async close(): Promise<void> {
    if (this.onclose) this.onclose();
  }

  async sendRequest(request: {
    method: string;
    params?: any;
    id: number;
  }): Promise<JSONRPCResponse> {
    const jsonrpcRequest = {
      jsonrpc: "2.0" as const,
      ...request,
    };

    const promise = new Promise<JSONRPCResponse>((resolve) => {
      this.pendingResolvers.set(request.id, resolve);
    });

    if (this.onmessage) {
      this.onmessage(jsonrpcRequest);
    } else {
      throw new Error("Transport not connected to a server");
    }

    return promise;
  }
}
