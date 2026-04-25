import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { jiraApi } from "../jira/endpoints.js";
import { extractProjectKeyFromIssueKey, ensureProjectAllowed } from "../security/guards.js";
import { toolSuccess } from "../utils/result.js";
import {
  expandSchema,
  fieldsSchema,
  issueKeySchema,
  paginationSchema,
  projectKeySchema,
  readOnlyAnnotations,
  registerTool,
  scopedSearchJql,
  type ToolContext,
} from "./helpers.js";

export function registerIssueReadTools(server: McpServer, context: ToolContext): void {
  registerTool(
    server,
    "jira_search_issues",
    "Search Jira issues with JQL, fields, expand, startAt, and maxResults.",
    z.object({
      jql: z.string().trim().optional(),
      projectKey: projectKeySchema.optional(),
      fields: fieldsSchema,
      expand: expandSchema,
      startAt: paginationSchema.shape.startAt,
      maxResults: paginationSchema.shape.maxResults,
      validateQuery: z.boolean().optional(),
    }),
    readOnlyAnnotations,
    async (arguments_) => {
      const scopedJql = scopedSearchJql(context.config, arguments_.projectKey, arguments_.jql);
      const searchResults = await context.client.searchIssues<Record<string, unknown>>({
        jql: scopedJql,
        fields: arguments_.fields,
        expand: arguments_.expand,
        startAt: arguments_.startAt,
        maxResults: arguments_.maxResults,
        validateQuery: arguments_.validateQuery,
      });

      return toolSuccess("jira_search_issues", searchResults, {
        endpoint: jiraApi("/search"),
        effectiveJql: scopedJql,
      });
    },
  );

  registerTool(
    server,
    "jira_get_issue",
    "Get a Jira issue by key or id with optional fields and expand parameters.",
    z.object({
      issueKey: issueKeySchema,
      fields: fieldsSchema,
      expand: expandSchema,
    }),
    readOnlyAnnotations,
    async ({ issueKey, fields, expand }) => {
      const projectKey = extractProjectKeyFromIssueKey(issueKey);
      if (projectKey) {
        ensureProjectAllowed(context.config, projectKey);
      }

      const issue = await context.client.get<Record<string, unknown>>(
        jiraApi(`/issue/${encodeURIComponent(issueKey)}`),
        {
          query: {
            fields: fields?.join(","),
            expand: expand?.join(","),
          },
        },
      );

      return toolSuccess("jira_get_issue", issue);
    },
  );

  registerTool(
    server,
    "jira_get_issue_comments",
    "Get comments for a Jira issue.",
    z.object({
      issueKey: issueKeySchema,
      startAt: paginationSchema.shape.startAt,
      maxResults: paginationSchema.shape.maxResults,
    }),
    readOnlyAnnotations,
    async ({ issueKey, startAt, maxResults }) => {
      const projectKey = extractProjectKeyFromIssueKey(issueKey);
      if (projectKey) {
        ensureProjectAllowed(context.config, projectKey);
      }

      const comments = await context.client.get<Record<string, unknown>>(
        jiraApi(`/issue/${encodeURIComponent(issueKey)}/comment`),
        {
          query: {
            startAt,
            maxResults,
          },
        },
      );

      return toolSuccess("jira_get_issue_comments", comments);
    },
  );

  registerTool(
    server,
    "jira_get_issue_transitions",
    "List workflow transitions available for a Jira issue.",
    z.object({
      issueKey: issueKeySchema,
      expandFields: z.boolean().optional(),
    }),
    readOnlyAnnotations,
    async ({ issueKey, expandFields }) => {
      const projectKey = extractProjectKeyFromIssueKey(issueKey);
      if (projectKey) {
        ensureProjectAllowed(context.config, projectKey);
      }

      const transitions = await context.client.get<Record<string, unknown>>(
        jiraApi(`/issue/${encodeURIComponent(issueKey)}/transitions`),
        {
          query: {
            expand: expandFields ? "transitions.fields" : undefined,
          },
        },
      );

      return toolSuccess("jira_get_issue_transitions", transitions);
    },
  );

  registerTool(
    server,
    "jira_get_issue_worklogs",
    "Get worklogs for a Jira issue.",
    z.object({
      issueKey: issueKeySchema,
      startAt: paginationSchema.shape.startAt,
      maxResults: paginationSchema.shape.maxResults,
    }),
    readOnlyAnnotations,
    async ({ issueKey, startAt, maxResults }) => {
      const projectKey = extractProjectKeyFromIssueKey(issueKey);
      if (projectKey) {
        ensureProjectAllowed(context.config, projectKey);
      }

      const worklogs = await context.client.get<Record<string, unknown>>(
        jiraApi(`/issue/${encodeURIComponent(issueKey)}/worklog`),
        {
          query: {
            startAt,
            maxResults,
          },
        },
      );

      return toolSuccess("jira_get_issue_worklogs", worklogs);
    },
  );

  registerTool(
    server,
    "jira_get_issue_links",
    "Return issue link information for a Jira issue using the issuelinks field.",
    z.object({
      issueKey: issueKeySchema,
    }),
    readOnlyAnnotations,
    async ({ issueKey }) => {
      const projectKey = extractProjectKeyFromIssueKey(issueKey);
      if (projectKey) {
        ensureProjectAllowed(context.config, projectKey);
      }

      const issue = await context.client.get<Record<string, unknown>>(
        jiraApi(`/issue/${encodeURIComponent(issueKey)}`),
        {
          query: {
            fields: "issuelinks,summary,status,issuetype",
          },
        },
      );

      const links = ((issue.fields as Record<string, unknown> | undefined)?.issuelinks ?? []) as unknown[];
      return toolSuccess("jira_get_issue_links", links, {
        issueKey,
      });
    },
  );

  registerTool(
    server,
    "jira_get_issue_changelog",
    "Get issue changelog history using expand=changelog.",
    z.object({
      issueKey: issueKeySchema,
    }),
    readOnlyAnnotations,
    async ({ issueKey }) => {
      const projectKey = extractProjectKeyFromIssueKey(issueKey);
      if (projectKey) {
        ensureProjectAllowed(context.config, projectKey);
      }

      const issue = await context.client.get<Record<string, unknown>>(
        jiraApi(`/issue/${encodeURIComponent(issueKey)}`),
        {
          query: {
            fields: "summary,status,assignee,reporter,updated,created",
            expand: "changelog",
          },
        },
      );

      return toolSuccess("jira_get_issue_changelog", issue);
    },
  );
}
