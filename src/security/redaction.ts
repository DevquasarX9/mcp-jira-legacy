import type { JsonRecord } from "../utils/result.js";

const SECRET_KEY_PATTERNS = [
  /authorization/i,
  /password/i,
  /token/i,
  /cookie/i,
  /secret/i,
];

const SECRET_VALUE_PATTERNS = [
  /basic\s+[a-z0-9+/=]+/i,
  /bearer\s+[a-z0-9._~-]+/i,
  /jsessionid=[^;,\s]+/i,
];

function isSecretKey(key: string): boolean {
  return SECRET_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

function redactString(value: string): string {
  let redactedValue = value;

  for (const pattern of SECRET_VALUE_PATTERNS) {
    redactedValue = redactedValue.replace(pattern, "[REDACTED]");
  }

  return redactedValue;
}

export function redactSecrets(value: unknown): unknown {
  if (value === undefined || value === null || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return redactString(value);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => redactSecrets(entry));
  }

  return Object.entries(value as Record<string, unknown>).reduce<JsonRecord>((accumulator, [key, entry]) => {
    accumulator[key] = isSecretKey(key) ? "[REDACTED]" : redactSecrets(entry);
    return accumulator;
  }, {});
}
