import Link from "next/link";
import { requireActiveFarm } from "@/lib/session";
import { getEarliestFinanceYear, getProfitLossReport } from "@/lib/services/reports";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { expenseCategoryLabels } from "@/lib/labels";
import {
  formatDateLT,
  formatEUR,
  formatMonthLT,
  formatMonthYearLT,
  formatPercent,
  ltMonthNames,
} from "@/lib/format";

type SearchParam = string | string[] | undefined;

/** Repeated query keys arrive as arrays in Next 16 — keep the first value. */
function first(value: SearchParam): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseIntOrNull(value: SearchParam): number | null {
  const raw = first(value);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isInteger(parsed) ? parsed : null;
}

/** Strict "YYYY-MM-DD" → UTC midnight. Rejects near-misses and rolled-over dates. */
function parseUtcDateInput(value: SearchParam): Date | null {
  const raw = first(value);
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const [year, month, day] = raw.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  // Guards against 2026-02-31 silently becoming March 3rd.
  return parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day ? parsed : null;
}

export default async function ProfitLossPage({
  searchParams,
}: {
  searchParams: Promise<{
    year?: SearchParam;
    month?: SearchParam;
    from?: SearchParam;
    to?: SearchParam;
  }>;
}) {
  const params = await searchParams;
  const { farm } = await requireActiveFarm();

  const currentYear = new Date().getUTCFullYear();
  const earliestYear = await getEarliestFinanceYear(farm.id);
  const years: number[] = [];
  for (let year = currentYear; year >= Math.min(earliestYear, currentYear); year--) {
    years.push(year);
  }

  const parsedYear = parseIntOrNull(params.year);
  const selectedYear = parsedYear != null && years.includes(parsedYear) ? parsedYear : currentYear;

  // `month` is 1-based in the URL so hand-typed links read naturally; 0-based everywhere else.
  const parsedMonth = parseIntOrNull(params.month);
  const selectedMonth =
    parsedMonth != null && parsedMonth >= 1 && parsedMonth <= 12 ? parsedMonth - 1 : null;

  // The date range and the year/month picker live in two separate GET forms. A
  // native GET form replaces the whole query string, so submitting one always
  // clears the other's params — the modes can never be set at once through the
  // UI. This precedence only decides hand-edited or bookmarked URLs.
  const customFrom = parseUtcDateInput(params.from);
  const customTo = parseUtcDateInput(params.to);
  const isCustomRange = customFrom != null || customTo != null;

  let range: { from: Date; to: Date };
  let periodLabel: string;

  if (isCustomRange) {
    const from = customFrom ?? new Date(Date.UTC(earliestYear, 0, 1));
    const to = customTo ?? new Date(Date.UTC(currentYear, 11, 31));
    // Tolerate a reversed range instead of returning a confusing empty report.
    range = from <= to ? { from, to } : { from: to, to: from };
    periodLabel = `${formatDateLT(range.from)} – ${formatDateLT(range.to)}`;
  } else if (selectedMonth != null) {
    // Day 0 of the next month is the last day of this one. `@db.Date` values are
    // exactly UTC midnight, so an `lte` on it includes that whole last day.
    range = {
      from: new Date(Date.UTC(selectedYear, selectedMonth, 1)),
      to: new Date(Date.UTC(selectedYear, selectedMonth + 1, 0)),
    };
    periodLabel = formatMonthYearLT(selectedYear, selectedMonth);
  } else {
    range = {
      from: new Date(Date.UTC(selectedYear, 0, 1)),
      to: new Date(Date.UTC(selectedYear, 11, 31)),
    };
    periodLabel = `${selectedYear} m.`;
  }

  const report = await getProfitLossReport(farm.id, range);
  const hasRecords = report.income > 0 || report.expenses > 0;
  const isDefaultView = !isCustomRange && selectedMonth == null && selectedYear === currentYear;
  const spansMultipleYears = new Set(report.monthly.map((month) => month.year)).size > 1;

  // Bought birds are an expense without an ExpenseCategory, so they join the
  // breakdown as their own row — otherwise the rows would not add up to the
  // expense total they are shown as percentages of.
  const categories = [
    ...(Object.entries(expenseCategoryLabels) as [string, string][]).map(([key, label]) => ({
      key,
      label,
      amount: report.expensesByCategory[key as keyof typeof report.expensesByCategory],
    })),
    { key: "BIRD_PURCHASES", label: "Paukščių pirkimai", amount: report.birdPurchaseCost },
  ]
    .filter((row) => row.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const maxCategoryAmount = categories[0]?.amount ?? 0;

  const controlClass = "h-11 rounded-lg border px-3 text-sm";

  return (
    <div>
      <PageHeader title="Pelnas / Nuostoliai" backHref="/finance" />

      <div className="flex flex-col gap-2 px-4 pb-3">
        <form className="flex gap-2" method="get">
          <select
            name="year"
            defaultValue={String(selectedYear)}
            aria-label="Metai"
            className={`${controlClass} flex-1 bg-transparent`}
          >
            {years.map((year) => (
              <option key={year} value={year}>
                {year} m.
              </option>
            ))}
          </select>
          <select
            name="month"
            defaultValue={selectedMonth == null ? "" : String(selectedMonth + 1)}
            aria-label="Mėnuo"
            className={`${controlClass} flex-1 bg-transparent`}
          >
            <option value="">Visi mėnesiai</option>
            {ltMonthNames.map((name, index) => (
              <option key={name} value={index + 1}>
                {name}
              </option>
            ))}
          </select>
          <button type="submit" className={`${controlClass} font-medium`}>
            Rodyti
          </button>
        </form>

        <form className="flex gap-2" method="get">
          <input
            type="date"
            name="from"
            defaultValue={isCustomRange ? range.from.toISOString().slice(0, 10) : ""}
            aria-label="Nuo"
            className={`${controlClass} flex-1`}
          />
          <input
            type="date"
            name="to"
            defaultValue={isCustomRange ? range.to.toISOString().slice(0, 10) : ""}
            aria-label="Iki"
            className={`${controlClass} flex-1`}
          />
          <button type="submit" className={`${controlClass} font-medium`}>
            Filtruoti
          </button>
        </form>

        <p className="text-xs text-muted-foreground">
          Rodoma: {periodLabel}
          {!isDefaultView && (
            <>
              {" · "}
              <Link href="/finance/profit-loss" className="underline">
                Atstatyti
              </Link>
            </>
          )}
        </p>
      </div>

      <div className="flex flex-col gap-3 px-4">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">
            {report.profit >= 0 ? "Pelnas" : "Nuostolis"}
          </p>
          <p
            className={`text-3xl font-semibold ${
              report.profit >= 0 ? "text-emerald-600" : "text-destructive"
            }`}
          >
            {formatEUR(report.profit)}
          </p>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Pajamos</p>
            <p className="text-xl font-semibold text-emerald-600">{formatEUR(report.income)}</p>
            <p className="mt-1 text-[11px] leading-tight text-muted-foreground">
              Parduota {report.eggsSold} kiaušinių
            </p>
            {report.birdsSold > 0 && (
              <p className="text-[11px] leading-tight text-muted-foreground">
                Parduota {report.birdsSold} paukščių · {formatEUR(report.birdSalesIncome)}
              </p>
            )}
          </Card>
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Išlaidos</p>
            <p className="text-xl font-semibold">{formatEUR(report.expenses)}</p>
            <p className="mt-1 text-[11px] leading-tight text-muted-foreground">
              Visos laikotarpio išlaidos
            </p>
            {report.birdsBought > 0 && (
              <p className="text-[11px] leading-tight text-muted-foreground">
                Pirkta {report.birdsBought} paukščių · {formatEUR(report.birdPurchaseCost)}
              </p>
            )}
          </Card>
        </div>

        {!hasRecords && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Pasirinktu laikotarpiu finansinių įrašų nėra.
          </p>
        )}

        {report.expenses > 0 && (
          <Card className="p-4">
            <p className="mb-3 text-sm text-muted-foreground">Išlaidos pagal kategoriją</p>
            <div className="flex flex-col gap-3">
              {categories.map(({ key, label, amount }) => (
                <div key={key}>
                  <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                    <span>{label}</span>
                    <span className="font-medium">
                      {formatEUR(amount)}
                      <span className="ml-1 text-xs text-muted-foreground">
                        {formatPercent(amount / report.expenses)}
                      </span>
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-foreground/70"
                      style={{
                        width: `${maxCategoryAmount > 0 ? (amount / maxCategoryAmount) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {report.monthly.length > 1 && (
          <Card className="p-4">
            <p className="mb-1 text-sm text-muted-foreground">Pagal mėnesius</p>
            <div className="flex flex-col">
              {report.monthly.map((month) => (
                <Link
                  key={`${month.year}-${month.month}`}
                  href={`/finance/profit-loss?year=${month.year}&month=${month.month + 1}`}
                  className="flex items-baseline justify-between gap-2 border-t py-2.5"
                >
                  <div>
                    <p className="text-sm">
                      {spansMultipleYears
                        ? formatMonthYearLT(month.year, month.month)
                        : formatMonthLT(month.month)}
                    </p>
                    <p className="text-[11px] leading-tight text-muted-foreground">
                      Pajamos {formatEUR(month.income)} · Išlaidos {formatEUR(month.expenses)}
                    </p>
                  </div>
                  <span
                    className={`text-sm font-medium ${
                      month.profit >= 0 ? "text-emerald-600" : "text-destructive"
                    }`}
                  >
                    {formatEUR(month.profit)}
                  </span>
                </Link>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
