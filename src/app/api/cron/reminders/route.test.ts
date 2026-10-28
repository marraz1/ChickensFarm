import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The V2 beta must never send the daily reminders (#181): V1 already sends
// them from the same users' settings. Real handler, batch mocked at the
// module boundary like the health route test.

const runReminderBatch = vi.fn();
vi.mock("@/lib/services/reminders", () => ({
  runReminderBatch: (...args: unknown[]) => runReminderBatch(...args),
}));

import { POST } from "./route";

const SECRET = "test-cron-secret";
const call = (auth?: string) =>
  POST(
    new Request("http://localhost/api/cron/reminders", {
      method: "POST",
      headers: auth ? { Authorization: auth } : undefined,
    }),
  );

beforeEach(() => {
  runReminderBatch.mockReset();
  runReminderBatch.mockResolvedValue({ due: 0, sent: 0 });
});
afterEach(() => vi.unstubAllEnvs());

describe("POST /api/cron/reminders", () => {
  it("refuses in the V2 beta, even with a valid secret", async () => {
    vi.stubEnv("APP_STAGE", "beta");
    vi.stubEnv("CRON_SECRET", SECRET);

    const res = await call(`Bearer ${SECRET}`);

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "Reminders are disabled in the V2 beta" });
    expect(runReminderBatch).not.toHaveBeenCalled();
  });

  it("still answers 503 without a secret outside the beta", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await call(`Bearer ${SECRET}`)).status).toBe(503);
    expect(runReminderBatch).not.toHaveBeenCalled();
  });

  it("still rejects a wrong bearer outside the beta", async () => {
    vi.stubEnv("CRON_SECRET", SECRET);
    expect((await call("Bearer nope")).status).toBe(401);
    expect(runReminderBatch).not.toHaveBeenCalled();
  });

  it("runs the batch outside the beta with the right secret", async () => {
    vi.stubEnv("CRON_SECRET", SECRET);
    const res = await call(`Bearer ${SECRET}`);
    expect(res.status).toBe(200);
    expect(runReminderBatch).toHaveBeenCalledOnce();
  });
});
