import { describe, expect, it } from "vitest";
import type { AppConfig } from "../src/config.js";
import { ensureWriteAllowed, scopeJql } from "../src/security/guards.js";

const baseConfig: AppConfig = {
  baseUrl: "https://jira.example.com",
  authMode: "basic",
  username: "alice",
  password: "secret",
  strictSsl: true,
  timeoutMs: 30_000,
  maxResults: 50,
  maxResponseBytes: 1_048_576,
  maxAttachmentBytes: 10 * 1024 * 1024,
  enableWriteTools: false,
  enableDestructiveTools: false,
  allowedProjects: ["ABC"],
  deniedProjects: ["SECRET"],
  logLevel: "info",
  auditLog: false,
  dryRun: false,
  readOnly: true,
  authHeaderName: "",
  authHeaderValue: "",
};

describe("guards", () => {
  it("rejects writes when read only", () => {
    expect(() => ensureWriteAllowed(baseConfig, "jira_add_comment")).toThrow(/JIRA_READ_ONLY=true/);
  });

  it("scopes JQL with allow and deny lists", () => {
    expect(scopeJql(baseConfig, 'status = "Open"', undefined)).toBe(
      'project in ("ABC") AND project not in ("SECRET") AND (status = "Open")',
    );
  });
});
