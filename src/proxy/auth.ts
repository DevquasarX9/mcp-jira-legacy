import type { IncomingHttpHeaders } from "node:http";
import type { ProxyConfig } from "./config.js";
import { ProxyError } from "./errors.js";
import { timingSafeMatch } from "./security.js";

export const LOCAL_PROXY_TOKEN_HEADER = "x-jira-proxy-token";

export function validateLocalProxyToken(
  headers: IncomingHttpHeaders,
  expectedToken: string | undefined,
): void {
  if (expectedToken === undefined) {
    return;
  }

  const providedHeader = headers[LOCAL_PROXY_TOKEN_HEADER];
  const providedToken = Array.isArray(providedHeader) ? providedHeader[0] : providedHeader;

  if (providedToken === undefined || !timingSafeMatch(expectedToken, providedToken)) {
    throw new ProxyError(401, "LOCAL_PROXY_AUTH_FAILED", "local proxy authentication failed");
  }
}

export function buildUpstreamAuthHeaders(config: ProxyConfig): Record<string, string> {
  switch (config.jiraAuthMode) {
    case "basic": {
      const passwordOrToken = config.jiraPassword ?? config.jiraToken;
      const credentials = Buffer.from(
        `${config.jiraUsername}:${passwordOrToken}`,
        "utf8",
      ).toString("base64");

      return {
        authorization: `Basic ${credentials}`,
      };
    }
    case "bearer":
      return {
        authorization: `Bearer ${config.jiraToken}`,
      };
    case "header":
      return {
        [config.jiraAuthHeaderName!]: config.jiraAuthHeaderValue!,
      };
    case "none":
      return {};
  }
}
