# Claude Code Setup

Install globally:

```bash
npm install -g jira-legacy-mcp-cli
```

Or use `npx` if you do not want a global install:

```bash
claude mcp add jira -- npx -y jira-legacy-mcp-cli
```

If you installed globally, add the server directly:

```bash
claude mcp add jira -- jira-legacy-mcp-server
```

Set the required environment variables before launching Claude Code:

```bash
export JIRA_BASE_URL="https://jira.example.com"
export JIRA_AUTH_MODE="basic"
export JIRA_USERNAME="your.username"
export JIRA_PASSWORD="your-password"
export JIRA_ENABLE_WRITE_TOOLS="false"
```

Recommended first check inside Claude Code:

```text
Use jira_validate_auth and jira_get_server_info, then tell me whether this Jira MCP server is read-only or write-enabled.
```

Keep `JIRA_ENABLE_WRITE_TOOLS=false` until you explicitly need write access.
