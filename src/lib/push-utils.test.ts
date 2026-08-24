import { describe, it, expect } from "vitest";
// Relative import, like notification-schedule.test.ts: the module under test has
// no internal imports, so the suite needs no vitest config.
import {
  MAX_PAYLOAD_BYTES,
  buildPushPayload,
  classifyPushSupport,
  isGoneStatus,
  resolveDeliveryOutcome,
  safeNotificationPath,
  urlBase64ToUint8Array,
} from "./push-utils";

describe("urlBase64ToUint8Array", () => {
  it("decodes a real VAPID public key to 65 bytes starting with 0x04", () => {
    // Generated with crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' }),
    // exported as SPKI and trimmed to the uncompressed point — the shape every
    // VAPID public key has.
    const key =
      "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U";
    const bytes = urlBase64ToUint8Array(key);
    expect(bytes.length).toBe(65);
    expect(bytes[0]).toBe(0x04);
  });

  it("restores stripped padding", () => {
    // "AQAB" needs none; "AQA" needs one "=".
    expect(Array.from(urlBase64ToUint8Array("AQAB"))).toEqual([1, 0, 1]);
    expect(urlBase64ToUint8Array("AQA").length).toBe(2);
  });

  it("maps the URL-safe alphabet back to standard base64", () => {
    // "-" and "_" stand in for "+" and "/".
    expect(Array.from(urlBase64ToUint8Array("-_8="))).toEqual([251, 255]);
  });
});

describe("isGoneStatus", () => {
  it("treats 404 and 410 as permanently gone", () => {
    expect(isGoneStatus(404)).toBe(true);
    expect(isGoneStatus(410)).toBe(true);
  });

  it("keeps the subscription for transient failures", () => {
    // Deleting a working device because the push service rate-limited us or had
    // an outage would silently stop that phone from ever ringing again.
    for (const code of [400, 401, 403, 429, 500, 502, 503, undefined]) {
      expect(isGoneStatus(code)).toBe(false);
    }
  });
});

describe("classifyPushSupport", () => {
  const base = {
    hasServiceWorker: false,
    hasPushManager: false,
    hasNotification: false,
    userAgent: "",
    maxTouchPoints: 0,
    standalone: false,
  };
  const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/605.1.15";
  const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15";

  it("reports supported whenever all three APIs are present", () => {
    const env = {
      ...base,
      hasServiceWorker: true,
      hasPushManager: true,
      hasNotification: true,
      userAgent: IPHONE,
    };
    // An installed iOS app has the APIs, so the UA must not override that.
    expect(classifyPushSupport(env)).toBe("supported");
  });

  it("tells an uninstalled iPhone to install rather than calling it unsupported", () => {
    expect(classifyPushSupport({ ...base, userAgent: IPHONE })).toBe("ios-needs-install");
  });

  it("recognises an iPad that reports itself as a Mac", () => {
    // iPadOS 13+ sends a Macintosh UA; touch points are the only distinguisher.
    expect(classifyPushSupport({ ...base, userAgent: MAC, maxTouchPoints: 5 })).toBe(
      "ios-needs-install",
    );
  });

  it("does not mistake a real Mac for an iPad", () => {
    expect(classifyPushSupport({ ...base, userAgent: MAC, maxTouchPoints: 0 })).toBe("unsupported");
  });

  it("reports unsupported for a browser missing the APIs", () => {
    expect(classifyPushSupport({ ...base, userAgent: "Mozilla/5.0 (X11; Linux)" })).toBe(
      "unsupported",
    );
  });
});

describe("resolveDeliveryOutcome", () => {
  it("counts one delivered channel as sent even if the other failed", () => {
    // The user got their reminder; a partial failure is an ops detail.
    expect(resolveDeliveryOutcome("delivered", "failed")).toBe("sent");
    expect(resolveDeliveryOutcome("failed", "delivered")).toBe("sent");
    expect(resolveDeliveryOutcome("delivered", "not-attempted")).toBe("sent");
  });

  it("counts failure only when something was attempted and everything errored", () => {
    expect(resolveDeliveryOutcome("failed", "failed")).toBe("failed");
    expect(resolveDeliveryOutcome("failed", "not-attempted")).toBe("failed");
  });

  it("counts nothing-attempted as skipped, not failed", () => {
    // Push on but no registered devices: the batch log must not look broken
    // every day for a user who simply has no phone attached.
    expect(resolveDeliveryOutcome("not-attempted", "not-attempted")).toBe("skipped");
  });
});

describe("safeNotificationPath", () => {
  it("keeps a same-origin path", () => {
    expect(safeNotificationPath("/eggs/collections/new")).toBe("/eggs/collections/new");
  });

  it("rejects anything that could resolve off-origin", () => {
    for (const bad of ["//evil.com", "https://evil.com", "javascript:alert(1)", 42, null]) {
      expect(safeNotificationPath(bad)).toBe("/");
    }
  });
});

describe("buildPushPayload", () => {
  it("passes an ordinary reminder through untouched", () => {
    const payload = { title: "ChickensFarm", body: "Nepamirškite suvesti duomenų.", url: "/x" };
    expect(JSON.parse(buildPushPayload(payload))).toEqual(payload);
  });

  it("truncates a pathologically long body instead of exceeding the limit", () => {
    const payload = { title: "T", body: "x".repeat(MAX_PAYLOAD_BYTES + 500), url: "/x" };
    const out = buildPushPayload(payload);
    expect(out.length).toBeLessThanOrEqual(MAX_PAYLOAD_BYTES);
    expect(JSON.parse(out).body.endsWith("…")).toBe(true);
    expect(JSON.parse(out).title).toBe("T");
  });
});
