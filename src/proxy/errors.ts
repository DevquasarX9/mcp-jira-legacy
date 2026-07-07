export class ProxyError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly expose: boolean;

  public constructor(statusCode: number, code: string, message: string, expose = true) {
    super(message);
    this.name = "ProxyError";
    this.statusCode = statusCode;
    this.code = code;
    this.expose = expose;
  }
}

export class ProxyConfigurationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ProxyConfigurationError";
  }
}

export class UpstreamTimeoutError extends ProxyError {
  public constructor() {
    super(504, "UPSTREAM_TIMEOUT", "upstream Jira request timed out");
    this.name = "UpstreamTimeoutError";
  }
}

export class UpstreamResponseTooLargeError extends ProxyError {
  public constructor(limitBytes: number) {
    super(
      502,
      "UPSTREAM_RESPONSE_TOO_LARGE",
      `upstream Jira response exceeded ${limitBytes} bytes`,
    );
    this.name = "UpstreamResponseTooLargeError";
  }
}

export function isProxyError(error: unknown): error is ProxyError {
  return error instanceof ProxyError;
}
