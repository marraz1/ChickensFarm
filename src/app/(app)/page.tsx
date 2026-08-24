import Link from "next/link";
import { requireActiveFarm } from "@/lib/session";
import { getDashboardData } from "@/lib/services/dashboard";
import { Card } from "@/components/ui/card";
import { formatEUR, formatMonthLT, formatRelativeLT } from "@/lib/format";
import { birdTypeLabels } from "@/lib/labels";
import { Egg, AlertTriangle, Heart } from "lucide-react";

const ACTIVITY_ICONS = {
  EGG_COLLECTION: Egg,
  LOSS: AlertTriangle,
  MOTHER_HEN_LOG: Heart,
} as const;

// Income minus expenses for one period, with its own Pajamos/Išlaidos breakdown.
// Rendered twice on the dashboard: current month and current year.
function BalanceCard({
  label,
  income,
  expenses,
  href,
}: {
  label: string;
  income: number;
  expenses: number;
  href: string;
}) {
  const balance = income - expenses;
  return (
    <Link href={href}>
      {/* h-full so both balance cards stay level when one label wraps. */}
      <Card className="h-full p-3">
        <p className="mb-1 text-xs text-muted-foreground">{label}</p>
        <p
          className={`text-xl font-medium ${balance >= 0 ? "text-emerald-600" : "text-destructive"}`}
        >
          {formatEUR(balance)}
        </p>
        {/* Stacked, not joined by "·": two of these sit side by side at 11px,
            and formatEUR emits "1 234,00 €", which wraps unpredictably. */}
        <p className="mt-1 text-[11px] leading-tight text-muted-foreground">
          Pajamos {formatEUR(income)}
        </p>
        <p className="text-[11px] leading-tight text-muted-foreground">
          Išlaidos {formatEUR(expenses)}
        </p>
      </Card>
    </Link>
  );
}

export default async function DashboardPage() {
  const { farm } = await requireActiveFarm();
  const data = await getDashboardData(farm.id);

  return (
    <div className="pt-2">
      <div className="grid grid-cols-2 gap-2.5 px-4">
        <Card className="p-3">
          <p className="mb-1 text-xs text-muted-foreground">Paukščių iš viso</p>
          <p className="text-xl font-medium">{data.totalBirds}</p>
          <p className="mt-1 text-[11px] leading-tight text-muted-foreground">
            {data.birdsByType.length > 0
              ? data.birdsByType
                  .map((entry) => `${birdTypeLabels[entry.birdType]} ${entry.quantity}`)
                  .join(" · ")
              : "Nėra paukščių"}
          </p>
        </Card>
        <Card className="p-3">
          <p className="mb-1 text-xs text-muted-foreground">Kiaušinių likutis</p>
          <p className="text-xl font-medium">{data.eggsRemaining}</p>
          <p className="mt-1 text-[11px] leading-tight text-muted-foreground">
            Šį mėn. {data.eggsThisMonth} · Metais {data.eggsThisYear}
          </p>
        </Card>
        <BalanceCard
          label={`Balansas · ${formatMonthLT(data.currentMonth)}`}
          income={data.incomeThisMonth}
          expenses={data.expensesThisMonth}
          href={`/finance/profit-loss?year=${data.currentYear}&month=${data.currentMonth + 1}`}
        />
        <BalanceCard
          label={`Balansas · ${data.currentYear} m.`}
          income={data.incomeThisYear}
          expenses={data.expensesThisYear}
          href={`/finance/profit-loss?year=${data.currentYear}`}
        />
        {/* Odd card out in a 2-column grid — span both so no empty cell is left. */}
        <Card className="col-span-2 p-3">
          <p className="mb-1 text-xs text-muted-foreground">Aktyvus perinimas</p>
          <p className="text-xl font-medium">{data.activeIncubationCount} ciklai</p>
        </Card>
      </div>

      <div className="px-4 pt-4">
        <p className="mb-2 text-sm text-muted-foreground">Paskutiniai įrašai</p>
        <div className="flex flex-col">
          {data.activity.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Dar nėra jokios veiklos.
            </p>
          )}
          {data.activity.map((item) => {
            const Icon = ACTIVITY_ICONS[item.type];
            return (
              <div
                key={`${item.type}-${item.id}`}
                className="flex items-center gap-3 border-t py-3 first:border-t-0"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent">
                  <Icon size={16} className="text-accent-foreground" aria-hidden />
                </div>
                <div className="flex-1">
                  <p className="text-sm">{item.summary}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatRelativeLT(item.createdAt)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
