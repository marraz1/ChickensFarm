"use client";

import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

/**
 * "Naujas" on an area overview and the "Naujas įrašas" bottom sheet it opens
 * (V2-<Area>-New, #187–#190): every record the area can add, then its expense
 * and loss. Picking one navigates away, which closes the sheet.
 */
export function AreaNewSheet({
  areaLabel,
  items,
  triggerLabel = "Naujas",
}: {
  areaLabel: string;
  items: readonly { href: string; label: string }[];
  /** The button's word as the design spells it: "Naujas", or "Nauja" on Perekšlės. */
  triggerLabel?: string;
}) {
  return (
    <Sheet>
      <SheetTrigger className="flex h-11 items-center gap-1 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground">
        <Plus size={16} aria-hidden /> {triggerLabel}
      </SheetTrigger>
      <SheetContent side="bottom" showCloseButton={false} className="rounded-t-2xl pb-4">
        <SheetHeader className="pb-0">
          <SheetTitle>Naujas įrašas</SheetTitle>
          <SheetDescription>{areaLabel}</SheetDescription>
        </SheetHeader>
        <nav aria-label="Naujas įrašas" className="flex flex-col px-4">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex min-h-11 items-center justify-between gap-3 border-t py-2.5 text-sm font-medium first:border-t-0"
            >
              {item.label}
              <ChevronRight size={16} className="text-muted-foreground" aria-hidden />
            </Link>
          ))}
        </nav>
        <div className="px-4">
          <SheetClose className="h-11 w-full rounded-lg border text-sm font-medium">
            Uždaryti
          </SheetClose>
        </div>
      </SheetContent>
    </Sheet>
  );
}
