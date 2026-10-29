"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { formatEUR, formatShareLT } from "@/lib/format";
import {
  areaSplit,
  donutSegments,
  splitTextAlternative,
  splitWord,
  type SplitMode,
} from "@/lib/area-split";
import { cn } from "@/lib/utils";
import type { FarmArea } from "@/generated/prisma/client";

const SIZE = 136;
const RADIUS = 52;
const MODES: { mode: SplitMode; label: string }[] = [
  { mode: "expenses", label: "Išlaidos" },
  { mode: "income", label: "Pajamos" },
];

// The overview's "Pagal sritį" card (#202, V2-Overview): the period's spending
// or income split by area. Tapping a legend row focuses its slice and shows its
// amount in the centre; tapping it again clears the focus.
export function AreaSplitCard({
  areas,
}: {
  areas: Record<FarmArea, { income: number; expenses: number }>;
}) {
  const [mode, setMode] = useState<SplitMode>("expenses");
  const [focus, setFocus] = useState<FarmArea | null>(null);

  const split = areaSplit(areas, mode);
  const segments = donutSegments(split.parts, RADIUS);
  const focused = split.parts.find((p) => p.area === focus);
  const centre = SIZE / 2;

  return (
    <Card className="gap-3 p-4" role="region" aria-label="Pagal sritį">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Pagal sritį</p>
        <div role="group" aria-label="Rodyti" className="flex rounded-lg bg-muted p-0.5">
          {MODES.map((m) => (
            <button
              key={m.mode}
              type="button"
              aria-pressed={mode === m.mode}
              onClick={() => setMode(m.mode)}
              className={cn(
                "min-h-9 rounded-md px-3 text-sm font-medium",
                mode === m.mode ? "bg-background shadow-sm" : "text-muted-foreground",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative size-[136px] shrink-0">
          <svg
            width={SIZE}
            height={SIZE}
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            role="img"
            aria-label={splitTextAlternative(split, mode)}
          >
            <circle
              cx={centre}
              cy={centre}
              r={RADIUS}
              fill="none"
              stroke="var(--muted)"
              strokeWidth={20}
            />
            {segments.map((s) => (
              <circle
                key={s.area}
                cx={centre}
                cy={centre}
                r={RADIUS}
                fill="none"
                stroke={s.color}
                strokeWidth={focus === s.area ? 24 : 20}
                strokeDasharray={s.dash}
                strokeDashoffset={s.offset}
                opacity={focus && focus !== s.area ? 0.3 : 1}
                transform={`rotate(-90 ${centre} ${centre})`}
              />
            ))}
          </svg>
          <div
            aria-live="polite"
            className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-7 text-center"
          >
            <span className="text-[11px] leading-[14px] text-muted-foreground">
              {focused ? focused.short : `${splitWord(mode)} iš viso`}
            </span>
            <span className="text-sm font-semibold tabular-nums">
              {formatEUR(focused ? focused.amount : split.total)}
            </span>
            <span className="text-[11px] leading-[14px] text-muted-foreground">
              {focused ? formatShareLT(focused.share) : `${split.parts.length} sritys`}
            </span>
          </div>
        </div>

        <ul className="flex min-w-0 flex-1 flex-col">
          {split.parts.map((part) => (
            <li key={part.area}>
              <button
                type="button"
                aria-pressed={focus === part.area}
                onClick={() => setFocus(focus === part.area ? null : part.area)}
                className={cn(
                  "flex min-h-11 w-full items-center gap-2 rounded-lg px-1.5 text-left",
                  focus === part.area && "bg-muted",
                )}
              >
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: part.color }}
                />
                <span className="min-w-0 flex-1 truncate text-[13px]">{part.short}</span>
                <span
                  className={cn(
                    "text-[13px] font-medium tabular-nums",
                    part.amount <= 0 && "text-muted-foreground",
                  )}
                >
                  {formatShareLT(part.share)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <p className="text-xs text-muted-foreground">Paspauskite sritį, kad pamatytumėte sumą.</p>
    </Card>
  );
}
