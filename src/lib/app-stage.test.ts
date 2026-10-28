import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appVersionLabel, appVersionTag, isBeta } from "./app-stage";

// Start every case from a known stage, whatever the shell exports.
beforeEach(() => vi.stubEnv("APP_STAGE", ""));
afterEach(() => vi.unstubAllEnvs());

describe("isBeta", () => {
  it("is true only for APP_STAGE=beta", () => {
    vi.stubEnv("APP_STAGE", "beta");
    expect(isBeta()).toBe(true);
  });

  it.each(["", "Beta", "production", "v2"])("is false for %j", (value) => {
    vi.stubEnv("APP_STAGE", value);
    expect(isBeta()).toBe(false);
  });
});

describe("appVersionLabel", () => {
  it("is the plain version outside the beta", () => {
    vi.stubEnv("APP_VERSION", "0.1.13");
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "b4ae5bc1234567");
    expect(appVersionLabel()).toBe("0.1.13");
  });

  it("names the V2 beta and its commit", () => {
    vi.stubEnv("APP_STAGE", "beta");
    vi.stubEnv("APP_VERSION", "0.1.13");
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "b4ae5bc1234567");
    expect(appVersionLabel()).toBe("0.1.13 · V2 beta · b4ae5bc");
  });

  it("leaves out a commit it does not know", () => {
    vi.stubEnv("APP_STAGE", "beta");
    vi.stubEnv("APP_VERSION", "0.1.13");
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "");
    expect(appVersionLabel()).toBe("0.1.13 · V2 beta");
  });

  it("shows a placeholder for an empty version, in and outside the beta", () => {
    vi.stubEnv("APP_VERSION", "");
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "");
    expect(appVersionLabel()).toBe("—");
    vi.stubEnv("APP_STAGE", "beta");
    expect(appVersionLabel()).toBe("— · V2 beta");
  });
});

describe("appVersionTag", () => {
  it("marks feedback sent from the beta", () => {
    vi.stubEnv("APP_STAGE", "beta");
    vi.stubEnv("APP_VERSION", "0.1.13");
    expect(appVersionTag()).toBe("0.1.13-beta");
  });

  it("is the plain version outside the beta, and null without one", () => {
    vi.stubEnv("APP_VERSION", "0.1.13");
    expect(appVersionTag()).toBe("0.1.13");
    vi.stubEnv("APP_VERSION", "");
    expect(appVersionTag()).toBeNull();
  });

  it("fits the 32-character feedback column for a plain x.y.z version", () => {
    // Longer pre-release versions are cut to 32 by createFeedback.
    vi.stubEnv("APP_STAGE", "beta");
    vi.stubEnv("APP_VERSION", "999.999.999");
    expect(appVersionTag()!.length).toBeLessThanOrEqual(32);
  });
});
