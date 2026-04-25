# jira-mcp-server

[![npm version](https://img.shields.io/npm/v/%40devquasarx9%2Fjira-mcp-server)](https://www.npmjs.com/package/@devquasarx9/jira-mcp-server)
[![npm downloads](https://img.shields.io/npm/dm/%40devquasarx9%2Fjira-mcp-server)](https://www.npmjs.com/package/@devquasarx9/jira-mcp-server)

Production-oriented MCP server for legacy Jira Server and compatible self-hosted Jira instances, designed around Jira Server/Data Center REST API v2 with Jira Server 7.7.1 as the primary target.

npm package: [@devquasarx9/jira-mcp-server](https://www.npmjs.com/package/@devquasarx9/jira-mcp-server)

## Compatibility

- Primary target: Jira Server 7.7.1
- API target: `/rest/api/2`
- User identity model: legacy `username` / `name`, not Jira Cloud `accountId`
- Agile API: optional, best-effort support through `/rest/agile/1.0` when Jira Software Agile endpoints are available

This server is intentionally **not Cloud-first**. It avoids Jira Cloud REST API v3 assumptions, Atlassian account IDs, Cloud OAuth scope models, and Cloud-only privacy behavior.

## Jira Cloud Warning

This project is not designed primarily for Jira Cloud.

Avoid these assumptions when using or extending the server:

- Do not switch core issue/project/user calls to `/rest/api/3`
- Do not require `accountId`
- Do not require Atlassian Cloud OAuth 2 scopes
- Do not assume Cloud-only document formats or app APIs
- Do not assume Personal Access Tokens exist on Jira Server 7.7.1

## Features

Read tools:

- instance info and auth validation
- projects, components, versions, roles, statuses
- issue search and issue reads
- comments, transitions, worklogs, changelog, links
- users and assignable users
- favourite filters and filter-backed issue search
- optional boards/sprints/backlog/epics
- higher-level summaries and heuristics for stale, blocked, overdue, sprint, standup, release notes, duplicates, and triage

Write tools, disabled by default:

- create issue
- update issue
- assign issue
- add/update comment
- transition issue
- link issues
- add/remove labels
- add worklog
- upload attachment

## Tool Safety Model

- `JIRA_READ_ONLY=true` by default
- `JIRA_ENABLE_WRITE_TOOLS=false` by default
- `JIRA_ENABLE_DESTRUCTIVE_TOOLS=false` by default
- project allow/deny lists are enforced on project-scoped and issue-scoped tools
- JQL is scoped through allow/deny project clauses
- request timeout, response size, and attachment size limits are enforced
- credentials and auth headers are redacted from logs
- write operations can be audited with `JIRA_AUDIT_LOG=true`
- dry-run mode is available with `JIRA_DRY_RUN=true`

## Installation

The published npm package is `@devquasarx9/jira-mcp-server`. The installed command is `jira-mcp-server`.

### Local development

```bash
npm install
npm run build
npm test
```

### Global install

```bash
npm install -g @devquasarx9/jira-mcp-server
```

### Run with npx

```bash
npx -y @devquasarx9/jira-mcp-server
```

## Environment Variables

Required:

- `JIRA_BASE_URL`
- `JIRA_AUTH_MODE`
- `JIRA_USERNAME` for `basic` and `cookie`
- `JIRA_PASSWORD` or `JIRA_TOKEN` depending on auth mode

Optional:

- `JIRA_STRICT_SSL=true`
- `JIRA_CA_CERT_PATH`
- `JIRA_TIMEOUT_MS=30000`
- `JIRA_MAX_RESULTS=50`
- `JIRA_MAX_RESPONSE_BYTES=1048576`
- `JIRA_MAX_ATTACHMENT_BYTES=10485760`
- `JIRA_ENABLE_WRITE_TOOLS=false`
- `JIRA_ENABLE_DESTRUCTIVE_TOOLS=false`
- `JIRA_ALLOWED_PROJECTS`
- `JIRA_DENIED_PROJECTS`
- `JIRA_DEFAULT_PROJECT`
- `JIRA_LOG_LEVEL=info`
- `JIRA_AUDIT_LOG=false`
- `JIRA_DRY_RUN=false`
- `JIRA_READ_ONLY=true`
- `JIRA_AUTH_HEADER_NAME`
- `JIRA_AUTH_HEADER_VALUE`

Authentication modes:

- `basic`
- `bearer`
- `cookie`
- `header`

Notes:

- On Jira Server 7.7.1, `basic` with username/password is the safest assumption.
- `bearer` exists for reverse proxy or plugin-backed token scenarios, but Jira Server 7.7.1 does not natively provide modern PAT behavior.
- `cookie` uses `/rest/auth/1/session` and requires username/password.
- `header` is for enterprise reverse-proxy identity forwarding.

## Authentication Examples

### Basic auth

```env
JIRA_BASE_URL=https://jira.example.com
JIRA_AUTH_MODE=basic
JIRA_USERNAME=your.username
JIRA_PASSWORD=your-password
JIRA_READ_ONLY=true
```

### Cookie/session auth

```env
JIRA_BASE_URL=https://jira.example.com
JIRA_AUTH_MODE=cookie
JIRA_USERNAME=your.username
JIRA_PASSWORD=your-password
JIRA_READ_ONLY=true
```

### Header auth behind reverse proxy

```env
JIRA_BASE_URL=https://jira.example.com
JIRA_AUTH_MODE=header
JIRA_AUTH_HEADER_NAME=X-Forwarded-User
JIRA_AUTH_HEADER_VALUE=service-account
JIRA_READ_ONLY=true
```

## MCP Client Configuration

### Generic MCP config

```json
{
  "mcpServers": {
    "jira": {
      "command": "jira-mcp-server",
      "env": {
        "JIRA_BASE_URL": "https://jira.example.com",
        "JIRA_AUTH_MODE": "basic",
        "JIRA_USERNAME": "your.username",
        "JIRA_PASSWORD": "your-password-or-token",
        "JIRA_READ_ONLY": "true"
      }
    }
  }
}
```

### Claude Desktop

Add the same server block to your Claude Desktop MCP configuration file and point `command` to `jira-mcp-server` or a local `node dist/index.js` wrapper.

### Cursor

Add the same server block to Cursor's MCP settings and keep the environment server-side. Start in read-only mode first.

### Codex

Use the same generic MCP server block if your Codex client exposes MCP server configuration. Keep `JIRA_READ_ONLY=true` until you intentionally enable write mode.

## Available Tools

### Instance / auth

- `jira_get_server_info`
- `jira_validate_auth`
- `jira_get_current_user`
- `jira_get_permissions`

### Projects

- `jira_list_projects`
- `jira_get_project`
- `jira_get_project_components`
- `jira_get_project_versions`
- `jira_get_project_roles`
- `jira_get_project_statuses`

### Issue read/search

- `jira_search_issues`
- `jira_get_issue`
- `jira_get_issue_comments`
- `jira_get_issue_transitions`
- `jira_get_issue_worklogs`
- `jira_get_issue_links`
- `jira_get_issue_changelog`

### Issue write

- `jira_create_issue`
- `jira_update_issue`
- `jira_assign_issue`
- `jira_add_comment`
- `jira_update_comment`
- `jira_transition_issue`
- `jira_link_issues`
- `jira_add_labels`
- `jira_remove_labels`
- `jira_add_worklog`
- `jira_upload_attachment`

### Users

- `jira_search_users`
- `jira_get_user`
- `jira_list_assignable_users`
- `jira_list_project_users`

### Filters

- `jira_list_favourite_filters`
- `jira_get_filter`
- `jira_search_filter_issues`

### Agile

- `jira_list_boards`
- `jira_get_board`
- `jira_list_sprints`
- `jira_get_sprint`
- `jira_get_sprint_issues`
- `jira_get_backlog_issues`
- `jira_get_board_epics`

### Intelligence

- `jira_summarize_project_status`
- `jira_find_stale_issues`
- `jira_find_blocked_issues`
- `jira_find_unassigned_issues`
- `jira_find_overdue_issues`
- `jira_summarize_sprint`
- `jira_explain_issue_history`
- `jira_prepare_standup_summary`
- `jira_generate_release_notes`
- `jira_find_duplicate_candidates`
- `jira_triage_issue`

## Read-only Mode

Default mode is read-only. This blocks all write tools even if the tools are listed.

```env
JIRA_READ_ONLY=true
JIRA_ENABLE_WRITE_TOOLS=false
```

## Write Mode

Enable only when you intend to allow issue mutations.

```env
JIRA_READ_ONLY=false
JIRA_ENABLE_WRITE_TOOLS=true
```

## Destructive Mode

The current implementation does not expose destructive delete operations, but the separate flag is already wired so future destructive tools can remain opt-in.

```env
JIRA_ENABLE_DESTRUCTIVE_TOOLS=false
```

## Security Notes

- Never log Authorization headers, passwords, tokens, or cookies
- Treat Jira issue content and comments as untrusted input
- Do not execute shell commands from tool input
- Do not use `eval`
- Keep write mode disabled unless actively needed
- Prefer project allowlists in shared environments
- Keep response and attachment limits conservative

## SSL / Self-Signed Certificates

For internal Jira instances with custom CAs:

```env
JIRA_STRICT_SSL=true
JIRA_CA_CERT_PATH=/absolute/path/to/internal-ca.pem
```

If you must temporarily bypass strict validation for a lab environment:

```env
JIRA_STRICT_SSL=false
```

Do not disable SSL validation permanently in production.

## Proxy Notes

Header-based auth is intended for reverse proxies or SSO gateways that inject a trusted identity header. Only use this when the proxy boundary is controlled and audited.

## Troubleshooting

### Permission errors

- Jira REST permissions are enforced server-side
- project allow/deny lists may block a request before Jira sees it
- issue transitions depend on workflow permissions and current status

### Common Jira Server 7.7.1 issues

- user endpoints expect legacy usernames, not `accountId`
- PAT/bearer auth may not exist on stock Jira Server 7.7.1
- Agile endpoints may not be installed or may be limited depending on Jira Software licensing
- custom fields use `customfield_xxxxx`
- attachment upload requires `X-Atlassian-Token: no-check`

### JQL examples

```text
project = ABC AND status = "Open" ORDER BY updated DESC
project = ABC AND assignee is EMPTY
project = ABC AND updated <= -14d AND resolution is EMPTY
project = ABC AND duedate < now() AND resolution is EMPTY
fixVersion = "1.2.0" AND resolution is not EMPTY
```

## Docker

Build and run:

```bash
docker compose build
docker compose up
```

The container uses stdio transport, so it is mainly useful for packaging and reproducible local execution rather than long-lived HTTP serving.

## Local Architecture

- `src/config.ts`: environment loading and validation
- `src/jira/`: Jira auth, endpoints, pagination, client, errors, shared types
- `src/security/`: policy guards, redaction, limits, audit
- `src/tools/`: MCP tools by category
- `src/server.ts`: MCP server assembly
- `src/index.ts`: stdio entrypoint

The server currently uses the stable `@modelcontextprotocol/sdk` package with stdio transport because it is the safest choice for current client compatibility and local MCP workflows.

## Testing

```bash
npm test
```

Current tests cover:

- config parsing
- pagination helpers
- policy guards
- Jira client search behavior
- representative project and issue tool handlers

## Publishing Notes

Selected npm package name:

- `@devquasarx9/jira-mcp-server`

GitHub Actions workflows:

- `.github/workflows/ci.yml`: PR and push validation
- `.github/workflows/publish.yml`: publish to npm when a GitHub release is published and the release tag matches `v<package.json version>`

The package is already prepared for publishing with:

- `bin` field for `jira-mcp-server`
- `files` allowlist
- `prepack` build step
- npm trusted publishing metadata in `package.json`

Validation before publishing:

```bash
npm run typecheck
npm run build
npm test
npm run pack:dry-run
```

Because `files` is already set in `package.json`, a separate `.npmignore` is not required.

Trusted publishing setup on npm:

- create the npm package `@devquasarx9/jira-mcp-server`
- configure a trusted publisher for GitHub repository `DevquasarX9/mcp-jira-legacy`
- point it at the publish workflow file `.github/workflows/publish.yml`

## Release Checklist

- verify Jira Server 7.7.1 connectivity against staging
- verify legacy username-based user tools
- verify comment, transition, and assignment writes in a non-production project
- verify Agile endpoints on an instance with Jira Software installed
- create or update a GitHub release tag in the form `vX.Y.Z`
- ensure the npm trusted publisher is configured before the first publish
- run `npm run typecheck`
- run `npm run build`
- run `npm test`
- run `npm run pack:dry-run`
