import { Resend } from "resend";
import { escapeHtml, escapeHtmlWithBreaks } from "@/lib/html";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

/**
 * Absolute base URL of the deployment, for links inside emails.
 *
 * Never derived from an incoming request: a reminder is sent from a cron job
 * whose Host header is whatever the scheduler happened to call, which would put
 * an attacker-influenceable URL into an email. Returns null when unconfigured,
 * and callers then send the message without a link rather than a broken one.
 */
export function appUrl(): string | null {
  const explicit = process.env.APP_URL?.trim().replace(/\/+$/, "");
  if (explicit) return explicit;
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return vercel ? `https://${vercel}` : null;
}

/**
 * Sends one email, or logs it when RESEND_API_KEY is unset (development).
 *
 * Throws when Resend reports a failure — the SDK resolves with `{ data, error }`
 * rather than rejecting, so an unchecked call fails silently. Callers decide
 * whether that should surface: see sendPasswordResetEmail.
 */
export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY not set — skipping send to ${to}: ${subject}\n${html}`);
    return;
  }

  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM ?? "ChickensFarm <onboarding@resend.dev>",
    to,
    subject,
    html,
  });

  if (error) {
    throw new Error(`Resend failed: ${error.message ?? "unknown error"}`);
  }
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  const href = escapeHtml(resetUrl);
  try {
    await sendEmail({
      to,
      subject: "Slaptažodžio atkūrimas",
      html: `<p>Gavome prašymą atkurti jūsų slaptažodį.</p><p><a href="${href}">Spauskite čia, kad nustatytumėte naują slaptažodį</a></p><p>Nuoroda galioja 1 valandą. Jei šio prašymo nesiuntėte, ignoruokite šį laišką.</p>`,
    });
  } catch (err) {
    // Deliberately swallowed. POST /api/auth/password-reset always answers
    // `{ ok: true }` so it never reveals whether an account exists; letting a
    // send failure escape would turn a 500 into exactly that signal.
    console.error("[email] password reset send failed", err);
  }
}

export async function sendReminderEmail(to: string, message: string) {
  const base = appUrl();
  const link = base
    ? `<p><a href="${escapeHtml(`${base}/eggs/collections/new`)}">Įvesti duomenis</a></p>`
    : "";
  const settingsLine = base
    ? `<p style="color:#666;font-size:12px">Priminimus galite išjungti <a href="${escapeHtml(`${base}/profile/notifications`)}">programėlės profilyje</a>.</p>`
    : `<p style="color:#666;font-size:12px">Priminimus galite išjungti programėlės profilyje.</p>`;

  // Lets a Resend failure propagate: the reminder batch logs it per user.
  await sendEmail({
    to,
    subject: "ChickensFarm priminimas",
    html: `<p>${escapeHtmlWithBreaks(message)}</p>${link}${settingsLine}`,
  });
}
