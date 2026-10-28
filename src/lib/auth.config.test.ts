import { describe, expect, it } from "vitest";
import authConfig from "./auth.config";

// V1 (chickensfarm.vercel.app) and the V2 beta (chickensfarm-v2.vercel.app)
// must keep separate sign-ins (#181): signing in to one may not replace or
// end the other's session. That holds because Auth.js session cookies are
// host-only by default. A cookie `domain` here would make them shared — this
// test is the tripwire for that.
describe("auth config cookies", () => {
  it("sets no cookie domain, so each site keeps its own session", () => {
    const cookies = (authConfig as { cookies?: Record<string, { options?: { domain?: string } }> })
      .cookies;
    const domains = Object.values(cookies ?? {}).map((c) => c.options?.domain);
    expect(domains.filter(Boolean)).toEqual([]);
  });

  it("uses JWT sessions, which carry no shared server-side session store", () => {
    expect(authConfig.session?.strategy).toBe("jwt");
  });
});
