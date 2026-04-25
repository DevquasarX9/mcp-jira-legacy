import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { jiraApi } from "../jira/endpoints.js";
import { filterAllowedProjects, ensureProjectAllowed } from "../security/guards.js";
import { toolSuccess } from "../utils/result.js";
import {
  projectKeySchema,
  readOnlyAnnotations,
  registerTool,
  type ToolContext,
} from "./helpers.js";

export function registerProjectTools(server: McpServer, context: ToolContext): void {
  registerTool(
    server,
    "jira_list_projects",
    "List Jira projects visible to the current user, filtered by the server allow/deny policy.",
    undefined,
    readOnlyAnnotations,
    async () => {
      const projects = await context.client.get<Array<Record<string, unknown>>>(jiraApi("/project"));
      return toolSuccess("jira_list_projects", filterAllowedProjects(context.config, projects));
    },
  );

  registerTool(
    server,
    "jira_get_project",
    "Get a Jira project by key.",
    z.object({
      projectKey: projectKeySchema,
    }),
    readOnlyAnnotations,
    async ({ projectKey }) => {
      ensureProjectAllowed(context.config, projectKey);
      const project = await context.client.get<Record<string, unknown>>(
        jiraApi(`/project/${encodeURIComponent(projectKey)}`),
      );
      return toolSuccess("jira_get_project", project);
    },
  );

  registerTool(
    server,
    "jira_get_project_components",
    "List components for a Jira project.",
    z.object({
      projectKey: projectKeySchema,
    }),
    readOnlyAnnotations,
    async ({ projectKey }) => {
      ensureProjectAllowed(context.config, projectKey);
      const components = await context.client.get<Array<Record<string, unknown>>>(
        jiraApi(`/project/${encodeURIComponent(projectKey)}/components`),
      );
      return toolSuccess("jira_get_project_components", components);
    },
  );

  registerTool(
    server,
    "jira_get_project_versions",
    "List versions for a Jira project.",
    z.object({
      projectKey: projectKeySchema,
    }),
    readOnlyAnnotations,
    async ({ projectKey }) => {
      ensureProjectAllowed(context.config, projectKey);
      const versions = await context.client.get<Array<Record<string, unknown>>>(
        jiraApi(`/project/${encodeURIComponent(projectKey)}/versions`),
      );
      return toolSuccess("jira_get_project_versions", versions);
    },
  );

  registerTool(
    server,
    "jira_get_project_roles",
    "Resolve project roles and actors for a Jira project.",
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

      return toolSuccess("jira_get_project_roles", roles);
    },
  );

  registerTool(
    server,
    "jira_get_project_statuses",
    "List project issue types and statuses.",
    z.object({
      projectKey: projectKeySchema,
    }),
    readOnlyAnnotations,
    async ({ projectKey }) => {
      ensureProjectAllowed(context.config, projectKey);
      const statuses = await context.client.get<Array<Record<string, unknown>>>(
        jiraApi(`/project/${encodeURIComponent(projectKey)}/statuses`),
      );
      return toolSuccess("jira_get_project_statuses", statuses);
    },
  );
}
