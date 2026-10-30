import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

// The register route's service is never reached while read-only; mocked so
// importing the route needs no database.
vi.mock("@/lib/services/auth", () => ({
  registerUser: vi.fn(),
  requestPasswordReset: vi.fn(),
  confirmPasswordReset: vi.fn(),
}));
vi.mock("@/lib/services/reminders", () => ({ runReminderBatch: vi.fn() }));

import {
  READ_ONLY_MESSAGE,
  blocksWhileReadOnly,
  isReadOnlyMode,
  readOnlyResponse,
  refuseWhileReadOnly,
} from "@/lib/read-only";
import { POST as register } from "@/app/api/auth/register/route";
import { PATCH as confirmReset, POST as requestReset } from "@/app/api/auth/password-reset/route";
import { POST as cron } from "@/app/api/cron/reminders/route";
import { registerUser } from "@/lib/services/auth";
import { runReminderBatch } from "@/lib/services/reminders";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isReadOnlyMode", () => {
  it("is off unless READ_ONLY_MODE is exactly true", () => {
    expect(isReadOnlyMode({})).toBe(false);
    expect(isReadOnlyMode({ READ_ONLY_MODE: "" })).toBe(false);
    expect(isReadOnlyMode({ READ_ONLY_MODE: "false" })).toBe(false);
    expect(isReadOnlyMode({ READ_ONLY_MODE: "1" })).toBe(false);
    expect(isReadOnlyMode({ READ_ONLY_MODE: "TRUE" })).toBe(false);
    expect(isReadOnlyMode({ READ_ONLY_MODE: "true" })).toBe(true);
  });
});

describe("blocksWhileReadOnly", () => {
  it("refuses every change to the farm's data", () => {
    for (const [method, path] of [
      ["POST", "/api/egg-collections"],
      ["PATCH", "/api/expenses/abc"],
      ["PUT", "/api/farms/f1"],
      ["DELETE", "/api/losses/l1"],
      ["POST", "/api/mother-hens/h1/logs"],
      ["POST", "/api/push/subscribe"],
      ["POST", "/api/feedback"],
      ["post", "/api/breeds"],
    ]) {
      expect(blocksWhileReadOnly(method, path), `${method} ${path}`).toBe(true);
    }
  });

  it("refuses creating users and changing passwords", () => {
    expect(blocksWhileReadOnly("POST", "/api/auth/register")).toBe(true);
    expect(blocksWhileReadOnly("POST", "/api/auth/password-reset")).toBe(true);
    expect(blocksWhileReadOnly("PATCH", "/api/auth/password-reset")).toBe(true);
  });

  it("lets owners read, sign in and switch farms", () => {
    for (const [method, path] of [
      ["GET", "/api/expenses"],
      ["HEAD", "/api/health"],
      ["OPTIONS", "/api/egg-sales"],
      ["POST", "/api/auth/callback/credentials"],
      ["POST", "/api/auth/signout"],
      ["GET", "/api/auth/session"],
      ["POST", "/api/active-farm"],
    ]) {
      expect(blocksWhileReadOnly(method, path), `${method} ${path}`).toBe(false);
    }
  });

  it("leaves pages alone (the banner covers them)", () => {
    expect(blocksWhileReadOnly("POST", "/login")).toBe(false);
    expect(blocksWhileReadOnly("GET", "/")).toBe(false);
    // Only the exact prefix counts as the API.
    expect(blocksWhileReadOnly("POST", "/apiary")).toBe(false);
  });
});

describe("readOnlyResponse", () => {
  it("answers 503 with the Lithuanian message", async () => {
    const res = readOnlyResponse();
    expect(res.status).toBe(503);
    expect(res.headers.get("Retry-After")).toBe("3600");
    expect(await res.json()).toEqual({ error: READ_ONLY_MESSAGE });
  });
});

describe("the routes the middleware does not see", () => {
  const post = (path: string, method = "POST") =>
    new Request(`http://localhost${path}`, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });

  it("refuses registration and password resets while read-only", async () => {
    vi.stubEnv("READ_ONLY_MODE", "true");
    for (const res of [
      await register(post("/api/auth/register")),
      await requestReset(post("/api/auth/password-reset")),
      await confirmReset(post("/api/auth/password-reset", "PATCH")),
    ]) {
      expect(res.status).toBe(503);
      expect(await res.json()).toEqual({ error: READ_ONLY_MESSAGE });
    }
    expect(registerUser).not.toHaveBeenCalled();
  });

  it("does nothing while the switch is off", () => {
    vi.stubEnv("READ_ONLY_MODE", "");
    expect(refuseWhileReadOnly(post("/api/auth/register"))).toBeNull();
  });
});

describe("routes outside the middleware", () => {
  // The middleware's matcher skips api/auth and api/cron, so a route there that
  // writes must check the switch itself. NextAuth's own handler only signs in
  // and out, which stays allowed.
  const root = path.join(process.cwd(), "src/app/api");
  const routes = ["auth", "cron"].flatMap((dir) =>
    fs
      .readdirSync(path.join(root, dir), { recursive: true, encoding: "utf8" })
      .filter((f) => f.endsWith("route.ts") && !f.includes("[...nextauth]"))
      .map((f) => path.join(dir, f)),
  );

  it("finds the routes it guards", () => {
    expect(routes.length).toBeGreaterThanOrEqual(3);
  });

  it.each(routes)("%s checks the read-only switch in every writing handler", (route) => {
    const source = fs.readFileSync(path.join(root, route), "utf8");
    const writers = source.match(/export async function (POST|PUT|PATCH|DELETE)\b/g) ?? [];
    const guards = source.match(/refuseWhileReadOnly\(req\)/g) ?? [];
    expect(guards.length).toBeGreaterThanOrEqual(writers.length);
  });
});

describe("the reminder cron while read-only", () => {
  it("answers 503 to the authorised workflow and runs no batch", async () => {
    vi.stubEnv("READ_ONLY_MODE", "true");
    vi.stubEnv("CRON_SECRET", "s3cret");
    const res = await cron(
      new Request("http://localhost/api/cron/reminders", {
        method: "POST",
        headers: { authorization: "Bearer s3cret" },
      }),
    );
    expect(res.status).toBe(503);
    expect(runReminderBatch).not.toHaveBeenCalled();
  });
});
