import { describe, expect, it } from "vitest";
import { loadProxyConfig } from "../../src/proxy/config.js";

const baseEnv = {
  PROXY_JIRA_UPSTREAM_BASE_URL: "https://jira.example.com",
  PROXY_JIRA_AUTH_MODE: "basic",
  PROXY_JIRA_USERNAME: "jira-user",
  PROXY_JIRA_PASSWORD: "jira-pass",
};

describe("loadProxyConfig", () => {
  it("loads a valid basic-auth proxy configuration", () => {
    const config = loadProxyConfig(baseEnv);

    expect(config.jiraUpstreamBaseUrl).toBe("https://jira.example.com");
    expect(config.proxyHost).toBe("127.0.0.1");
    expect(config.proxyPort).toBe(4877);
    expect(config.proxyReadOnly).toBe(true);
  });

  it("refuses to bind to 0.0.0.0 by default", () => {
    expect(() =>
      loadProxyConfig({
        ...baseEnv,
        PROXY_HOST: "0.0.0.0",
      }),
    ).toThrow(/refusing to bind/i);
  });

  it("requires Jira credentials in basic mode", () => {
    expect(() =>
      loadProxyConfig({
        PROXY_JIRA_UPSTREAM_BASE_URL: "https://jira.example.com",
        PROXY_JIRA_AUTH_MODE: "basic",
        PROXY_JIRA_USERNAME: "jira-user",
      }),
    ).toThrow(/PROXY_JIRA_PASSWORD.*PROXY_JIRA_TOKEN/i);
  });

  it("requires read-only mode to be disabled before enabling writes", () => {
    expect(() =>
      loadProxyConfig({
        ...baseEnv,
        PROXY_READ_ONLY: "true",
        PROXY_ENABLE_WRITE: "true",
      }),
    ).toThrow(/PROXY_ENABLE_WRITE=true requires PROXY_READ_ONLY=false/i);
  });

  it("keeps compatibility with the original standalone proxy env names", () => {
    const config = loadProxyConfig({
      JIRA_UPSTREAM_BASE_URL: "https://jira.example.com",
      JIRA_AUTH_MODE: "basic",
      JIRA_USERNAME: "jira-user",
      JIRA_PASSWORD: "jira-pass",
    });

    expect(config.jiraAuthMode).toBe("basic");
    expect(config.jiraUsername).toBe("jira-user");
  });
});
