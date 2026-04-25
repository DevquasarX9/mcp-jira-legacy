import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { JiraIssue } from "../jira/types.js";
import { jiraAgile, jiraApi } from "../jira/endpoints.js";
import { toolSuccess } from "../utils/result.js";
import {
  idSchema,
  issueKeySchema,
  projectKeySchema,
  readOnlyAnnotations,
  registerTool,
  resolveProjectKey,
  scopedSearchJql,
  type ToolContext,
  usernameSchema,
} from "./helpers.js";

const intelligenceFields = [
  "summary",
  "description",
  "status",
  "priority",
  "assignee",
  "reporter",
  "labels",
  "updated",
  "created",
  "duedate",
  "issuelinks",
  "issuetype",
  "components",
  "fixVersions",
  "resolution",
  "resolutiondate",
];

function getIssueFields(issue: JiraIssue): Record<string, unknown> {
  return (issue.fields ?? {}) as Record<string, unknown>;
}

function getNestedString(record: Record<string, unknown>, key: string, nestedKey = "name"): string | null {
  const value = record[key];
  if (!value || typeof value !== "object") {
    return null;
  }

  const nestedValue = (value as Record<string, unknown>)[nestedKey];
  return typeof nestedValue === "string" ? nestedValue : null;
}

function getIssueSummary(issue: JiraIssue): string {
  return (getIssueFields(issue).summary as string | undefined) ?? issue.key ?? "Unknown issue";
}

function getIssueUpdated(issue: JiraIssue): string | null {
  const updated = getIssueFields(issue).updated;
  return typeof updated === "string" ? updated : null;
}

function isBlockedIssue(issue: JiraIssue): boolean {
  const fields = getIssueFields(issue);
  const statusName = getNestedString(fields, "status")?.toLowerCase() ?? "";
  const labels = Array.isArray(fields.labels)
    ? fields.labels.map((label) => String(label).toLowerCase())
    : [];
  const links = Array.isArray(fields.issuelinks) ? (fields.issuelinks as Array<Record<string, unknown>>) : [];

  return (
    statusName.includes("blocked") ||
    statusName.includes("impediment") ||
    labels.some((label) => ["blocked", "blocker", "impediment"].includes(label)) ||
    links.some((link) => JSON.stringify(link).toLowerCase().includes("block"))
  );
}

function isOverdueIssue(issue: JiraIssue): boolean {
  const fields = getIssueFields(issue);
  const dueDate = fields.duedate;
  const resolution = fields.resolution;
  return typeof dueDate === "string" && Date.parse(dueDate) < Date.now() && resolution == null;
}

function issueToDigest(issue: JiraIssue): Record<string, unknown> {
  const fields = getIssueFields(issue);

  return {
    key: issue.key ?? null,
    summary: fields.summary ?? null,
    status: getNestedString(fields, "status"),
    priority: getNestedString(fields, "priority"),
    assignee: getNestedString(fields, "assignee", "displayName") ?? getNestedString(fields, "assignee"),
    updated: fields.updated ?? null,
    dueDate: fields.duedate ?? null,
    labels: Array.isArray(fields.labels) ? fields.labels : [],
  };
}

async function searchIssueCollection(
  context: ToolContext,
  options: {
    readonly projectKey?: string;
    readonly jql?: string;
    readonly maxItems?: number;
    readonly fields?: string[];
    readonly orderBy?: string;
  },
): Promise<JiraIssue[]> {
  const scopedJql = scopedSearchJql(
    context.config,
    options.projectKey,
    `${options.jql ?? ""}${options.orderBy ? ` ORDER BY ${options.orderBy}` : ""}`.trim(),
  );
  const collection = await context.client.searchIssuesCollection(
    {
      jql: scopedJql,
      fields: options.fields ?? intelligenceFields,
    },
    options.maxItems ?? 200,
  );

  return collection.items;
}

function buildDateRangeJql(dateFrom?: string, dateTo?: string): string {
  const clauses: string[] = [];
  if (dateFrom) {
    clauses.push(`updated >= "${dateFrom}"`);
  }
  if (dateTo) {
    clauses.push(`updated <= "${dateTo}"`);
  }
  return clauses.join(" AND ");
}

