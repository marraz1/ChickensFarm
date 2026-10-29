import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { requireActiveFarm } from "@/lib/session";
import { getAreaLosses } from "@/lib/services/losses";
import { AREA_LOSS_COPY } from "@/lib/area-losses";
import { countNounLT } from "@/lib/format";
import { AREA_SLUGS, isAreaSlug } from "@/lib/v2-navigation";

// The area's Nuostoliai tab (#196, V2-<Area>-Losses): the year's dead birds
// split by cause, and every loss of the area, newest first. "Nuostolis" opens
// the area loss form (#195).
export default async function AreaLossesPage({ params }: { params: Promise<{ area: string }> }) {
  const { area } = await params;
  // The area layout already 404s an unknown slug; this narrows the type.
  if (!isAreaSlug(area)) notFound();
  const { farm } = await requireActiveFarm();
  // Rows carry ?area= so the edit screen returns here and keeps the area lit.
  const { year, total, byReason, rows, hasMore } = await getAreaLosses(farm.id, AREA_SLUGS[area], {
    linkQuery: `?area=${area}`,
  });
  const copy = AREA_LOSS_COPY[area];
  const heading = `${copy.heading} · ${year} m.`;

  return (
    <div className="flex flex-col gap-3 px-4 pb-4">
      <div className="flex justify-end">
        <Link
          href={`/losses/new?area=${area}`}
          className="flex h-11 items-center gap-1 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground"
        >
          <Plus size={16} aria-hidden /> Nuostolis
        </Link>
      </div>

      <Card className="gap-2 p-4" role="region" aria-label={heading}>
        <p className="text-sm text-muted-foreground">{heading}</p>
        <p className="text-2xl font-semibold tabular-nums">{countNounLT(total, copy.unit)}</p>
        <dl className="mt-1 grid grid-cols-3 gap-2">
          {byReason.map((r) => (
            <div
              key={r.reason}
              className="flex flex-col-reverse items-center rounded-lg border p-2"
            >
              <dt className="text-xs text-muted-foreground">{r.label}</dt>
              <dd className="text-lg font-semibold tabular-nums">{r.count}</dd>
            </div>
          ))}
        </dl>
      </Card>

      {/* None this year; earlier years' records are still listed below. */}
      {total === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">{copy.empty}</p>
      )}

      {rows.length > 0 && (
        <>
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
                    <span className="shrink-0 text-sm font-medium text-destructive tabular-nums">
                      −{row.quantity}
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
          {hasMore && (
            <Link
              href="/losses"
              className="flex min-h-11 items-center justify-center text-sm font-medium text-primary"
            >
              Visi ūkio nuostoliai
            </Link>
          )}
        </>
      )}
    </div>
  );
}
