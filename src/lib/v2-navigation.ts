// V2 navigation (issue #185): the bottom bar, the area tabs and which bar item
// each URL belongs to. One table so the bar, the tabs and the route map in
// docs/V2_app_designs/V2-implementation-plan.md cannot drift apart.
//
// Area pages live under /areas/<slug>; the V1 record screens V2 reuses keep
// their own URLs and are mapped onto an area here. Pure on purpose (no React,
// no runtime imports), so it is unit-tested without a DOM.
import type { FarmArea } from "@/generated/prisma/client";

export const AREA_SLUGS = {
  eggs: "EGGS",
  hens: "HENS",
  incubation: "INC",
  meat: "MEAT",
} as const satisfies Record<string, FarmArea>;

export type AreaSlug = keyof typeof AREA_SLUGS;

export function isAreaSlug(value: string): value is AreaSlug {
  return Object.hasOwn(AREA_SLUGS, value);
}

export type NavKey = "overview" | AreaSlug;

// Short labels from V2Nav; page titles use farmAreaLabels' long forms.
export const NAV_ITEMS: readonly { key: NavKey; href: string; label: string }[] = [
  { key: "overview", href: "/", label: "Apžvalga" },
  { key: "eggs", href: "/areas/eggs", label: "Kiaušiniai" },
  { key: "hens", href: "/areas/hens", label: "Perekšlės" },
  { key: "incubation", href: "/areas/incubation", label: "Perinimas" },
  { key: "meat", href: "/areas/meat", label: "Mėsa" },
];

export type AreaTabSegment = null | "expenses" | "losses" | "finance";

// `segment` is what useSelectedLayoutSegment() returns inside /areas/[area];
// null is the area's own page (its Apžvalga tab).
export const AREA_TABS: readonly { segment: AreaTabSegment; label: string }[] = [
  { segment: null, label: "Apžvalga" },
  { segment: "expenses", label: "Išlaidos" },
  { segment: "losses", label: "Nuostoliai" },
  { segment: "finance", label: "Finansai" },
];

export function areaTabHref(area: AreaSlug, segment: AreaTabSegment): string {
  return segment ? `/areas/${area}/${segment}` : `/areas/${area}`;
}

// Reused V1 screens and the bar item they sit under. Longest prefix wins, so
// /birds/consumptions (meat use) beats nothing broader; farm-wide screens
// (expenses, losses, finance, profile, farms) belong to no area and fall back
// to Apžvalga or to nothing.
const ROUTE_AREAS: readonly [prefix: string, key: NavKey | null][] = [
  ["/eggs", "eggs"],
  ["/birds/purchases", "eggs"],
  ["/birds/sales", "eggs"],
  ["/bird-groups", "eggs"],
  ["/breeds", "eggs"],
  ["/mother-hens", "hens"],
  ["/incubation", "incubation"],
  ["/birds/consumptions", "meat"],
  ["/expenses", "overview"],
  ["/losses", "overview"],
  ["/finance", "overview"],
  ["/birds", "overview"],
];

function underPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

// Areas a bird group can live in, by their URL slug (#186). A group is never
// in Perekšlės (a mother hen is an individual bird), so "hens" is not one.
const GROUP_AREA_SLUGS = { eggs: "EGGS", meat: "MEAT", incubation: "INC" } as const;
export type GroupArea = (typeof GROUP_AREA_SLUGS)[keyof typeof GROUP_AREA_SLUGS];
export type GroupAreaSlug = keyof typeof GROUP_AREA_SLUGS;

/** `?area=` on group and trade screens → the group area, or null for "all". */
export function groupAreaFromParam(value: string | string[] | undefined | null): GroupArea | null {
  if (typeof value !== "string" || !Object.hasOwn(GROUP_AREA_SLUGS, value)) return null;
  return GROUP_AREA_SLUGS[value as GroupAreaSlug];
}

export function groupAreaSlug(area: GroupArea): GroupAreaSlug {
  return (Object.keys(GROUP_AREA_SLUGS) as GroupAreaSlug[]).find(
    (slug) => GROUP_AREA_SLUGS[slug] === area,
  )!;
}

// Group and trade screens are shared by the areas; `?area=` says which one
// the farmer came from, so the bar keeps that area highlighted.
const AREA_AWARE_PREFIXES = ["/bird-groups", "/birds/purchases", "/birds/sales"];

/** The bottom-bar item to highlight for a URL, or null when none applies. */
export function navKeyForPath(pathname: string, areaParam?: string | null): NavKey | null {
  if (pathname === "/") return "overview";

  const area = /^\/areas\/([^/]+)/.exec(pathname)?.[1];
  if (area !== undefined) return isAreaSlug(area) ? area : null;

  const groupArea = groupAreaFromParam(areaParam);
  if (groupArea && AREA_AWARE_PREFIXES.some((p) => underPrefix(pathname, p))) {
    return groupAreaSlug(groupArea);
  }

  let best: { length: number; key: NavKey | null } | null = null;
  for (const [prefix, key] of ROUTE_AREAS) {
    if (underPrefix(pathname, prefix) && (!best || prefix.length > best.length)) {
      best = { length: prefix.length, key };
    }
  }
  return best?.key ?? null;
}

// Interim content of each area's Apžvalga tab: links to the V1 screens that
// belong to the area, until the area overview stories (#187–#190) replace it.
export const AREA_RECORD_LINKS: Record<AreaSlug, readonly { href: string; label: string }[]> = {
  eggs: [
    { href: "/eggs/collections", label: "Kiaušinių surinkimas" },
    { href: "/eggs/sales", label: "Kiaušinių pardavimai" },
    { href: "/eggs/consumptions", label: "Suvartoti kiaušiniai" },
    { href: "/birds/purchases", label: "Paukščių pirkimai" },
    { href: "/birds/sales", label: "Paukščių pardavimai" },
    { href: "/bird-groups?area=eggs", label: "Dedeklių grupės" },
    { href: "/eggs/reports", label: "Kiaušinių ataskaita" },
  ],
  hens: [{ href: "/mother-hens", label: "Perekšlės" }],
  incubation: [{ href: "/incubation", label: "Perinimo ciklai" }],
  meat: [
    { href: "/birds/consumptions", label: "Suvartota mėsai" },
    { href: "/bird-groups?area=meat", label: "Mėsinių grupės" },
    { href: "/birds/purchases/new?area=meat", label: "Pirkti jauniklių auginti" },
    { href: "/birds/sales", label: "Paukščių pardavimai" },
  ],
};

// Farm-wide V1 screen each not-yet-built area tab points to meanwhile.
export const AREA_TAB_FALLBACK: Record<
  Exclude<AreaTabSegment, null>,
  { href: string; label: string }
> = {
  expenses: { href: "/expenses", label: "Visos ūkio išlaidos" },
  losses: { href: "/losses", label: "Visi ūkio nuostoliai" },
  finance: { href: "/finance/profit-loss", label: "Ūkio pelnas / nuostoliai" },
};
