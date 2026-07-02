import { requireActiveFarm } from "@/lib/session";
import { getDashboardData } from "@/lib/services/dashboard";
import { Card } from "@/components/ui/card";
import { formatEUR, formatRelativeLT } from "@/lib/format";
import { Egg, AlertTriangle, Heart } from "lucide-react";

const ACTIVITY_ICONS = {
  EGG_COLLECTION: Egg,
  LOSS: AlertTriangle,
  MOTHER_HEN_LOG: Heart,
} as const;

export default async function DashboardPage() {
  const { farm } = await requireActiveFarm();
  const data = await getDashboardData(farm.id);

  return (
    <div className="pt-2">
      <div className="grid grid-cols-2 gap-2.5 px-4">
        <Card className="p-3">
          <p className="mb-1 text-xs text-muted-foreground">Paukščių iš viso</p>
          <p className="text-xl font-medium">{data.totalBirds}</p>
        </Card>
        <Card className="p-3">
          <p className="mb-1 text-xs text-muted-foreground">Kiaušiniai (7 d.)</p>
          <p className="text-xl font-medium">{data.eggsLast7d}</p>
        </Card>
        <Card className="p-3">
          <p className="mb-1 text-xs text-muted-foreground">Pajamos (mėn.)</p>
          <p className="text-xl font-medium text-emerald-600">{formatEUR(data.incomeThisMonth)}</p>
        </Card>
        <Card className="p-3">
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
              <div key={`${item.type}-${item.id}`} className="flex items-center gap-3 border-t py-3 first:border-t-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent">
                  <Icon size={16} className="text-accent-foreground" aria-hidden />
                </div>
                <div className="flex-1">
                  <p className="text-sm">{item.summary}</p>
                  <p className="text-xs text-muted-foreground">{formatRelativeLT(item.createdAt)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
