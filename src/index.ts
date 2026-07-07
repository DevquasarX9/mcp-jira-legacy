#!/usr/bin/env node
import "dotenv/config";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { createServer } from "./server.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const { server, client, logger } = createServer(config);
  const transport = new StdioServerTransport();

  process.on("SIGINT", async () => {
    await server.close();
    await client.close();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await server.close();
    await client.close();
    process.exit(0);
  });

  await server.connect(transport);
  logger.info("jira_mcp_server_started", {
    baseUrl: config.baseUrl,
    readOnly: config.readOnly,
    writeToolsEnabled: config.enableWriteTools,
  });
}

main().catch((error) => {
  process.stderr.write(
    `${JSON.stringify({
      level: "error",
      message: error instanceof Error ? error.message : "Unknown startup error",
    })}\n`,
  );
  process.exit(1);
});
