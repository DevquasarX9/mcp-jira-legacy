import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import {
  DEFAULT_MAX_ATTACHMENT_BYTES,
  DEFAULT_MAX_RESPONSE_BYTES,
  DEFAULT_MAX_RESULTS,
  DEFAULT_TIMEOUT_MS,
} from "./security/limits.js";
import type { LogLevel } from "./utils/logger.js";
import { normalizeBaseUrl, parseBoolean, parseCsv, parseInteger } from "./utils/validation.js";

const authModeSchema = z.enum(["basic", "bearer", "cookie", "header"]);
const logLevelSchema = z.enum(["debug", "info", "warn", "error"]);

const rawConfigSchema = z
  .object({
    JIRA_BASE_URL: z.string().url(),
    JIRA_AUTH_MODE: authModeSchema,
    JIRA_USERNAME: z.string().optional(),
    JIRA_PASSWORD: z.string().optional(),
    JIRA_TOKEN: z.string().optional(),
    JIRA_STRICT_SSL: z.string().optional(),
    JIRA_CA_CERT_PATH: z.string().optional(),
    JIRA_TIMEOUT_MS: z.string().optional(),
    JIRA_MAX_RESULTS: z.string().optional(),
    JIRA_MAX_RESPONSE_BYTES: z.string().optional(),
    JIRA_MAX_ATTACHMENT_BYTES: z.string().optional(),
    JIRA_ENABLE_WRITE_TOOLS: z.string().optional(),
    JIRA_ENABLE_DESTRUCTIVE_TOOLS: z.string().optional(),
    JIRA_ALLOWED_PROJECTS: z.string().optional(),
    JIRA_DENIED_PROJECTS: z.string().optional(),
    JIRA_DEFAULT_PROJECT: z.string().optional(),
    JIRA_LOG_LEVEL: logLevelSchema.optional(),
    JIRA_AUDIT_LOG: z.string().optional(),
    JIRA_DRY_RUN: z.string().optional(),
    JIRA_READ_ONLY: z.string().optional(),
    JIRA_AUTH_HEADER_NAME: z.string().optional(),
    JIRA_AUTH_HEADER_VALUE: z.string().optional(),
  })
  .superRefine((value, context) => {
    switch (value.JIRA_AUTH_MODE) {
      case "basic":
        if (!value.JIRA_USERNAME) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["JIRA_USERNAME"],
            message: "JIRA_USERNAME is required for basic auth.",
          });
        }

        if (!value.JIRA_PASSWORD && !value.JIRA_TOKEN) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["JIRA_PASSWORD"],
            message: "JIRA_PASSWORD or JIRA_TOKEN is required for basic auth.",
          });
        }
        break;
      case "bearer":
        if (!value.JIRA_TOKEN) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["JIRA_TOKEN"],
            message: "JIRA_TOKEN is required for bearer auth.",
          });
        }
        break;
      case "cookie":
        if (!value.JIRA_USERNAME) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["JIRA_USERNAME"],
            message: "JIRA_USERNAME is required for cookie auth.",
          });
        }

        if (!value.JIRA_PASSWORD) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["JIRA_PASSWORD"],
            message: "JIRA_PASSWORD is required for cookie auth.",
          });
        }
        break;
      case "header":
        if (!value.JIRA_AUTH_HEADER_NAME || !value.JIRA_AUTH_HEADER_VALUE) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["JIRA_AUTH_HEADER_NAME"],
            message: "JIRA_AUTH_HEADER_NAME and JIRA_AUTH_HEADER_VALUE are required for header auth.",
          });
        }
        break;
    }
  });

export interface AppConfig {
  readonly baseUrl: string;
  readonly authMode: z.infer<typeof authModeSchema>;
  readonly username?: string;
  readonly password?: string;
  readonly token?: string;
  readonly strictSsl: boolean;
  readonly caCertPath?: string;
  readonly caCert?: string;
  readonly timeoutMs: number;
  readonly maxResults: number;
  readonly maxResponseBytes: number;
  readonly maxAttachmentBytes: number;
  readonly enableWriteTools: boolean;
  readonly enableDestructiveTools: boolean;
  readonly allowedProjects: string[];
  readonly deniedProjects: string[];
  readonly defaultProject?: string;
  readonly logLevel: LogLevel;
  readonly auditLog: boolean;
  readonly dryRun: boolean;
  readonly readOnly: boolean;
  readonly authHeaderName: string;
  readonly authHeaderValue: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsedConfig = rawConfigSchema.parse(env);

  const caCertPath =
    parsedConfig.JIRA_CA_CERT_PATH && parsedConfig.JIRA_CA_CERT_PATH.trim().length > 0
      ? path.resolve(parsedConfig.JIRA_CA_CERT_PATH)
      : undefined;

  return {
    baseUrl: normalizeBaseUrl(parsedConfig.JIRA_BASE_URL),
    authMode: parsedConfig.JIRA_AUTH_MODE,
    username: parsedConfig.JIRA_USERNAME,
    password: parsedConfig.JIRA_PASSWORD,
    token: parsedConfig.JIRA_TOKEN,
    strictSsl: parseBoolean(parsedConfig.JIRA_STRICT_SSL, true),
    caCertPath,
    caCert: caCertPath ? fs.readFileSync(caCertPath, "utf8") : undefined,
    timeoutMs: parseInteger(parsedConfig.JIRA_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
    maxResults: parseInteger(parsedConfig.JIRA_MAX_RESULTS, DEFAULT_MAX_RESULTS),
    maxResponseBytes: parseInteger(parsedConfig.JIRA_MAX_RESPONSE_BYTES, DEFAULT_MAX_RESPONSE_BYTES),
    maxAttachmentBytes: parseInteger(
      parsedConfig.JIRA_MAX_ATTACHMENT_BYTES,
      DEFAULT_MAX_ATTACHMENT_BYTES,
    ),
    enableWriteTools: parseBoolean(parsedConfig.JIRA_ENABLE_WRITE_TOOLS, false),
    enableDestructiveTools: parseBoolean(parsedConfig.JIRA_ENABLE_DESTRUCTIVE_TOOLS, false),
    allowedProjects: parseCsv(parsedConfig.JIRA_ALLOWED_PROJECTS).map((value) => value.toUpperCase()),
    deniedProjects: parseCsv(parsedConfig.JIRA_DENIED_PROJECTS).map((value) => value.toUpperCase()),
    defaultProject: parsedConfig.JIRA_DEFAULT_PROJECT?.toUpperCase(),
    logLevel: parsedConfig.JIRA_LOG_LEVEL ?? "info",
    auditLog: parseBoolean(parsedConfig.JIRA_AUDIT_LOG, false),
    dryRun: parseBoolean(parsedConfig.JIRA_DRY_RUN, false),
    readOnly: parseBoolean(parsedConfig.JIRA_READ_ONLY, true),
    authHeaderName: parsedConfig.JIRA_AUTH_HEADER_NAME ?? "",
    authHeaderValue: parsedConfig.JIRA_AUTH_HEADER_VALUE ?? "",
  };
}
