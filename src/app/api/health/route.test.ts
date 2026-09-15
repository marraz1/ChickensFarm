import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Covers issue #75: an external uptime monitor (UptimeRobot et al.) alerts on
// HTTP status code, not response body content, so this route must answer
// non-200 whenever it has decided the app is unhealthy — never 200 with a
// "degraded" body baked in. Same boundary-mocking style as
// notifications/test/route.test.ts: real handler, I/O mocked at the module
// boundary.

const queryRaw = vi.fn();
const findManyNotificationSettings = vi.fn();
const countPushSubscriptions = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: (...args: unknown[]) => queryRaw(...args),
    notificationSetting: {
      findMany: (...args: unknown[]) => findManyNotificationSettings(...args),
    },
    pushSubscription: { count: (...args: unknown[]) => countPushSubscriptions(...args) },
  },
}));

vi.mock("@/lib/email", () => ({ isEmailConfigured: vi.fn(() => true) }));

vi.mock("@/lib/push", () => ({
  pushPublicKey: vi.fn(() => "vapid-key"),
  vapidSubject: vi.fn(() => "mailto:ops@example.com"),
}));

import { GET } from "./route";

const CRON_SECRET = "test-cron-secret";

function request(headers?: Record<string, string>): Request {
  return new Request("http://localhost/api/health", { headers });
}

function authedRequest(): Request {
  return request({ Authorization: `Bearer ${CRON_SECRET}` });
}

beforeEach(() => {
  queryRaw.mockReset();
  findManyNotificationSettings.mockReset().mockResolvedValue([]);
  countPushSubscriptions.mockReset().mockResolvedValue(0);
});

afterEach(() => {
  delete process.env.CRON_SECRET;
  vi.unstubAllEnvs();
});

describe("GET /api/health — unauthenticated (what an uptime monitor sees)", () => {
  it("returns 200 with status ok when the database is reachable", async () => {
    queryRaw.mockResolvedValueOnce([{ "?column?": 1 }]); // SELECT 1

    const res = await GET(request());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.status).toBe("ok");
    // Liveness only — no reconnaissance material for an unauthenticated caller.
    expect(json.migrations).toBeUndefined();
    expect(json.database).toBeUndefined();
  });

  it("returns 503, not 200, when the database is unreachable", async () => {
    queryRaw.mockRejectedValueOnce(new Error("connection refused"));

    const res = await GET(request());
    const json = await res.json();

    expect(res.status).toBe(503);
    expect(json.status).toBe("degraded");
  });
});

describe("GET /api/health — authenticated (deploy pipeline / operator)", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = CRON_SECRET;
  });

  it("returns 200 with full detail when the db is up and no migration is stuck", async () => {
    queryRaw
      .mockResolvedValueOnce([{ "?column?": 1 }]) // SELECT 1
      .mockResolvedValueOnce([
        { migration_name: "0001_init", finished_at: new Date("2024-01-01"), rolled_back_at: null },
      ]);

    const res = await GET(authedRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.status).toBe("ok");
    expect(json.migrations.failed).toEqual([]);
    expect(json.migrations.applied).toEqual(["0001_init"]);
  });

  it("returns 503 when a migration started and never finished", async () => {
    queryRaw
      .mockResolvedValueOnce([{ "?column?": 1 }]) // SELECT 1
      .mockResolvedValueOnce([
        { migration_name: "0001_init", finished_at: new Date("2024-01-01"), rolled_back_at: null },
        { migration_name: "0002_stuck", finished_at: null, rolled_back_at: null },
      ]);

    const res = await GET(authedRequest());
    const json = await res.json();

    expect(res.status).toBe(503);
    expect(json.status).toBe("degraded");
    expect(json.migrations.failed).toEqual(["0002_stuck"]);
  });

  it("returns 503 when the database itself is unreachable, even for an authorized caller", async () => {
    queryRaw.mockRejectedValueOnce(new Error("connection refused"));

    const res = await GET(authedRequest());
    const json = await res.json();

    expect(res.status).toBe(503);
    expect(json.status).toBe("degraded");
    expect(json.database.connected).toBe(false);
  });

  it("does not treat a wrong bearer token as authorized", async () => {
    queryRaw.mockResolvedValueOnce([{ "?column?": 1 }]);

    const res = await GET(request({ Authorization: "Bearer wrong-secret" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.migrations).toBeUndefined();
  });
});
