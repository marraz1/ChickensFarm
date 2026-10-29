import Link from "next/link";
import { Card } from "@/components/ui/card";
import { formatEUR } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AreaFinance } from "@/lib/area-finance";
import type { AreaSlug } from "@/lib/v2-navigation";

/**
 * "Balansas · <year> m." on an area overview (#187–#190): the area's result
 * for the year, as its Finansai tab computes it, and a way into that tab.
 */
export function AreaBalanceCard({
  area,
  year,
  finance,
}: {
  area: AreaSlug;
  year: number;
  finance: Pick<AreaFinance, "income" | "expenses" | "result">;
}) {
  const label = `Balansas · ${year} m.`;
  return (
    <Link href={`/areas/${area}/finance`} aria-label={`${label}: ${formatEUR(finance.result)}`}>
      <Card className="gap-1 p-3" role="region" aria-label={label}>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p
          className={cn(
            "text-xl font-medium tabular-nums",
            finance.result >= 0 ? "text-emerald-600" : "text-destructive",
          )}
        >
          {formatEUR(finance.result)}
        </p>
        <p className="text-[11px] leading-tight text-muted-foreground">
          Pajamos {formatEUR(finance.income)} · Išlaidos {formatEUR(finance.expenses)}
        </p>
      </Card>
    </Link>
  );
}
