import { describe, it, expect } from "vitest";
// Imported relatively, not via "@/", so the suite runs with no vitest config:
// this module deliberately has no internal imports of its own.
import {
  LATE_TOLERANCE_MINUTES,
  addLocalDays,
  dateOnlyUtc,
  evaluateDue,
  getLocalNow,
  isDue,
  nextSendAt,
  parseSendTime,
  safeTimeZone,
  shouldStampToday,
  zonedWallTimeToInstant,
} from "./notification-schedule";

const VILNIUS = "Europe/Vilnius";

describe("getLocalNow", () => {
  it("applies the winter offset (UTC+2)", () => {
    expect(getLocalNow(new Date("2026-01-15T06:30:00Z"), VILNIUS)).toEqual({
      date: "2026-01-15",
      minutes: 8 * 60 + 30,
    });
  });

  it("applies the summer offset (UTC+3)", () => {
    expect(getLocalNow(new Date("2026-07-15T06:30:00Z"), VILNIUS)).toEqual({
      date: "2026-07-15",
      minutes: 9 * 60 + 30,
    });
  });

  it("rolls over to the next local day before UTC midnight", () => {
    expect(getLocalNow(new Date("2026-07-15T22:30:00Z"), VILNIUS)).toEqual({
      date: "2026-07-16",
      minutes: 90,
    });
  });

  it("reports local midnight as 0 minutes, never 24 hours", () => {
    expect(getLocalNow(new Date("2026-07-14T21:00:00Z"), VILNIUS)).toEqual({
      date: "2026-07-15",
      minutes: 0,
    });
  });
});

describe("safeTimeZone", () => {
  it("falls back for an unknown zone instead of throwing", () => {
    expect(safeTimeZone("Mars/Olympus")).toBe(VILNIUS);
    expect(safeTimeZone("")).toBe(VILNIUS);
    expect(safeTimeZone(null)).toBe(VILNIUS);
  });

  it("keeps a valid zone", () => {
    expect(safeTimeZone("America/New_York")).toBe("America/New_York");
  });
});

describe("parseSendTime", () => {
  it("parses valid times", () => {
    expect(parseSendTime("00:00")).toBe(0);
    expect(parseSendTime("19:00")).toBe(1140);
    expect(parseSendTime("23:59")).toBe(1439);
  });

  it("rejects malformed input", () => {
    for (const bad of ["24:00", "7:00", "19:60", "", "abc", "19-00"]) {
      expect(parseSendTime(bad)).toBeNull();
    }
  });
});

