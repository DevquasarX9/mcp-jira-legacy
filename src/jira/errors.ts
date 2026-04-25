export class JiraClientError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
    public readonly status?: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "JiraClientError";
  }
}

export function normalizeJiraErrorMessage(status: number, body: unknown, fallback: string): string {
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    const errorMessages = Array.isArray(record.errorMessages)
      ? record.errorMessages.filter((entry): entry is string => typeof entry === "string")
      : [];

    if (errorMessages.length > 0) {
      return errorMessages.join("; ");
    }

    if (record.message && typeof record.message === "string") {
      return record.message;
    }

    if (record.errors && typeof record.errors === "object") {
      const fieldErrors = Object.values(record.errors as Record<string, unknown>).filter(
        (entry): entry is string => typeof entry === "string",
      );

      if (fieldErrors.length > 0) {
        return fieldErrors.join("; ");
      }
    }
  }

  if (status === 401) {
    return "Jira authentication failed.";
  }

  if (status === 403) {
    return "Jira request was forbidden.";
  }

  if (status === 404) {
    return "Jira resource was not found.";
  }

  return fallback;
}
