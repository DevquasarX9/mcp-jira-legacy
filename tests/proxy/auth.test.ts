import { describe, expect, it } from "vitest";
import { validateLocalProxyToken } from "../../src/proxy/auth.js";

describe("validateLocalProxyToken", () => {
  it("requires the local token when configured", () => {
    expect(() => validateLocalProxyToken({}, "expected-token")).toThrow(
      /local proxy authentication failed/i,
    );
  });

  it("rejects the wrong local token", () => {
    expect(() =>
      validateLocalProxyToken(
        {
          "x-jira-proxy-token": "wrong-token",
        },
        "expected-token",
      ),
    ).toThrow(/local proxy authentication failed/i);
  });

  it("accepts the correct local token", () => {
    expect(() =>
      validateLocalProxyToken(
        {
          "x-jira-proxy-token": "expected-token",
        },
        "expected-token",
      ),
    ).not.toThrow();
  });
});
