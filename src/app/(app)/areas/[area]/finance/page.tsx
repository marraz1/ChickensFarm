import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { PeriodSwitch } from "@/components/v2/period-switch";
import { requireActiveFarm } from "@/lib/session";
import { getAreaFinance, getAreaUnitBase } from "@/lib/services/area-finance";
import { unitFigure } from "@/lib/unit-economics";
import { resolveFinancePeriod, type SearchParam } from "@/lib/finance-period";
import { AREA_LOSS_COPY } from "@/lib/area-losses";
import type { AreaFinance } from "@/lib/area-finance";
import {
  countNounLT,
  formatEUR,
  formatMonthLT,
  formatMonthYearLT,
  formatShareLT,
} from "@/lib/format";
import { AREA_SLUGS, isAreaSlug, type AreaSlug } from "@/lib/v2-navigation";
import { cn } from "@/lib/utils";

const NOTE = "text-[11px] leading-tight text-muted-foreground";

/** What the Pajamos card says under its amount. */
function incomeNotes(area: AreaSlug, f: AreaFinance): string[] {
  // Birds given away at 0 € are still sales; only no money and no birds is none.
  if (f.income === 0 && f.birdsSold === 0) return ["Pardavimų nebuvo"];
  if (area === "eggs") {
    return [`Kiaušiniai ${formatEUR(f.eggIncome)}`, `Paukščiai ${formatEUR(f.birdIncome)}`];
  }
  return [`Parduota ${countNounLT(f.birdsSold, AREA_LOSS_COPY[area].unit)}`];
}

/** What the Išlaidos card says: Kiaušiniai's bird purchases, else the top categories. */
function expenseNote(area: AreaSlug, f: AreaFinance): string | null {
  if (area === "eggs") return f.purchases > 0 ? `Iš jų pirkimai ${formatEUR(f.purchases)}` : null;
  const top = f.byCategory.slice(0, 3).map((c, i) => (i === 0 ? c.label : c.label.toLowerCase()));
  return top.length > 0 ? top.join(", ") : null;
}

// The area's Finansai tab (#198, V2-<Area>-Finance): the period's result,
// income and expenses, spend by category and the months. Which money counts
// where is decided in getAreaFinance; each area's per-unit figure (#199) in
// unit-economics.ts.
export default async function AreaFinancePage({
  params,
  searchParams,
}: {
  params: Promise<{ area: string }>;
  searchParams: Promise<{ period?: SearchParam; from?: SearchParam; to?: SearchParam }>;
}) {
  const [{ area }, query] = await Promise.all([params, searchParams]);
  // The area layout already 404s an unknown slug; this narrows the type.
  if (!isAreaSlug(area)) notFound();
  const { farm } = await requireActiveFarm();
  const period = resolveFinancePeriod(query);
  const [f, unitBase] = await Promise.all([
    getAreaFinance(farm.id, AREA_SLUGS[area], period),
    getAreaUnitBase(farm.id, area, period),
  ]);
  const unit = unitFigure(area, f, unitBase);

  const isProfit = f.result >= 0;
  const heading = `${isProfit ? "Pelnas" : "Nuostolis"} · ${period.label}`;
  const maxShare = f.byCategory[0]?.share ?? 0;
  const notes = [
    unit.placement === "result" && unit.text,
    area === "hens" && "Išperinti jaunikliai įskaitomi Perinimo srityje",
    f.homeUse > 0 &&
      `Namuose suvartota ${countNounLT(f.homeUse, AREA_LOSS_COPY[area].unit)} — į pajamas neįskaičiuojama`,
  ].filter((note): note is string => Boolean(note));
  // Perekšlės and Mėsa put their per-unit cost where the top categories go.
  const expNote = unit.placement === "expenses" ? unit.text : expenseNote(area, f);

  return (
    <div className="flex flex-col gap-3 px-4 pb-4">
      <PeriodSwitch basePath={`/areas/${area}/finance`} period={period} />

      <Card className="gap-1 p-4" role="region" aria-label={heading}>
        <p className="text-sm text-muted-foreground">{heading}</p>
        <p
          className={cn(
            "text-3xl font-semibold tabular-nums",
            isProfit ? "text-emerald-600" : "text-destructive",
          )}
        >
          {formatEUR(f.result)}
        </p>
        {notes.map((note) => (
          <p key={note} className="text-xs text-muted-foreground">
            {note}
          </p>
        ))}
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card className="gap-1 p-4" role="region" aria-label="Pajamos">
          <p className="text-sm text-muted-foreground">Pajamos</p>
          <p className="text-xl font-semibold tabular-nums text-emerald-600">
            {formatEUR(f.income)}
          </p>
          {incomeNotes(area, f).map((note) => (
            <p key={note} className={NOTE}>
              {note}
            </p>
          ))}
        </Card>
        <Card className="gap-1 p-4" role="region" aria-label="Išlaidos">
          <p className="text-sm text-muted-foreground">Išlaidos</p>
          <p className="text-xl font-semibold tabular-nums">{formatEUR(f.expenses)}</p>
          {expNote && <p className={NOTE}>{expNote}</p>}
        </Card>
      </div>

      {!f.hasRecords ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Šiuo laikotarpiu finansinių įrašų nėra.
        </p>
      ) : (
        <>
          {f.byCategory.length > 0 && (
            <Card className="gap-3 p-4" role="region" aria-label="Išlaidos pagal kategoriją">
              <p className="text-sm text-muted-foreground">Išlaidos pagal kategoriją</p>
              <ul className="flex flex-col gap-3">
                {f.byCategory.map((c) => (
                  <li key={c.label}>
                    <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                      <span>{c.label}</span>
                      <span className="font-medium tabular-nums">
                        {formatEUR(c.amount)}
                        <span className="ml-1.5 text-xs text-muted-foreground">
                          {formatShareLT(c.share)}
                        </span>
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-foreground/70"
                        style={{ width: `${maxShare > 0 ? (c.share / maxShare) * 100 : 0}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card className="gap-1 p-4" role="region" aria-label="Pagal mėnesius">
            <p className="text-sm text-muted-foreground">Pagal mėnesius</p>
            <ul className="flex flex-col">
              {f.months.map((m) => (
                <li
                  key={`${m.year}-${m.month}`}
                  className="flex min-h-11 items-center justify-between gap-2 border-t py-2.5"
                >
                  <div>
                    <p className="text-sm">
                      {f.spansYears ? formatMonthYearLT(m.year, m.month) : formatMonthLT(m.month)}
                    </p>
                    <p className={NOTE}>
                      Pajamos {formatEUR(m.income)} · Išlaidos {formatEUR(m.expenses)}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "text-sm font-medium tabular-nums",
                      m.result >= 0 ? "text-emerald-600" : "text-destructive",
                    )}
                  >
                    {formatEUR(m.result)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}

      {/* The farm overview, which #201 turns into the farm's finance screen. */}
      <Link
        href="/"
        className="flex min-h-11 items-center justify-center text-sm font-medium text-primary"
      >
        Visi ūkio finansai
      </Link>
    </div>
  );
}
