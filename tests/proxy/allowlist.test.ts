import { describe, expect, it } from "vitest";
import { evaluateRouteAccess, matchPattern } from "../../src/proxy/allowlist.js";
import type { ProxyConfig } from "../../src/proxy/config.js";

const config: ProxyConfig = {
  jiraUpstreamBaseUrl: "https://jira.example.com",
  jiraAuthMode: "none",
  proxyHost: "127.0.0.1",
  proxyPort: 4877,
  proxyReadOnly: true,
  proxyEnableWrite: false,
  proxyEnableDestructive: false,
  enableAgileApi: false,
  enableAttachments: false,
  maxRequestBytes: 1_048_576,
  maxResponseBytes: 10_485_760,
  upstreamTimeoutMs: 30_000,
  strictSsl: true,
  logLevel: "info",
  allowNonLocalBind: false,
};

describe("proxy allowlist", () => {
  it("matches single-segment wildcards only", () => {
    expect(matchPattern("/rest/api/2/project/*", "/rest/api/2/project/ABC")).toBe(true);
    expect(matchPattern("/rest/api/2/project/*", "/rest/api/2/project/ABC/roles")).toBe(false);
  });

  it("allows MCP read routes", () => {
    expect(evaluateRouteAccess(config, "POST", "/rest/api/2/search").allowed).toBe(true);
    expect(evaluateRouteAccess(config, "GET", "/rest/api/2/field").allowed).toBe(true);
    expect(evaluateRouteAccess(config, "GET", "/rest/api/2/priority").allowed).toBe(true);
    expect(evaluateRouteAccess(config, "GET", "/rest/api/2/status").allowed).toBe(true);
    expect(evaluateRouteAccess(config, "GET", "/rest/api/2/issuetype").allowed).toBe(true);
    expect(evaluateRouteAccess(config, "GET", "/rest/api/2/user/search").allowed).toBe(true);
  });

  it("rejects write endpoints when writes are disabled", () => {
    const decision = evaluateRouteAccess(config, "POST", "/rest/api/2/issue/ABC-1/comment");

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("route_not_allowed");
  });

  it("enables Agile routes only when configured", () => {
    expect(evaluateRouteAccess(config, "GET", "/rest/agile/1.0/board").allowed).toBe(false);

    expect(
      evaluateRouteAccess({ ...config, enableAgileApi: true }, "GET", "/rest/agile/1.0/board")
        .allowed,
    ).toBe(true);
  });
});
