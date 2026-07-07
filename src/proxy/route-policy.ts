import type { ProxyConfig } from "./config.js";
import { JIRA_AGILE_PREFIX, JIRA_API_PREFIX } from "../jira/endpoints.js";

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const READ_OPERATION_OVERRIDES = new Set(["POST /rest/api/2/search"]);

export interface RoutePolicyDecision {
  readonly allowed: boolean;
  readonly reason: "allowed" | "route_not_allowed" | "read_only" | "agile_disabled";
  readonly access?: "read" | "write";
}

export function evaluateRouteAccess(
  config: ProxyConfig,
  method: string,
  normalizedPath: string,
): RoutePolicyDecision {
  if (!isJiraRestPath(config, normalizedPath)) {
    return {
      allowed: false,
      reason: normalizedPath === JIRA_AGILE_PREFIX || normalizedPath.startsWith(`${JIRA_AGILE_PREFIX}/`)
        ? "agile_disabled"
        : "route_not_allowed",
    };
  }

  if (READ_METHODS.has(method) || READ_OPERATION_OVERRIDES.has(`${method} ${normalizedPath}`)) {
    return {
      allowed: true,
      reason: "allowed",
      access: "read",
    };
  }

  if (!WRITE_METHODS.has(method)) {
    return {
      allowed: false,
      reason: "route_not_allowed",
    };
  }

  if (!config.proxyEnableWrite) {
    return {
      allowed: false,
      reason: "read_only",
      access: "write",
    };
  }

  return {
    allowed: true,
    reason: "allowed",
    access: "write",
  };
}

function isJiraRestPath(config: ProxyConfig, normalizedPath: string): boolean {
  if (normalizedPath === JIRA_API_PREFIX || normalizedPath.startsWith(`${JIRA_API_PREFIX}/`)) {
    return true;
  }

  return config.enableAgileApi && (
    normalizedPath === JIRA_AGILE_PREFIX ||
    normalizedPath.startsWith(`${JIRA_AGILE_PREFIX}/`)
  );
}
