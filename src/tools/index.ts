import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolContext } from "./helpers.js";
import { registerAgileTools } from "./agile.js";
import { registerCommentTools } from "./comments.js";
import { registerFilterTools } from "./filters.js";
import { registerInstanceTools } from "./instance.js";
import { registerIssueReadTools } from "./issues.read.js";
import { registerIssueWriteTools } from "./issues.write.js";
import { registerIntelligenceTools } from "./intelligence.js";
import { registerProjectTools } from "./projects.js";
import { registerTransitionTools } from "./transitions.js";
import { registerUserTools } from "./users.js";

export function registerTools(server: McpServer, context: ToolContext): void {
  registerInstanceTools(server, context);
  registerProjectTools(server, context);
  registerIssueReadTools(server, context);
  registerIssueWriteTools(server, context);
  registerCommentTools(server, context);
  registerTransitionTools(server, context);
  registerUserTools(server, context);
  registerFilterTools(server, context);
  registerAgileTools(server, context);
  registerIntelligenceTools(server, context);
}
