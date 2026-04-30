import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AppConfig } from "./config.js";
import { JiraClient } from "./jira/client.js";
import { AuditLogger } from "./security/audit.js";
import { Logger } from "./utils/logger.js";
import { registerTools } from "./tools/index.js";

export interface ServerRuntime {
  readonly server: McpServer;
  readonly client: JiraClient;
  readonly logger: Logger;
}

export function createServer(config: AppConfig): ServerRuntime {
  const logger = new Logger(config.logLevel);
  const client = new JiraClient(config, logger);
  const audit = new AuditLogger(config.auditLog, logger);

  const server = new McpServer({
    name: "jira-legacy-mcp-server",
    version: "0.1.0",
  });

  registerTools(server, {
    config,
    client,
    audit,
    logger,
  });

  return {
    server,
    client,
    logger,
  };
}
