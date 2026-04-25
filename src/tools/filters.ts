import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { jiraApi } from "../jira/endpoints.js";
import { toolSuccess } from "../utils/result.js";
import {
  expandSchema,
  fieldsSchema,
  idSchema,
  paginationSchema,
  readOnlyAnnotations,
  registerTool,
  type ToolContext,
} from "./helpers.js";

export function registerFilterTools(server: McpServer, context: ToolContext): void {
  registerTool(
    server,
    "jira_list_favourite_filters",
    "List favourite Jira filters visible to the current user.",
    undefined,
    readOnlyAnnotations,
    async () => {
      const filters = await context.client.get<Array<Record<string, unknown>>>(jiraApi("/filter/favourite"));
      return toolSuccess("jira_list_favourite_filters", filters);
    },
  );

  registerTool(
    server,
    "jira_get_filter",
    "Get a Jira filter by id.",
    z.object({
      filterId: idSchema,
      expand: expandSchema,
    }),
    readOnlyAnnotations,
    async ({ filterId, expand }) => {
      const filter = await context.client.get<Record<string, unknown>>(
        jiraApi(`/filter/${encodeURIComponent(String(filterId))}`),
        {
          query: {
            expand: expand?.join(","),
          },
        },
      );
      return toolSuccess("jira_get_filter", filter);
    },
  );

  registerTool(
    server,
    "jira_search_filter_issues",
    "Run issue search using a saved filter JQL, optionally extended with additional JQL.",
    z.object({
      filterId: idSchema,
      additionalJql: z.string().trim().optional(),
      fields: fieldsSchema,
      expand: expandSchema,
      startAt: paginationSchema.shape.startAt,
      maxResults: paginationSchema.shape.maxResults,
    }),
    readOnlyAnnotations,
    async ({ filterId, additionalJql, fields, expand, startAt, maxResults }) => {
      const filter = await context.client.get<Record<string, unknown>>(
        jiraApi(`/filter/${encodeURIComponent(String(filterId))}`),
      );
      const filterJql = String(filter.jql ?? "");
      const effectiveJql =
        additionalJql && additionalJql.length > 0 ? `(${filterJql}) AND (${additionalJql})` : filterJql;

      const results = await context.client.searchIssues<Record<string, unknown>>({
        jql: effectiveJql,
        fields,
        expand,
        startAt,
        maxResults,
      });

      return toolSuccess("jira_search_filter_issues", results, {
        filterId: String(filterId),
        effectiveJql,
      });
    },
  );
}
