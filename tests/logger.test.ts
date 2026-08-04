import { afterEach, describe, expect, it, vi } from "vitest";
import { createProxyLogger } from "../src/proxy/logger.js";
import { Logger } from "../src/utils/logger.js";

describe("Logger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("routes proxy debug and info logs to stdout and warnings and errors to stderr", () => {
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const logger = createProxyLogger("debug");

    logger.debug("proxy_debug");
    logger.info("proxy_info");
    logger.warn("proxy_warning");
    logger.error("proxy_error");

    expect(logMessages(stdout.mock.calls)).toEqual(["proxy_debug", "proxy_info"]);
    expect(logMessages(stderr.mock.calls)).toEqual(["proxy_warning", "proxy_error"]);
  });

  it("keeps the default MCP logger on stderr for every severity", () => {
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const logger = new Logger("debug");

    logger.debug("mcp_debug");
    logger.info("mcp_info");
    logger.warn("mcp_warning");
    logger.error("mcp_error");

    expect(logMessages(stdout.mock.calls)).toEqual([]);
    expect(logMessages(stderr.mock.calls)).toEqual([
      "mcp_debug",
      "mcp_info",
      "mcp_warning",
      "mcp_error",
    ]);
  });
});

function logMessages(calls: unknown[][]): string[] {
  return calls.map(([line]) => {
    if (typeof line !== "string") {
      throw new TypeError("expected log output to be a string");
    }

    const payload: unknown = JSON.parse(line);
    if (!isLogPayload(payload)) {
      throw new TypeError("expected structured log output");
    }

    return payload.message;
  });
}

function isLogPayload(value: unknown): value is { readonly message: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "message" in value &&
    typeof value.message === "string"
  );
}
