// Pure scheduling logic for the daily reminder — deliberately free of any
// import (no Prisma, no Next), so it stays unit-testable without a database and
// so the cron and the save path can share exactly the same rules.

export const DEFAULT_TIME_ZONE = "Europe/Vilnius";

/** Sensible default: at 08:00 nobody has collected eggs yet, so a morning
 *  reminder would fire unconditionally every day and stop being a signal. */
export const DEFAULT_SEND_TIME = "19:00";

/**
 * A reminder stays deliverable for the rest of its own local day.
 *
 * There used to be a fixed lateness cap (240 min) as well, on the assumption
 * that scheduler drift is bounded. It is not. The workflow asks for a tick every
 * 15 min, but that is a request, not a promise: measured over 62 h of real runs,
 * GitHub delivered 12% of the ticks it was asked for, with four blackouts of
 * 5.1 h, 9.5 h, 11.2 h and 11.3 h. A reminder whose time fell inside one of
 * those was dropped for the whole day and never sent. A reminder that arrives
 * late is worth more than one that never arrives, so the local day is now the
 * only bound.
 *
 * That bound needs no constant: it is the `late < 0` check in evaluateDue. Past
 * local midnight the day has rolled over, `late` goes negative, and the reminder
 * waits for its next occurrence instead of arriving stamped with the wrong day.
 * Exactly-once per local day comes from the `lastRunOn` compare-and-set.
 *
 * Dropping the cap also removed the DST spring-forward edge case it existed to
 * cover: on the last Sunday of March Europe/Vilnius skips 03:00–03:59, and a
 * reminder set inside that hour is simply picked up by a later tick that day.
 */

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
  | "beforeTime";

export type DueCandidate = {
  sendTime: string;
  timeZone: string;
  /** Local day this setting was last acted on — sent OR deliberately skipped. */
  lastRunOn: Date | null;
};

/**
 * Whether a reminder should be acted on right now.
 *
 * Due from the chosen time until the end of that local day. The day is the only
 * bound (see the note above): `late < 0` both defers a time that has not arrived
 * and, past midnight, keeps a still-unsent 21:00 reminder from firing against
 * the *new* day stamped with the wrong one — it waits for tonight instead.
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

  return localNow.minutes < scheduled ? "beforeTime" : "due";
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
 * Today counts until it has been sent or skipped — matching evaluateDue, whose
 * only bound is the local day. So an unsent reminder whose time has passed
 * reports today's instant, in the past: it is genuinely overdue and goes out on
 * the next tick, which is more honest than pointing at tomorrow. Once the day is
 * spoken for, the answer is tomorrow at the same wall-clock time. Recomputed per
 * day rather than by adding 24 h, so a DST change keeps the reminder at the time
 * the user actually chose.
 */
export function nextSendAt(candidate: DueCandidate, now: Date): Date | null {
  const scheduled = parseSendTime(candidate.sendTime);
  if (scheduled == null) return null;

  const zone = safeTimeZone(candidate.timeZone);
  const localNow = getLocalNow(now, zone);
  const handledToday =
    candidate.lastRunOn != null && toLocalDateString(candidate.lastRunOn) >= localNow.date;

  const day = handledToday ? addLocalDays(localNow.date, 1) : localNow.date;
  return zonedWallTimeToInstant(day, scheduled, zone);
}
