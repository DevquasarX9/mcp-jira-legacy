import { describe, expect, it, vi } from "vitest";
import type { AppConfig } from "../src/config.js";
import { JiraClient } from "../src/jira/client.js";
import { Logger } from "../src/utils/logger.js";

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
  enableDestructiveTools: false,
  allowedProjects: [],
  deniedProjects: [],
  logLevel: "error",
  auditLog: false,
  dryRun: false,
  readOnly: true,
  authHeaderName: "",
  authHeaderValue: "",
};

describe("JiraClient", () => {
  it("uses GET search for smaller payloads", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ startAt: 0, total: 1, issues: [] }), {
        status: 200,
        headers: { "content-length": "32" },
      }),
    );
    const client = new JiraClient(config, new Logger("error"), fetchMock as any);

    await client.searchIssues({
      jql: 'project = "ABC"',
      maxResults: 10,
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const calls = fetchMock.mock.calls as unknown as Array<[unknown, unknown?]>;
    const firstUrl = calls[0]?.[0];
    expect(firstUrl).toBeDefined();
    expect(String(firstUrl)).toContain("/rest/api/2/search?");
  });
});
