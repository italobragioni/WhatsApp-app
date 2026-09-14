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

/** True when a key name looks sensitive (substring match, case-insensitive). */
function isSensitiveKey(key: string): boolean {
  const k = key.toLowerCase();
  return SENSITIVE_KEYS.some((s) => k.includes(s));
}

/**
 * Recursively redact sensitive keys. Depth-capped so a pathological or cyclic
 * structure can never hang the logger. Redaction is by key name at any depth,
 * so a nested `{ headers: { Authorization: "Bearer ..." } }` is masked.
 */
function redact(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    out[key] = isSensitiveKey(key) ? "[REDACTED]" : redact(val, depth + 1);
  }
  return out;
}

function sanitizeContext(context?: LogContext): LogContext | undefined {
  if (!context) return undefined;
  return redact(context) as LogContext;
}

/** Exposed for tests: redact sensitive keys (recursively) from a context. */
export function redactLogContext(context: LogContext): LogContext {
  return sanitizeContext(context) ?? {};
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
