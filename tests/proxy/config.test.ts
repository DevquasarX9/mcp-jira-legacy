import { describe, expect, it } from "vitest";
import { loadProxyConfig } from "../../src/proxy/config.js";

const baseEnv = {
  JIRA_PROXY_UPSTREAM_BASE_URL: "https://jira.example.com",
  JIRA_PROXY_AUTH_MODE: "basic",
  JIRA_PROXY_USERNAME: "jira-user",
  JIRA_PROXY_PASSWORD: "jira-pass",
};

describe("loadProxyConfig", () => {
  it("loads a valid basic-auth proxy configuration", () => {
    const config = loadProxyConfig(baseEnv);

    expect(config.jiraUpstreamBaseUrl).toBe("https://jira.example.com");
    expect(config.proxyHost).toBe("127.0.0.1");
    expect(config.proxyPort).toBe(4877);
    expect(config.proxyEnableWrite).toBe(false);
  });

  it("refuses to bind to 0.0.0.0 by default", () => {
    expect(() =>
      loadProxyConfig({
        ...baseEnv,
        JIRA_PROXY_HOST: "0.0.0.0",
      }),
    ).toThrow(/refusing to bind/i);
  });

  it("requires Jira credentials in basic mode", () => {
    expect(() =>
      loadProxyConfig({
        JIRA_PROXY_UPSTREAM_BASE_URL: "https://jira.example.com",
        JIRA_PROXY_AUTH_MODE: "basic",
        JIRA_PROXY_USERNAME: "jira-user",
      }),
    ).toThrow(/JIRA_PROXY_PASSWORD.*JIRA_PROXY_TOKEN/i);
  });

  it("enables proxy write forwarding with one explicit flag", () => {
    const config = loadProxyConfig({
      ...baseEnv,
      JIRA_PROXY_ENABLE_WRITE: "true",
    });

    expect(config.proxyEnableWrite).toBe(true);
  });

  it("supports bearer auth with the proxy naming convention", () => {
    const config = loadProxyConfig({
      JIRA_PROXY_UPSTREAM_BASE_URL: "https://jira.example.com",
      JIRA_PROXY_AUTH_MODE: "bearer",
      JIRA_PROXY_TOKEN: "jira-token",
    });

    expect(config.jiraAuthMode).toBe("bearer");
    expect(config.jiraToken).toBe("jira-token");
  });
});
