#!/usr/bin/env node
import "dotenv/config";
import { Logger } from "../utils/logger.js";
import { loadProxyConfig } from "./config.js";
import { createProxyServer, startProxyServer } from "./server.js";

async function main(): Promise<void> {
  const config = loadProxyConfig();
  const logger = new Logger(config.logLevel);
  const app = createProxyServer(config, { logger });

  await startProxyServer(app, config, logger);
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${JSON.stringify({
      ts: new Date().toISOString(),
      level: "error",
      message: "failed_to_start_jira_auth_proxy",
      context: {
        error: error instanceof Error ? error.message : "unknown startup error",
      },
    })}\n`,
  );
  process.exitCode = 1;
});
