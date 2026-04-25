import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { jiraApi } from "../jira/endpoints.js";
import { ensureWriteAllowed, extractProjectKeyFromIssueKey, ensureProjectAllowed } from "../security/guards.js";
import { toolSuccess } from "../utils/result.js";
import { issueKeySchema, jsonObjectSchema, safeWriteAnnotations, registerTool, type ToolContext } from "./helpers.js";

export function registerTransitionTools(server: McpServer, context: ToolContext): void {
  registerTool(
    server,
    "jira_transition_issue",
    "Transition a Jira issue by transition id or transition name. Disabled unless write mode is enabled.",
    z.object({
      issueKey: issueKeySchema,
      transitionId: z.string().trim().min(1).optional(),
      transitionName: z.string().trim().min(1).optional(),
      fields: jsonObjectSchema.optional(),
      update: jsonObjectSchema.optional(),
      comment: z.string().trim().min(1).optional(),
      notifyUsers: z.boolean().optional(),
      historyMetadata: jsonObjectSchema.optional(),
    }),
    safeWriteAnnotations,
    async (arguments_) => {
      ensureWriteAllowed(context.config, "jira_transition_issue");
      const projectKey = extractProjectKeyFromIssueKey(arguments_.issueKey);
      if (projectKey) {
        ensureProjectAllowed(context.config, projectKey);
      }

      let transitionId = arguments_.transitionId;
      if (!transitionId && arguments_.transitionName) {
        const transitionResponse = await context.client.get<{ transitions?: Array<{ id?: string; name?: string }> }>(
          jiraApi(`/issue/${encodeURIComponent(arguments_.issueKey)}/transitions`),
        );
        const matchedTransition = transitionResponse.transitions?.find(
          (transition) => transition.name?.toLowerCase() === arguments_.transitionName?.toLowerCase(),
        );
        transitionId = matchedTransition?.id;
      }

      if (!transitionId) {
        throw new Error("Provide transitionId or a resolvable transitionName.");
      }

      const payload: Record<string, unknown> = {
        transition: { id: transitionId },
      };

      if (arguments_.fields) {
        payload.fields = arguments_.fields;
      }

      if (arguments_.update) {
        payload.update = arguments_.update;
      }

      if (arguments_.historyMetadata) {
        payload.historyMetadata = arguments_.historyMetadata;
      }

      if (arguments_.comment) {
        payload.update = {
          ...(payload.update && typeof payload.update === "object"
            ? (payload.update as Record<string, unknown>)
            : {}),
          comment: [{ add: { body: arguments_.comment } }],
        };
      }

      if (context.config.dryRun) {
        return toolSuccess("jira_transition_issue", { dryRun: true, payload, issueKey: arguments_.issueKey });
      }

      const response = await context.client.post<Record<string, unknown>>(
        jiraApi(`/issue/${encodeURIComponent(arguments_.issueKey)}/transitions`),
        {
          body: payload,
          query: {
            notifyUsers: arguments_.notifyUsers,
          },
        },
      );
      context.audit.logWrite("jira_transition_issue", arguments_.issueKey, { transitionId });
      return toolSuccess("jira_transition_issue", response);
    },
  );
}
