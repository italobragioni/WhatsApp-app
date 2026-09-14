import { LogLevel } from "@prisma/client";

import { prisma } from "@/server/db/prisma";

/**
 * Lightweight structured logger with optional persistence.
 *
 * Rules:
 *  - Never log secrets or tokens. Callers are responsible for redaction, and
 *    `sanitizeContext` strips a set of well-known sensitive keys as a safety net.
 *  - Console output is always emitted. Database persistence is best-effort and
 *    never throws (logging must not break the request that triggered it).
 */

type LogContext = Record<string, unknown>;

const SENSITIVE_KEYS = [
  "password",
  "passwordhash",
  "token",
  "accesstoken",
  "authorization",
  "secret",
  "apikey",
  "api_key",
  "cookie",
];

function sanitizeContext(context?: LogContext): LogContext | undefined {
  if (!context) return undefined;
  const clean: LogContext = {};
  for (const [key, value] of Object.entries(context)) {
    if (SENSITIVE_KEYS.includes(key.toLowerCase())) {
      clean[key] = "[REDACTED]";
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

async function persist(
  level: LogLevel,
  scope: string,
  message: string,
  context?: LogContext,
): Promise<void> {
  try {
    await prisma.systemLog.create({
      data: {
        level,
        scope,
        message,
        context: (sanitizeContext(context) as object | undefined) ?? undefined,
      },
    });
  } catch {
    // Persistence is best-effort; swallow to avoid cascading failures.
  }
}

function emit(
  level: LogLevel,
  scope: string,
  message: string,
  context?: LogContext,
): void {
  const clean = sanitizeContext(context);
  const line = `[${level}] (${scope}) ${message}`;
  const sink =
    level === "ERROR"
      ? console.error
      : level === "WARN"
        ? console.warn
        : console.log;
  if (clean) {
    sink(line, clean);
  } else {
    sink(line);
  }
  // Fire-and-forget persistence.
  void persist(level, scope, message, context);
}

export const logger = {
  debug: (scope: string, message: string, context?: LogContext) =>
    emit(LogLevel.DEBUG, scope, message, context),
  info: (scope: string, message: string, context?: LogContext) =>
    emit(LogLevel.INFO, scope, message, context),
  warn: (scope: string, message: string, context?: LogContext) =>
    emit(LogLevel.WARN, scope, message, context),
  error: (scope: string, message: string, context?: LogContext) =>
    emit(LogLevel.ERROR, scope, message, context),
};
