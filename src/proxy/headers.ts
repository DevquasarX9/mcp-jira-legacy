import type { IncomingHttpHeaders } from "node:http";
import { buildUpstreamAuthHeaders, LOCAL_PROXY_TOKEN_HEADER } from "./auth.js";
import type { ProxyConfig } from "./config.js";

const STRIPPED_REQUEST_HEADERS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "x-forwarded-for",
  "x-real-ip",
  "host",
  "connection",
  "transfer-encoding",
  "upgrade",
  "proxy-authorization",
  "proxy-authenticate",
  "forwarded",
  "x-http-method-override",
  "x-method-override",
  "x-forwarded-host",
  "x-forwarded-proto",
  LOCAL_PROXY_TOKEN_HEADER,
]);

const SAFE_RESPONSE_HEADERS = new Set([
  "content-type",
  "content-length",
  "cache-control",
  "etag",
  "last-modified",
]);

export function buildUpstreamHeaders(
  config: ProxyConfig,
  headers: IncomingHttpHeaders,
): Record<string, string> {
  const sanitizedHeaders: Record<string, string> = {
    accept: getHeaderValue(headers.accept) ?? "application/json",
    "user-agent": "jira-legacy-mcp-auth-proxy/0.1.0",
  };

  const contentType = getHeaderValue(headers["content-type"]);
  if (contentType !== undefined) {
    sanitizedHeaders["content-type"] = contentType;
  }

  for (const [headerName, headerValue] of Object.entries(headers)) {
    const normalizedHeaderName = headerName.toLowerCase();
    if (STRIPPED_REQUEST_HEADERS.has(normalizedHeaderName)) {
      continue;
    }

    if (
      normalizedHeaderName === "accept" ||
      normalizedHeaderName === "content-type" ||
      normalizedHeaderName === "user-agent" ||
      normalizedHeaderName === "content-length"
    ) {
      continue;
    }

    const value = getHeaderValue(headerValue);
    if (value !== undefined && normalizedHeaderName.startsWith("x-")) {
      sanitizedHeaders[normalizedHeaderName] = value;
    }
  }

  return {
    ...sanitizedHeaders,
    ...buildUpstreamAuthHeaders(config),
  };
}

export function sanitizeResponseHeaders(headers: IncomingHttpHeaders): Record<string, string> {
  const sanitizedHeaders: Record<string, string> = {};

  for (const [headerName, headerValue] of Object.entries(headers)) {
    const normalizedHeaderName = headerName.toLowerCase();
    if (!SAFE_RESPONSE_HEADERS.has(normalizedHeaderName)) {
      continue;
    }

    const value = getHeaderValue(headerValue);
    if (value !== undefined) {
      sanitizedHeaders[normalizedHeaderName] = value;
    }
  }

  return sanitizedHeaders;
}

function getHeaderValue(value: string | string[] | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return Array.isArray(value) ? value[0] : value;
}