function buildKeywordPriority(summary: string, description: string): string {
  const normalizedText = `${summary} ${description}`.toLowerCase();
  if (/(security|outage|sev1|sev2|production down|urgent|critical|blocker)/.test(normalizedText)) {
    return "Highest";
  }
  if (/(bug|failure|error|incident|payment|login|auth)/.test(normalizedText)) {
    return "High";
  }
  return "Medium";
}

function scoreDuplicateCandidate(referenceText: string, candidateText: string): number {
  const tokenize = (value: string) =>
    value
      .toLowerCase()
      .split(/[^a-z0-9]+/i)
      .filter((token) => token.length >= 4);

  const referenceTokens = new Set(tokenize(referenceText));
  const candidateTokens = new Set(tokenize(candidateText));
  const intersection = [...referenceTokens].filter((token) => candidateTokens.has(token)).length;
  const union = new Set([...referenceTokens, ...candidateTokens]).size;

  return union === 0 ? 0 : intersection / union;
}

export function registerIntelligenceTools(server: McpServer, context: ToolContext): void {
  registerTool(
    server,
    "jira_summarize_project_status",
    "Summarize issue distribution, blockers, overdue work, and ownership for a project or JQL scope.",
    z.object({
      projectKey: projectKeySchema.optional(),
      jql: z.string().trim().optional(),
      dateFrom: z.string().trim().optional(),
      dateTo: z.string().trim().optional(),
      maxItems: z.number().int().min(1).max(500).optional(),
    }),
    readOnlyAnnotations,
    async ({ projectKey, jql, dateFrom, dateTo, maxItems }) => {
      const rangeJql = buildDateRangeJql(dateFrom, dateTo);
      const issues = await searchIssueCollection(context, {
        projectKey,
        jql: [jql, rangeJql].filter(Boolean).join(" AND "),
        maxItems,
      });

      const byStatus = new Map<string, number>();
      const byAssignee = new Map<string, number>();
      let overdueCount = 0;
      let blockedCount = 0;
      let unassignedCount = 0;

      for (const issue of issues) {
        const fields = getIssueFields(issue);
        const status = getNestedString(fields, "status") ?? "Unknown";
        const assignee =
          getNestedString(fields, "assignee", "displayName") ?? getNestedString(fields, "assignee") ?? "Unassigned";

        byStatus.set(status, (byStatus.get(status) ?? 0) + 1);
        byAssignee.set(assignee, (byAssignee.get(assignee) ?? 0) + 1);

        if (assignee === "Unassigned") {
          unassignedCount += 1;
        }

        if (isOverdueIssue(issue)) {
          overdueCount += 1;
        }

        if (isBlockedIssue(issue)) {
          blockedCount += 1;
        }
      }

      return toolSuccess("jira_summarize_project_status", {
        issueCount: issues.length,
        byStatus: Object.fromEntries(byStatus),
        byAssignee: Object.fromEntries(byAssignee),
        blockedCount,
        overdueCount,
        unassignedCount,
        sampleIssues: issues.slice(0, 10).map(issueToDigest),
      });
    },
  );

  registerTool(
    server,
    "jira_find_stale_issues",
    "Find issues not updated recently.",
    z.object({
      projectKey: projectKeySchema.optional(),
      jql: z.string().trim().optional(),
      staleDays: z.number().int().min(1).max(365).default(14),
      maxResults: z.number().int().min(1).max(100).default(25),
    }),
    readOnlyAnnotations,
    async ({ projectKey, jql, staleDays, maxResults }) => {
      const effectiveJql = [jql, `updated <= -${staleDays}d`, "resolution is EMPTY"]
        .filter(Boolean)
        .join(" AND ");
      const results = await context.client.searchIssues<Record<string, unknown>>({
        jql: scopedSearchJql(context.config, projectKey, effectiveJql),
        fields: intelligenceFields,
        maxResults,
      });
      return toolSuccess("jira_find_stale_issues", results);
    },
  );

  registerTool(
    server,
    "jira_find_blocked_issues",
    "Find issues that look blocked based on status, labels, or issue links.",
    z.object({
      projectKey: projectKeySchema.optional(),
      jql: z.string().trim().optional(),
      maxItems: z.number().int().min(1).max(300).optional(),
    }),
    readOnlyAnnotations,
    async ({ projectKey, jql, maxItems }) => {
      const issues = await searchIssueCollection(context, {
        projectKey,
        jql,
        maxItems,
      });
      const blockedIssues = issues.filter(isBlockedIssue).map(issueToDigest);
      return toolSuccess("jira_find_blocked_issues", blockedIssues, {
        analyzedIssueCount: issues.length,
      });
    },
  );

  registerTool(
    server,
    "jira_find_unassigned_issues",
    "Find unassigned issues within a project or JQL scope.",
    z.object({
      projectKey: projectKeySchema.optional(),
      jql: z.string().trim().optional(),
      maxResults: z.number().int().min(1).max(100).default(25),
    }),
    readOnlyAnnotations,
    async ({ projectKey, jql, maxResults }) => {
      const effectiveJql = [jql, "assignee is EMPTY"].filter(Boolean).join(" AND ");
      const results = await context.client.searchIssues<Record<string, unknown>>({
        jql: scopedSearchJql(context.config, projectKey, effectiveJql),
        fields: intelligenceFields,
        maxResults,
      });
      return toolSuccess("jira_find_unassigned_issues", results);
    },
  );

  registerTool(
    server,
    "jira_find_overdue_issues",
    "Find unresolved issues past their due date.",
    z.object({
      projectKey: projectKeySchema.optional(),
      jql: z.string().trim().optional(),
      maxResults: z.number().int().min(1).max(100).default(25),
    }),
    readOnlyAnnotations,
    async ({ projectKey, jql, maxResults }) => {
      const effectiveJql = [jql, "duedate < now()", "resolution is EMPTY"].filter(Boolean).join(" AND ");
      const results = await context.client.searchIssues<Record<string, unknown>>({
        jql: scopedSearchJql(context.config, projectKey, effectiveJql),
        fields: intelligenceFields,
        maxResults,
      });
      return toolSuccess("jira_find_overdue_issues", results);
    },
  );

  registerTool(
    server,
    "jira_summarize_sprint",
    "Summarize sprint progress using the Agile API when available, or a JQL scope otherwise.",
    z.object({
      boardId: idSchema.optional(),
      sprintId: idSchema.optional(),
      projectKey: projectKeySchema.optional(),
      jql: z.string().trim().optional(),
      maxItems: z.number().int().min(1).max(300).optional(),
    }),
    readOnlyAnnotations,
    async ({ boardId, sprintId, projectKey, jql, maxItems }) => {
      let issues: JiraIssue[] = [];
      let sprintDetails: Record<string, unknown> | null = null;

      if (sprintId) {
        sprintDetails = await context.client.get<Record<string, unknown>>(
          jiraAgile(`/sprint/${encodeURIComponent(String(sprintId))}`),
        );
        const sprintIssues = await context.client.get<{ issues?: JiraIssue[] }>(
          jiraAgile(`/sprint/${encodeURIComponent(String(sprintId))}/issue`),
          {
            query: {
              maxResults: maxItems,
              fields: intelligenceFields.join(","),
            },
          },
        );
        issues = sprintIssues.issues ?? [];
      } else if (boardId) {
        const sprintList = await context.client.get<{ values?: Array<Record<string, unknown>> }>(
          jiraAgile(`/board/${encodeURIComponent(String(boardId))}/sprint`),
          {
            query: { state: "active", maxResults: 1 },
          },
        );
        sprintDetails = sprintList.values?.[0] ?? null;
        if (sprintDetails?.id) {
          const sprintIssues = await context.client.get<{ issues?: JiraIssue[] }>(
            jiraAgile(`/sprint/${encodeURIComponent(String(sprintDetails.id))}/issue`),
            {
              query: {
                maxResults: maxItems,
                fields: intelligenceFields.join(","),
              },
            },
          );
          issues = sprintIssues.issues ?? [];
        }
      } else {
        issues = await searchIssueCollection(context, {
          projectKey,
          jql,
          maxItems,
        });
      }

      const doneCount = issues.filter((issue) => getNestedString(getIssueFields(issue), "statusCategory", "key") === "done").length;
      const blockedIssues = issues.filter(isBlockedIssue).map(issueToDigest);

      return toolSuccess("jira_summarize_sprint", {
        sprint: sprintDetails,
        issueCount: issues.length,
        doneCount,
        blockedCount: blockedIssues.length,
        blockedIssues: blockedIssues.slice(0, 10),
        completionPercent: issues.length === 0 ? 0 : Number(((doneCount / issues.length) * 100).toFixed(2)),
      });
    },
  );

  registerTool(
    server,
    "jira_explain_issue_history",
    "Explain major changes in an issue changelog.",
    z.object({
      issueKey: issueKeySchema,
      maxEvents: z.number().int().min(1).max(100).default(25),
    }),
    readOnlyAnnotations,
    async ({ issueKey, maxEvents }) => {
      const issue = await context.client.get<JiraIssue>(
        jiraApi(`/issue/${encodeURIComponent(issueKey)}`),
        {
          query: {
            fields: "summary,status,assignee,priority,created,updated,resolution,resolutiondate",
            expand: "changelog",
          },
        },
      );

      const histories = issue.changelog?.histories ?? [];
      const timeline = histories
        .flatMap((history) =>
          (history.items ?? []).map((item) => ({
            created: history.created ?? null,
            author: history.author?.displayName ?? history.author?.name ?? null,
            field: item.field ?? null,
            from: item.fromString ?? item.from ?? null,
            to: item.toString ?? item.to ?? null,
          })),
        )
        .filter((entry) => ["status", "assignee", "priority", "resolution", "Fix Version"].includes(String(entry.field)))
        .slice(-maxEvents);

      return toolSuccess("jira_explain_issue_history", {
        issue: issueToDigest(issue),
        timeline,
      });
    },
  );

  registerTool(
    server,
    "jira_prepare_standup_summary",
    "Summarize recent work, blockers, and in-progress issues for a team or user set.",
    z.object({
      projectKey: projectKeySchema.optional(),
      jql: z.string().trim().optional(),
      users: z.array(usernameSchema).max(50).optional(),
      dateFrom: z.string().trim().optional(),
      dateTo: z.string().trim().optional(),
      maxItems: z.number().int().min(1).max(300).optional(),
    }),
    readOnlyAnnotations,
    async ({ projectKey, jql, users, dateFrom, dateTo, maxItems }) => {
      const userScope =
        users && users.length > 0
          ? `(${users.map((user) => `assignee = "${user}" OR reporter = "${user}"`).join(" OR ")})`
          : "";
      const dateScope = buildDateRangeJql(dateFrom, dateTo);
      const issues = await searchIssueCollection(context, {
        projectKey,
        jql: [jql, userScope, dateScope].filter(Boolean).join(" AND "),
        maxItems,
      });

      const grouped = new Map<string, JiraIssue[]>();
      for (const issue of issues) {
        const assignee =
          getNestedString(getIssueFields(issue), "assignee", "displayName") ??
          getNestedString(getIssueFields(issue), "assignee") ??
          "Unassigned";
        const existingIssues = grouped.get(assignee) ?? [];
        existingIssues.push(issue);
        grouped.set(assignee, existingIssues);
      }

      return toolSuccess("jira_prepare_standup_summary", {
        people: [...grouped.entries()].map(([person, personIssues]) => ({
          person,
          issueCount: personIssues.length,
          blockers: personIssues.filter(isBlockedIssue).map(issueToDigest),
          work: personIssues.slice(0, 10).map(issueToDigest),
        })),
      });
    },
  );

  registerTool(
    server,
    "jira_generate_release_notes",
    "Generate grouped release notes from a fixVersion or JQL scope.",
    z.object({
      projectKey: projectKeySchema.optional(),
      fixVersion: z.string().trim().optional(),
      jql: z.string().trim().optional(),
      includeNotDone: z.boolean().optional(),
      maxItems: z.number().int().min(1).max(400).optional(),
    }),
    readOnlyAnnotations,
    async ({ projectKey, fixVersion, jql, includeNotDone, maxItems }) => {
      const fixVersionClause = fixVersion ? `fixVersion = "${fixVersion}"` : "";
      const doneClause = includeNotDone ? "" : "resolution is not EMPTY";
      const issues = await searchIssueCollection(context, {
        projectKey,
        jql: [jql, fixVersionClause, doneClause].filter(Boolean).join(" AND "),
        maxItems,
      });

      const grouped = new Map<string, Array<Record<string, unknown>>>();
      for (const issue of issues) {
        const issueType = getNestedString(getIssueFields(issue), "issuetype") ?? "Other";
        const entries = grouped.get(issueType) ?? [];
        entries.push({
          key: issue.key ?? null,
          summary: getIssueSummary(issue),
          status: getNestedString(getIssueFields(issue), "status"),
        });
        grouped.set(issueType, entries);
      }

      return toolSuccess("jira_generate_release_notes", {
        fixVersion: fixVersion ?? null,
        groups: Object.fromEntries(grouped),
      });
    },
  );

  registerTool(
    server,
    "jira_find_duplicate_candidates",
    "Find likely duplicate issues using a local text similarity heuristic.",
    z.object({
      projectKey: projectKeySchema.optional(),
      jql: z.string().trim().optional(),
      summary: z.string().trim().min(1),
      description: z.string().trim().optional(),
      maxCandidates: z.number().int().min(1).max(20).default(10),
    }),
    readOnlyAnnotations,
    async ({ projectKey, jql, summary, description, maxCandidates }) => {
      const issues = await searchIssueCollection(context, {
        projectKey,
        jql,
        maxItems: 100,
        fields: ["summary", "description", "status", "updated"],
        orderBy: "updated DESC",
      });

      const referenceText = `${summary}\n${description ?? ""}`.trim();
      const scoredCandidates = issues
        .map((issue) => {
          const fields = getIssueFields(issue);
          const candidateText = `${String(fields.summary ?? "")}\n${String(fields.description ?? "")}`;
          return {
            score: scoreDuplicateCandidate(referenceText, candidateText),
            issue: issueToDigest(issue),
          };
        })
        .filter((candidate) => candidate.score > 0)
        .sort((left, right) => right.score - left.score)
        .slice(0, maxCandidates);

      return toolSuccess("jira_find_duplicate_candidates", scoredCandidates);
    },
  );

  registerTool(
    server,
    "jira_triage_issue",
    "Suggest priority, components, assignee, and next-step triage notes for an issue.",
    z.object({
      issueKey: issueKeySchema,
    }),
    readOnlyAnnotations,
    async ({ issueKey }) => {
      const issue = await context.client.get<JiraIssue>(
        jiraApi(`/issue/${encodeURIComponent(issueKey)}`),
        {
          query: {
            fields: "summary,description,project,components,assignee,priority,status",
          },
        },
      );
      const fields = getIssueFields(issue);
      const projectKey = resolveProjectKey(
        ((fields.project as Record<string, unknown> | undefined)?.key as string | undefined) ?? undefined,
        context.config,
      );

      const components = projectKey
        ? await context.client.get<Array<Record<string, unknown>>>(
            jiraApi(`/project/${encodeURIComponent(projectKey)}/components`),
          )
        : [];

      const summary = String(fields.summary ?? "");
      const description = String(fields.description ?? "");
      const matchedComponents = components.filter((component) =>
        `${summary} ${description}`.toLowerCase().includes(String(component.name ?? "").toLowerCase()),
      );

      const suggestedPriority = buildKeywordPriority(summary, description);
      const suggestedAssignee =
        matchedComponents.find((component) => typeof component.leadUserName === "string")?.leadUserName ?? null;

      return toolSuccess("jira_triage_issue", {
        issue: issueToDigest(issue),
        suggestions: {
          priority: suggestedPriority,
          components: matchedComponents.map((component) => component.name),
          assigneeName: suggestedAssignee,
          status: getNestedString(fields, "status") ?? "To Do",
        },
        rationale: [
          "Priority is derived from issue summary/description keywords.",
          "Component suggestions are based on project component names found in the issue text.",
          "Assignee suggestion prefers a matched component lead when available.",
        ],
      });
    },
  );
}
