import { NextResponse } from "next/server";
import { requireUserApi } from "@/lib/session";
import { handleApiError } from "@/lib/api-utils";
import { pushPublicKey, reminderPayload, sendPushToUser } from "@/lib/push";

// Sends a notification to the caller's own devices right away. Without this the
// only way to check push works is to wait for a cron tick on a day with no data
// entered — far too slow a feedback loop for a permission-gated feature.
export async function POST() {
  try {
    const user = await requireUserApi();

    if (!pushPublicKey()) {
      return NextResponse.json({ error: "Pranešimai telefone nesukonfigūruoti" }, { status: 503 });
    }

    const result = await sendPushToUser(
      user.id,
      reminderPayload("Bandomasis pranešimas — viskas veikia."),
    );

    if (result.sent === 0) {
      return NextResponse.json(
        {
          error:
            result.removed > 0
              ? "Įrenginio prenumerata nebegalioja. Išjunkite ir vėl įjunkite pranešimus."
              : "Nerasta nė vieno įrenginio. Įjunkite pranešimus telefone.",
        },
        { status: 400 },
      );
    }

    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err);
  }
}
