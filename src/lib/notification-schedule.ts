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
 * GitHub Actions schedule ticks every 15 min and can drift by tens of minutes,
 * so 120 leaves room. It also covers the DST spring-forward gap: on the last
 * Sunday of March, Europe/Vilnius skips 03:00–03:59 entirely, and a reminder
 * set inside that hour only becomes reachable on a later tick.
 */
export const LATE_TOLERANCE_MINUTES = 120;

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
 */
export function isDue(candidate: DueCandidate, now: Date): boolean {
  const scheduled = parseSendTime(candidate.sendTime);
  if (scheduled == null) return false;

  const localNow = getLocalNow(now, candidate.timeZone);
  if (candidate.lastRunOn && toLocalDateString(candidate.lastRunOn) >= localNow.date) {
    return false;
  }

  const late = localNow.minutes - scheduled;
  return late >= 0 && late <= LATE_TOLERANCE_MINUTES;
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
