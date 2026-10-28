"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { LayoutGrid, Egg, Heart, Thermometer, Drumstick } from "lucide-react";
import { NAV_ITEMS, navKeyForPath, type NavKey } from "@/lib/v2-navigation";
import { cn } from "@/lib/utils";

const ICONS: Record<NavKey, typeof Egg> = {
  overview: LayoutGrid,
  eggs: Egg,
  hens: Heart,
  incubation: Thermometer,
  meat: Drumstick,
};

/**
 * V2 bottom bar (docs/V2_app_designs/V2Nav): one item per farm area plus the
 * farm overview. There is no add button — each area's page header carries its
 * own primary action instead.
 *
 * Group and trade screens are shared by Kiaušiniai and Mėsa, so `?area=` on
 * them picks the highlighted item (#186). Reading search params needs a
 * Suspense boundary; until it resolves, the bar highlights by path alone.
 */
export function BottomTabBar() {
  const pathname = usePathname();
  return (
    <Suspense fallback={<Bar active={navKeyForPath(pathname)} />}>
      <BarWithArea pathname={pathname} />
    </Suspense>
  );
}

function BarWithArea({ pathname }: { pathname: string }) {
  const area = useSearchParams().get("area");
  return <Bar active={navKeyForPath(pathname, area)} />;
}

function Bar({ active }: { active: NavKey | null }) {
  return (
    <nav
      aria-label="Ūkio sritys"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80"
    >
      <div className="mx-auto flex max-w-md items-center justify-around">
        {NAV_ITEMS.map((item) => {
          const Icon = ICONS[item.key];
          const isActive = item.key === active;
          return (
            <Link
              key={item.key}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-muted-foreground",
                isActive && "font-medium text-primary",
              )}
            >
              <span className="flex h-7 items-center">
                <Icon size={20} aria-hidden />
              </span>
              <span className="text-[11px]">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
