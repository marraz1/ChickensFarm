import { describe, expect, it } from "vitest";
import { pushSubscriptionSchema, pushUnsubscribeSchema } from "@/lib/validation/push";

const keys = { p256dh: "p256dh-key", auth: "auth-secret" };

function subscriptionWith(endpoint: string) {
  return { endpoint, keys };
}

describe("pushSubscriptionSchema", () => {
  it("accepts a real Chrome/FCM endpoint", () => {
    const result = pushSubscriptionSchema.safeParse(
      subscriptionWith("https://fcm.googleapis.com/fcm/send/abc123"),
    );
    expect(result.success).toBe(true);
  });

  it("accepts a real Firefox/Mozilla endpoint", () => {
    const result = pushSubscriptionSchema.safeParse(
      subscriptionWith("https://updates.push.services.mozilla.com/wpush/v2/abc123"),
    );
    expect(result.success).toBe(true);
  });

  it("accepts a real Safari/Apple endpoint (with subdomain)", () => {
    const result = pushSubscriptionSchema.safeParse(
      subscriptionWith("https://web.push.apple.com/QABC123"),
    );
    expect(result.success).toBe(true);
  });

  it("accepts a real Edge/WNS endpoint (with subdomain)", () => {
    const result = pushSubscriptionSchema.safeParse(
      subscriptionWith("https://db5.notify.windows.com/w/abc123"),
    );
    expect(result.success).toBe(true);
  });

  it("rejects an internal/private-network URL", () => {
    const result = pushSubscriptionSchema.safeParse(
      subscriptionWith("http://169.254.169.254/latest/meta-data/"),
    );
    expect(result.success).toBe(false);
  });

  it("rejects an arbitrary attacker-controlled URL", () => {
    const result = pushSubscriptionSchema.safeParse(
      subscriptionWith("https://attacker.example.com/collect"),
    );
    expect(result.success).toBe(false);
  });

  it("rejects a bypass attempt using an allowed host as a path segment", () => {
    const result = pushSubscriptionSchema.safeParse(
      subscriptionWith("https://evil.com/fcm.googleapis.com"),
    );
    expect(result.success).toBe(false);
  });

  it("rejects a bypass attempt using an allowed host as a subdomain prefix", () => {
    const result = pushSubscriptionSchema.safeParse(
      subscriptionWith("https://fcm.googleapis.com.evil.com/x"),
    );
    expect(result.success).toBe(false);
  });

  it("rejects a bypass attempt appending an allowed host to a lookalike domain", () => {
    const result = pushSubscriptionSchema.safeParse(
      subscriptionWith("https://evil-fcm.googleapis.com.attacker.com/x"),
    );
    expect(result.success).toBe(false);
  });

  it("rejects a non-URL endpoint", () => {
    const result = pushSubscriptionSchema.safeParse(subscriptionWith("not-a-url"));
    expect(result.success).toBe(false);
  });
});

describe("pushUnsubscribeSchema", () => {
  it("accepts a real FCM endpoint", () => {
    const result = pushUnsubscribeSchema.safeParse({
      endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-allowlisted endpoint", () => {
    const result = pushUnsubscribeSchema.safeParse({
      endpoint: "https://attacker.example.com/collect",
    });
    expect(result.success).toBe(false);
  });
});
