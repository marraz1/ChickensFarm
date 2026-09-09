import { afterEach, describe, expect, it, vi } from "vitest";
// Relative import, like finance-math.test.ts / push-utils.test.ts: this
// module has no internal imports, so the suite needs no vitest config.
import { ConcurrentModificationError, ValidationError, logError } from "./errors";

describe("logError", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("writes a single structured JSON line to console.error", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const err = new ValidationError("Neteisingi duomenys");

    logError("test.context", err, "expected");

    expect(spy).toHaveBeenCalledTimes(1);
    const line = spy.mock.calls[0][0] as string;
    const parsed = JSON.parse(line);

    expect(parsed).toMatchObject({
      severity: "expected",
      context: "test.context",
      name: "ValidationError",
      message: "Neteisingi duomenys",
    });
    expect(typeof parsed.timestamp).toBe("string");
    expect(new Date(parsed.timestamp).toString()).not.toBe("Invalid Date");
    expect(typeof parsed.stack).toBe("string");
  });

  it("defaults severity to 'unexpected'", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    logError("test.context", new Error("boom"));

    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed.severity).toBe("unexpected");
  });

  it("coerces a non-Error throw into a message without crashing", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    logError("test.context", "just a string", "unexpected");

    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed.message).toBe("just a string");
    expect(parsed.name).toBe("Error");
  });

  it("distinguishes ConcurrentModificationError by name", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    logError("test.context", new ConcurrentModificationError(), "expected");

    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed.name).toBe("ConcurrentModificationError");
  });
});
