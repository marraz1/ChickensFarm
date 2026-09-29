import { NextResponse } from "next/server";
import { requireUserApi, resolveActiveFarm } from "@/lib/session";
import { handleApiError } from "@/lib/api-utils";
import { checkRateLimit } from "@/lib/rate-limit";
import { feedbackSchema } from "@/lib/validation/feedback";
import { createFeedback } from "@/lib/services/feedback";

// Per user rather than per IP: the route is authenticated, and a household
// behind one NAT should not share a bucket. Generous for a real person, tight
// enough that a stuck client or script cannot flood the table.
const FEEDBACK_LIMIT = { limit: 5, windowMs: 60 * 60 * 1000 };

export async function POST(req: Request) {
  try {
    const user = await requireUserApi();

    const rate = checkRateLimit(`feedback:${user.id}`, FEEDBACK_LIMIT);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Per daug atsiliepimų per trumpą laiką. Pabandykite vėliau." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = feedbackSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Neteisingi duomenys" },
        { status: 400 },
      );
    }

    // Context only, and optional: a user with no farm yet can still write in.
    const { activeFarm } = await resolveActiveFarm(user.id);
    const created = await createFeedback(user.id, activeFarm?.id ?? null, parsed.data);
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
