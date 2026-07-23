import { randomUUID } from "node:crypto";

type LogLevel = "info" | "warn" | "error";
type LogMeta = Record<string, unknown>;

const SECRET_KEY = /(pin|cookie|token|secret|private.?key|credential|password|file.?id|spreadsheet.?id)/i;

function sanitize(value: unknown, key?: string): unknown {
  if (key && SECRET_KEY.test(key)) return "[REDACTED]";
  if (Array.isArray(value)) return value.map((item) => sanitize(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [entryKey, sanitize(entryValue, entryKey)]),
    );
  }
  return value;
}

export interface Logger {
  info(message: string, meta?: LogMeta): void;
  warn(message: string, meta?: LogMeta): void;
  error(message: string, meta?: LogMeta): void;
}

export function createRequestId(): string {
  return randomUUID();
}

export function createLogger(baseMeta: LogMeta = {}): Logger {
  const write = (level: LogLevel, message: string, meta: LogMeta = {}): void => {
    const sanitized = sanitize({ ...baseMeta, ...meta });
    const safeMeta: Record<string, unknown> =
      sanitized && typeof sanitized === "object" && !Array.isArray(sanitized)
        ? (sanitized as Record<string, unknown>)
        : {};
    const record = {
      level,
      message,
      occurredAt: new Date().toISOString(),
      ...safeMeta,
    };
    const serialized = JSON.stringify(record);
    if (level === "error") console.error(serialized);
    else if (level === "warn") console.warn(serialized);
    else console.info(serialized);
  };

  return {
    info: (message, meta) => write("info", message, meta),
    warn: (message, meta) => write("warn", message, meta),
    error: (message, meta) => write("error", message, meta),
  };
}
