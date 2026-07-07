import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { LogLevel } from "../utils/logger.js";
import { parseBoolean, parseInteger } from "../utils/validation.js";
import { ProxyConfigurationError } from "./errors.js";
import { assertSafeBindHost } from "./security.js";

const proxyAuthModeSchema = z.enum(["basic", "bearer", "header", "none"]);
const logLevelSchema = z.enum(["debug", "info", "warn", "error"]);

const rawProxyConfigSchema = z
  .object({
    PROXY_JIRA_UPSTREAM_BASE_URL: z.string().url().optional(),
    JIRA_UPSTREAM_BASE_URL: z.string().url().optional(),
    PROXY_JIRA_AUTH_MODE: proxyAuthModeSchema.optional(),
    JIRA_AUTH_MODE: proxyAuthModeSchema.optional(),
    PROXY_JIRA_USERNAME: z.string().optional(),
    JIRA_USERNAME: z.string().optional(),
    PROXY_JIRA_PASSWORD: z.string().optional(),
    JIRA_PASSWORD: z.string().optional(),
    PROXY_JIRA_TOKEN: z.string().optional(),
    JIRA_TOKEN: z.string().optional(),
    PROXY_JIRA_AUTH_HEADER_NAME: z.string().optional(),
    JIRA_AUTH_HEADER_NAME: z.string().optional(),
    PROXY_JIRA_AUTH_HEADER_VALUE: z.string().optional(),
    JIRA_AUTH_HEADER_VALUE: z.string().optional(),
    PROXY_HOST: z.string().optional(),
    PROXY_PORT: z.string().optional(),
    PROXY_LOCAL_TOKEN: z.string().optional(),
    LOCAL_PROXY_TOKEN: z.string().optional(),
    PROXY_READ_ONLY: z.string().optional(),
    PROXY_ENABLE_WRITE: z.string().optional(),
    PROXY_ENABLE_DESTRUCTIVE: z.string().optional(),
    PROXY_ENABLE_AGILE_API: z.string().optional(),
    ENABLE_AGILE_API: z.string().optional(),
    PROXY_ENABLE_ATTACHMENTS: z.string().optional(),
    ENABLE_ATTACHMENTS: z.string().optional(),
    PROXY_MAX_REQUEST_BYTES: z.string().optional(),
    MAX_REQUEST_BYTES: z.string().optional(),
    PROXY_MAX_RESPONSE_BYTES: z.string().optional(),
    MAX_RESPONSE_BYTES: z.string().optional(),
    PROXY_UPSTREAM_TIMEOUT_MS: z.string().optional(),
    UPSTREAM_TIMEOUT_MS: z.string().optional(),
    PROXY_STRICT_SSL: z.string().optional(),
    STRICT_SSL: z.string().optional(),
    PROXY_CA_CERT_PATH: z.string().optional(),
    CA_CERT_PATH: z.string().optional(),
    PROXY_LOG_LEVEL: logLevelSchema.optional(),
    LOG_LEVEL: logLevelSchema.optional(),
    PROXY_ALLOW_NON_LOCAL_BIND: z.string().optional(),
    ALLOW_NON_LOCAL_BIND: z.string().optional(),
  })
  .superRefine((value, context) => {
    const jiraAuthMode = value.PROXY_JIRA_AUTH_MODE ?? value.JIRA_AUTH_MODE;
    const jiraUsername = value.PROXY_JIRA_USERNAME ?? value.JIRA_USERNAME;
    const jiraPassword = value.PROXY_JIRA_PASSWORD ?? value.JIRA_PASSWORD;
    const jiraToken = value.PROXY_JIRA_TOKEN ?? value.JIRA_TOKEN;
    const jiraAuthHeaderName = value.PROXY_JIRA_AUTH_HEADER_NAME ?? value.JIRA_AUTH_HEADER_NAME;
    const jiraAuthHeaderValue = value.PROXY_JIRA_AUTH_HEADER_VALUE ?? value.JIRA_AUTH_HEADER_VALUE;

    if (!isDefined(value.PROXY_JIRA_UPSTREAM_BASE_URL ?? value.JIRA_UPSTREAM_BASE_URL)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["PROXY_JIRA_UPSTREAM_BASE_URL"],
        message: "PROXY_JIRA_UPSTREAM_BASE_URL or JIRA_UPSTREAM_BASE_URL is required.",
      });
    }

    if (jiraAuthMode === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["PROXY_JIRA_AUTH_MODE"],
        message: "PROXY_JIRA_AUTH_MODE or JIRA_AUTH_MODE is required.",
      });
      return;
    }

    switch (jiraAuthMode) {
      case "basic":
        if (!isDefined(jiraUsername)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["PROXY_JIRA_USERNAME"],
            message: "PROXY_JIRA_USERNAME or JIRA_USERNAME is required when proxy Jira auth mode is basic.",
          });
        }

        if (!isDefined(jiraPassword) && !isDefined(jiraToken)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["PROXY_JIRA_PASSWORD"],
            message: "PROXY_JIRA_PASSWORD, PROXY_JIRA_TOKEN, JIRA_PASSWORD, or JIRA_TOKEN is required when proxy Jira auth mode is basic.",
          });
        }
        break;
      case "bearer":
        if (!isDefined(jiraToken)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["PROXY_JIRA_TOKEN"],
            message: "PROXY_JIRA_TOKEN or JIRA_TOKEN is required when proxy Jira auth mode is bearer.",
          });
        }
        break;
      case "header":
        if (!isDefined(jiraAuthHeaderName) || !isDefined(jiraAuthHeaderValue)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["PROXY_JIRA_AUTH_HEADER_NAME"],
            message: "proxy Jira auth header name and value are required when proxy Jira auth mode is header.",
          });
        }
        break;
      case "none":
        break;
    }

    if (
      parseBoolean(value.PROXY_READ_ONLY, true) &&
      parseBoolean(value.PROXY_ENABLE_WRITE, false)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["PROXY_ENABLE_WRITE"],
        message: "PROXY_ENABLE_WRITE=true requires PROXY_READ_ONLY=false.",
      });
    }
  });

