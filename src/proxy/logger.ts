import { Logger, type LogLevel } from "../utils/logger.js";

export function createProxyLogger(level: LogLevel): Logger {
  return new Logger(
    level,
    (line) => process.stdout.write(`${line}\n`),
    (line) => process.stderr.write(`${line}\n`),
  );
}
