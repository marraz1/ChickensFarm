import { afterEach, describe, expect, it, vi } from "vitest";
import { appStage, appVersionLabel, appVersionTag } from "./app-stage";

afterEach(() => vi.unstubAllEnvs());

describe("appStage", () => {
  it("is beta only for APP_STAGE=beta", () => {
    vi.stubEnv("APP_STAGE", "beta");
    expect(appStage()).toBe("beta");
  });

  it.each([undefined, "", "Beta", "production", "v2"])("is null for %s", (value) => {
    vi.stubEnv("APP_STAGE", value as string);
    expect(appStage()).toBeNull();
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

  it("fits the 32-character feedback column for any semver", () => {
    vi.stubEnv("APP_STAGE", "beta");
    vi.stubEnv("APP_VERSION", "999.999.999");
    expect(appVersionTag()!.length).toBeLessThanOrEqual(32);
  });
});
