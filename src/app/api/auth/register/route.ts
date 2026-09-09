import { NextResponse } from "next/server";
import { registerSchema } from "@/lib/validation/auth";
import { registerUser } from "@/lib/services/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

// 8 registrations per 15 min per IP — generous for real signups, tight
// enough to blunt scripted bulk account creation.
const REGISTER_LIMIT = { limit: 8, windowMs: 15 * 60 * 1000 };

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rate = checkRateLimit(`register:${ip}`, REGISTER_LIMIT);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Per daug bandymų registruotis. Pabandykite vėliau." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const body = await req.json();
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Neteisingi duomenys" },
      { status: 400 },
    );
  }

  try {
    const user = await registerUser(parsed.data);
    return NextResponse.json({ id: user.id, email: user.email });
  } catch (err) {
    if (err instanceof Error && err.message === "EMAIL_TAKEN") {
      return NextResponse.json({ error: "Šis el. paštas jau užregistruotas" }, { status: 409 });
    }
    throw err;
  }
}
