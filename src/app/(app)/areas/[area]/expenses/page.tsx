import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { requireActiveFarm } from "@/lib/session";
import { getAreaExpenses } from "@/lib/services/expenses";
import { formatEUR } from "@/lib/format";
import { isAreaSlug } from "@/lib/v2-navigation";

// The area's Išlaidos tab (#194, V2-<Area>-Expenses): the year's total with a
// per-category breakdown, and every expense of the area, newest first.
// "Išlaida" opens the area expense form (#192).
export default async function AreaExpensesPage({ params }: { params: Promise<{ area: string }> }) {
  const { area } = await params;
  // The area layout already 404s an unknown slug; this narrows the type.
  if (!isAreaSlug(area)) notFound();
  const { farm } = await requireActiveFarm();
  const { year, total, breakdown, rows } = await getAreaExpenses(farm.id, area);

  return (
    <div className="flex flex-col gap-3 px-4 pb-4">
      <div className="flex justify-end">
        <Link
          href={`/expenses/new?area=${area}`}
          className="flex h-11 items-center gap-1 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground"
        >
          <Plus size={16} aria-hidden /> Išlaida
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Šioje srityje dar nėra išlaidų.
        </p>
      ) : (
        <>
          <Card className="gap-2 p-4" aria-label={`Išlaidos · ${year} m.`}>
            <p className="text-sm text-muted-foreground">Išlaidos · {year} m.</p>
            <p className="text-2xl font-semibold tabular-nums">{formatEUR(total)}</p>
            {breakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground">Šiais metais išlaidų nėra.</p>
            ) : (
              <ul className="mt-1 flex flex-col gap-1.5">
                {breakdown.map((part) => (
                  <li
                    key={part.label}
                    className="flex items-baseline justify-between gap-3 text-sm"
                  >
                    <span>{part.label}</span>
                    <span className="tabular-nums">{formatEUR(part.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <h2 className="pt-2 text-sm font-medium text-muted-foreground">Įrašai</h2>
          <ul className="flex flex-col gap-2">
            {rows.map((row) => (
              <li key={row.key}>
                <Link href={row.href}>
                  <Card className="flex min-h-11 flex-row items-center gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{row.title}</p>
                      {row.detail && (
                        <p className="truncate text-sm text-muted-foreground">{row.detail}</p>
                      )}
                    </div>
                    <span className="shrink-0 text-sm font-medium tabular-nums">
                      {formatEUR(row.amount)}
                    </span>
                    <ChevronRight
                      size={16}
                      className="shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
