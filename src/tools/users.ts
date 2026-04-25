import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { jiraApi } from "../jira/endpoints.js";
import { ensureProjectAllowed } from "../security/guards.js";
import { toolSuccess } from "../utils/result.js";
import {
  issueKeySchema,
  paginationSchema,
  projectKeySchema,
  readOnlyAnnotations,
  registerTool,
  usernameSchema,
  type ToolContext,
} from "./helpers.js";

export function registerUserTools(server: McpServer, context: ToolContext): void {
  registerTool(
    server,
    "jira_search_users",
    "Search Jira users by legacy username or display name.",
    z.object({
      query: z.string().trim().min(1),
      maxResults: paginationSchema.shape.maxResults,
      includeInactive: z.boolean().optional(),
    }),
    readOnlyAnnotations,
    async ({ query, maxResults, includeInactive }) => {
      const users = await context.client.get<Array<Record<string, unknown>>>(jiraApi("/user/search"), {
        query: {
          username: query,
          maxResults,
          includeActive: true,
          includeInactive,
        },
      });

      return toolSuccess("jira_search_users", users);
    },
  );

  registerTool(
    server,
    "jira_get_user",
    "Get a Jira user by legacy username.",
    z.object({
      username: usernameSchema,
      expand: z.array(z.string().trim().min(1)).max(10).optional(),
    }),
    readOnlyAnnotations,
    async ({ username, expand }) => {
      const user = await context.client.get<Record<string, unknown>>(jiraApi("/user"), {
        query: {
          username,
          expand: expand?.join(","),
        },
      });
      return toolSuccess("jira_get_user", user);
    },
  );

  registerTool(
    server,
    "jira_list_assignable_users",
    "List assignable Jira users for a project or issue.",
    z.object({
      projectKey: projectKeySchema.optional(),
      issueKey: issueKeySchema.optional(),
      query: z.string().trim().optional(),
      maxResults: paginationSchema.shape.maxResults,
    }),
    readOnlyAnnotations,
    async ({ projectKey, issueKey, query, maxResults }) => {
      if (projectKey) {
        ensureProjectAllowed(context.config, projectKey);
      }

      const users = await context.client.get<Array<Record<string, unknown>>>(
        jiraApi("/user/assignable/search"),
        {
          query: {
            project: projectKey,
            issueKey,
            username: query,
            maxResults,
          },
        },
      );

      return toolSuccess("jira_list_assignable_users", users);
    },
  );

  registerTool(
    server,
    "jira_list_project_users",
    "List users discoverable through project roles for a Jira project.",
    z.object({
      projectKey: projectKeySchema,
    }),
    readOnlyAnnotations,
    async ({ projectKey }) => {
      ensureProjectAllowed(context.config, projectKey);
      const roleUrls = await context.client.get<Record<string, string>>(
        jiraApi(`/project/${encodeURIComponent(projectKey)}/role`),
      );

      const roles = await Promise.all(
        Object.entries(roleUrls).map(async ([roleName, roleUrl]) => ({
          roleName,
          details: await context.client.get<Record<string, unknown>>(roleUrl),
        })),
      );

      const userActors = roles.flatMap((role) => {
        const actors = Array.isArray((role.details as Record<string, unknown>).actors)
          ? ((role.details as Record<string, unknown>).actors as Array<Record<string, unknown>>)
          : [];

        return actors
          .filter((actor) => (actor.type as string | undefined)?.toLowerCase().includes("user"))
          .map((actor) => ({
            roleName: role.roleName,
            name: actor.name,
            displayName: actor.displayName,
          }));
      });

      return toolSuccess("jira_list_project_users", userActors);
    },
  );
}
