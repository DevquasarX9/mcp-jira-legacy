import type { AppConfig } from "../config.js";
import {
  DEFAULT_MAX_ATTACHMENT_BYTES,
  DEFAULT_MAX_COMMENT_LENGTH,
  DEFAULT_MAX_JQL_LENGTH,
} from "./limits.js";

export class GuardError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "GuardError";
  }
}

export function extractProjectKeyFromIssueKey(issueKey: string): string | null {
  const match = issueKey.trim().toUpperCase().match(/^([A-Z][A-Z0-9_]+)-\d+$/);
  return match?.[1] ?? null;
}

export function ensureProjectAllowed(config: AppConfig, projectKey: string): void {
  const normalizedProjectKey = projectKey.trim().toUpperCase();

  if (
    config.deniedProjects.includes(normalizedProjectKey) ||
    (config.allowedProjects.length > 0 && !config.allowedProjects.includes(normalizedProjectKey))
  ) {
    throw new GuardError(
      "PROJECT_NOT_ALLOWED",
      `Project ${normalizedProjectKey} is not allowed by server policy.`,
    );
  }
}

export function filterAllowedProjects<T extends { key?: string }>(config: AppConfig, projects: T[]): T[] {
  return projects.filter((project) => {
    if (!project.key) {
      return true;
    }

    const normalizedProjectKey = project.key.toUpperCase();

    if (config.deniedProjects.includes(normalizedProjectKey)) {
      return false;
    }

    return config.allowedProjects.length === 0 || config.allowedProjects.includes(normalizedProjectKey);
  });
}

export function ensureWriteAllowed(config: AppConfig, operation: string): void {
  if (config.readOnly) {
    throw new GuardError("READ_ONLY_MODE", `${operation} is disabled because JIRA_READ_ONLY=true.`);
  }

  if (!config.enableWriteTools) {
    throw new GuardError(
      "WRITE_TOOLS_DISABLED",
      `${operation} is disabled because JIRA_ENABLE_WRITE_TOOLS=false.`,
    );
  }
}

export function ensureDestructiveAllowed(
  config: AppConfig,
  operation: string,
  confirmDestructive?: boolean,
): void {
  ensureWriteAllowed(config, operation);

  if (!config.enableDestructiveTools) {
    throw new GuardError(
      "DESTRUCTIVE_TOOLS_DISABLED",
      `${operation} is disabled because JIRA_ENABLE_DESTRUCTIVE_TOOLS=false.`,
    );
  }

  if (confirmDestructive !== true) {
    throw new GuardError(
      "DESTRUCTIVE_CONFIRMATION_REQUIRED",
      `${operation} requires confirm_destructive=true.`,
    );
  }
}

export function ensureValidJql(jql: string): void {
  if (jql.trim().length === 0) {
    throw new GuardError("INVALID_JQL", "JQL must not be empty.");
  }

  if (jql.length > DEFAULT_MAX_JQL_LENGTH) {
    throw new GuardError(
      "JQL_TOO_LARGE",
      `JQL exceeds the maximum supported length of ${DEFAULT_MAX_JQL_LENGTH} characters.`,
    );
  }
}

export function scopeJql(config: AppConfig, jql: string, projectKey?: string): string {
  const clauses: string[] = [];

  if (projectKey) {
    ensureProjectAllowed(config, projectKey);
    clauses.push(`project = "${projectKey.toUpperCase()}"`);
  }

  if (config.allowedProjects.length > 0) {
    const allowedProjects = config.allowedProjects.map((key) => `"${key}"`).join(", ");
    clauses.push(`project in (${allowedProjects})`);
  }

  if (config.deniedProjects.length > 0) {
    const deniedProjects = config.deniedProjects.map((key) => `"${key}"`).join(", ");
    clauses.push(`project not in (${deniedProjects})`);
  }

  if (jql.trim().length > 0) {
    clauses.push(`(${jql.trim()})`);
  }

  if (clauses.length === 0) {
    throw new GuardError(
      "PROJECT_SCOPE_REQUIRED",
      "Provide a JQL query or configure JIRA_ALLOWED_PROJECTS/JIRA_DEFAULT_PROJECT.",
    );
  }

  const scopedJql = clauses.join(" AND ");
  ensureValidJql(scopedJql);

  return scopedJql;
}

export function ensureCommentLength(commentBody: string): void {
  if (commentBody.length > DEFAULT_MAX_COMMENT_LENGTH) {
    throw new GuardError(
      "COMMENT_TOO_LARGE",
      `Comment body exceeds the maximum supported length of ${DEFAULT_MAX_COMMENT_LENGTH} characters.`,
    );
  }
}

export function ensureAttachmentAllowed(config: AppConfig, bytes: number): void {
  ensureWriteAllowed(config, "jira_upload_attachment");

  if (bytes > config.maxAttachmentBytes || bytes > DEFAULT_MAX_ATTACHMENT_BYTES) {
    throw new GuardError(
      "ATTACHMENT_TOO_LARGE",
      `Attachment exceeds the maximum supported size of ${config.maxAttachmentBytes} bytes.`,
    );
  }
}
