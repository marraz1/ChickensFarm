import { describe, expect, it, vi } from "vitest";

// notifications.ts imports "@/lib/prisma" (for getNotificationSetting /
// saveNotificationSetting / getNotificationStatus, none of which this suite
// exercises) and, through data-presence.ts, again. Stubbed the same way
// multi-tenant-isolation.test.ts does, so this suite needs no DATABASE_URL
// and never touches a real client.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { resolveTestEmailRecipient } from "./notifications";

// Covers issue #136: POST /api/notifications/test must only ever send to the
// caller's own account email or their already-saved NotificationSetting.email
// — never an address supplied in the request body. This is the function the
// route calls to pick that address; the request body's `email` field is
// never one of its inputs (see the route and notificationTestSchema, which no
// longer even parses one).
describe("resolveTestEmailRecipient", () => {
  it("prefers the saved NotificationSetting.email over the account email", () => {
    expect(resolveTestEmailRecipient("account@example.com", "saved@example.com")).toBe(
      "saved@example.com",
    );
  });

  it("falls back to the account email when nothing is saved", () => {
    expect(resolveTestEmailRecipient("account@example.com", null)).toBe("account@example.com");
    expect(resolveTestEmailRecipient("account@example.com", undefined)).toBe("account@example.com");
  });

  it("returns null when neither address is available", () => {
    expect(resolveTestEmailRecipient(null, null)).toBeNull();
    expect(resolveTestEmailRecipient(undefined, undefined)).toBeNull();
  });
});
