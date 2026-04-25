import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult, ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { AppConfig } from "../config.js";
import { JiraClient } from "../jira/client.js";
import { JiraClientError } from "../jira/errors.js";
import { GuardError, scopeJql } from "../security/guards.js";
import { AuditLogger } from "../security/audit.js";
import { Logger } from "../utils/logger.js";
import { asJsonValue, toolError } from "../utils/result.js";

export interface ToolContext {
  readonly config: AppConfig;
  readonly client: JiraClient;
  readonly audit: AuditLogger;
  readonly logger: Logger;
}

export const jsonObjectSchema = z.record(z.unknown());
export const projectKeySchema = z.string().trim().regex(/^[A-Za-z][A-Za-z0-9_]+$/);
export const issueKeySchema = z.string().trim().regex(/^[A-Za-z][A-Za-z0-9_]+-\d+$/);
export const usernameSchema = z.string().trim().min(1);
export const idSchema = z.union([z.string().trim().min(1), z.number().int().positive()]);
export const jqlSchema = z.string().trim().min(1);
export const fieldsSchema = z.array(z.string().trim().min(1)).max(100).optional();
export const expandSchema = z.array(z.string().trim().min(1)).max(20).optional();
export const paginationSchema = z.object({
  startAt: z.number().int().min(0).optional(),
  maxResults: z.number().int().min(1).max(100).optional(),
});

export const readOnlyAnnotations: ToolAnnotations = {
  readOnlyHint: true,
  idempotentHint: true,
  destructiveHint: false,
  openWorldHint: true,
};

export const safeWriteAnnotations: ToolAnnotations = {
  readOnlyHint: false,
  idempotentHint: false,
  destructiveHint: false,
  openWorldHint: true,
};

export function normalizeToolError(operation: string, error: unknown) {
  if (error instanceof GuardError) {
    return toolError(operation, error.code, error.message);
  }

  if (error instanceof JiraClientError) {
    return toolError(
      operation,
      error.code,
      error.message,
      error.details === undefined
        ? undefined
        : asJsonValue({ status: error.status ?? null, details: error.details }),
    );
  }

  if (error instanceof z.ZodError) {
    return toolError(operation, "VALIDATION_ERROR", "Input validation failed.", asJsonValue(error.flatten()));
  }

  if (error instanceof Error) {
    return toolError(operation, "INTERNAL_ERROR", error.message);
  }

  return toolError(operation, "INTERNAL_ERROR", "Unknown server error.");
}

export function registerTool<TSchema extends z.ZodTypeAny>(
  server: McpServer,
  name: string,
  description: string,
  inputSchema: TSchema | undefined,
  annotations: ToolAnnotations | undefined,
  handler: (arguments_: z.infer<TSchema>) => Promise<CallToolResult>,
): void {
  const effectiveInputSchema = (inputSchema ?? z.object({})) as TSchema;

  (server.registerTool as unknown as (
    toolName: string,
    config: Record<string, unknown>,
    callback: (arguments_: unknown, extra: unknown) => Promise<CallToolResult>,
  ) => void)(
    name,
    {
      description,
      inputSchema: effectiveInputSchema,
      ...(annotations === undefined ? {} : { annotations }),
    },
    async (arguments_, _extra) => {
      try {
        return await handler(arguments_ as z.infer<TSchema>);
      } catch (error) {
        return normalizeToolError(name, error);
      }
    },
  );
}

export function resolveProjectKey(projectKey: string | undefined, config: AppConfig): string | undefined {
  return projectKey?.toUpperCase() ?? config.defaultProject;
}

export function scopedSearchJql(
  config: AppConfig,
  projectKey: string | undefined,
  jql: string | undefined,
): string {
  return scopeJql(config, jql ?? "", resolveProjectKey(projectKey, config));
}
