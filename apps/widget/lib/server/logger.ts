import "server-only";

const LOG_ENABLED =
  process.env.NEXT_PUBLIC_API_LOGS === "true" ||
  process.env.API_LOGS === "true" ||
  process.env.NODE_ENV === "development";

const LOG_STACKS = process.env.LOG_STACKS === "true";

type SerializedError = {
  name: string;
  message: string;
  code?: string;
  stack?: string;
  cause?: SerializedError;
};

function serializeError(err: unknown): SerializedError {
  const anyErr = err as any;
  const name = typeof anyErr?.name === "string" ? anyErr.name : "Error";
  const message = typeof anyErr?.message === "string" ? anyErr.message : String(err);
  const code = typeof anyErr?.code === "string" ? anyErr.code : undefined;
  const cause = anyErr?.cause;
  return {
    name,
    message,
    code,
    ...(LOG_STACKS && typeof anyErr?.stack === "string" ? { stack: anyErr.stack } : {}),
    ...(cause ? { cause: serializeError(cause) } : {}),
  };
}

function safeJsonStringify(value: unknown, space?: string | number) {
  const seen = new WeakSet<object>();
  return JSON.stringify(value, (_key, v) => {
    if (v instanceof Error) return serializeError(v);
    // Node's fetch abort uses DOMException (name=AbortError); treat similarly.
    if (typeof DOMException !== "undefined" && v instanceof DOMException) return serializeError(v);
    if (typeof v === "object" && v !== null) {
      if (seen.has(v)) return "<<circular>>";
      seen.add(v);
    }
    return v;
  }, space);
}

function formatArgs(args: unknown[]) {
  const isDev = process.env.NODE_ENV === "development";
  const indent = isDev ? 2 : undefined;
  
  return args.map((arg) => {
    if (typeof arg === "string") return arg;
    try {
      if (arg instanceof Error) return safeJsonStringify(serializeError(arg), indent);
      if (typeof DOMException !== "undefined" && arg instanceof DOMException) return safeJsonStringify(serializeError(arg), indent);
      return safeJsonStringify(arg, indent);
    } catch {
      return String(arg);
    }
  });
}

function logWithLevel(level: "log" | "warn" | "error", args: unknown[]) {
  if (!LOG_ENABLED) return;
  const formatted = formatArgs(args);
  if (level === "log") console.log(...formatted);
  else if (level === "warn") console.warn(...formatted);
  else console.error(...formatted);
}

export const logger = {
  info: (...args: unknown[]) => logWithLevel("log", args),
  warn: (...args: unknown[]) => logWithLevel("warn", args),
  error: (...args: unknown[]) => logWithLevel("error", args),
};
