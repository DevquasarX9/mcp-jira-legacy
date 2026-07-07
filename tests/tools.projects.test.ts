import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { describe, expect, it, vi } from "vitest";
import type { AppConfig } from "../src/config.js";
import { AuditLogger } from "../src/security/audit.js";
import { Logger } from "../src/utils/logger.js";
import { registerProjectTools } from "../src/tools/projects.js";

const config: AppConfig = {
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
  allowedProjects: ["ABC"],
  deniedProjects: [],
  logLevel: "error",
  auditLog: false,
  dryRun: false,
  authHeaderName: "",
  authHeaderValue: "",
};

describe("project tools", () => {
  it("filters projects through the allow list", async () => {
    const server = new McpServer({ name: "test", version: "1.0.0" });
    const client = {
      get: vi.fn(async () => [
        { key: "ABC", name: "Allowed" },
        { key: "XYZ", name: "Filtered" },
      ]),
    };
    registerProjectTools(server, {
      config,
      client: client as never,
      audit: new AuditLogger(false, new Logger("error")),
      logger: new Logger("error"),
    });

    const tools = (server as unknown as { _registeredTools: Record<string, { handler: Function }> })._registeredTools;
    const handler = tools["jira_list_projects"]!.handler;
    const result = await handler({}, {});

    expect(result.isError).toBeUndefined();
    expect(JSON.parse(result.content[0].text).data).toEqual([{ key: "ABC", name: "Allowed" }]);
  });
});
