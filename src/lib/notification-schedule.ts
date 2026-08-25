// Pure scheduling logic for the daily reminder — deliberately free of any
// import (no Prisma, no Next), so it stays unit-testable without a database and
// so the cron and the save path can share exactly the same rules.

export const DEFAULT_TIME_ZONE = "Europe/Vilnius";

/** Sensible default: at 08:00 nobody has collected eggs yet, so a morning
 *  reminder would fire unconditionally every day and stop being a signal. */
export const DEFAULT_SEND_TIME = "19:00";

/**
 * How late a reminder may still be delivered, in minutes.
 *
 * Must comfortably exceed (cron interval + worst-case scheduler drift). The
 * workflow asks for every 15 min, but that is a request, not a promise: GitHub
 * throttles scheduled workflows under load, and the observed gaps on this repo
 * run 30–100 min, which left almost no headroom against the original 120. Four
 * hours keeps a missed tick from silently costing the whole day.
 *
 * It also covers the DST spring-forward gap: on the last Sunday of March,
 * Europe/Vilnius skips 03:00–03:59 entirely, and a reminder set inside that
 * hour only becomes reachable on a later tick.
 *
 * The window still never crosses local midnight — past midnight the local day
 * has rolled over, `late` goes negative, and the reminder waits for tomorrow
 * rather than arriving stamped with the wrong day.
 */
export const LATE_TOLERANCE_MINUTES = 240;

export const SEND_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export type LocalNow = {
  /** Local calendar day as "YYYY-MM-DD". */
  date: string;
  /** Minutes since local midnight. */
  minutes: number;
};

/** Falls back to the default when a stored zone is unknown, so one bad row can
 *  never break the whole reminder batch. */
export function safeTimeZone(timeZone: string | null | undefined): string {
  if (!timeZone) return DEFAULT_TIME_ZONE;
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone });
    return timeZone;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

/** "HH:mm" → minutes since midnight, or null when malformed. */
export function parseSendTime(sendTime: string): number | null {
  if (!SEND_TIME_PATTERN.test(sendTime)) return null;
  const [hour, minute] = sendTime.split(":").map(Number);
  return hour * 60 + minute;
}

export function formatSendTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * The wall-clock date and time in the given IANA zone. Uses Intl rather than a
 * library because it is DST-correct for free and adds no dependency (date-fns
 * needs a separate @date-fns/tz package for zones).
 */
export function getLocalNow(now: Date, timeZone: string): LocalNow {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: safeTimeZone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .formatToParts(now)
    .reduce<Record<string, string>>((acc, part) => {
      acc[part.type] = part.value;
      return acc;
    }, {});

  // Some ICU builds render midnight as "24" under an h23-style request; the
  // modulo makes that harmless either way.
  const hour = Number(parts.hour) % 24;

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: hour * 60 + Number(parts.minute),
  };
}

/** A "YYYY-MM-DD" local day as the UTC-midnight Date that Prisma stores for
 *  `@db.Date` columns. */
export function dateOnlyUtc(localDate: string): Date {
  return new Date(`${localDate}T00:00:00.000Z`);
}

/** Why a candidate is, or is not, ready to be acted on right now. */
export type DueReason =
  | "due"
  /** sendTime is not a valid "HH:mm" — the row predates validation, or was written directly. */
  | "invalidTime"
  /** This local day was already sent or deliberately skipped. */
  | "alreadyHandled"
  /** The chosen time has not arrived yet today. */
  | "beforeTime"
  /** The chosen time passed more than LATE_TOLERANCE_MINUTES ago. */
  | "windowMissed";

export type DueCandidate = {
  sendTime: string;
  timeZone: string;
  /** Local day this setting was last acted on — sent OR deliberately skipped. */
  lastRunOn: Date | null;
};

/**
 * Whether a reminder should be acted on right now.
 *
 * The window is bounded on both sides on purpose. An unbounded "now is past the
 * send time" rule delivers a 08:00 reminder at 14:00 after an outage, and — worse
 * — is inconsistent across midnight: a 21:00 reminder still unsent at 01:00 would
 * compare against the *new* day and never fire at all. Requiring 0 <= late <=
 * tolerance makes both cases behave the same way: skip today, fire normally
 * tomorrow.
 *
 * Returns the reason rather than a boolean so both the cron log and the
 * settings screen can say *why* nothing happened. "Nothing was due" was
 * previously indistinguishable from a broken schedule from the outside.
 */