describe("isDue", () => {
  const at = (utc: string) => new Date(utc);
  const setting = (over: Partial<Parameters<typeof isDue>[0]> = {}) => ({
    sendTime: "19:00",
    timeZone: VILNIUS,
    lastRunOn: null,
    ...over,
  });

  it("fires exactly on time", () => {
    // 19:00 Vilnius in summer = 16:00Z
    expect(isDue(setting(), at("2026-07-15T16:00:00Z"))).toBe(true);
  });

  it("fires one cron tick late", () => {
    expect(isDue(setting(), at("2026-07-15T16:15:00Z"))).toBe(true);
  });

  it("does not fire before the send time", () => {
    expect(isDue(setting(), at("2026-07-15T15:45:00Z"))).toBe(false);
  });

  it("fires at the edge of the tolerance window but not past it", () => {
    const edge = at(
      `2026-07-15T${String(16 + LATE_TOLERANCE_MINUTES / 60).padStart(2, "0")}:00:00Z`,
    );
    expect(isDue(setting(), edge)).toBe(true);
    expect(isDue(setting(), new Date(edge.getTime() + 60_000))).toBe(false);
  });

  it("stays silent once the local day has already been handled", () => {
    expect(
      isDue(setting({ lastRunOn: dateOnlyUtc("2026-07-15") }), at("2026-07-15T16:00:00Z")),
    ).toBe(false);
  });

  it("fires again the next local day", () => {
    expect(
      isDue(setting({ lastRunOn: dateOnlyUtc("2026-07-15") }), at("2026-07-16T16:00:00Z")),
    ).toBe(true);
  });

  it("does not re-fire when lastRunOn is ahead of the local day", () => {
    // Happens if a user's zone moves westward after a send was recorded.
    expect(
      isDue(setting({ lastRunOn: dateOnlyUtc("2026-07-20") }), at("2026-07-15T16:00:00Z")),
    ).toBe(false);
  });

  it("skips a 23:50 reminder that was missed past midnight rather than firing at 00:05", () => {
    // 00:05 local on the 16th: yesterday's 23:50 is long gone, today's is ahead.
    expect(isDue(setting({ sendTime: "23:50" }), at("2026-07-15T21:05:00Z"))).toBe(false);
    // ...and it fires normally that evening.
    expect(isDue(setting({ sendTime: "23:50" }), at("2026-07-16T20:50:00Z"))).toBe(true);
  });

  it("still delivers a reminder set inside the DST spring-forward gap", () => {
    // 2026-03-29: Vilnius jumps 03:00 -> 04:00, so 03:30 local never exists.
    // 01:10Z is 04:10 local, 40 min "late" — inside the tolerance.
    expect(isDue(setting({ sendTime: "03:30" }), at("2026-03-29T01:10:00Z"))).toBe(true);
  });

  it("does not double-fire across the autumn duplicated hour", () => {
    // 2026-10-25: 03:00-03:59 local happens twice. lastRunOn covers the repeat.
    const during = at("2026-10-25T00:30:00Z");
    expect(isDue(setting({ sendTime: "03:30" }), during)).toBe(true);
    expect(
      isDue(setting({ sendTime: "03:30", lastRunOn: dateOnlyUtc("2026-10-25") }), during),
    ).toBe(false);
  });

  it("never fires on a malformed send time", () => {
    expect(isDue(setting({ sendTime: "nonsense" }), at("2026-07-15T16:00:00Z"))).toBe(false);
  });
});

describe("shouldStampToday", () => {
  it("stamps when the chosen time has already passed today", () => {
    // 09:00 local, reminder set for 08:00 — must not fire immediately on save.
    expect(shouldStampToday("08:00", VILNIUS, new Date("2026-07-15T06:00:00Z"))).toBe(true);
  });

  it("does not stamp when the chosen time is still ahead", () => {
    expect(shouldStampToday("19:00", VILNIUS, new Date("2026-07-15T06:00:00Z"))).toBe(false);
  });
});

describe("evaluateDue", () => {
  const at = (iso: string) => new Date(iso);

  it("reports the schedule state rather than a bare false", () => {
    // 19:00 Vilnius in summer is 16:00Z.
    const candidate = { sendTime: "19:00", timeZone: VILNIUS, lastRunOn: null };

    expect(evaluateDue(candidate, at("2026-07-15T15:30:00Z"))).toBe("beforeTime");
    expect(evaluateDue(candidate, at("2026-07-15T16:00:00Z"))).toBe("due");
    expect(evaluateDue(candidate, at("2026-07-15T19:59:00Z"))).toBe("due");
    expect(evaluateDue(candidate, at("2026-07-15T20:30:00Z"))).toBe("windowMissed");
  });

  it("separates an already-handled day from a missed window", () => {
    const handled = {
      sendTime: "19:00",
      timeZone: VILNIUS,
      lastRunOn: dateOnlyUtc("2026-07-15"),
    };
    expect(evaluateDue(handled, at("2026-07-15T16:05:00Z"))).toBe("alreadyHandled");
    // The next local day is a clean slate again.
    expect(evaluateDue(handled, at("2026-07-16T16:05:00Z"))).toBe("due");
  });

  it("names a malformed time instead of silently never firing", () => {
    expect(
      evaluateDue(
        { sendTime: "25:00", timeZone: VILNIUS, lastRunOn: null },
        at("2026-07-15T16:00:00Z"),
      ),
    ).toBe("invalidTime");
  });

  it("stays consistent with isDue", () => {
    const times = ["2026-07-15T15:00:00Z", "2026-07-15T16:00:00Z", "2026-07-15T21:00:00Z"];
    for (const iso of times) {
      const candidate = { sendTime: "19:00", timeZone: VILNIUS, lastRunOn: null };
      expect(isDue(candidate, at(iso))).toBe(evaluateDue(candidate, at(iso)) === "due");
    }
  });

  it("covers a gap the previous 120-minute window would have dropped", () => {
    // GitHub throttled the schedule: the tick after 19:00 local landed 3h late.
    const candidate = { sendTime: "19:00", timeZone: VILNIUS, lastRunOn: null };
    const threeHoursLate = at("2026-07-15T19:00:00Z"); // 22:00 local
    expect(LATE_TOLERANCE_MINUTES).toBeGreaterThanOrEqual(180);
    expect(evaluateDue(candidate, threeHoursLate)).toBe("due");
  });
});

