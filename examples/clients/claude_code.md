# Claude Code Setup

Install globally:

```bash
npm install -g @devquasarx9/jira-mcp-server
```

Or use `npx` if you do not want a global install:

```bash
claude mcp add jira -- npx -y @devquasarx9/jira-mcp-server
```

If you installed globally, add the server directly:

```bash
claude mcp add jira -- jira-mcp-server
```

Set the required environment variables before launching Claude Code:

```bash
export JIRA_BASE_URL="https://jira.example.com"
export JIRA_AUTH_MODE="basic"
export JIRA_USERNAME="your.username"
export JIRA_PASSWORD="your-password"
export JIRA_READ_ONLY="true"
export JIRA_ENABLE_WRITE_TOOLS="false"
```

Recommended first check inside Claude Code:

```text
Use jira_validate_auth and jira_get_server_info, then tell me whether this Jira MCP server is read-only or write-enabled.
```

Keep `JIRA_READ_ONLY=true` and `JIRA_ENABLE_WRITE_TOOLS=false` until you explicitly need write access.
