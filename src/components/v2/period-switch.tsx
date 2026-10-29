import Link from "next/link";
import type { FinancePeriod, FinancePeriodKind } from "@/lib/finance-period";
import { toLocalDateString } from "@/lib/notification-schedule";
import { cn } from "@/lib/utils";

/**
 * "Šis mėn." · "<year> m." · "Laikotarpis" — the period switch of the V2
 * finance screens (#198 area Finansai, #201 farm overview). Plain links, so it
 * works without client JavaScript; "Laikotarpis" adds a GET form for the dates.
 * The URL shape is read back by resolveFinancePeriod.
 */
export function PeriodSwitch({ basePath, period }: { basePath: string; period: FinancePeriod }) {
  const chips: { kind: FinancePeriodKind; label: string; href: string }[] = [
    { kind: "month", label: "Šis mėn.", href: `${basePath}?period=month` },
    { kind: "year", label: `${period.year} m.`, href: basePath },
    { kind: "range", label: "Laikotarpis", href: `${basePath}?period=range` },
  ];

  return (
    <div className="flex flex-col gap-2">
      <nav aria-label="Ataskaitos laikotarpis" className="flex gap-2">
        {chips.map((chip) => {
          const isActive = chip.kind === period.kind;
          return (
            <Link
              key={chip.kind}
              href={chip.href}
              aria-current={isActive ? "true" : undefined}
              className={cn(
                "flex min-h-[44px] items-center rounded-full border px-4 text-[13px] font-medium",
                isActive
                  ? "border-foreground bg-foreground text-background"
                  : "bg-card text-muted-foreground",
              )}
            >
              {chip.label}
            </Link>
          );
        })}
      </nav>

      {period.kind === "range" && (
        <form method="get" action={basePath} className="flex gap-2">
          <input type="hidden" name="period" value="range" />
          <input
            type="date"
            name="from"
            defaultValue={toLocalDateString(period.from)}
            aria-label="Nuo"
            className="h-11 min-w-0 flex-1 rounded-lg border bg-transparent px-3 text-sm"
          />
          <input
            type="date"
            name="to"
            defaultValue={toLocalDateString(period.to)}
            aria-label="Iki"
            className="h-11 min-w-0 flex-1 rounded-lg border bg-transparent px-3 text-sm"
          />
          <button type="submit" className="h-11 rounded-lg border px-3 text-sm font-medium">
            Rodyti
          </button>
        </form>
      )}
    </div>
  );
}
