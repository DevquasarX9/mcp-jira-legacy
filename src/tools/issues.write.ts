import fs from "node:fs/promises";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { jiraApi } from "../jira/endpoints.js";
import {
  ensureAttachmentAllowed,
  ensureProjectAllowed,
  ensureWriteAllowed,
  extractProjectKeyFromIssueKey,
} from "../security/guards.js";
import { toolSuccess } from "../utils/result.js";
import {
  issueKeySchema,
  jsonObjectSchema,
  projectKeySchema,
  registerTool,
  resolveProjectKey,
  safeWriteAnnotations,
  type ToolContext,
  usernameSchema,
} from "./helpers.js";

function buildIssueFields(arguments_: {
  readonly projectKey?: string;
  readonly issueTypeId?: string;
  readonly issueTypeName?: string;
  readonly summary: string;
  readonly description?: string;
  readonly labels?: string[];
  readonly priorityId?: string;
  readonly priorityName?: string;
  readonly assigneeName?: string | null;
  readonly reporterName?: string;
  readonly components?: string[];
  readonly fixVersions?: string[];
  readonly affectsVersions?: string[];
  readonly fields?: Record<string, unknown>;
}): Record<string, unknown> {
  const fields: Record<string, unknown> = {
    ...(arguments_.fields ?? {}),
    summary: arguments_.summary,
  };

  if (arguments_.projectKey) {
    fields.project = { key: arguments_.projectKey };
  }

  if (arguments_.issueTypeId) {
    fields.issuetype = { id: arguments_.issueTypeId };
  } else if (arguments_.issueTypeName) {
    fields.issuetype = { name: arguments_.issueTypeName };
  }

  if (arguments_.description) {
    fields.description = arguments_.description;
  }

  if (arguments_.labels?.length) {
    fields.labels = arguments_.labels;
  }

  if (arguments_.priorityId) {
    fields.priority = { id: arguments_.priorityId };
  } else if (arguments_.priorityName) {
    fields.priority = { name: arguments_.priorityName };
  }

  if (arguments_.assigneeName !== undefined) {
    fields.assignee = arguments_.assigneeName === null ? null : { name: arguments_.assigneeName };
  }

  if (arguments_.reporterName) {
    fields.reporter = { name: arguments_.reporterName };
  }

  if (arguments_.components?.length) {
    fields.components = arguments_.components.map((component) => ({ name: component }));
  }

  if (arguments_.fixVersions?.length) {
    fields.fixVersions = arguments_.fixVersions.map((version) => ({ name: version }));
  }

  if (arguments_.affectsVersions?.length) {
    fields.versions = arguments_.affectsVersions.map((version) => ({ name: version }));
  }

  return fields;
}

