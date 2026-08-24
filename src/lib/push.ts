import webpush, { WebPushError } from "web-push";
import { prisma } from "@/lib/prisma";
import { appUrl } from "@/lib/email";
import { buildPushPayload, isGoneStatus, type PushPayload } from "@/lib/push-utils";

/**
 * VAPID identifies this application to the push services. The keys are generated
 * locally (`npx web-push generate-vapid-keys`) — there is no account and no cost.
 */
export function pushPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY?.trim() || null;
}

/**
 * A contact URI so a push service can reach the sender about problems. Must be
 * `mailto:` or `https://` — `web-push` rejects anything else, and the angle
 * brackets shown in some guides (`<mailto:…>`) are exactly what it rejects.
 */
function vapidSubject(): string | null {
  const explicit = process.env.VAPID_SUBJECT?.trim();
  if (explicit) return explicit;
  // APP_URL is already required for reminder-email links, so production usually
  // needs only the two keys. No fabricated fallback: a made-up mailto would be a
  // lie to the push service rather than a default.
  const base = appUrl();
  return base?.startsWith("https://") ? base : null;
}

// Memoised per instance: setVapidDetails validates and stores globals, so
// re-running it per send is waste and re-logging the warning would drown the log.
let configured: boolean | null = null;

function configure(): boolean {
  if (configured !== null) return configured;

  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = vapidSubject();
  if (!publicKey || !privateKey || !subject) {
    console.warn("[push] VAPID not configured — push delivery disabled");
    return (configured = false);
  }

  try {
    // Throws on a malformed key or a bad subject. Caught so one typo in an env
    // var disables push instead of taking the whole reminder batch down.
    webpush.setVapidDetails(subject, publicKey, privateKey);
    return (configured = true);
  } catch (err) {
    console.error("[push] invalid VAPID configuration", err);
    return (configured = false);
  }
}

export type PushResult = { sent: number; removed: number; failed: number };

/**
 * Delivers one notification to every device the user has subscribed.
 *
 * Never throws for a single dead device: an endpoint the push service reports as
 * gone (404/410) is deleted, because a user who uninstalled the PWA would
 * otherwise keep a dead row forever and cost a request on every run. Transient
 * failures are counted and left alone.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<PushResult> {
  if (!configure()) return { sent: 0, removed: 0, failed: 0 };

  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subscriptions.length === 0) return { sent: 0, removed: 0, failed: 0 };

  const body = buildPushPayload(payload);
  let sent = 0;
  let removed = 0;
  let failed = 0;
  const gone: string[] = [];

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body,
        );
        sent += 1;
      } catch (err) {
        if (err instanceof WebPushError && isGoneStatus(err.statusCode)) {
          gone.push(sub.id);
          removed += 1;
          return;
        }
        failed += 1;
        // Host only. A push endpoint is a capability URL — anyone holding it can
        // send that device notifications, so it must never reach the logs.
        console.error("[push] send failed", { host: safeHost(sub.endpoint), err });
      }
    }),
  );

  if (gone.length > 0) {
    await prisma.pushSubscription.deleteMany({ where: { id: { in: gone } } });
  }
  if (sent > 0) {
    await prisma.pushSubscription.updateMany({
      where: { userId, id: { notIn: gone } },
      data: { lastUsedAt: new Date() },
    });
  }

  return { sent, removed, failed };
}

function safeHost(endpoint: string): string {
  try {
    return new URL(endpoint).host;
  } catch {
    return "unknown";
  }
}

/** The reminder notification, shared by the batch and the test button. */
export function reminderPayload(message: string): PushPayload {
  return {
    title: "ChickensFarm",
    body: message,
    url: "/eggs/collections/new",
  };
}
