import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { jiraApi } from "../jira/endpoints.js";
import { toolSuccess } from "../utils/result.js";
import {
  readOnlyAnnotations,
  registerTool,
  type ToolContext,
} from "./helpers.js";

export function registerInstanceTools(server: McpServer, context: ToolContext): void {
  registerTool(
    server,
    "jira_get_server_info",
    "Return Jira server build/version information using Jira Server REST API v2.",
    undefined,
    readOnlyAnnotations,
    async () => {
      const serverInfo = await context.client.getServerInfo<Record<string, unknown>>();
      return toolSuccess("jira_get_server_info", serverInfo, {
        endpoint: jiraApi("/serverInfo"),
      });
    },
  );

  registerTool(
    server,
    "jira_validate_auth",
    "Validate Jira credentials without exposing secrets.",
    undefined,
    readOnlyAnnotations,
    async () => {
      const serverInfo = await context.client.getServerInfo<Record<string, unknown>>();
      const currentUser = await context.client.getCurrentUser<Record<string, unknown>>();

      return toolSuccess("jira_validate_auth", {
        authenticated: true,
        server: serverInfo,
        currentUser,
      });
    },
  );

  registerTool(
    server,
    "jira_get_current_user",
    "Return the currently authenticated Jira user.",
    undefined,
    readOnlyAnnotations,
    async () => {
      const currentUser = await context.client.getCurrentUser<Record<string, unknown>>();
      return toolSuccess("jira_get_current_user", currentUser, {
        endpoint: jiraApi("/myself"),
      });
    },
  );

  registerTool(
    server,
    "jira_get_permissions",
    "Return Jira permission information for the current session or selected permissions.",
    z.object({
      permissions: z.array(z.string().trim().min(1)).max(50).optional(),
    }),
    readOnlyAnnotations,
    async (arguments_) => {
      const permissions = await context.client.getPermissions<Record<string, unknown>>(arguments_.permissions);
      return toolSuccess("jira_get_permissions", permissions, {
        endpoint: jiraApi("/mypermissions"),
      });
    },
  );
}
