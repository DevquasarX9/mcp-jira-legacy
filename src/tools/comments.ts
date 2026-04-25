import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { jiraApi } from "../jira/endpoints.js";
import { ensureCommentLength, ensureWriteAllowed, extractProjectKeyFromIssueKey, ensureProjectAllowed } from "../security/guards.js";
import { toolSuccess } from "../utils/result.js";
import { issueKeySchema, safeWriteAnnotations, registerTool, type ToolContext } from "./helpers.js";

export function registerCommentTools(server: McpServer, context: ToolContext): void {
  registerTool(
    server,
    "jira_add_comment",
    "Add a comment to a Jira issue. Disabled unless write mode is enabled.",
    z.object({
      issueKey: issueKeySchema,
      body: z.string().min(1),
      visibility: z
        .object({
          type: z.string().min(1),
          value: z.string().min(1),
        })
        .optional(),
    }),
    safeWriteAnnotations,
    async ({ issueKey, body, visibility }) => {
      ensureWriteAllowed(context.config, "jira_add_comment");
      const projectKey = extractProjectKeyFromIssueKey(issueKey);
      if (projectKey) {
        ensureProjectAllowed(context.config, projectKey);
      }
      ensureCommentLength(body);

      const payload = visibility ? { body, visibility } : { body };
      if (context.config.dryRun) {
        return toolSuccess("jira_add_comment", { dryRun: true, payload, issueKey });
      }

      const comment = await context.client.post<Record<string, unknown>>(
        jiraApi(`/issue/${encodeURIComponent(issueKey)}/comment`),
        {
          body: payload,
        },
      );
      context.audit.logWrite("jira_add_comment", issueKey);
      return toolSuccess("jira_add_comment", comment);
    },
  );

  registerTool(
    server,
    "jira_update_comment",
    "Update an existing Jira comment. Disabled unless write mode is enabled.",
    z.object({
      issueKey: issueKeySchema,
      commentId: z.union([z.string().min(1), z.number().int().positive()]),
      body: z.string().min(1),
      visibility: z
        .object({
          type: z.string().min(1),
          value: z.string().min(1),
        })
        .optional(),
    }),
    safeWriteAnnotations,
    async ({ issueKey, commentId, body, visibility }) => {
      ensureWriteAllowed(context.config, "jira_update_comment");
      const projectKey = extractProjectKeyFromIssueKey(issueKey);
      if (projectKey) {
        ensureProjectAllowed(context.config, projectKey);
      }
      ensureCommentLength(body);

      const payload = visibility ? { body, visibility } : { body };
      if (context.config.dryRun) {
        return toolSuccess("jira_update_comment", { dryRun: true, payload, issueKey, commentId });
      }

      const comment = await context.client.put<Record<string, unknown>>(
        jiraApi(`/issue/${encodeURIComponent(issueKey)}/comment/${encodeURIComponent(String(commentId))}`),
        {
          body: payload,
        },
      );
      context.audit.logWrite("jira_update_comment", `${issueKey}:${commentId}`);
      return toolSuccess("jira_update_comment", comment);
    },
  );
}