export interface ProxyConfig {
  readonly jiraUpstreamBaseUrl: string;
  readonly jiraAuthMode: z.infer<typeof proxyAuthModeSchema>;
  readonly jiraUsername?: string;
  readonly jiraPassword?: string;
  readonly jiraToken?: string;
  readonly jiraAuthHeaderName?: string;
  readonly jiraAuthHeaderValue?: string;
  readonly proxyHost: string;
  readonly proxyPort: number;
  readonly localProxyToken?: string;
  readonly proxyReadOnly: boolean;
  readonly proxyEnableWrite: boolean;
  readonly proxyEnableDestructive: boolean;
  readonly enableAgileApi: boolean;
  readonly enableAttachments: boolean;
  readonly maxRequestBytes: number;
  readonly maxResponseBytes: number;
  readonly upstreamTimeoutMs: number;
  readonly strictSsl: boolean;
  readonly caCertPath?: string;
  readonly caCert?: string;
  readonly logLevel: LogLevel;
  readonly allowNonLocalBind: boolean;
}

export function loadProxyConfig(env: NodeJS.ProcessEnv = process.env): ProxyConfig {
  const parsedConfig = rawProxyConfigSchema.safeParse(env);

  if (!parsedConfig.success) {
    throw new ProxyConfigurationError(
      parsedConfig.error.issues.map((issue) => issue.message).join("; "),
    );
  }

  const data = parsedConfig.data;
  const jiraUpstreamBaseUrl = data.PROXY_JIRA_UPSTREAM_BASE_URL ?? data.JIRA_UPSTREAM_BASE_URL;
  const jiraAuthMode = data.PROXY_JIRA_AUTH_MODE ?? data.JIRA_AUTH_MODE;
  const proxyHost = data.PROXY_HOST ?? "127.0.0.1";
  const allowNonLocalBind = parseBoolean(
    data.PROXY_ALLOW_NON_LOCAL_BIND ?? data.ALLOW_NON_LOCAL_BIND,
    false,
  );
  assertSafeBindHost(proxyHost, allowNonLocalBind);

  const caCertPath = normalizeOptionalString(data.PROXY_CA_CERT_PATH ?? data.CA_CERT_PATH);
  const resolvedCaCertPath = caCertPath === undefined ? undefined : path.resolve(caCertPath);

  return {
    jiraUpstreamBaseUrl: sanitizeBaseUrl(jiraUpstreamBaseUrl!),
    jiraAuthMode: jiraAuthMode!,
    jiraUsername: normalizeOptionalString(data.PROXY_JIRA_USERNAME ?? data.JIRA_USERNAME),
    jiraPassword: normalizeOptionalString(data.PROXY_JIRA_PASSWORD ?? data.JIRA_PASSWORD),
    jiraToken: normalizeOptionalString(data.PROXY_JIRA_TOKEN ?? data.JIRA_TOKEN),
    jiraAuthHeaderName: normalizeOptionalString(
      data.PROXY_JIRA_AUTH_HEADER_NAME ?? data.JIRA_AUTH_HEADER_NAME,
    ),
    jiraAuthHeaderValue: normalizeOptionalString(
      data.PROXY_JIRA_AUTH_HEADER_VALUE ?? data.JIRA_AUTH_HEADER_VALUE,
    ),
    proxyHost,
    proxyPort: parseInteger(data.PROXY_PORT, 4877),
    localProxyToken: normalizeOptionalString(data.PROXY_LOCAL_TOKEN ?? data.LOCAL_PROXY_TOKEN),
    proxyReadOnly: parseBoolean(data.PROXY_READ_ONLY, true),
    proxyEnableWrite: parseBoolean(data.PROXY_ENABLE_WRITE, false),
    proxyEnableDestructive: parseBoolean(data.PROXY_ENABLE_DESTRUCTIVE, false),
    enableAgileApi: parseBoolean(data.PROXY_ENABLE_AGILE_API ?? data.ENABLE_AGILE_API, false),
    enableAttachments: parseBoolean(
      data.PROXY_ENABLE_ATTACHMENTS ?? data.ENABLE_ATTACHMENTS,
      false,
    ),
    maxRequestBytes: parseInteger(data.PROXY_MAX_REQUEST_BYTES ?? data.MAX_REQUEST_BYTES, 1_048_576),
    maxResponseBytes: parseInteger(
      data.PROXY_MAX_RESPONSE_BYTES ?? data.MAX_RESPONSE_BYTES,
      10_485_760,
    ),
    upstreamTimeoutMs: parseInteger(
      data.PROXY_UPSTREAM_TIMEOUT_MS ?? data.UPSTREAM_TIMEOUT_MS,
      30_000,
    ),
    strictSsl: parseBoolean(data.PROXY_STRICT_SSL ?? data.STRICT_SSL, true),
    caCertPath: resolvedCaCertPath,
    caCert: resolvedCaCertPath === undefined ? undefined : fs.readFileSync(resolvedCaCertPath, "utf8"),
    logLevel: data.PROXY_LOG_LEVEL ?? data.LOG_LEVEL ?? "info",
    allowNonLocalBind,
  };
}

function sanitizeBaseUrl(rawBaseUrl: string): string {
  const url = new URL(rawBaseUrl);

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new ProxyConfigurationError("JIRA_UPSTREAM_BASE_URL must use http or https.");
  }

  url.pathname = url.pathname.replace(/\/$/, "");
  url.search = "";
  url.hash = "";

  return url.toString().replace(/\/$/, "");
}

function isDefined(value: string | undefined): boolean {
  return normalizeOptionalString(value) !== undefined;
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length === 0 ? undefined : trimmedValue;
}
