import { Card } from "@/components/ui/card";
import type { AreaLossInsight } from "@/lib/area-losses";
import type { AreaSlug } from "@/lib/v2-navigation";

// The feed value is an estimate: whole euros, as the design shows it ("≈ 92 €").
const wholeEUR = new Intl.NumberFormat("lt-LT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const BROKEN_COPY: Partial<Record<AreaSlug, { title: string; note: string }>> = {
  eggs: { title: "Sudaužyti kiaušiniai", note: "Iš surinkimų · šį mėnesį" },
  hens: { title: "Sudaužyti perinti kiaušiniai", note: "Pagal perekšlių dienoraštį" },
};

// The extra card under an area's dead birds on its Nuostoliai tab (#197,
// V2-<Area>-Losses): the losses that matter there beyond dead birds.
export function LossInsightCard({ area, insight }: { area: AreaSlug; insight: AreaLossInsight }) {
  if (insight.kind === "unhatched") {
    const title = "Kiaušiniai, iš kurių neišsirito";
    return (
      <Card className="gap-2 p-4" role="region" aria-label={title}>
        <p className="text-sm text-muted-foreground">{title}</p>
        <dl className="grid grid-cols-2 gap-2">
          {[
            { label: "Neapvaisinti", value: insight.infertile },
            { label: "Apvaisinti, bet neišsirito", value: insight.unhatched },
          ].map((s) => (
            <div key={s.label} className="flex flex-col-reverse items-center rounded-lg border p-2">
              <dt className="text-center text-xs text-muted-foreground">{s.label}</dt>
              <dd className="text-lg font-semibold tabular-nums">{s.value}</dd>
            </div>
          ))}
        </dl>
      </Card>
    );
  }

  const { title, note, value } =
    insight.kind === "feed"
      ? {
          title: "Prarasta pašarų vertė",
          note: "Apytiksliai, pagal vidutines išlaidas vienam paukščiui",
          value:
            insight.valueCents == null ? "—" : `≈ ${wholeEUR.format(insight.valueCents / 100)}`,
        }
      : { ...BROKEN_COPY[area]!, value: String(insight.count) };

  return (
    <Card className="flex-row items-center gap-3 p-4" role="region" aria-label={title}>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{note}</p>
      </div>
      <p className="shrink-0 text-xl font-semibold tabular-nums">{value}</p>
    </Card>
  );
}
