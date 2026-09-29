import { beforeEach, describe, expect, it, vi } from "vitest";

// Drives the real route handler (real feedbackSchema, real rate limiter, real
// createFeedback) and stubs only its I/O boundaries: the session and Prisma.
// The point is tenant scoping — the stored userId/farmId must come from the
// session and the caller's own active farm, never from the request body.

vi.mock("@/lib/session", () => {
  class ForbiddenError extends Error {}
  return { ForbiddenError, requireUserApi: vi.fn(), resolveActiveFarm: vi.fn() };
});

const feedbackCreate = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { feedback: { create: (...args: unknown[]) => feedbackCreate(...args) } },
}));

import { ForbiddenError, requireUserApi, resolveActiveFarm } from "@/lib/session";
import { resetRateLimits } from "@/lib/rate-limit";
import { POST } from "./route";

const CALLER = { id: "user-1", email: "owner@example.com", name: "Owner" };
const OWN_FARM = { id: "farm-1", name: "Mano ūkis" };

function postRequest(body: unknown): Request {
  return new Request("http://localhost/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  resetRateLimits();
  vi.mocked(requireUserApi).mockReset().mockResolvedValue(CALLER);
  vi.mocked(resolveActiveFarm)
    .mockReset()
    // Only the fields the route reads; the real type carries more.
    .mockResolvedValue({ farms: [OWN_FARM], activeFarm: OWN_FARM } as never);
  feedbackCreate.mockReset().mockResolvedValue({ id: "fb-1", createdAt: new Date() });
});

describe("POST /api/feedback", () => {
  it("stores the message against the session user and their active farm", async () => {
    const res = await POST(postRequest({ message: "  Trūksta eksporto į Excel  " }));

    expect(res.status).toBe(201);
    expect(resolveActiveFarm).toHaveBeenCalledWith(CALLER.id);
    expect(feedbackCreate).toHaveBeenCalledTimes(1);
    expect(feedbackCreate.mock.calls[0][0].data).toMatchObject({
      userId: CALLER.id,
      farmId: OWN_FARM.id,
      message: "Trūksta eksporto į Excel",
    });
  });

  it("ignores userId/farmId supplied in the body", async () => {
    await POST(postRequest({ message: "Sveiki", userId: "victim", farmId: "someone-elses-farm" }));

    const data = feedbackCreate.mock.calls[0][0].data;
    expect(data.userId).toBe(CALLER.id);
    expect(data.farmId).toBe(OWN_FARM.id);
  });

  it("accepts feedback from a user with no farm yet, with farmId null", async () => {
    vi.mocked(resolveActiveFarm).mockResolvedValue({ farms: [], activeFarm: null } as never);

    const res = await POST(postRequest({ message: "Nepavyksta sukurti ūkio" }));

    expect(res.status).toBe(201);
    expect(feedbackCreate.mock.calls[0][0].data.farmId).toBeNull();
  });

  it("rejects an empty message with 400 and stores nothing", async () => {
    const res = await POST(postRequest({ message: "   " }));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Parašykite atsiliepimą");
    expect(feedbackCreate).not.toHaveBeenCalled();
  });

  it("rejects a malformed body with 400", async () => {
    const res = await POST(postRequest("not json"));

    expect(res.status).toBe(400);
    expect(feedbackCreate).not.toHaveBeenCalled();
  });

  it("returns 403 when not signed in", async () => {
    vi.mocked(requireUserApi).mockRejectedValue(new ForbiddenError("Not authenticated"));

    const res = await POST(postRequest({ message: "Sveiki" }));

    expect(res.status).toBe(403);
    expect(feedbackCreate).not.toHaveBeenCalled();
  });

  it("rate-limits per user", async () => {
    for (let i = 0; i < 5; i++) {
      expect((await POST(postRequest({ message: `Nr. ${i}` }))).status).toBe(201);
    }
    const limited = await POST(postRequest({ message: "Dar vienas" }));
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBeTruthy();
    expect(feedbackCreate).toHaveBeenCalledTimes(5);

    // A different user has their own bucket.
    vi.mocked(requireUserApi).mockResolvedValue({ ...CALLER, id: "user-2" });
    expect((await POST(postRequest({ message: "Sveiki" }))).status).toBe(201);
  });
});
