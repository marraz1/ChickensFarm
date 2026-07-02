import { NextResponse } from "next/server";
import { ForbiddenError } from "@/lib/session";
import { ValidationError, ConcurrentModificationError } from "@/lib/errors";

export function handleApiError(err: unknown) {
  if (err instanceof ForbiddenError) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
  if (err instanceof ValidationError) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
  if (err instanceof ConcurrentModificationError) {
    return NextResponse.json({ error: err.message }, { status: 409 });
  }
  throw err;
}
