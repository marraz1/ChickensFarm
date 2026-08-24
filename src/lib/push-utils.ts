// Pure helpers for web push, deliberately free of any import so they can be
// unit-tested without a database, a browser, or the web-push client — the same
// arrangement as notification-schedule.ts.

/**
 * A VAPID public key travels as base64url; `applicationServerKey` wants raw
 * bytes. A valid key decodes to 65 bytes starting with 0x04 (an uncompressed
 * P-256 point).
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

/**
 * Whether a push service response means the subscription is permanently gone
 * and its row should be deleted.
 *
 * 404/410 are the two the spec defines for an expired or unknown endpoint.
 * Everything else — 429 rate limiting, 5xx outages, network errors — is
 * transient and must NOT delete a working device.
 */
export function isGoneStatus(statusCode: number | undefined): boolean {
  return statusCode === 404 || statusCode === 410;
}

export type PushSupport = "supported" | "ios-needs-install" | "unsupported";

/**
 * Pure so the fiddly part — telling "iOS that just needs installing" apart from
 * "genuinely unsupported" — can be tested without a browser. The caller probes
 * `navigator` and passes the results in.
 *
 * iOS exposes Notification and PushManager *only* inside a home-screen app
 * (16.4+), so feature detection alone cannot distinguish the two, and telling an
 * iPhone user "unsupported" when they simply have not installed the app yet is
 * the single most confusing thing this feature could do.
 */
export function classifyPushSupport(env: {
  hasServiceWorker: boolean;
  hasPushManager: boolean;
  hasNotification: boolean;
  userAgent: string;
  maxTouchPoints: number;
  standalone: boolean;
}): PushSupport {
  if (env.hasServiceWorker && env.hasPushManager && env.hasNotification) return "supported";

  // iPadOS 13+ reports itself as "Macintosh"; the touch-point count is what
  // separates an iPad from a real Mac, and a Mac in Safari 16+ supports push.
  const isIos =
    /iPad|iPhone|iPod/.test(env.userAgent) ||
    (/Macintosh/.test(env.userAgent) && env.maxTouchPoints > 1);

  if (isIos && !env.standalone) return "ios-needs-install";
  return "unsupported";
}

export type ChannelAttempt = "not-attempted" | "delivered" | "failed";
export type DeliveryOutcome = "sent" | "failed" | "skipped";

/**
 * Collapses the two channels into the batch's single verdict.
 *
 * The distinction that matters: a user with push on but no registered devices
 * (they uninstalled the app) attempted nothing, so that is `skipped`, not
 * `failed` — counting it as a failure would make the workflow log look broken
 * every single day for a user who simply has no phone attached.
 */
export function resolveDeliveryOutcome(
  email: ChannelAttempt,
  push: ChannelAttempt,
): DeliveryOutcome {
  if (email === "delivered" || push === "delivered") return "sent";
  if (email === "failed" || push === "failed") return "failed";
  return "skipped";
}

/** Only same-origin relative paths may be opened by a notification click. */
export function safeNotificationPath(url: unknown, fallback = "/"): string {
  if (typeof url !== "string") return fallback;
  // "//evil.com" is protocol-relative and would resolve off-origin.
  if (!url.startsWith("/") || url.startsWith("//")) return fallback;
  return url;
}

export type PushPayload = {
  title: string;
  body: string;
  /** Path the notification opens, relative to the app origin. */
  url: string;
};

/** Push payloads are capped at roughly 4 KB after encryption; the reminder text
 *  is capped at 300 chars, so this only guards against a pathological case. */
export const MAX_PAYLOAD_BYTES = 3000;

export function buildPushPayload(payload: PushPayload): string {
  const json = JSON.stringify(payload);
  if (json.length <= MAX_PAYLOAD_BYTES) return json;
  const overflow = json.length - MAX_PAYLOAD_BYTES;
  return JSON.stringify({
    ...payload,
    body: `${payload.body.slice(0, Math.max(0, payload.body.length - overflow - 1))}…`,
  });
}
