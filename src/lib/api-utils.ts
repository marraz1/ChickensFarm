import { NextResponse } from "next/server";
import { ForbiddenError } from "@/lib/session";
import { ValidationError, ConcurrentModificationError, logError } from "@/lib/errors";

// Single catch handler used by every API route (see route.ts under
// src/app/api/**). Every path through here logs a structured line first
// (issue #91) so errors are visible in Vercel logs even though the known
// cases are mapped to a "normal" 4xx response, and the unknown case — which
// used to just vanish into Next.js's own generic unstructured output — gets
// one before being rethrown.
export function handleApiError(err: unknown) {
  if (err instanceof ForbiddenError) {
    logError("handleApiError.forbidden", err, "expected");
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
  if (err instanceof ValidationError) {
    logError("handleApiError.validation", err, "expected");
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
  if (err instanceof ConcurrentModificationError) {
    logError("handleApiError.concurrentModification", err, "expected");
    return NextResponse.json({ error: err.message }, { status: 409 });
  }
  logError("handleApiError.unexpected", err, "unexpected");
  throw err;
}
