import { z } from "zod";

// Real push subscription endpoints only ever come from a small, known set of
// push-service hosts operated by the browser vendors. Anything else accepted
// here would let an authenticated user register an arbitrary URL — internal
// address, cloud metadata endpoint, attacker listener — that the server later
// POSTs to via webpush.sendNotification (src/lib/push.ts), on demand through
// their own /api/notifications/test call. See GitHub issue #137.
//
// Exact hosts and safe suffix matches only (hostname === host or
// hostname.endsWith("." + host)) — never a substring/includes() check, which a
// hostile domain like "evil-fcm.googleapis.com.attacker.com" would bypass.
const ALLOWED_PUSH_ENDPOINT_HOSTS = [
  "fcm.googleapis.com", // Chrome / Chromium (FCM)
  "android.googleapis.com", // Chrome / Chromium (legacy GCM)
  "updates.push.services.mozilla.com", // Firefox
  "push.apple.com", // Safari / WebKit (exact + *.push.apple.com subdomains)
  "notify.windows.com", // Edge / WNS (exact + *.notify.windows.com subdomains)
];

function isAllowedPushEndpointHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return ALLOWED_PUSH_ENDPOINT_HOSTS.some(
    (allowed) => host === allowed || host.endsWith(`.${allowed}`),
  );
}

function hasAllowedPushEndpointHost(endpoint: string): boolean {
  try {
    return isAllowedPushEndpointHost(new URL(endpoint).hostname);
  } catch {
    // Malformed URLs are already rejected by the preceding .url() check; treat
    // anything unparsable here as disallowed rather than throwing.
    return false;
  }
}

// Mirrors the browser's PushSubscription.toJSON() shape.
export const pushSubscriptionSchema = z.object({
  endpoint: z
    .string()
    .trim()
    .url("Neteisingas endpoint")
    .max(2000)
    .refine(hasAllowedPushEndpointHost, "Neleistinas push endpoint domenas"),
  keys: z.object({
    p256dh: z.string().trim().min(1).max(255),
    auth: z.string().trim().min(1).max(255),
  }),
});

export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;

export const pushUnsubscribeSchema = z.object({
  endpoint: z
    .string()
    .trim()
    .url("Neteisingas endpoint")
    .max(2000)
    .refine(hasAllowedPushEndpointHost, "Neleistinas push endpoint domenas"),
});
