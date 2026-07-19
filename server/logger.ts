// Minimal structured JSON logger. Deliberately dependency-free for this MVP.
// Every log line is a single JSON object on its own line (easy to ship to any log
// aggregator). Callers must never pass uploaded evidence, incident content, or secrets -
// only operational metadata (route, status code, duration, event type).

type LogLevel = "info" | "warn" | "error";

interface LogFields {
  [key: string]: string | number | boolean | undefined;
}

function write(level: LogLevel, message: string, fields: LogFields = {}): void {
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    service: "proofops",
    message,
    ...fields,
  });
  if (level === "error") {
    process.stderr.write(`${line}\n`);
  } else {
    process.stdout.write(`${line}\n`);
  }
}

export const logger = {
  info: (message: string, fields?: LogFields) => write("info", message, fields),
  warn: (message: string, fields?: LogFields) => write("warn", message, fields),
  error: (message: string, fields?: LogFields) => write("error", message, fields),
};