export function evaluateDue(candidate: DueCandidate, now: Date): DueReason {
  const scheduled = parseSendTime(candidate.sendTime);
  if (scheduled == null) return "invalidTime";

  const localNow = getLocalNow(now, candidate.timeZone);
  if (candidate.lastRunOn && toLocalDateString(candidate.lastRunOn) >= localNow.date) {
    return "alreadyHandled";
  }

  const late = localNow.minutes - scheduled;
  if (late < 0) return "beforeTime";
  if (late > LATE_TOLERANCE_MINUTES) return "windowMissed";
  return "due";
}

export function isDue(candidate: DueCandidate, now: Date): boolean {
  return evaluateDue(candidate, now) === "due";
}

/** Reads back a `@db.Date` value as its "YYYY-MM-DD" local day. Those columns
 *  round-trip at exactly UTC midnight, so UTC getters are the correct ones. */
export function toLocalDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Whether saving a setting should immediately mark today as handled.
 *
 * Without this, enabling a reminder at 09:00 with a send time of 08:00 fires an
 * email the moment the user presses save — right while they are looking at the
 * settings screen. Stamping the day instead starts the schedule tomorrow.
 */
export function shouldStampToday(sendTime: string, timeZone: string, now: Date): boolean {
  const scheduled = parseSendTime(sendTime);
  if (scheduled == null) return false;
  return getLocalNow(now, timeZone).minutes >= scheduled;
}

/** Adds whole days to a "YYYY-MM-DD" local day. Pure calendar arithmetic — it
 *  never touches a zone, so it is safe across a DST boundary. */
export function addLocalDays(localDate: string, days: number): string {
  const [year, month, day] = localDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/**
 * The zone's UTC offset, in minutes, at a given instant.
 *
 * Derived by formatting the instant in the zone and diffing the result against
 * the instant itself — the standard way to get an offset out of Intl, which
 * exposes no offset API. The instant is floored to whole seconds first because
 * the formatted parts carry no milliseconds.
 */
function zoneOffsetMinutes(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: safeTimeZone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  })
    .formatToParts(instant)
    .reduce<Record<string, string>>((acc, part) => {
      acc[part.type] = part.value;
      return acc;
    }, {});

  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  );
  return Math.round((asUtc - Math.floor(instant.getTime() / 1000) * 1000) / 60_000);
}

/**
 * A local wall-clock time in a zone → the UTC instant it refers to.
 *
 * Two passes: the offset itself depends on the instant we are trying to find,
 * so the first guess uses the offset at the naive time and the second corrects
 * it. That converges everywhere except inside a DST transition, where one pass
 * is already exact on one side of the jump.
 *
 * A wall time skipped by spring-forward does not exist; it resolves to the
 * instant just after the jump, which is the first moment the reminder could
 * actually be delivered.
 */
export function zonedWallTimeToInstant(
  localDate: string,
  minutesFromMidnight: number,
  timeZone: string,
): Date {
  const [year, month, day] = localDate.split("-").map(Number);
  // Date.UTC normalises minutes > 59 on its own, so no hour/minute split needed.
  const naive = Date.UTC(year, month - 1, day, 0, minutesFromMidnight);
  const firstGuess = naive - zoneOffsetMinutes(new Date(naive), timeZone) * 60_000;
  return new Date(naive - zoneOffsetMinutes(new Date(firstGuess), timeZone) * 60_000);
}

/**
 * The instant the next reminder is expected, or null when the time is unusable.
 *
 * Today still counts while its delivery window is open; once the window has
 * closed — or the day is already spoken for — the answer is tomorrow at the
 * same wall-clock time. Recomputed per day rather than by adding 24 h, so a DST
 * change keeps the reminder at the time the user actually chose.
 */
export function nextSendAt(candidate: DueCandidate, now: Date): Date | null {
  const scheduled = parseSendTime(candidate.sendTime);
  if (scheduled == null) return null;

  const zone = safeTimeZone(candidate.timeZone);
  const localNow = getLocalNow(now, zone);
  const handledToday =
    candidate.lastRunOn != null && toLocalDateString(candidate.lastRunOn) >= localNow.date;
  const todayStillOpen = !handledToday && localNow.minutes <= scheduled + LATE_TOLERANCE_MINUTES;

  const day = todayStillOpen ? localNow.date : addLocalDays(localNow.date, 1);
  return zonedWallTimeToInstant(day, scheduled, zone);
}
