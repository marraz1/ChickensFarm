import { afterEach, describe, expect, it, vi } from "vitest";

// api-utils imports "@/lib/session" for ForbiddenError; session.ts pulls in
// next/navigation, @/lib/auth and @/lib/prisma at module scope, so it's
// mocked here the same way route.test.ts suites mock it, rather than
// importing the real module into a unit test.
vi.mock("@/lib/session", () => {
  class ForbiddenError extends Error {
    constructor(message = "Forbidden") {
      super(message);
      this.name = "ForbiddenError";
    }
  }
  return { ForbiddenError };
});

import { ForbiddenError } from "@/lib/session";
import { ConcurrentModificationError, ValidationError } from "@/lib/errors";
import { handleApiError } from "@/lib/api-utils";

function lastLoggedEntry(spy: ReturnType<typeof vi.spyOn>) {
  const call = spy.mock.calls.at(-1);
  expect(call).toBeDefined();
  return JSON.parse(call![0] as string);
}

describe("handleApiError", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs a structured line and returns 403 for ForbiddenError", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = handleApiError(new ForbiddenError("nope"));

    expect(res.status).toBe(403);
    const entry = lastLoggedEntry(spy);
    expect(entry).toMatchObject({
      severity: "expected",
      context: "handleApiError.forbidden",
      name: "ForbiddenError",
      message: "nope",
    });
    expect(typeof entry.timestamp).toBe("string");
  });

  it("logs a structured line and returns 400 for ValidationError", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = handleApiError(new ValidationError("bad input"));

    expect(res.status).toBe(400);
    const entry = lastLoggedEntry(spy);
    expect(entry).toMatchObject({
      severity: "expected",
      context: "handleApiError.validation",
      name: "ValidationError",
      message: "bad input",
    });
  });

  it("logs a structured line and returns 409 for ConcurrentModificationError", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = handleApiError(new ConcurrentModificationError());

    expect(res.status).toBe(409);
    const entry = lastLoggedEntry(spy);
    expect(entry).toMatchObject({
      severity: "expected",
      context: "handleApiError.concurrentModification",
      name: "ConcurrentModificationError",
    });
  });

  it("logs a structured 'unexpected' line then rethrows for an unknown error", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const err = new Error("database is on fire");

    expect(() => handleApiError(err)).toThrow(err);

    const entry = lastLoggedEntry(spy);
    expect(entry).toMatchObject({
      severity: "unexpected",
      context: "handleApiError.unexpected",
      name: "Error",
      message: "database is on fire",
    });
    expect(typeof entry.stack).toBe("string");
  });
});
