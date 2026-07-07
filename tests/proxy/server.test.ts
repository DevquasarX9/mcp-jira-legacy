import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import type { ProxyConfig } from "../../src/proxy/config.js";
import { createProxyServer } from "../../src/proxy/server.js";
import { normalizeAndValidateRequestTarget } from "../../src/proxy/security.js";
import type { UpstreamRequestResponse } from "../../src/proxy/upstream.js";
import { Logger } from "../../src/utils/logger.js";

const baseConfig: ProxyConfig = {
  jiraUpstreamBaseUrl: "https://jira.example.com",
  jiraAuthMode: "basic",
  jiraUsername: "jira-user",
  jiraPassword: "jira-pass",
  proxyHost: "127.0.0.1",
  proxyPort: 4877,
  localProxyToken: "local-secret",
  proxyEnableWrite: false,
  enableAgileApi: false,
  maxRequestBytes: 1_048_576,
  maxResponseBytes: 128,
  upstreamTimeoutMs: 20,
  strictSsl: true,
  logLevel: "debug",
  allowNonLocalBind: false,
};

describe("proxy server", () => {
  it("rejects requests without the local proxy token", async () => {
    const logs: string[] = [];
    const app = createProxyServer(baseConfig, {
      logger: new Logger("debug", (line) => logs.push(line)),
    });

    const response = await app.inject({
      method: "GET",
      url: "/rest/api/2/serverInfo",
    });

    expect(response.statusCode).toBe(401);
    expect(logs.join("\n")).not.toContain("local-secret");

    await app.close();
  });

  it("forwards an allowed GET route and strips client auth headers", async () => {
    let upstreamHeaders: Record<string, string> = {};

    const app = createProxyServer(baseConfig, {
      logger: new Logger("debug", () => undefined),
      requestImpl: async (_url, options) => {
        upstreamHeaders = { ...options.headers };

        return buildResponse({
          statusCode: 200,
          headers: { "content-type": "application/json" },
          body: Readable.from([Buffer.from(JSON.stringify({ version: "7.7.1" }))]),
        });
      },
    });

    const response = await app.inject({
      method: "GET",
      url: "/rest/api/2/serverInfo",
      headers: {
        authorization: "Bearer should-not-pass",
        cookie: "session=123",
        "x-jira-proxy-token": "local-secret",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ version: "7.7.1" });
    expect(upstreamHeaders.authorization).toMatch(/^Basic /);
    expect(upstreamHeaders.cookie).toBeUndefined();

    await app.close();
  });

  it("rejects non-Jira REST paths", async () => {
    const app = createProxyServer(baseConfig, {
      logger: new Logger("debug", () => undefined),
    });

    const response = await app.inject({
      method: "GET",
      url: "/plugins/servlet/admin",
      headers: {
        "x-jira-proxy-token": "local-secret",
      },
    });

    expect(response.statusCode).toBe(403);
    await app.close();
  });

  it("allows POST search in read-only mode", async () => {
    const app = createProxyServer(baseConfig, {
      logger: new Logger("debug", () => undefined),
      requestImpl: async () =>
        buildResponse({
          statusCode: 200,
          headers: { "content-type": "application/json" },
          body: Readable.from([Buffer.from(JSON.stringify({ issues: [] }))]),
        }),
    });

    const response = await app.inject({
      method: "POST",
      url: "/rest/api/2/search",
      headers: {
        "content-type": "application/json",
        "x-jira-proxy-token": "local-secret",
      },
      payload: {
        jql: "project = TEST",
      },
    });

    expect(response.statusCode).toBe(200);
    await app.close();
  });

  it("rejects path traversal", async () => {
    const app = createProxyServer(baseConfig, {
      logger: new Logger("debug", () => undefined),
    });

    const response = await app.inject({
      method: "GET",
      url: "/rest/api/2/../user",
      headers: {
        "x-jira-proxy-token": "local-secret",
      },
    });

    expect(response.statusCode).toBe(403);
    await app.close();
  });

  it("rejects absolute URL request paths", () => {
    expect(() => normalizeAndValidateRequestTarget("http://evil.example/rest/api/2/serverInfo"))
      .toThrow(/absolute URL/i);
  });

  it("enforces the upstream response size limit", async () => {
    const app = createProxyServer(baseConfig, {
      logger: new Logger("debug", () => undefined),
      requestImpl: async () =>
        buildResponse({
          statusCode: 200,
          headers: { "content-type": "application/json" },
          body: Readable.from([Buffer.alloc(1024, "x")]),
        }),
    });

    const response = await app.inject({
      method: "GET",
      url: "/rest/api/2/serverInfo",
      headers: {
        "x-jira-proxy-token": "local-secret",
      },
    });

    expect(response.statusCode).toBe(502);
    await app.close();
  });

  it("handles upstream timeouts", async () => {
    const app = createProxyServer(baseConfig, {
      logger: new Logger("debug", () => undefined),
      requestImpl: async (_url, options) =>
        await new Promise((_, reject) => {
          options.signal.addEventListener("abort", () => reject(new Error("aborted")));
        }),
    });

    const response = await app.inject({
      method: "GET",
      url: "/rest/api/2/serverInfo",
      headers: {
        "x-jira-proxy-token": "local-secret",
      },
    });

    expect(response.statusCode).toBe(504);
    await app.close();
  });
});

function buildResponse(response: UpstreamRequestResponse): UpstreamRequestResponse {
  return response;
}
