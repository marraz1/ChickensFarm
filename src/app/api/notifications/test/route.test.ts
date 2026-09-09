import { beforeEach, describe, expect, it, vi } from "vitest";

// Covers issue #136: POST /api/notifications/test used to send to whatever
// `email` the request body carried, letting any authenticated user relay
// attacker-chosen text to an arbitrary address through this app's own Resend
// account. This suite drives the real route handler end to end (real
// notificationTestSchema, real resolveTestEmailRecipient fallback) and only
// stubs its I/O boundaries — session, the saved-settings lookup, email
// sending, and push — the same boundary-mocking style multi-tenant-isolation
// .test.ts uses for the service layer.

vi.mock("@/lib/session", () => {
  class ForbiddenError extends Error {}
  return { ForbiddenError, requireUserApi: vi.fn() };
});

// notifications.ts (and data-presence.ts, which it imports) reach "@/lib/prisma"
// at module scope; stubbed so this suite needs no DATABASE_URL. getNotificationSetting
// itself is mocked per test below — nothing here actually calls into this stub.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

vi.mock("@/lib/services/notifications", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/services/notifications")>();
  return { ...actual, getNotificationSetting: vi.fn() };
});

vi.mock("@/lib/email", () => ({
  isEmailConfigured: vi.fn(() => true),
  sendReminderEmail: vi.fn(async () => {}),
}));

vi.mock("@/lib/push", () => ({
  pushPublicKey: vi.fn(() => null),
  reminderPayload: vi.fn((message: string) => ({ title: "ChickensFarm", body: message, url: "/" })),
  sendPushToUser: vi.fn(async () => ({ sent: 0, removed: 0, failed: 0 })),
}));

import { requireUserApi } from "@/lib/session";
import { getNotificationSetting } from "@/lib/services/notifications";
import { sendReminderEmail } from "@/lib/email";
import { POST } from "./route";

const CALLER = { id: "user-1", email: "owner@example.com", name: "Owner" };

function postRequest(body: unknown): Request {
  return new Request("http://localhost/api/notifications/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.mocked(requireUserApi).mockReset().mockResolvedValue(CALLER);
  vi.mocked(getNotificationSetting).mockReset().mockResolvedValue(null);
  vi.mocked(sendReminderEmail).mockClear();
});

describe("POST /api/notifications/test", () => {
  it("sends to the caller's account email, ignoring an email field in the body", async () => {
    const res = await POST(
      postRequest({
        message: "hello",
        email: "attacker@evil.com",
        emailEnabled: true,
        pushEnabled: false,
      }),
    );
    const json = await res.json();

    expect(sendReminderEmail).toHaveBeenCalledWith("owner@example.com", "hello");
    expect(sendReminderEmail).not.toHaveBeenCalledWith("attacker@evil.com", expect.anything());
    expect(json.email).toMatchObject({ attempted: true, sent: true, to: "owner@example.com" });
  });

  it("prefers the saved NotificationSetting.email over both the account email and the body", async () => {
    vi.mocked(getNotificationSetting).mockResolvedValue({
      email: "saved@example.com",
    } as Awaited<ReturnType<typeof getNotificationSetting>>);

    const res = await POST(
      postRequest({
        message: "hello",
        email: "attacker@evil.com",
        emailEnabled: true,
        pushEnabled: false,
      }),
    );
    const json = await res.json();

    expect(sendReminderEmail).toHaveBeenCalledWith("saved@example.com", "hello");
    expect(json.email.to).toBe("saved@example.com");
  });

  it("still works with no email field in the body at all (the UI's shape after this fix)", async () => {
    const res = await POST(
      postRequest({ message: "hello", emailEnabled: true, pushEnabled: false }),
    );
    const json = await res.json();

    expect(sendReminderEmail).toHaveBeenCalledWith("owner@example.com", "hello");
    expect(json.email).toMatchObject({ attempted: true, sent: true });
  });

  it("does not attempt an email send when the email channel is off, even with a body email", async () => {
    const res = await POST(
      postRequest({
        message: "hello",
        email: "attacker@evil.com",
        emailEnabled: false,
        pushEnabled: true,
      }),
    );
    await res.json();

    expect(sendReminderEmail).not.toHaveBeenCalled();
  });
});
