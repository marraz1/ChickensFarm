"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import { AREA_TABS, areaTabHref, type AreaSlug } from "@/lib/v2-navigation";
import { cn } from "@/lib/utils";

/**
 * The four tabs every V2 area shares (docs/V2_app_designs/V2Tabs). Rendered by
 * app/(app)/areas/[area]/layout.tsx, so the selected segment below the layout
 * is the active tab: null on the area page itself (Apžvalga).
 */
export function AreaTabs({ area }: { area: AreaSlug }) {
  const segment = useSelectedLayoutSegment();

  return (
    <nav
      aria-label="Srities skirtukai"
      className="mx-4 mb-3 grid grid-cols-4 gap-0.5 rounded-[10px] bg-muted p-[3px]"
    >
      {AREA_TABS.map((tab) => {
        const isActive = tab.segment === segment;
        return (
          <Link
            key={tab.label}
            href={areaTabHref(area, tab.segment)}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex min-h-[44px] items-center justify-center rounded-lg text-[13px] font-medium text-muted-foreground",
              isActive && "bg-card text-foreground shadow-sm",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
