import type { ProxyConfig } from "./config.js";

export interface RouteRule {
  readonly method: string;
  readonly pattern: string;
  readonly access: "read" | "write";
}

export interface AllowlistDecision {
  readonly allowed: boolean;
  readonly reason: "allowed" | "route_not_allowed" | "read_only";
  readonly access?: "read" | "write";
}

const READ_RULES: RouteRule[] = [
  { method: "GET", pattern: "/rest/api/2/serverInfo", access: "read" },
  { method: "GET", pattern: "/rest/api/2/myself", access: "read" },
  { method: "GET", pattern: "/rest/api/2/mypermissions", access: "read" },
  { method: "GET", pattern: "/rest/api/2/project", access: "read" },
  { method: "GET", pattern: "/rest/api/2/project/*", access: "read" },
  { method: "GET", pattern: "/rest/api/2/project/*/components", access: "read" },
  { method: "GET", pattern: "/rest/api/2/project/*/versions", access: "read" },
  { method: "GET", pattern: "/rest/api/2/project/*/role", access: "read" },
  { method: "GET", pattern: "/rest/api/2/project/*/statuses", access: "read" },
  { method: "GET", pattern: "/rest/api/2/issue/*", access: "read" },
  { method: "GET", pattern: "/rest/api/2/issue/*/comment", access: "read" },
  { method: "GET", pattern: "/rest/api/2/issue/*/transitions", access: "read" },
  { method: "GET", pattern: "/rest/api/2/issue/*/worklog", access: "read" },
  { method: "GET", pattern: "/rest/api/2/search", access: "read" },
  { method: "POST", pattern: "/rest/api/2/search", access: "read" },
  { method: "GET", pattern: "/rest/api/2/filter/favourite", access: "read" },
  { method: "GET", pattern: "/rest/api/2/filter/*", access: "read" },
  { method: "GET", pattern: "/rest/api/2/field", access: "read" },
  { method: "GET", pattern: "/rest/api/2/priority", access: "read" },
  { method: "GET", pattern: "/rest/api/2/status", access: "read" },
  { method: "GET", pattern: "/rest/api/2/issuetype", access: "read" },
  { method: "GET", pattern: "/rest/api/2/user", access: "read" },
  { method: "GET", pattern: "/rest/api/2/user/search", access: "read" },
  { method: "GET", pattern: "/rest/api/2/user/assignable/search", access: "read" },
];

const WRITE_RULES: RouteRule[] = [
  { method: "POST", pattern: "/rest/api/2/issue", access: "write" },
  { method: "PUT", pattern: "/rest/api/2/issue/*", access: "write" },
  { method: "POST", pattern: "/rest/api/2/issue/*/comment", access: "write" },
  { method: "PUT", pattern: "/rest/api/2/issue/*/comment/*", access: "write" },
  { method: "POST", pattern: "/rest/api/2/issue/*/transitions", access: "write" },
  { method: "PUT", pattern: "/rest/api/2/issue/*/assignee", access: "write" },
  { method: "POST", pattern: "/rest/api/2/issue/*/worklog", access: "write" },
  { method: "POST", pattern: "/rest/api/2/issueLink", access: "write" },
];

const AGILE_READ_RULES: RouteRule[] = [
  { method: "GET", pattern: "/rest/agile/1.0/board", access: "read" },
  { method: "GET", pattern: "/rest/agile/1.0/board/*", access: "read" },
  { method: "GET", pattern: "/rest/agile/1.0/board/*/sprint", access: "read" },
  { method: "GET", pattern: "/rest/agile/1.0/board/*/backlog", access: "read" },
  { method: "GET", pattern: "/rest/agile/1.0/board/*/epic", access: "read" },
  { method: "GET", pattern: "/rest/agile/1.0/sprint/*", access: "read" },
  { method: "GET", pattern: "/rest/agile/1.0/sprint/*/issue", access: "read" },
];

const ATTACHMENT_WRITE_RULES: RouteRule[] = [
  { method: "POST", pattern: "/rest/api/2/issue/*/attachments", access: "write" },
];

export function buildAllowlist(config: ProxyConfig): RouteRule[] {
  const readRules = config.enableAgileApi ? [...READ_RULES, ...AGILE_READ_RULES] : READ_RULES;
  const writeRules = [
    ...WRITE_RULES,
    ...(config.enableAttachments ? ATTACHMENT_WRITE_RULES : []),
  ];

  if (!config.proxyEnableWrite) {
    return readRules;
  }

  return [...readRules, ...writeRules];
}

export function evaluateRouteAccess(
  config: ProxyConfig,
  method: string,
  normalizedPath: string,
): AllowlistDecision {
  const matchedRule = buildAllowlist(config).find((rule) => {
    if (rule.method !== method) {
      return false;
    }

    return matchPattern(rule.pattern, normalizedPath);
  });

  if (matchedRule === undefined) {
    return {
      allowed: false,
      reason: "route_not_allowed",
    };
  }

  if (config.proxyReadOnly && matchedRule.access === "write") {
    return {
      allowed: false,
      reason: "read_only",
      access: "write",
    };
  }

  return {
    allowed: true,
    reason: "allowed",
    access: matchedRule.access,
  };
}

export function matchPattern(pattern: string, normalizedPath: string): boolean {
  const patternSegments = pattern.split("/").filter(Boolean);
  const pathSegments = normalizedPath.split("/").filter(Boolean);

  if (patternSegments.length !== pathSegments.length) {
    return false;
  }

  return patternSegments.every((segment, index) => {
    if (segment === "*") {
      return pathSegments[index] !== undefined && pathSegments[index].length > 0;
    }

    return segment === pathSegments[index];
  });
}
