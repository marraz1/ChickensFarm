import { isBeta } from "@/lib/app-stage";

/**
 * Shown on every page of the V2 beta (#181): beta data is reloaded from V1 by
 * each data copy (#180), so anything entered here can disappear. Not
 * dismissible on purpose — the warning has to stay true while it applies.
 */
export function BetaBanner() {
  if (!isBeta()) return null;
  return (
    <div
      role="note"
      className="bg-amber-100 px-4 py-1.5 text-center text-xs font-medium text-amber-900"
    >
      Beta: duomenys gali būti perrašyti
    </div>
  );
}
