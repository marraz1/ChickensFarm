import { NextResponse } from "next/server";
import { registerSchema } from "@/lib/validation/auth";
import { registerUser } from "@/lib/services/auth";

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Neteisingi duomenys" }, { status: 400 });
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
