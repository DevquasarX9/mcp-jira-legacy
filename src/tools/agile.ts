import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { jiraAgile } from "../jira/endpoints.js";
import { toolSuccess } from "../utils/result.js";
import {
  idSchema,
  paginationSchema,
  projectKeySchema,
  readOnlyAnnotations,
  registerTool,
  type ToolContext,
} from "./helpers.js";

export function registerAgileTools(server: McpServer, context: ToolContext): void {
  registerTool(
    server,
    "jira_list_boards",
    "List Jira Software boards if the Agile API is available on this instance.",
    z.object({
      projectKey: projectKeySchema.optional(),
      type: z.string().trim().optional(),
      name: z.string().trim().optional(),
      startAt: paginationSchema.shape.startAt,
      maxResults: paginationSchema.shape.maxResults,
    }),
    readOnlyAnnotations,
    async ({ projectKey, type, name, startAt, maxResults }) => {
      const boards = await context.client.get<Record<string, unknown>>(jiraAgile("/board"), {
        query: {
          projectKeyOrId: projectKey,
          type,
          name,
          startAt,
          maxResults,
        },
      });
      return toolSuccess("jira_list_boards", boards, {
        compatibility: "optional",
      });
    },
  );

  registerTool(
    server,
    "jira_get_board",
    "Get a Jira Software board by id if the Agile API is available.",
    z.object({
      boardId: idSchema,
    }),
    readOnlyAnnotations,
    async ({ boardId }) => {
      const board = await context.client.get<Record<string, unknown>>(
        jiraAgile(`/board/${encodeURIComponent(String(boardId))}`),
      );
      return toolSuccess("jira_get_board", board, {
        compatibility: "optional",
      });
    },
  );

  registerTool(
    server,
    "jira_list_sprints",
    "List sprints for a board if the Agile API is available.",
    z.object({
      boardId: idSchema,
      state: z.string().trim().optional(),
      startAt: paginationSchema.shape.startAt,
      maxResults: paginationSchema.shape.maxResults,
    }),
    readOnlyAnnotations,
    async ({ boardId, state, startAt, maxResults }) => {
      const sprints = await context.client.get<Record<string, unknown>>(
        jiraAgile(`/board/${encodeURIComponent(String(boardId))}/sprint`),
        {
          query: {
            state,
            startAt,
            maxResults,
          },
        },
      );
      return toolSuccess("jira_list_sprints", sprints, {
        compatibility: "optional",
      });
    },
  );

  registerTool(
    server,
    "jira_get_sprint",
    "Get a Jira sprint by id if the Agile API is available.",
    z.object({
      sprintId: idSchema,
    }),
    readOnlyAnnotations,
    async ({ sprintId }) => {
      const sprint = await context.client.get<Record<string, unknown>>(
        jiraAgile(`/sprint/${encodeURIComponent(String(sprintId))}`),
      );
      return toolSuccess("jira_get_sprint", sprint, {
        compatibility: "optional",
      });
    },
  );

  registerTool(
    server,
    "jira_get_sprint_issues",
    "List issues in a Jira sprint if the Agile API is available.",
    z.object({
      sprintId: idSchema,
      startAt: paginationSchema.shape.startAt,
      maxResults: paginationSchema.shape.maxResults,
      fields: z.array(z.string().trim().min(1)).optional(),
    }),
    readOnlyAnnotations,
    async ({ sprintId, startAt, maxResults, fields }) => {
      const issues = await context.client.get<Record<string, unknown>>(
        jiraAgile(`/sprint/${encodeURIComponent(String(sprintId))}/issue`),
        {
          query: {
            startAt,
            maxResults,
            fields: fields?.join(","),
          },
        },
      );
      return toolSuccess("jira_get_sprint_issues", issues, {
        compatibility: "optional",
      });
    },
  );

  registerTool(
    server,
    "jira_get_backlog_issues",
    "List backlog issues for a Jira board if the Agile API is available.",
    z.object({
      boardId: idSchema,
      startAt: paginationSchema.shape.startAt,
      maxResults: paginationSchema.shape.maxResults,
      fields: z.array(z.string().trim().min(1)).optional(),
    }),
    readOnlyAnnotations,
    async ({ boardId, startAt, maxResults, fields }) => {
      const issues = await context.client.get<Record<string, unknown>>(
        jiraAgile(`/board/${encodeURIComponent(String(boardId))}/backlog`),
        {
          query: {
            startAt,
            maxResults,
            fields: fields?.join(","),
          },
        },
      );
      return toolSuccess("jira_get_backlog_issues", issues, {
        compatibility: "optional",
      });
    },
  );

  registerTool(
    server,
    "jira_get_board_epics",
    "List board epics if supported by the Jira Software Agile API on this instance.",
    z.object({
      boardId: idSchema,
      done: z.boolean().optional(),
      startAt: paginationSchema.shape.startAt,
      maxResults: paginationSchema.shape.maxResults,
    }),
    readOnlyAnnotations,
    async ({ boardId, done, startAt, maxResults }) => {
      const epics = await context.client.get<Record<string, unknown>>(
        jiraAgile(`/board/${encodeURIComponent(String(boardId))}/epic`),
        {
          query: {
            done,
            startAt,
            maxResults,
          },
        },
      );
      return toolSuccess("jira_get_board_epics", epics, {
        compatibility: "uncertain",
      });
    },
  );
}
