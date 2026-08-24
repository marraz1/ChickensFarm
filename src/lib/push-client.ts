"use client";

import { classifyPushSupport, urlBase64ToUint8Array, type PushSupport } from "@/lib/push-utils";

/** True when the page is running as an installed app rather than a browser tab. */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone;
  return window.matchMedia("(display-mode: standalone)").matches || iosStandalone === true;
}

export function probePushSupport(): PushSupport {
  if (typeof window === "undefined") return "unsupported";
  return classifyPushSupport({
    hasServiceWorker: "serviceWorker" in navigator,
    hasPushManager: "PushManager" in window,
    hasNotification: typeof Notification !== "undefined",
    userAgent: navigator.userAgent,
    maxTouchPoints: typeof navigator.maxTouchPoints === "number" ? navigator.maxTouchPoints : 0,
    standalone: isStandalone(),
  });
}

export class PushSetupError extends Error {}

/**
 * Registers the worker, asks for permission and stores the subscription.
 *
 * Must be called from a user gesture — browsers reject a permission prompt that
 * is not tied to one.
 */
/** Does this subscription's stored key still match the one the server uses? */
function keyMatches(subscription: PushSubscription, expected: Uint8Array): boolean {
  const current = subscription.options?.applicationServerKey;
  if (!current) return false;
  const bytes = new Uint8Array(current as ArrayBuffer);
  return bytes.length === expected.length && bytes.every((b, i) => b === expected[i]);
}

export async function enablePush(vapidPublicKey: string): Promise<void> {
  const support = probePushSupport();
  if (support === "ios-needs-install") {
    throw new PushSetupError(
      "„iPhone“ ir „iPad“ pranešimai veikia tik įsidiegus programėlę. Safari naršyklėje spauskite dalinimosi mygtuką → „Į pradžios ekraną“, tada atidarykite ChickensFarm iš pradžios ekrano.",
    );
  }
  if (support === "unsupported") {
    throw new PushSetupError("Ši naršyklė nepalaiko pranešimų.");
  }
  if (Notification.permission === "denied") {
    throw new PushSetupError(
      "Pranešimai užblokuoti. Iš naujo įjungti galima tik įrenginio arba naršyklės nustatymuose.",
    );
  }

  // Called before any await so the click's transient activation is still live —
  // Safari rejects a permission prompt that has lost it.
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new PushSetupError("Be leidimo pranešimų siųsti negalime.");
  }

  const registration = await navigator.serviceWorker.register("/sw.js", {
    scope: "/",
    // Check for a newer worker without going through the HTTP cache.
    updateViaCache: "none",
  });
  await navigator.serviceWorker.ready;

  const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
  let subscription = await registration.pushManager.getSubscription();

  // If the server's VAPID key was rotated since this device subscribed, the old
  // subscription is dead and `subscribe()` would throw InvalidStateError rather
  // than replace it — leaving the device permanently unable to re-register.
  if (subscription && !keyMatches(subscription, applicationServerKey)) {
    await subscription.unsubscribe().catch(() => {});
    subscription = null;
  }

  subscription ??= await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: applicationServerKey as BufferSource,
  });

  const json = subscription.toJSON();
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
  });

  if (!res.ok) {
    // Roll the browser subscription back. Leaving it would make
    // getSubscription() report this device as subscribed on the next visit while
    // the server has no row for it — a UI that is permanently lying.
    await subscription.unsubscribe().catch(() => {});
    const body = await res.json().catch(() => null);
    throw new PushSetupError(body?.error ?? "Nepavyko įregistruoti įrenginio.");
  }
}

/** Removes this device's subscription, both locally and on the server. */
export async function disablePush(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;

  const { endpoint } = subscription;
  await subscription.unsubscribe().catch(() => {});
  await fetch("/api/push/subscribe", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint }),
  }).catch(() => {});
}
