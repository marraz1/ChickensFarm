"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatEUR, formatShareLT } from "@/lib/format";
import type { FarmStats } from "@/lib/farm-stats";
import { cn } from "@/lib/utils";

const PANEL_ID = "more-stats-panel";

// The overview's "Daugiau statistikos" (#204, V2-Overview): collapsed by
// default; opened, the period's spend by category and the farm's months.
export function MoreStats({ stats }: { stats: FarmStats }) {
  const [open, setOpen] = useState(false);

  return (
    <Card className="gap-0 py-0" role="region" aria-label="Daugiau statistikos">
      <button
        type="button"
        aria-expanded={open}
        // The panel is only rendered while open.
        aria-controls={open ? PANEL_ID : undefined}
        onClick={() => setOpen(!open)}
        className="flex min-h-13 w-full items-center justify-between px-4 text-sm font-medium"
      >
        Daugiau statistikos
        <ChevronDown
          size={16}
          aria-hidden
          className={cn("text-muted-foreground", open && "rotate-180")}
        />
      </button>

      {open && (
        <div id={PANEL_ID} className="flex flex-col gap-4 px-4 pb-4">
          <div className="flex flex-col gap-3">
            <p className="text-xs text-muted-foreground">Išlaidos pagal kategoriją</p>
            {stats.categories.length === 0 ? (
              <p className="text-sm text-muted-foreground">Išlaidų nėra.</p>
            ) : (
              stats.categories.map((c) => (
                <div key={c.label}>
                  <div className="mb-1 flex justify-between gap-3 text-sm">
                    <span>{c.label}</span>
                    <span className="font-medium tabular-nums">
                      {formatEUR(c.amount)}
                      <span className="ml-1 text-xs font-normal text-muted-foreground">
                        {formatShareLT(c.share)}
                      </span>
                    </span>
                  </div>
                  <div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.round(c.bar * 100)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="flex flex-col gap-1">
            <p className="text-xs text-muted-foreground">Pagal mėnesius · visas ūkis</p>
            {stats.months.map((m) => (
              <div key={m.key} className="flex justify-between gap-3 border-t py-1.5 text-sm">
                <span>
                  {m.label}
                  <span className="block text-xs text-muted-foreground">
                    Pajamos {formatEUR(m.income)} · Išlaidos {formatEUR(m.expenses)}
                  </span>
                </span>
                <span
                  className={cn(
                    "font-medium tabular-nums",
                    m.result >= 0 ? "text-emerald-600" : "text-destructive",
                  )}
                >
                  {formatEUR(m.result)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
