import { NextResponse } from "next/server";
import {
  requestPasswordResetSchema,
  confirmPasswordResetSchema,
} from "@/lib/validation/auth";
import { requestPasswordReset, confirmPasswordReset } from "@/lib/services/auth";

// POST { email } -> request a reset link
export async function POST(req: Request) {
  const body = await req.json();
  const parsed = requestPasswordResetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Neteisingi duomenys" }, { status: 400 });
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
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Neteisingi duomenys" }, { status: 400 });
  }

  try {
    await confirmPasswordReset(parsed.data.token, parsed.data.password);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Error && err.message === "INVALID_TOKEN") {
      return NextResponse.json({ error: "Nuoroda negalioja arba pasibaigė jos galiojimas" }, { status: 400 });
    }
    throw err;
  }
}
