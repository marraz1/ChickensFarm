import { NextResponse } from "next/server";
import { requestPasswordResetSchema, confirmPasswordResetSchema } from "@/lib/validation/auth";
import { requestPasswordReset, confirmPasswordReset } from "@/lib/services/auth";
import { checkRateLimit, getClientIp, normalizeEmailKey } from "@/lib/rate-limit";

// 10 requests per 15 min per IP guards against a single client hammering the
// endpoint; 3 per 15 min per target email stops it being used to email-bomb
// one victim's inbox from many IPs.
const PASSWORD_RESET_IP_LIMIT = { limit: 10, windowMs: 15 * 60 * 1000 };
const PASSWORD_RESET_EMAIL_LIMIT = { limit: 3, windowMs: 15 * 60 * 1000 };

// POST { email } -> request a reset link
export async function POST(req: Request) {
  const ip = getClientIp(req);
  const ipRate = checkRateLimit(`password-reset:ip:${ip}`, PASSWORD_RESET_IP_LIMIT);
  if (!ipRate.allowed) {
    return NextResponse.json(
      { error: "Per daug bandymų. Pabandykite vėliau." },
      { status: 429, headers: { "Retry-After": String(ipRate.retryAfterSeconds) } },
    );
  }

  const body = await req.json();
  const parsed = requestPasswordResetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Neteisingi duomenys" },
      { status: 400 },
    );
  }

  const emailRate = checkRateLimit(
    `password-reset:email:${normalizeEmailKey(parsed.data.email)}`,
    PASSWORD_RESET_EMAIL_LIMIT,
  );
  if (!emailRate.allowed) {
    return NextResponse.json(
      { error: "Per daug bandymų. Pabandykite vėliau." },
      { status: 429, headers: { "Retry-After": String(emailRate.retryAfterSeconds) } },
    );
  }

  const appUrl = new URL(req.url).origin;
  await requestPasswordReset(parsed.data.email, appUrl);

  // Always return success — never reveal whether the email exists.
  return NextResponse.json({ ok: true });
}

// PATCH { token, password } -> confirm a reset
export async function PATCH(req: Request) {
  const body = await req.json();
  const parsed = confirmPasswordResetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Neteisingi duomenys" },
      { status: 400 },
    );
  }

  try {
    await confirmPasswordReset(parsed.data.token, parsed.data.password);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Error && err.message === "INVALID_TOKEN") {
      return NextResponse.json(
        { error: "Nuoroda negalioja arba pasibaigė jos galiojimas" },
        { status: 400 },
      );
    }
    throw err;
  }
}
