// Domain error types shared by the service layer and mapped to HTTP status
// codes by handleApiError. Kept free of framework imports so services can throw
// them without pulling in next/server.

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

// Raised when an optimistic-concurrency guard detects that a row changed
// underneath a read-modify-write (e.g. two simultaneous losses on one group).
export class ConcurrentModificationError extends Error {
  constructor(message = "Įrašas ką tik pasikeitė, bandykite dar kartą") {
    super(message);
    this.name = "ConcurrentModificationError";
  }
}

// Structured error logging (issue #91). There is no logging library in this
// app — on purpose, for a small solo-maintained project — so this writes one
// JSON object per line to stderr via console.error. Vercel's log pipeline
// captures stdout/stderr per invocation and treats a JSON line as structured,
// making it filterable/queryable in the log explorer, unlike a bare stack
// trace dump.
//
// "expected" is for errors handleApiError already knows how to map to a 4xx
// response (ValidationError, ForbiddenError, ConcurrentModificationError) —
// still worth a record, but not an on-call-worthy one. "unexpected" is
// everything else: the case that previously vanished into Next.js's generic
// unstructured output with zero structured trace of what happened.
export type ErrorLogSeverity = "expected" | "unexpected";

export interface ErrorLogEntry {
  timestamp: string;
  severity: ErrorLogSeverity;
  context: string;
  name: string;
  message: string;
  stack?: string;
}

/**
 * Logs one structured JSON line describing `err` to stderr.
 *
 * @param context A short label for where the error was caught (e.g.
 *   "handleApiError.unexpected"), so log lines can be grouped/filtered
 *   without parsing the stack trace.
 * @param err The caught value. Non-Error throws are coerced into a message.
 * @param severity "expected" for errors already mapped to a specific HTTP
 *   response, "unexpected" for anything else. Defaults to "unexpected".
 */
export function logError(
  context: string,
  err: unknown,
  severity: ErrorLogSeverity = "unexpected",
): void {
  const error = err instanceof Error ? err : new Error(String(err));
  const entry: ErrorLogEntry = {
    timestamp: new Date().toISOString(),
    severity,
    context,
    name: error.name,
    message: error.message,
    ...(error.stack ? { stack: error.stack } : {}),
  };
  console.error(JSON.stringify(entry));
}
