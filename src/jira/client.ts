import fs from "node:fs/promises";
import { File } from "node:buffer";
import { Agent, FormData, fetch as undiciFetch, type BodyInit, type Dispatcher, type Response } from "undici";
import type { AppConfig } from "../config.js";
import { ABSOLUTE_MAX_RESULTS } from "../security/limits.js";
import { Logger } from "../utils/logger.js";
import { clampNumber } from "../utils/validation.js";
import { buildAuthHeaders } from "./auth.js";
import { jiraApi } from "./endpoints.js";
import { JiraClientError, normalizeJiraErrorMessage } from "./errors.js";
import { collectPaginated } from "./pagination.js";
import type { JiraIssue, JiraPaginatedResponse } from "./types.js";

export interface JiraRequestOptions {
  readonly query?: Record<string, string | number | boolean | undefined>;
  readonly body?: BodyInit | object | undefined;
  readonly headers?: Record<string, string>;
  readonly accept?: string;
  readonly contentType?: string;
}

export interface JiraSearchOptions {
  readonly jql: string;
  readonly fields?: string[];
  readonly expand?: string[];
  readonly startAt?: number;
  readonly maxResults?: number;
  readonly validateQuery?: boolean;
}

export type FetchImplementation = (
  input: string | URL,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: BodyInit;
    signal?: AbortSignal;
    dispatcher?: Dispatcher;
  },
) => Promise<Response>;

export class JiraClient {
  private readonly dispatcher: Dispatcher;
  private sessionCookie?: string;

  public constructor(
    private readonly config: AppConfig,
    private readonly logger: Logger,
    private readonly fetchImplementation: FetchImplementation = undiciFetch,
  ) {
    this.dispatcher = new Agent({
      connect: {
        rejectUnauthorized: config.strictSsl,
        ...(config.caCert === undefined ? {} : { ca: config.caCert }),
      },
    });
  }

  public async close(): Promise<void> {
    await this.dispatcher.close();
  }

  public async get<T>(path: string, options?: JiraRequestOptions): Promise<T> {
    return this.requestJson<T>("GET", path, options);
  }

  public async post<T>(path: string, options?: JiraRequestOptions): Promise<T> {
    return this.requestJson<T>("POST", path, options);
  }

  public async put<T>(path: string, options?: JiraRequestOptions): Promise<T> {
    return this.requestJson<T>("PUT", path, options);
  }

  public async delete<T>(path: string, options?: JiraRequestOptions): Promise<T> {
    return this.requestJson<T>("DELETE", path, options);
  }

  public async getServerInfo<T>(): Promise<T> {
    return this.get<T>(jiraApi("/serverInfo"));
  }

  public async getCurrentUser<T>(): Promise<T> {
    return this.get<T>(jiraApi("/myself"));
  }

  public async getPermissions<T>(permissions?: string[]): Promise<T> {
    return this.get<T>(jiraApi("/mypermissions"), {
      query: permissions && permissions.length > 0 ? { permissions: permissions.join(",") } : undefined,
    });
  }

  public async searchIssues<T>(options: JiraSearchOptions): Promise<T> {
    const clampedMaxResults = clampNumber(
      options.maxResults ?? this.config.maxResults,
      1,
      Math.min(this.config.maxResults, ABSOLUTE_MAX_RESULTS),
    );

    const payload = {
      jql: options.jql,
      startAt: options.startAt ?? 0,
      maxResults: clampedMaxResults,
      ...(options.fields?.length ? { fields: options.fields } : {}),
      ...(options.expand?.length ? { expand: options.expand } : {}),
      ...(options.validateQuery === undefined ? {} : { validateQuery: options.validateQuery }),
    };

    const serializedPayload = JSON.stringify(payload);
    const useGet = serializedPayload.length <= 1_500;

    if (useGet) {
      return this.get<T>(jiraApi("/search"), {
        query: {
          jql: payload.jql,
          startAt: payload.startAt,
          maxResults: payload.maxResults,
          fields: options.fields?.join(","),
          expand: options.expand?.join(","),
          validateQuery: payload.validateQuery,
        },
      });
    }

    return this.post<T>(jiraApi("/search"), {
      body: payload,
    });
  }

  public async searchIssuesPage(
    options: JiraSearchOptions,
  ): Promise<JiraPaginatedResponse<JiraIssue>> {
    return this.searchIssues<JiraPaginatedResponse<JiraIssue>>(options);
  }

  public async searchIssuesCollection(
    options: JiraSearchOptions,
    maxItems = 200,
  ): Promise<Awaited<ReturnType<typeof collectPaginated<JiraIssue>>>> {
    return collectPaginated<JiraIssue>(
      (startAt, maxResults) =>
        this.searchIssuesPage({
          ...options,
          startAt,
          maxResults,
        }),
      {
        pageSize: Math.min(this.config.maxResults, ABSOLUTE_MAX_RESULTS),
        maxItems,
      },
    );
  }

