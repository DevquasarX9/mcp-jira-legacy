import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { describe, expect, it, vi } from "vitest";
import type { AppConfig } from "../src/config.js";
import { AuditLogger } from "../src/security/audit.js";
import { Logger } from "../src/utils/logger.js";
import { registerCommentTools } from "../src/tools/comments.js";
import { registerIssueReadTools } from "../src/tools/issues.read.js";

const readOnlyConfig: AppConfig = {
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
  deniedProjects: [],
  logLevel: "error",
  auditLog: false,
  dryRun: false,
  readOnly: true,
  authHeaderName: "",
  authHeaderValue: "",
};

describe("issue tools", () => {
  it("applies project scoping to search", async () => {
    const server = new McpServer({ name: "test", version: "1.0.0" });
    const client = {
      searchIssues: vi.fn(async () => ({ total: 0, issues: [] })),
    };
    registerIssueReadTools(server, {
      config: readOnlyConfig,
      client: client as never,
      audit: new AuditLogger(false, new Logger("error")),
      logger: new Logger("error"),
    });

    const tools = (server as unknown as { _registeredTools: Record<string, { handler: Function }> })._registeredTools;
    const handler = tools["jira_search_issues"]!.handler;
    await handler({ jql: 'status = "Open"' }, {});

    expect(client.searchIssues).toHaveBeenCalledWith(
      expect.objectContaining({
        jql: 'project in ("ABC") AND (status = "Open")',
      }),
    );
  });

  it("blocks comment writes in read-only mode", async () => {
    const server = new McpServer({ name: "test", version: "1.0.0" });
    registerCommentTools(server, {
      config: readOnlyConfig,
      client: { post: vi.fn() } as never,
      audit: new AuditLogger(false, new Logger("error")),
      logger: new Logger("error"),
    });

    const tools = (server as unknown as { _registeredTools: Record<string, { handler: Function }> })._registeredTools;
    const handler = tools["jira_add_comment"]!.handler;
    const result = await handler({ issueKey: "ABC-1", body: "test" }, {});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("READ_ONLY_MODE");
  });
});
