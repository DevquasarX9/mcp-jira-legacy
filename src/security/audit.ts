import type { JsonRecord } from "../utils/result.js";
import { Logger } from "../utils/logger.js";

export class AuditLogger {
  public constructor(
    private readonly enabled: boolean,
    private readonly logger: Logger,
  ) {}

  public logWrite(operation: string, target: string, metadata?: JsonRecord): void {
    if (!this.enabled) {
      return;
    }

    this.logger.info("jira_write_action", {
      operation,
      target,
      ...(metadata === undefined ? {} : metadata),
    });
  }
}
