import { afterEach, describe, expect, it, vi } from "vitest";

// The register route's service is never reached while read-only; mocked so
// importing the route needs no database.
vi.mock("@/lib/services/auth", () => ({
  registerUser: vi.fn(),
  requestPasswordReset: vi.fn(),
  confirmPasswordReset: vi.fn(),
}));

import {
  READ_ONLY_MESSAGE,
  blocksWhileReadOnly,
  isReadOnlyMode,
  readOnlyResponse,
  refuseWhileReadOnly,
} from "@/lib/read-only";
import { POST as register } from "@/app/api/auth/register/route";
import { PATCH as confirmReset, POST as requestReset } from "@/app/api/auth/password-reset/route";
import { registerUser } from "@/lib/services/auth";

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
