import Link from "next/link";
import { Card } from "@/components/ui/card";
import type { FarmNow as FarmNowData } from "@/lib/services/dashboard";
import { areaTabHref } from "@/lib/v2-navigation";

// The overview's "Ūkis dabar" (#204, V2-Overview): the farm as it is now, each
// box opening the area it belongs to, as the design links them.
export function FarmNow({ data }: { data: FarmNowData }) {
  const boxes = [
    { label: "Kiaušinių likutis", value: data.eggStock, href: areaTabHref("eggs", null) },
    { label: "Paukščių iš viso", value: data.totalBirds, href: areaTabHref("eggs", null) },
    { label: "Aktyvūs ciklai", value: data.activeCycles, href: areaTabHref("incubation", null) },
    {
      label: `Nuostoliai · ${data.losses.year} m.`,
      value: data.losses.count,
      href: areaTabHref("eggs", "losses"),
    },
  ];

  return (
    <section aria-labelledby="farm-now-heading">
      <h2 id="farm-now-heading" className="mb-2 text-sm text-muted-foreground">
        Ūkis dabar
      </h2>
      <div className="grid grid-cols-2 gap-2.5">
        {boxes.map((box) => (
          <Link key={box.label} href={box.href} className="rounded-xl">
            <Card className="min-h-11 gap-1 p-3">
              <p className="text-xs text-muted-foreground">{box.label}</p>
              <p className="text-xl font-semibold tabular-nums">{box.value}</p>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
