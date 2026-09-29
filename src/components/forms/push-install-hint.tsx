"use client";

import { useSyncExternalStore } from "react";
import { Share, SquarePlus, Smartphone } from "lucide-react";
import { probePushSupport } from "@/lib/push-client";
import type { PushSupport } from "@/lib/push-utils";

/**
 * Re-probe when the display mode flips (e.g. the page is reopened from the home
 * screen in the same tab on some platforms). There is nothing else to listen to:
 * installing an app on iOS always opens a fresh window.
 */
function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia("(display-mode: standalone)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** The server cannot know the device, so it renders nothing and the client fills in. */
function getServerSnapshot(): PushSupport | null {
  return null;
}

/**
 * Up-front explanation that phone notifications on iPhone/iPad only work once
 * ChickensFarm is added to the home screen (iOS 16.4+). Shown before the user
 * touches the push toggle, so they do not have to discover it via an error.
 * Renders nothing on devices where no action is needed.
 */
export function PushInstallHint() {
  const support = useSyncExternalStore(subscribe, probePushSupport, getServerSnapshot);

  if (support === "ios-needs-update") {
    return (
      <div className="flex gap-3 rounded-lg border border-border bg-muted/40 p-3 text-sm">
        <Smartphone className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        <p>
          Pranešimai telefone „iPhone“ ir „iPad“ veikia nuo iOS 16.4. Atnaujinkite įrenginio
          programinę įrangą (Nustatymai → Bendra → Programinės įrangos naujinimas).
        </p>
      </div>
    );
  }

  if (support !== "ios-needs-install") return null;

  return (
    <div
      role="note"
      aria-labelledby="push-install-hint-title"
      className="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm"
    >
      <div className="flex items-center gap-2">
        <Smartphone className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <p id="push-install-hint-title" className="font-medium">
          Įsidiekite programėlę, kad gautumėte pranešimus telefone
        </p>
      </div>
      <p className="text-muted-foreground">
        „iPhone“ ir „iPad“ pranešimai veikia tik tada, kai ChickensFarm atidaroma iš pradžios
        ekrano, o ne Safari naršyklėje (reikia iOS 16.4 ar naujesnės).
      </p>
      <ol className="flex list-decimal flex-col gap-1 pl-5">
        <li>
          Safari naršyklėje spauskite dalinimosi mygtuką{" "}
          <Share className="inline size-4 align-text-bottom" aria-label="Dalintis" />.
        </li>
        <li>
          Pasirinkite „Į pradžios ekraną“{" "}
          <SquarePlus className="inline size-4 align-text-bottom" aria-hidden />.
        </li>
        <li>Atidarykite ChickensFarm iš pradžios ekrano ir prisijunkite.</li>
        <li>Grįžkite čia ir įjunkite „Telefone“.</li>
      </ol>
    </div>
  );
}