describe("addLocalDays", () => {
  it("rolls over month and year boundaries", () => {
    expect(addLocalDays("2026-08-31", 1)).toBe("2026-09-01");
    expect(addLocalDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addLocalDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("zonedWallTimeToInstant", () => {
  it("resolves a wall time using the summer offset (UTC+3)", () => {
    expect(zonedWallTimeToInstant("2026-07-15", 19 * 60, VILNIUS).toISOString()).toBe(
      "2026-07-15T16:00:00.000Z",
    );
  });

  it("resolves a wall time using the winter offset (UTC+2)", () => {
    expect(zonedWallTimeToInstant("2026-01-15", 19 * 60, VILNIUS).toISOString()).toBe(
      "2026-01-15T17:00:00.000Z",
    );
  });

  it("round-trips through getLocalNow for both offsets", () => {
    for (const [date, minutes] of [
      ["2026-01-15", 8 * 60 + 30],
      ["2026-07-15", 21 * 60 + 45],
    ] as const) {
      const instant = zonedWallTimeToInstant(date, minutes, VILNIUS);
      expect(getLocalNow(instant, VILNIUS)).toEqual({ date, minutes });
    }
  });

  it("puts a spring-forward gap time at the first reachable instant", () => {
    // Vilnius skips 03:00–03:59 on 2026-03-29; 03:30 does not exist.
    const instant = zonedWallTimeToInstant("2026-03-29", 3 * 60 + 30, VILNIUS);
    expect(getLocalNow(instant, VILNIUS).minutes).toBeGreaterThanOrEqual(4 * 60);
  });
});

describe("nextSendAt", () => {
  it("points at today while the window is still open", () => {
    const candidate = { sendTime: "19:00", timeZone: VILNIUS, lastRunOn: null };
    // 10:00 local, long before the slot.
    expect(nextSendAt(candidate, new Date("2026-07-15T07:00:00Z"))?.toISOString()).toBe(
      "2026-07-15T16:00:00.000Z",
    );
  });

  it("rolls to tomorrow once the window has closed", () => {
    const candidate = { sendTime: "19:00", timeZone: VILNIUS, lastRunOn: null };
    // 23:30 local — past 19:00 + 4h.
    expect(nextSendAt(candidate, new Date("2026-07-15T20:30:00Z"))?.toISOString()).toBe(
      "2026-07-16T16:00:00.000Z",
    );
  });

  it("rolls to tomorrow when today is already handled", () => {
    const candidate = {
      sendTime: "19:00",
      timeZone: VILNIUS,
      lastRunOn: dateOnlyUtc("2026-07-15"),
    };
    // Still mid-afternoon, but today is spoken for.
    expect(nextSendAt(candidate, new Date("2026-07-15T12:00:00Z"))?.toISOString()).toBe(
      "2026-07-16T16:00:00.000Z",
    );
  });

  it("keeps the chosen wall-clock time across a DST change", () => {
    const candidate = { sendTime: "19:00", timeZone: VILNIUS, lastRunOn: null };
    // 23:30 local on the 24th (UTC+3, window closed) rolls to the 25th — the
    // autumn fall-back day, which runs at UTC+2 by 19:00. Adding a flat 24h to
    // the previous slot would land an hour early.
    const next = nextSendAt(candidate, new Date("2026-10-24T20:30:00Z"));
    expect(next?.toISOString()).toBe("2026-10-25T17:00:00.000Z");
    expect(getLocalNow(next!, VILNIUS).minutes).toBe(19 * 60);
  });

  it("returns null for a time it cannot parse", () => {
    expect(
      nextSendAt({ sendTime: "oops", timeZone: VILNIUS, lastRunOn: null }, new Date()),
    ).toBeNull();
  });
});
