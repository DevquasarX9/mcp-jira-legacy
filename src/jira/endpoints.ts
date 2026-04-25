export const JIRA_API_PREFIX = "/rest/api/2";
export const JIRA_AUTH_PREFIX = "/rest/auth/1";
export const JIRA_AGILE_PREFIX = "/rest/agile/1.0";

export function jiraApi(path: string): string {
  return `${JIRA_API_PREFIX}${path}`;
}

export function jiraAuth(path: string): string {
  return `${JIRA_AUTH_PREFIX}${path}`;
}

export function jiraAgile(path: string): string {
  return `${JIRA_AGILE_PREFIX}${path}`;
}
