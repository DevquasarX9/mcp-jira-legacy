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
    JIRA_PROXY_UPSTREAM_BASE_URL: z.string().url(),
    JIRA_PROXY_AUTH_MODE: proxyAuthModeSchema,
    JIRA_PROXY_USERNAME: z.string().optional(),
    JIRA_PROXY_PASSWORD: z.string().optional(),
    JIRA_PROXY_TOKEN: z.string().optional(),
    JIRA_PROXY_AUTH_HEADER_NAME: z.string().optional(),
    JIRA_PROXY_AUTH_HEADER_VALUE: z.string().optional(),
    JIRA_PROXY_HOST: z.string().optional(),
    JIRA_PROXY_PORT: z.string().optional(),
    JIRA_PROXY_LOCAL_TOKEN: z.string().optional(),
    JIRA_PROXY_ENABLE_WRITE: z.string().optional(),
    JIRA_PROXY_ENABLE_AGILE_API: z.string().optional(),
    JIRA_PROXY_MAX_REQUEST_BYTES: z.string().optional(),
    JIRA_PROXY_MAX_RESPONSE_BYTES: z.string().optional(),
    JIRA_PROXY_UPSTREAM_TIMEOUT_MS: z.string().optional(),
    JIRA_PROXY_STRICT_SSL: z.string().optional(),
    JIRA_PROXY_CA_CERT_PATH: z.string().optional(),
    JIRA_PROXY_LOG_LEVEL: logLevelSchema.optional(),
    JIRA_PROXY_ALLOW_NON_LOCAL_BIND: z.string().optional(),
  })
  .superRefine((value, context) => {
    switch (value.JIRA_PROXY_AUTH_MODE) {
      case "basic":
        if (!isDefined(value.JIRA_PROXY_USERNAME)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["JIRA_PROXY_USERNAME"],
            message: "JIRA_PROXY_USERNAME is required when JIRA_PROXY_AUTH_MODE=basic.",
          });
        }

        if (!isDefined(value.JIRA_PROXY_PASSWORD) && !isDefined(value.JIRA_PROXY_TOKEN)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["JIRA_PROXY_PASSWORD"],
            message: "JIRA_PROXY_PASSWORD or JIRA_PROXY_TOKEN is required when JIRA_PROXY_AUTH_MODE=basic.",
          });
        }
        break;
      case "bearer":
        if (!isDefined(value.JIRA_PROXY_TOKEN)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["JIRA_PROXY_TOKEN"],
            message: "JIRA_PROXY_TOKEN is required when JIRA_PROXY_AUTH_MODE=bearer.",
          });
        }
        break;
      case "header":
        if (
          !isDefined(value.JIRA_PROXY_AUTH_HEADER_NAME) ||
          !isDefined(value.JIRA_PROXY_AUTH_HEADER_VALUE)
        ) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["JIRA_PROXY_AUTH_HEADER_NAME"],
            message: "JIRA_PROXY_AUTH_HEADER_NAME and JIRA_PROXY_AUTH_HEADER_VALUE are required when JIRA_PROXY_AUTH_MODE=header.",
          });
        }
        break;
      case "none":
        break;
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
  readonly proxyEnableWrite: boolean;
  readonly enableAgileApi: boolean;
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
  const proxyHost = data.JIRA_PROXY_HOST ?? "127.0.0.1";
  const allowNonLocalBind = parseBoolean(data.JIRA_PROXY_ALLOW_NON_LOCAL_BIND, false);
  assertSafeBindHost(proxyHost, allowNonLocalBind);

  const caCertPath = normalizeOptionalString(data.JIRA_PROXY_CA_CERT_PATH);
  const resolvedCaCertPath = caCertPath === undefined ? undefined : path.resolve(caCertPath);

  return {
    jiraUpstreamBaseUrl: sanitizeBaseUrl(data.JIRA_PROXY_UPSTREAM_BASE_URL),
    jiraAuthMode: data.JIRA_PROXY_AUTH_MODE,
    jiraUsername: normalizeOptionalString(data.JIRA_PROXY_USERNAME),
    jiraPassword: normalizeOptionalString(data.JIRA_PROXY_PASSWORD),
    jiraToken: normalizeOptionalString(data.JIRA_PROXY_TOKEN),
    jiraAuthHeaderName: normalizeOptionalString(data.JIRA_PROXY_AUTH_HEADER_NAME),
    jiraAuthHeaderValue: normalizeOptionalString(data.JIRA_PROXY_AUTH_HEADER_VALUE),
    proxyHost,
    proxyPort: parseInteger(data.JIRA_PROXY_PORT, 4877),
    localProxyToken: normalizeOptionalString(data.JIRA_PROXY_LOCAL_TOKEN),
    proxyEnableWrite: parseBoolean(data.JIRA_PROXY_ENABLE_WRITE, false),
    enableAgileApi: parseBoolean(data.JIRA_PROXY_ENABLE_AGILE_API, false),
    maxRequestBytes: parseInteger(data.JIRA_PROXY_MAX_REQUEST_BYTES, 1_048_576),
    maxResponseBytes: parseInteger(data.JIRA_PROXY_MAX_RESPONSE_BYTES, 10_485_760),
    upstreamTimeoutMs: parseInteger(data.JIRA_PROXY_UPSTREAM_TIMEOUT_MS, 30_000),
    strictSsl: parseBoolean(data.JIRA_PROXY_STRICT_SSL, true),
    caCertPath: resolvedCaCertPath,
    caCert: resolvedCaCertPath === undefined ? undefined : fs.readFileSync(resolvedCaCertPath, "utf8"),
    logLevel: data.JIRA_PROXY_LOG_LEVEL ?? "info",
    allowNonLocalBind,
  };
}

function sanitizeBaseUrl(rawBaseUrl: string): string {
  const url = new URL(rawBaseUrl);

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new ProxyConfigurationError("JIRA_PROXY_UPSTREAM_BASE_URL must use http or https.");
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