  public async uploadAttachment<T>(
    issueKey: string,
    filePath: string,
    fileName?: string,
    mimeType = "application/octet-stream",
  ): Promise<T> {
    const fileBuffer = await fs.readFile(filePath);
    const formData = new FormData();
    formData.append(
      "file",
      new File([fileBuffer], fileName ?? filePath.split("/").pop() ?? "attachment.bin", {
        type: mimeType,
      }),
    );

    return this.post<T>(jiraApi(`/issue/${encodeURIComponent(issueKey)}/attachments`), {
      body: formData,
      headers: {
        "X-Atlassian-Token": "no-check",
      },
    });
  }

  public async requestJson<T>(
    method: string,
    path: string,
    options?: JiraRequestOptions,
  ): Promise<T> {
    const url = this.buildUrl(path, options?.query);
    const headers = await this.buildHeaders(options);
    const body = this.normalizeRequestBody(options?.body, options?.contentType);

    this.logger.debug("jira_request", {
      method,
      url: url.toString(),
      accept: options?.accept ?? "application/json",
    });

    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await this.fetchImplementation(url, {
        method,
        headers,
        body,
        signal: controller.signal,
        dispatcher: this.dispatcher,
      });

      const responseText = await this.readResponseText(response);
      const parsedBody = responseText.length > 0 ? this.safeJsonParse(responseText) : null;

      if (!response.ok) {
        throw new JiraClientError(
          "JIRA_REQUEST_FAILED",
          normalizeJiraErrorMessage(
            response.status,
            parsedBody,
            `Jira request failed with status ${response.status}.`,
          ),
          response.status,
          parsedBody,
        );
      }

      return parsedBody as T;
    } catch (error) {
      if (error instanceof JiraClientError) {
        throw error;
      }

      if (error instanceof Error && error.name === "AbortError") {
        throw new JiraClientError(
          "REQUEST_TIMEOUT",
          `Jira request timed out after ${this.config.timeoutMs}ms.`,
        );
      }

      throw new JiraClientError(
        "NETWORK_ERROR",
        error instanceof Error ? error.message : "Unknown Jira network error.",
      );
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  private async buildHeaders(options?: JiraRequestOptions): Promise<Record<string, string>> {
    const authHeaders = (await buildAuthHeaders(
      this.config,
      {
        dispatcher: this.dispatcher,
        fetchImplementation: this.fetchImplementation,
      },
      this.config.baseUrl,
      this.sessionCookie,
    )) as Record<string, string>;

    if (this.config.authMode === "cookie" && authHeaders.Cookie) {
      this.sessionCookie = authHeaders.Cookie;
    }

    return {
      Accept: options?.accept ?? "application/json",
      ...(options?.contentType ? { "Content-Type": options.contentType } : {}),
      ...authHeaders,
      ...(options?.headers ?? {}),
    };
  }

  private buildUrl(
    path: string,
    query?: Record<string, string | number | boolean | undefined>,
  ): URL {
    const url = new URL(path.startsWith("http") ? path : `${this.config.baseUrl}${path}`);

    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    return url;
  }

  private normalizeRequestBody(body: JiraRequestOptions["body"], contentType?: string): BodyInit | undefined {
    if (body === undefined) {
      return undefined;
    }

    if (body instanceof FormData || typeof body === "string" || body instanceof URLSearchParams) {
      return body;
    }

    if (contentType === undefined) {
      return JSON.stringify(body);
    }

    return body as BodyInit;
  }

  private async readResponseText(response: Response): Promise<string> {
    const contentLengthHeader = response.headers.get("content-length");
    const declaredLength =
      contentLengthHeader === null ? undefined : Number.parseInt(contentLengthHeader, 10);

    if (declaredLength !== undefined && declaredLength > this.config.maxResponseBytes) {
      throw new JiraClientError(
        "RESPONSE_TOO_LARGE",
        `Jira response exceeded the configured limit of ${this.config.maxResponseBytes} bytes.`,
      );
    }

    if (!response.body) {
      return "";
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      totalBytes += value.byteLength;

      if (totalBytes > this.config.maxResponseBytes) {
        throw new JiraClientError(
          "RESPONSE_TOO_LARGE",
          `Jira response exceeded the configured limit of ${this.config.maxResponseBytes} bytes.`,
        );
      }

      chunks.push(value);
    }

    return new TextDecoder().decode(Buffer.concat(chunks));
  }

  private safeJsonParse(body: string): unknown {
    try {
      return JSON.parse(body);
    } catch {
      return { raw: body };
    }
  }
}