export function registerIssueWriteTools(server: McpServer, context: ToolContext): void {
  registerTool(
    server,
    "jira_create_issue",
    "Create a Jira issue. Disabled unless write mode is enabled.",
    z.object({
      projectKey: projectKeySchema.optional(),
      issueTypeId: z.string().trim().optional(),
      issueTypeName: z.string().trim().optional(),
      summary: z.string().trim().min(1),
      description: z.string().trim().optional(),
      labels: z.array(z.string().trim().min(1)).max(50).optional(),
      priorityId: z.string().trim().optional(),
      priorityName: z.string().trim().optional(),
      assigneeName: usernameSchema.nullable().optional(),
      reporterName: usernameSchema.optional(),
      components: z.array(z.string().trim().min(1)).max(50).optional(),
      fixVersions: z.array(z.string().trim().min(1)).max(50).optional(),
      affectsVersions: z.array(z.string().trim().min(1)).max(50).optional(),
      fields: jsonObjectSchema.optional(),
    }),
    safeWriteAnnotations,
    async (arguments_) => {
      ensureWriteAllowed(context.config, "jira_create_issue");
      const projectKey = resolveProjectKey(arguments_.projectKey, context.config);
      if (projectKey) {
        ensureProjectAllowed(context.config, projectKey);
      }

      const fields = buildIssueFields({
        ...arguments_,
        projectKey,
      });

      if (!("project" in fields)) {
        throw new Error("projectKey is required unless fields.project is provided.");
      }

      if (!("issuetype" in fields)) {
        throw new Error("issueTypeId or issueTypeName is required unless fields.issuetype is provided.");
      }

      const payload = { fields };

      if (context.config.dryRun) {
        return toolSuccess("jira_create_issue", { dryRun: true, payload });
      }

      const createdIssue = await context.client.post<Record<string, unknown>>(jiraApi("/issue"), {
        body: payload,
      });
      context.audit.logWrite("jira_create_issue", String((createdIssue.key as string | undefined) ?? projectKey ?? "unknown"));
      return toolSuccess("jira_create_issue", createdIssue);
    },
  );

  registerTool(
    server,
    "jira_update_issue",
    "Update a Jira issue with fields or update operations. Disabled unless write mode is enabled.",
    z.object({
      issueKey: issueKeySchema,
      fields: jsonObjectSchema.optional(),
      update: jsonObjectSchema.optional(),
      historyMetadata: jsonObjectSchema.optional(),
      notifyUsers: z.boolean().optional(),
    }),
    safeWriteAnnotations,
    async ({ issueKey, fields, update, historyMetadata, notifyUsers }) => {
      ensureWriteAllowed(context.config, "jira_update_issue");
      const projectKey = extractProjectKeyFromIssueKey(issueKey);
      if (projectKey) {
        ensureProjectAllowed(context.config, projectKey);
      }

      if (!fields && !update) {
        throw new Error("Provide fields or update payload.");
      }

      const payload = {
        ...(fields ? { fields } : {}),
        ...(update ? { update } : {}),
        ...(historyMetadata ? { historyMetadata } : {}),
      };

      if (context.config.dryRun) {
        return toolSuccess("jira_update_issue", { dryRun: true, issueKey, payload });
      }

      const response = await context.client.put<unknown>(jiraApi(`/issue/${encodeURIComponent(issueKey)}`), {
        body: payload,
        query: {
          notifyUsers,
        },
      });
      context.audit.logWrite("jira_update_issue", issueKey);
      return toolSuccess("jira_update_issue", response ?? { updated: true, issueKey });
    },
  );

  registerTool(
    server,
    "jira_assign_issue",
    "Assign or unassign a Jira issue by legacy username. Disabled unless write mode is enabled.",
    z.object({
      issueKey: issueKeySchema,
      assigneeName: usernameSchema.nullable(),
    }),
    safeWriteAnnotations,
    async ({ issueKey, assigneeName }) => {
      ensureWriteAllowed(context.config, "jira_assign_issue");
      const projectKey = extractProjectKeyFromIssueKey(issueKey);
      if (projectKey) {
        ensureProjectAllowed(context.config, projectKey);
      }

      const payload = { name: assigneeName };

      if (context.config.dryRun) {
        return toolSuccess("jira_assign_issue", { dryRun: true, issueKey, payload });
      }

      const response = await context.client.put<unknown>(
        jiraApi(`/issue/${encodeURIComponent(issueKey)}/assignee`),
        {
          body: payload,
        },
      );
      context.audit.logWrite("jira_assign_issue", issueKey, {
        assigneeName: assigneeName ?? "unassigned",
      });
      return toolSuccess("jira_assign_issue", response ?? { updated: true, issueKey, assigneeName });
    },
  );

  registerTool(
    server,
    "jira_link_issues",
    "Create an issue link between two Jira issues. Disabled unless write mode is enabled.",
    z.object({
      inwardIssueKey: issueKeySchema,
      outwardIssueKey: issueKeySchema,
      linkTypeName: z.string().trim().min(1),
      comment: z.string().trim().optional(),
    }),
    safeWriteAnnotations,
    async ({ inwardIssueKey, outwardIssueKey, linkTypeName, comment }) => {
      ensureWriteAllowed(context.config, "jira_link_issues");
      const inwardProject = extractProjectKeyFromIssueKey(inwardIssueKey);
      const outwardProject = extractProjectKeyFromIssueKey(outwardIssueKey);
      if (inwardProject) {
        ensureProjectAllowed(context.config, inwardProject);
      }
      if (outwardProject) {
        ensureProjectAllowed(context.config, outwardProject);
      }

      const payload = {
        type: { name: linkTypeName },
        inwardIssue: { key: inwardIssueKey },
        outwardIssue: { key: outwardIssueKey },
        ...(comment ? { comment: { body: comment } } : {}),
      };

      if (context.config.dryRun) {
        return toolSuccess("jira_link_issues", { dryRun: true, payload });
      }

      const response = await context.client.post<unknown>(jiraApi("/issueLink"), {
        body: payload,
      });
      context.audit.logWrite("jira_link_issues", `${outwardIssueKey}->${inwardIssueKey}`, {
        linkTypeName,
      });
      return toolSuccess("jira_link_issues", response ?? { created: true, payload });
    },
  );

  registerTool(
    server,
    "jira_add_labels",
    "Add labels to a Jira issue. Disabled unless write mode is enabled.",
    z.object({
      issueKey: issueKeySchema,
      labels: z.array(z.string().trim().min(1)).min(1).max(50),
    }),
    safeWriteAnnotations,
    async ({ issueKey, labels }) => {
      ensureWriteAllowed(context.config, "jira_add_labels");
      const projectKey = extractProjectKeyFromIssueKey(issueKey);
      if (projectKey) {
        ensureProjectAllowed(context.config, projectKey);
      }

      const payload = {
        update: {
          labels: labels.map((label) => ({ add: label })),
        },
      };

      if (context.config.dryRun) {
        return toolSuccess("jira_add_labels", { dryRun: true, payload, issueKey });
      }

      const response = await context.client.put<unknown>(jiraApi(`/issue/${encodeURIComponent(issueKey)}`), {
        body: payload,
      });
      context.audit.logWrite("jira_add_labels", issueKey, { labels });
      return toolSuccess("jira_add_labels", response ?? { updated: true, issueKey, labels });
    },
  );

  registerTool(
    server,
    "jira_remove_labels",
    "Remove labels from a Jira issue. Disabled unless write mode is enabled.",
    z.object({
      issueKey: issueKeySchema,
      labels: z.array(z.string().trim().min(1)).min(1).max(50),
    }),
    safeWriteAnnotations,
    async ({ issueKey, labels }) => {
      ensureWriteAllowed(context.config, "jira_remove_labels");
      const projectKey = extractProjectKeyFromIssueKey(issueKey);
      if (projectKey) {
        ensureProjectAllowed(context.config, projectKey);
      }

      const payload = {
        update: {
          labels: labels.map((label) => ({ remove: label })),
        },
      };

      if (context.config.dryRun) {
        return toolSuccess("jira_remove_labels", { dryRun: true, payload, issueKey });
      }

      const response = await context.client.put<unknown>(jiraApi(`/issue/${encodeURIComponent(issueKey)}`), {
        body: payload,
      });
      context.audit.logWrite("jira_remove_labels", issueKey, { labels });
      return toolSuccess("jira_remove_labels", response ?? { updated: true, issueKey, labels });
    },
  );

  registerTool(
    server,
    "jira_add_worklog",
    "Add a worklog entry to a Jira issue. Disabled unless write mode is enabled.",
    z.object({
      issueKey: issueKeySchema,
      comment: z.string().trim().optional(),
      started: z.string().trim().optional(),
      timeSpent: z.string().trim().optional(),
      timeSpentSeconds: z.number().int().positive().optional(),
      adjustEstimate: z.string().trim().optional(),
      newEstimate: z.string().trim().optional(),
    }),
    safeWriteAnnotations,
    async ({ issueKey, comment, started, timeSpent, timeSpentSeconds, adjustEstimate, newEstimate }) => {
      ensureWriteAllowed(context.config, "jira_add_worklog");
      const projectKey = extractProjectKeyFromIssueKey(issueKey);
      if (projectKey) {
        ensureProjectAllowed(context.config, projectKey);
      }

      if (!timeSpent && !timeSpentSeconds) {
        throw new Error("Provide timeSpent or timeSpentSeconds.");
      }

      const payload = {
        ...(comment ? { comment } : {}),
        ...(started ? { started } : {}),
        ...(timeSpent ? { timeSpent } : {}),
        ...(timeSpentSeconds ? { timeSpentSeconds } : {}),
      };

      if (context.config.dryRun) {
        return toolSuccess("jira_add_worklog", { dryRun: true, issueKey, payload });
      }

      const response = await context.client.post<Record<string, unknown>>(
        jiraApi(`/issue/${encodeURIComponent(issueKey)}/worklog`),
        {
          body: payload,
          query: {
            adjustEstimate,
            newEstimate,
          },
        },
      );
      context.audit.logWrite("jira_add_worklog", issueKey);
      return toolSuccess("jira_add_worklog", response);
    },
  );

  registerTool(
    server,
    "jira_upload_attachment",
    "Upload an attachment to a Jira issue. Disabled unless write mode is enabled.",
    z.object({
      issueKey: issueKeySchema,
      filePath: z.string().trim().min(1),
      fileName: z.string().trim().optional(),
      mimeType: z.string().trim().optional(),
    }),
    safeWriteAnnotations,
    async ({ issueKey, filePath, fileName, mimeType }) => {
      ensureWriteAllowed(context.config, "jira_upload_attachment");
      const projectKey = extractProjectKeyFromIssueKey(issueKey);
      if (projectKey) {
        ensureProjectAllowed(context.config, projectKey);
      }

      const stats = await fs.stat(filePath);
      ensureAttachmentAllowed(context.config, stats.size);

      if (context.config.dryRun) {
        return toolSuccess("jira_upload_attachment", {
          dryRun: true,
          issueKey,
          filePath,
          fileName,
          mimeType,
          bytes: stats.size,
        });
      }

      const response = await context.client.uploadAttachment<Record<string, unknown>>(
        issueKey,
        filePath,
        fileName,
        mimeType,
      );
      context.audit.logWrite("jira_upload_attachment", issueKey, {
        filePath,
        bytes: stats.size,
      });
      return toolSuccess("jira_upload_attachment", response);
    },
  );
}
