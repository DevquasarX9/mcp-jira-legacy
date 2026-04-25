import type { BodyInit, Dispatcher, HeadersInit, Response } from "undici";
import { fetch as undiciFetch, getSetCookies } from "undici";
import type { AppConfig } from "../config.js";
import { jiraAuth } from "./endpoints.js";
import { JiraClientError, normalizeJiraErrorMessage } from "./errors.js";

interface AuthFetchOptions {
  readonly dispatcher?: Dispatcher;
  readonly fetchImplementation: (
    input: string | URL,
    init?: {
      method?: string;
      headers?: Record<string, string>;
      body?: BodyInit;
      signal?: AbortSignal;
      dispatcher?: Dispatcher;
    },
  ) => Promise<Response>;
}

export async function buildAuthHeaders(
  config: AppConfig,
  authFetchOptions: AuthFetchOptions,
  baseUrl: string,
  cachedSessionCookie?: string,
): Promise<HeadersInit> {
  switch (config.authMode) {
    case "basic": {
      const passwordOrToken = config.password ?? config.token;
      const encodedCredentials = Buffer.from(`${config.username}:${passwordOrToken}`).toString("base64");

      return {
        Authorization: `Basic ${encodedCredentials}`,
      };
    }
    case "bearer":
      return {
        Authorization: `Bearer ${config.token}`,
      };
    case "header":
      return {
        [config.authHeaderName]: config.authHeaderValue,
      };
    case "cookie":
      return {
        Cookie:
          cachedSessionCookie ??
          (await createSessionCookie(config, authFetchOptions.fetchImplementation, baseUrl, authFetchOptions.dispatcher)),
      };
  }
}

export async function createSessionCookie(
  config: AppConfig,
  fetchImplementation: (
    input: string | URL,
    init?: {
      method?: string;
      headers?: Record<string, string>;
      body?: BodyInit;
      signal?: AbortSignal;
      dispatcher?: Dispatcher;
    },
  ) => Promise<Response>,
  baseUrl: string,
  dispatcher?: Dispatcher,
): Promise<string> {
  const response = await fetchImplementation(`${baseUrl}${jiraAuth("/session")}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username: config.username,
      password: config.password,
    }),
    dispatcher,
  });

  if (!response.ok) {
    const body = await response
      .json()
      .catch(() => null);
    throw new JiraClientError(
      "AUTHENTICATION_FAILED",
      normalizeJiraErrorMessage(response.status, body, "Failed to create Jira session."),
      response.status,
      body,
    );
  }

  const setCookies = getSetCookies(response.headers);

  if (setCookies.length === 0) {
    throw new JiraClientError(
      "AUTHENTICATION_FAILED",
      "Jira session authentication did not return any cookies.",
      response.status,
    );
  }

  return setCookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
}
