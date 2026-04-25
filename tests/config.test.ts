import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  it("parses basic auth config with defaults", () => {
    const config = loadConfig({
      JIRA_BASE_URL: "https://jira.example.com/",
      JIRA_AUTH_MODE: "basic",
      JIRA_USERNAME: "alice",
      JIRA_PASSWORD: "secret",
    });

    expect(config.baseUrl).toBe("https://jira.example.com");
    expect(config.readOnly).toBe(true);
    expect(config.enableWriteTools).toBe(false);
    expect(config.allowedProjects).toEqual([]);
  });

  it("requires password for cookie auth", () => {
    expect(() =>
      loadConfig({
        JIRA_BASE_URL: "https://jira.example.com",
        JIRA_AUTH_MODE: "cookie",
        JIRA_USERNAME: "alice",
      }),
    ).toThrow(/JIRA_PASSWORD is required/);
  });
});
