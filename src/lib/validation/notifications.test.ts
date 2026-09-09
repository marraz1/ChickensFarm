import { describe, expect, it } from "vitest";
// Relative import, like notification-schedule.test.ts: this module's only
// internal import is notification-schedule.ts, which itself has none, so the
// suite needs no vitest config.
import { notificationTestSchema } from "./notifications";

// Covers issue #136: POST /api/notifications/test must never send to a
// client-supplied address. notificationTestSchema is the request body's
// gate, so this pins down that it carries no `email` field to smuggle one
// through — the destination is resolved server-side instead (see
// resolveTestEmailRecipient in src/lib/services/notifications.ts).
describe("notificationTestSchema", () => {
  const base = { message: "Test message", emailEnabled: true, pushEnabled: false };

  it("accepts a body with only message and channel toggles", () => {
    const result = notificationTestSchema.safeParse(base);
    expect(result.success).toBe(true);
  });

  it("does not carry an email field through, even when the request body sends one", () => {
    const result = notificationTestSchema.safeParse({
      ...base,
      email: "attacker@evil.com",
    });
    expect(result.success).toBe(true);
    // zod strips unknown keys by default; asserting it explicitly here so a
    // future `.passthrough()` (which would let it leak into parsed.data)
    // fails this test instead of silently reopening the hole.
    expect(result.success && "email" in result.data).toBe(false);
  });

  it("still requires at least one channel to be on", () => {
    const result = notificationTestSchema.safeParse({
      message: "Test message",
      emailEnabled: false,
      pushEnabled: false,
    });
    expect(result.success).toBe(false);
  });

  it("still requires a non-empty message", () => {
    const result = notificationTestSchema.safeParse({ ...base, message: "" });
    expect(result.success).toBe(false);
  });
});
