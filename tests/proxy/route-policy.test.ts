import { describe, expect, it } from "vitest";
import { evaluateRouteAccess } from "../../src/proxy/route-policy.js";
import type { ProxyConfig } from "../../src/proxy/config.js";

const config: ProxyConfig = {
  jiraUpstreamBaseUrl: "https://jira.example.com",
  jiraAuthMode: "none",
  proxyHost: "127.0.0.1",
  proxyPort: 4877,
  proxyEnableWrite: false,
  enableAgileApi: false,
  maxRequestBytes: 1_048_576,
  maxResponseBytes: 10_485_760,
  upstreamTimeoutMs: 30_000,
  strictSsl: true,
  logLevel: "info",
  allowNonLocalBind: false,
};

describe("proxy route policy", () => {
  it("allows Jira API v2 routes without repeating each endpoint", () => {
    expect(evaluateRouteAccess(config, "POST", "/rest/api/2/search").allowed).toBe(true);
    expect(evaluateRouteAccess(config, "GET", "/rest/api/2/field").allowed).toBe(true);
    expect(evaluateRouteAccess(config, "GET", "/rest/api/2/priority").allowed).toBe(true);
    expect(evaluateRouteAccess(config, "GET", "/rest/api/2/status").allowed).toBe(true);
    expect(evaluateRouteAccess(config, "GET", "/rest/api/2/issuetype").allowed).toBe(true);
    expect(evaluateRouteAccess(config, "GET", "/rest/api/2/user/search").allowed).toBe(true);
    expect(evaluateRouteAccess(config, "GET", "/rest/api/2/new-future-endpoint").allowed).toBe(
      true,
    );
  });

  it("rejects write methods when writes are disabled", () => {
    const decision = evaluateRouteAccess(config, "POST", "/rest/api/2/issue/ABC-1/comment");

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("read_only");
  });

  it("allows write methods when writes are enabled", () => {
    const decision = evaluateRouteAccess(
      {
        ...config,
        proxyEnableWrite: true,
      },
      "PUT",
      "/rest/api/2/issue/ABC-1",
    );

    expect(decision.allowed).toBe(true);
    expect(decision.access).toBe("write");
  });

  it("enables Agile routes only when configured", () => {
    expect(evaluateRouteAccess(config, "GET", "/rest/agile/1.0/board").allowed).toBe(false);

    expect(
      evaluateRouteAccess({ ...config, enableAgileApi: true }, "GET", "/rest/agile/1.0/board")
        .allowed,
    ).toBe(true);
  });
});
