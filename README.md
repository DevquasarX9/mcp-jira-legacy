# Jira Legacy MCP Server

[![npm version](https://img.shields.io/npm/v/jira-legacy-mcp-cli)](https://www.npmjs.com/package/jira-legacy-mcp-cli)
[![npm downloads](https://img.shields.io/npm/dm/jira-legacy-mcp-cli)](https://www.npmjs.com/package/jira-legacy-mcp-cli)

MCP server for legacy Jira Server and Jira Data Center environments, built around Jira REST API v2 and tested with Jira Server 7.7.1 assumptions.

Package: [jira-legacy-mcp-cli](https://www.npmjs.com/package/jira-legacy-mcp-cli)  
Repository: [DevquasarX9/mcp-jira-legacy](https://github.com/DevquasarX9/mcp-jira-legacy)
Works with: Claude Code, Claude Desktop, Codex, Cursor, and other MCP clients

## Why this package exists

Most Jira MCP integrations assume Jira Cloud, REST API v3, and `accountId`-based users. That is the wrong fit for many self-hosted installations.

This server is designed for teams that need:

- Jira Server or Jira Data Center compatibility
- REST API v2 compatibility
- legacy username and `name` user fields instead of Jira Cloud `accountId`
- a local stdio MCP server for tools such as Claude Desktop, Cursor, and Codex
- an optional local auth proxy so Jira credentials can stay outside MCP client prompts/config
- safe defaults, with write tools disabled unless explicitly enabled

If your Jira instance is primarily Jira Cloud or modern Jira-first tooling, this package is probably not the right choice.

## Compatibility

- Primary target: Jira Server 7.7.1
- API family: `/rest/api/2`
- User identity model: legacy `username` and `name`
- Transport: MCP stdio server
- Agile support: optional `/rest/agile/1.0` endpoints when Jira Software is installed and available

Non-goals:

- Jira Cloud-first behavior
- `/rest/api/3`
- `accountId`-based user workflows
- Cloud OAuth scope assumptions
- destructive issue deletion flows in v1

## Capabilities

The server exposes structured Jira tools for:

- instance info, auth validation, current user, and permissions
- project listing and project metadata
- JQL issue search and direct issue reads
- comments, worklogs, links, transitions, and changelog reads
- issue creation and updates when write mode is enabled
- assignment, transitions, comments, labels, links, worklogs, and attachments when write mode is enabled
- user search and assignable-user lookups
- favourite filters and filter-backed issue search
- optional Jira Agile board, sprint, backlog, and epic tools
- higher-level read-only intelligence tools for stale work, blockers, overdue issues, standups, sprint summaries, release notes, and triage support

## Safety model

The package is intentionally conservative by default.

- `JIRA_ENABLE_WRITE_TOOLS=false` by default
- tool inputs are validated with `zod`
- project allow/deny lists are enforced for scoped operations
- credentials, auth headers, tokens, and cookies are redacted from logs
- optional local auth proxy strips client auth headers before injecting Jira credentials
- `JIRA_DRY_RUN=true` can preview write payloads without mutating Jira
- `JIRA_AUDIT_LOG=true` can record write activity without exposing secrets

## Install

### Global install

```bash
npm install -g jira-legacy-mcp-cli
```

### Run with npx

```bash
npx -y jira-legacy-mcp-cli
```

### Local development

```bash
npm install
npm run build
npm test
```

The installed CLI commands are:

```bash
jira-legacy-mcp-cli
jira-legacy-auth-proxy
```

## Quick start

1. Copy `.env.example` to `.env`.
2. Set your Jira base URL and authentication values.
3. Keep write tools disabled first.
4. Run the server from your MCP client.

Minimal example:

```env
JIRA_BASE_URL=https://jira.example.com
JIRA_AUTH_MODE=basic
JIRA_USERNAME=your.username
JIRA_PASSWORD=your-password
JIRA_ENABLE_WRITE_TOOLS=false
```

## Local auth proxy

Use `jira-legacy-auth-proxy` when you want the MCP server to talk to localhost while real Jira credentials live only in the proxy process environment. Proxy settings use the `JIRA_PROXY_*` prefix so they follow the package's Jira naming convention without colliding with the MCP server's own `JIRA_*` variables.

Start the proxy:

```env
JIRA_PROXY_UPSTREAM_BASE_URL=https://jira.example.com
JIRA_PROXY_AUTH_MODE=basic
JIRA_PROXY_USERNAME=your.username
JIRA_PROXY_PASSWORD=your-password
JIRA_PROXY_LOCAL_TOKEN=local-shared-secret
JIRA_PROXY_ENABLE_WRITE=false
```

```bash
jira-legacy-auth-proxy
```

Point the MCP server at the local proxy:

```env
JIRA_BASE_URL=http://127.0.0.1:4877
JIRA_AUTH_MODE=header
JIRA_AUTH_HEADER_NAME=x-jira-proxy-token
JIRA_AUTH_HEADER_VALUE=local-shared-secret
JIRA_ENABLE_WRITE_TOOLS=false
```

Proxy behavior:

- binds to `127.0.0.1:4877` by default
- refuses non-local bind hosts unless `JIRA_PROXY_ALLOW_NON_LOCAL_BIND=true`
- only proxies Jira Server REST API v2 paths by default
- keeps write methods blocked unless `JIRA_PROXY_ENABLE_WRITE=true`
- strips caller `Authorization`, `Cookie`, forwarding, and proxy headers before adding Jira auth
- supports optional Agile routes with `JIRA_PROXY_ENABLE_AGILE_API=true`

## MCP client setup

Example client configs live in the repository under [`examples/clients/`](https://github.com/DevquasarX9/mcp-jira-legacy/tree/main/examples/clients):

- [Claude Code guide](https://github.com/DevquasarX9/mcp-jira-legacy/blob/main/examples/clients/claude_code.md)
- [Claude Desktop JSON config](https://github.com/DevquasarX9/mcp-jira-legacy/blob/main/examples/clients/claude_desktop_config.json)
- [Codex TOML config](https://github.com/DevquasarX9/mcp-jira-legacy/blob/main/examples/clients/codex-config.toml)
- [Cursor MCP JSON config](https://github.com/DevquasarX9/mcp-jira-legacy/blob/main/examples/clients/cursor.mcp.json)

## Environment variables

### Required

- `JIRA_BASE_URL`
- `JIRA_AUTH_MODE`
- `JIRA_USERNAME` for `basic` and `cookie`
- `JIRA_PASSWORD` or `JIRA_TOKEN` depending on auth mode

### Optional

- `JIRA_STRICT_SSL=true`
- `JIRA_CA_CERT_PATH`
- `JIRA_TIMEOUT_MS=30000`
- `JIRA_MAX_RESULTS=50`
- `JIRA_MAX_RESPONSE_BYTES=1048576`
- `JIRA_MAX_ATTACHMENT_BYTES=10485760`
- `JIRA_ENABLE_WRITE_TOOLS=false`
- `JIRA_ALLOWED_PROJECTS`
- `JIRA_DENIED_PROJECTS`
- `JIRA_DEFAULT_PROJECT`
- `JIRA_LOG_LEVEL=info`
- `JIRA_AUDIT_LOG=false`
- `JIRA_DRY_RUN=false`
- `JIRA_AUTH_HEADER_NAME`
- `JIRA_AUTH_HEADER_VALUE`

### Local proxy variables

- `JIRA_PROXY_UPSTREAM_BASE_URL`
- `JIRA_PROXY_AUTH_MODE=basic|bearer|header|none`
- `JIRA_PROXY_USERNAME`
- `JIRA_PROXY_PASSWORD` or `JIRA_PROXY_TOKEN`
- `JIRA_PROXY_AUTH_HEADER_NAME`
- `JIRA_PROXY_AUTH_HEADER_VALUE`
- `JIRA_PROXY_HOST=127.0.0.1`
- `JIRA_PROXY_PORT=4877`
- `JIRA_PROXY_LOCAL_TOKEN`
- `JIRA_PROXY_ENABLE_WRITE=false`
- `JIRA_PROXY_ENABLE_AGILE_API=false`
- `JIRA_PROXY_MAX_REQUEST_BYTES=1048576`
- `JIRA_PROXY_MAX_RESPONSE_BYTES=10485760`
- `JIRA_PROXY_UPSTREAM_TIMEOUT_MS=30000`
- `JIRA_PROXY_STRICT_SSL=true`
- `JIRA_PROXY_CA_CERT_PATH`
- `JIRA_PROXY_LOG_LEVEL=info`
- `JIRA_PROXY_ALLOW_NON_LOCAL_BIND=false`

### Authentication modes

- `basic`: username plus password, or username plus token where the Jira deployment supports it
- `bearer`: for proxy or plugin-backed token scenarios
- `cookie`: uses `/rest/auth/1/session`
- `header`: for trusted reverse-proxy identity forwarding

Notes:

- On Jira Server 7.7.1, `basic` with username/password is the safest default.
- Jira Server 7.7.1 does not natively behave like modern Jira Cloud PAT-based authentication.
- `bearer` is included for compatible self-hosted environments, not as a claim about stock Jira Server 7.7.1 features.

## Authentication examples

### Basic auth

```env
JIRA_BASE_URL=https://jira.example.com
JIRA_AUTH_MODE=basic
JIRA_USERNAME=your.username
JIRA_PASSWORD=your-password
JIRA_ENABLE_WRITE_TOOLS=false
```

### Cookie auth

```env
JIRA_BASE_URL=https://jira.example.com
JIRA_AUTH_MODE=cookie
JIRA_USERNAME=your.username
JIRA_PASSWORD=your-password
JIRA_ENABLE_WRITE_TOOLS=false
```

### Header auth behind a reverse proxy

```env
JIRA_BASE_URL=https://jira.example.com
JIRA_AUTH_MODE=header
JIRA_AUTH_HEADER_NAME=X-Forwarded-User
JIRA_AUTH_HEADER_VALUE=service-account
JIRA_ENABLE_WRITE_TOOLS=false
```

## MCP configuration

### Generic MCP server config

```json
{
  "mcpServers": {
    "jira": {
      "command": "jira-legacy-mcp-cli",
      "env": {
        "JIRA_BASE_URL": "https://jira.example.com",
        "JIRA_AUTH_MODE": "basic",
        "JIRA_USERNAME": "your.username",
        "JIRA_PASSWORD": "your-password",
        "JIRA_ENABLE_WRITE_TOOLS": "false"
      }
    }
  }
}
```

### `npx` config

```json
{
  "mcpServers": {
    "jira": {
      "command": "npx",
      "args": ["-y", "jira-legacy-mcp-cli"],
      "env": {
        "JIRA_BASE_URL": "https://jira.example.com",
        "JIRA_AUTH_MODE": "basic",
        "JIRA_USERNAME": "your.username",
        "JIRA_PASSWORD": "your-password",
        "JIRA_ENABLE_WRITE_TOOLS": "false"
      }
    }
  }
}
```

### Codex TOML config

```toml
[mcp_servers.jira]
command = "jira-legacy-mcp-cli"

[mcp_servers.jira.env]
JIRA_BASE_URL = "https://jira.example.com"
JIRA_AUTH_MODE = "basic"
JIRA_USERNAME = "your.username"
JIRA_PASSWORD = "your-password"
JIRA_ENABLE_WRITE_TOOLS = "false"
```

### Claude Desktop

Add the same server block to your Claude Desktop MCP configuration and point `command` to either `jira-legacy-mcp-cli` or a local `node dist/index.js`.

### Cursor

Add the same block in Cursor MCP settings. Keep credentials in the server environment and start in read-only mode.

### Codex

Use the same MCP server definition when Codex is configured to launch local MCP servers.

## Tool catalog

### Instance and auth

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

### Issues and search

- `jira_search_issues`
- `jira_get_issue`
- `jira_get_issue_comments`
- `jira_get_issue_transitions`
- `jira_get_issue_worklogs`
- `jira_get_issue_links`
- `jira_get_issue_changelog`

### Issue write tools

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

## Example JQL

```text
project = ABC AND status = "Open" ORDER BY updated DESC
project = ABC AND assignee is EMPTY
project = ABC AND updated <= -14d AND resolution is EMPTY
project = ABC AND duedate < now() AND resolution is EMPTY
fixVersion = "1.2.0" AND resolution is not EMPTY
```

## Common Jira Server notes

- user APIs expect legacy usernames, not `accountId`
- custom fields are typically named like `customfield_12345`
- Agile endpoints may be unavailable without Jira Software
- attachment uploads require `X-Atlassian-Token: no-check`
- transition availability depends on workflow state and Jira permissions

## SSL and internal CAs

For internal Jira instances with a private certificate authority:

```env
JIRA_STRICT_SSL=true
JIRA_CA_CERT_PATH=/absolute/path/to/internal-ca.pem
```

Temporary lab-only bypass:

```env
JIRA_STRICT_SSL=false
```

Do not disable SSL verification permanently in production.

## Docker

Build and run locally:

```bash
docker compose build
docker compose up
```

This image still runs the stdio MCP server. It is useful for reproducible local packaging, not as a long-lived HTTP API service.

## Development

```bash
npm run typecheck
npm run build
npm test
npm run pack:dry-run
```

Project layout:

- `src/config.ts`: environment loading and validation
- `src/jira/`: Jira client, auth, errors, pagination, types, and endpoints
- `src/security/`: redaction, audit, guardrails, and limits
- `src/tools/`: MCP tools grouped by feature area
- `src/proxy/`: optional local auth proxy, policy, header sanitization, and upstream forwarding
- `src/server.ts`: MCP server assembly
- `src/index.ts`: stdio entrypoint

Contribution guidance lives in [CONTRIBUTING.md](https://github.com/DevquasarX9/mcp-jira-legacy/blob/main/CONTRIBUTING.md).

## CI and publishing

GitHub Actions workflows:

- `.github/workflows/ci.yml`: typecheck, lint, test, build, and package verification
- `.github/workflows/publish.yml`: publish to npm on GitHub release publication when the tag matches `v<package.json version>`

The package is published as `jira-legacy-mcp-cli` and already includes:

- bin entries for `jira-legacy-mcp-cli` and `jira-legacy-auth-proxy`
- a package `files` allowlist
- a `prepack` build step
- npm trusted publishing metadata

## Release checklist

- verify connectivity against a Jira Server or Data Center staging instance
- verify username-based user flows on a Jira 7-compatible target
- verify write paths in a non-production project before enabling them broadly
- verify Agile tools on an instance with Jira Software available
- run `npm run typecheck`
- run `npm run build`
- run `npm test`
- run `npm run pack:dry-run`
- publish a GitHub release with a tag matching `v<package.json version>`
