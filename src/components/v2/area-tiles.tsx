"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatEUR } from "@/lib/format";
import type { AreaTile } from "@/lib/area-tiles";
import { cn } from "@/lib/utils";
import type { FarmArea } from "@/generated/prisma/client";

const resultColor = (amount: number) => (amount >= 0 ? "text-emerald-600" : "text-destructive");

// The overview's "Sritys" (#203, V2-Overview): two tiles a row, Bendros across
// both. Tapping a tile widens it and opens its details; one is open at a time.
export function AreaTiles({ tiles }: { tiles: AreaTile[] }) {
  const [open, setOpen] = useState<FarmArea | null>(null);

  return (
    <section aria-labelledby="area-tiles-heading">
      <h2 id="area-tiles-heading" className="mb-2 text-sm text-muted-foreground">
        Sritys
      </h2>
      <div className="grid grid-cols-2 gap-2.5">
        {tiles.map((tile) => {
          const isOpen = open === tile.area;
          const panelId = `area-tile-${tile.area}`;
          return (
            <Card
              key={tile.area}
              className={cn(
                "gap-0 overflow-hidden py-0",
                (isOpen || tile.area === "SHARED") && "col-span-2",
              )}
            >
              <button
                type="button"
                aria-expanded={isOpen}
                // The panel is only rendered while open.
                aria-controls={isOpen ? panelId : undefined}
                onClick={() => setOpen(isOpen ? null : tile.area)}
                className="flex min-h-11 w-full flex-col gap-0.5 p-3 text-left"
              >
                <span className="flex w-full items-center gap-1.5">
                  <span
                    aria-hidden
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ background: tile.color }}
                  />
                  <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                    {tile.name}
                  </span>
                  <ChevronDown
                    size={16}
                    aria-hidden
                    className={cn("shrink-0 text-muted-foreground", isOpen && "rotate-180")}
                  />
                </span>
                <span
                  className={cn("text-lg font-semibold tabular-nums", resultColor(tile.result))}
                >
                  {formatEUR(tile.result)}
                </span>
                {tile.sharedNote != null ? (
                  <>
                    <span className="text-xs text-muted-foreground">Nepriskirtos sričiai</span>
                    <span className="text-xs text-muted-foreground">{tile.sharedNote}</span>
                  </>
                ) : (
                  <>
                    <span className="text-xs text-muted-foreground">
                      Pajamos {formatEUR(tile.income)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Išlaidos {formatEUR(tile.expenses)}
                    </span>
                  </>
                )}
              </button>

              {isOpen && (
                <div id={panelId} className="flex flex-col gap-3 border-t p-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Pajamos</p>
                      <p className="text-base font-semibold tabular-nums text-emerald-600">
                        {formatEUR(tile.income)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Išlaidos</p>
                      <p className="text-base font-semibold tabular-nums">
                        {formatEUR(tile.expenses)}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <p className="text-xs text-muted-foreground">Didžiausios išlaidos</p>
                    {tile.topCategories.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Išlaidų nėra.</p>
                    ) : (
                      tile.topCategories.map((c) => (
                        <div key={c.label} className="flex justify-between gap-3 text-sm">
                          <span>{c.label}</span>
                          <span className="font-medium tabular-nums">{formatEUR(c.amount)}</span>
                        </div>
                      ))
                    )}
                  </div>

                  {tile.losses != null && (
                    <div className="flex justify-between gap-3 text-sm">
                      <span className="text-muted-foreground">Nuostoliai</span>
                      <span className="font-medium">{tile.losses}</span>
                    </div>
                  )}

                  <div className="flex flex-col gap-1">
                    <p className="text-xs text-muted-foreground">Pagal mėnesius</p>
                    {tile.months.map((m) => (
                      <div key={m.key} className="flex justify-between gap-3 text-sm">
                        <span>{m.label}</span>
                        <span className={cn("font-medium tabular-nums", resultColor(m.result))}>
                          {formatEUR(m.result)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {tile.links && (
                    <div className="grid grid-cols-2 gap-2">
                      <Link
                        href={tile.links.overview}
                        className="flex min-h-11 items-center justify-center rounded-lg border text-sm font-medium"
                      >
                        Atidaryti sritį
                      </Link>
                      <Link
                        href={tile.links.finance}
                        className="flex min-h-11 items-center justify-center rounded-lg border text-sm font-medium"
                      >
                        Finansai
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </section>
  );
}
