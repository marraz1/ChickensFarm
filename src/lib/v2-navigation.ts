// V2 navigation (issue #185): the bottom bar, the area tabs and which bar item
// each URL belongs to. One table so the bar, the tabs and the route map in
// docs/V2_app_designs/V2-implementation-plan.md cannot drift apart.
//
// Area pages live under /areas/<slug>; the V1 record screens V2 reuses keep
// their own URLs and are mapped onto an area here. Pure on purpose (no React,
// no runtime imports), so it is unit-tested without a DOM.
import type { FarmArea } from "@/generated/prisma/client";
import type { BirdGroupArea } from "@/lib/validation/farm-areas";

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
const GROUP_AREA_SLUGS = {
  eggs: "EGGS",
  meat: "MEAT",
  incubation: "INC",
} as const satisfies Record<string, BirdGroupArea>;
// The same union as the validation enum (one source of truth for group areas).
export type GroupArea = BirdGroupArea;
export type GroupAreaSlug = keyof typeof GROUP_AREA_SLUGS;

/** `?area=` on group and trade screens → the group area, or null for "all". */
export function groupAreaFromParam(value: string | string[] | undefined | null): GroupArea | null {
  if (typeof value !== "string" || !Object.hasOwn(GROUP_AREA_SLUGS, value)) return null;
  return GROUP_AREA_SLUGS[value as GroupAreaSlug];
}

/**
 * A stored group's area as a GroupArea. The bird_groups_area_check constraint
 * keeps it to EGGS, MEAT or INC; anything else would read as Kiaušiniai rather
 * than produce an `?area=undefined` link.
 */
export function toGroupArea(area: string): GroupArea {
  return area === "MEAT" || area === "INC" ? area : "EGGS";
}

const GROUP_AREA_TO_SLUG: Record<GroupArea, GroupAreaSlug> = {
  EGGS: "eggs",
  MEAT: "meat",
  INC: "incubation",
};

export function groupAreaSlug(area: GroupArea): GroupAreaSlug {
  return GROUP_AREA_TO_SLUG[area];
}

/** Short area name as the bottom bar shows it ("Kiaušiniai", "Mėsa", "Perinimas"). */
export function groupAreaShortLabel(area: GroupArea): string {
  const slug = groupAreaSlug(area);
  return NAV_ITEMS.find((item) => item.key === slug)!.label;
}

// Screens shared by the areas, where `?area=` says which one the farmer came
// from, so the bar keeps that area highlighted. `group` screens accept the
// areas a bird group can live in (#186); `any` screens accept every area,
// Perekšlės included (#192). Only screens that actually work in that area are
// listed — the farm-wide expense list is not filtered, so it is not here; the
// new-expense form and an expense opened from an area's list (#194) are.
const AREA_PARAM_SCREENS: readonly { match: RegExp; accepts: "group" | "any" }[] = [
  { match: /^\/bird-groups(\/|$)/, accepts: "group" },
  { match: /^\/birds\/purchases(\/|$)/, accepts: "group" },
  { match: /^\/birds\/sales(\/|$)/, accepts: "group" },
  { match: /^\/birds\/consumptions(\/|$)/, accepts: "group" },
  { match: /^\/expenses\/new$/, accepts: "any" },
  { match: /^\/expenses\/[^/]+\/edit$/, accepts: "any" },
  { match: /^\/losses\/new$/, accepts: "any" },
  { match: /^\/losses\/[^/]+\/edit$/, accepts: "any" },
];

function areaFromParam(areaParam: string | null | undefined, accepts: "group" | "any") {
  if (accepts === "any") return areaParam && isAreaSlug(areaParam) ? areaParam : null;
  const groupArea = groupAreaFromParam(areaParam);
  return groupArea ? groupAreaSlug(groupArea) : null;
}

/** The bottom-bar item to highlight for a URL, or null when none applies. */
export function navKeyForPath(pathname: string, areaParam?: string | null): NavKey | null {
  if (pathname === "/") return "overview";

  const area = /^\/areas\/([^/]+)/.exec(pathname)?.[1];
  if (area !== undefined) return isAreaSlug(area) ? area : null;

  const screen = AREA_PARAM_SCREENS.find((s) => s.match.test(pathname));
  const fromParam = screen ? areaFromParam(areaParam, screen.accepts) : null;
  if (fromParam) return fromParam;

  let best: { length: number; key: NavKey | null } | null = null;
  for (const [prefix, key] of ROUTE_AREAS) {
    if (underPrefix(pathname, prefix) && (!best || prefix.length > best.length)) {
      best = { length: prefix.length, key };
    }
  }
  return best?.key ?? null;
}

// The "Įrašai" list on the Apžvalga tabs that have one: the V1 screens that
// belong to the area. `stat` names the figure the overview shows beside the
// link (#187 Kiaušiniai, #190 Mėsa). Perekšlės and Perinimas list their hens
// and cycles instead (#188, #189).
export type EggsStatKey =
  "collected" | "eggSales" | "eggsConsumed" | "purchases" | "birdSales" | "groups";
export type MeatStatKey = "groups" | "consumed" | "sales";
export type AreaStatKey = EggsStatKey | MeatStatKey;
export type AreaRecordLink = { href: string; label: string; stat?: AreaStatKey };

export const AREA_RECORD_LINKS: Record<"eggs" | "meat", readonly AreaRecordLink[]> = {
  eggs: [
    { href: "/eggs/collections", label: "Kiaušinių surinkimas", stat: "collected" },
    { href: "/eggs/sales", label: "Kiaušinių pardavimai", stat: "eggSales" },
    { href: "/eggs/consumptions", label: "Suvartoti kiaušiniai", stat: "eggsConsumed" },
    { href: "/birds/purchases", label: "Paukščių pirkimai", stat: "purchases" },
    { href: "/birds/sales?area=eggs", label: "Paukščių pardavimai", stat: "birdSales" },
    { href: "/bird-groups?area=eggs", label: "Dedeklių grupės", stat: "groups" },
    // Not in the design; kept so the report stays reachable in V2.
    { href: "/eggs/reports", label: "Kiaušinių ataskaita" },
  ],
  // The Mėsa use and sales figures are the year's, as the design shows them
  // (#190); each list is kept to the area, so it holds what its figure counts.
  meat: [
    { href: "/bird-groups?area=meat", label: "Mėsinių grupės", stat: "groups" },
    { href: "/birds/consumptions?area=meat", label: "Suvartota mėsai", stat: "consumed" },
    { href: "/birds/sales?area=meat", label: "Mėsinių pardavimai", stat: "sales" },
  ],
};

// The "Naujas įrašas" sheet of each area (V2-<Area>-New): every record the
// area can add, then its expense and loss.
//
// `cycle` marks an action done on one incubation cycle: the Perinimas overview
// points it at that cycle when exactly one fits (incubationSheetItems), else
// it opens the cycle list to pick from.
export type NewRecordLink = { href: string; label: string; cycle?: "active" | "growing" };
type NewRecordLinks = readonly NewRecordLink[];
export const AREA_NEW_RECORDS: Record<AreaSlug, NewRecordLinks> = {
  eggs: [
    { href: "/eggs/collections/new", label: "Surinkti kiaušinius" },
    { href: "/eggs/sales/new", label: "Parduoti kiaušinius" },
    { href: "/eggs/consumptions/new", label: "Suvartoti kiaušinius" },
    { href: "/birds/purchases/new?area=eggs", label: "Pirkti paukščių" },
    { href: "/birds/sales/new?area=eggs", label: "Parduoti paukščių" },
    { href: "/bird-groups/new?area=eggs", label: "Nauja dedeklių grupė" },
    { href: "/expenses/new?area=eggs", label: "Nauja išlaida" },
    { href: "/losses/new?area=eggs", label: "Registruoti nuostolį" },
  ],
  hens: [
    { href: "/mother-hens/new", label: "Nauja perekšlė" },
    // A diary entry belongs to one hen, so this opens the hens to pick from.
    { href: "/mother-hens", label: "Dienoraščio įrašas" },
    // The brood is a Perinimas cycle with the hen chosen on it (#188).
    { href: "/incubation/new", label: "Pradėti perėjimą su perekšle" },
    { href: "/expenses/new?area=hens", label: "Nauja išlaida" },
    { href: "/losses/new?area=hens", label: "Registruoti nuostolį" },
  ],
  incubation: [
    { href: "/incubation/new", label: "Naujas perinimo ciklas" },
    // Candling and the hatch are recorded on a running cycle's page.
    { href: "/incubation", label: "Apšvietimas / patikra", cycle: "active" },
    { href: "/incubation", label: "Registruoti išsiritimą", cycle: "active" },
    // A growth entry belongs to a hatched cycle still being raised.
    { href: "/incubation", label: "Jauniklių sekimo įrašas", cycle: "growing" },
    { href: "/expenses/new?area=incubation", label: "Nauja išlaida" },
    { href: "/losses/new?area=incubation", label: "Registruoti nuostolį" },
  ],
  meat: [
    { href: "/birds/consumptions/new?area=meat", label: "Suvartoti mėsai" },
    { href: "/birds/sales/new?area=meat", label: "Parduoti paukščių" },
    { href: "/birds/purchases/new?area=meat", label: "Pirkti jauniklių auginti" },
    { href: "/bird-groups/new?area=meat", label: "Nauja mėsinių grupė" },
    { href: "/expenses/new?area=meat", label: "Nauja išlaida" },
    { href: "/losses/new?area=meat", label: "Registruoti nuostolį" },
  ],
};

export type ExpenseTargetField = "birdGroupId" | "motherHenId" | "incubationCycleId";

// What an area's expense can optionally point at (#192, V2ExpenseForm): the
// field it is stored in and the field's label. The server checks that the
// target belongs to the farm and to the expense's area (#179).
export const AREA_EXPENSE_TARGETS: Record<AreaSlug, { field: ExpenseTargetField; label: string }> =
  {
    eggs: { field: "birdGroupId", label: "Dedeklių grupė (neprivaloma)" },
    hens: { field: "motherHenId", label: "Perekšlė (neprivaloma)" },
    incubation: { field: "incubationCycleId", label: "Perinimo ciklas (neprivaloma)" },
    meat: { field: "birdGroupId", label: "Mėsinių grupė (neprivaloma)" },
  };

const GROUP_LOSS_HINT = "Grupės kiekis bus sumažintas ir įrašytas į istoriją.";

// What an area's loss is recorded against (#195, V2LossForm): required, and
// what happens to it is spelled out under the field.
export const AREA_LOSS_TARGETS: Record<
  AreaSlug,
  {
    field: ExpenseTargetField;
    label: string;
    hint: string;
    quantityLabel: string;
    requiredMessage: string;
  }
> = {
  eggs: {
    field: "birdGroupId",
    label: "Dedeklių grupė",
    hint: GROUP_LOSS_HINT,
    quantityLabel: "Kiekis",
    requiredMessage: "Pasirinkite dedeklių grupę",
  },
  hens: {
    field: "motherHenId",
    label: "Perekšlė",
    hint: "Perekšlė bus pažymėta kaip nugaišusi.",
    quantityLabel: "Kiekis",
    requiredMessage: "Pasirinkite perekšlę",
  },
  incubation: {
    field: "incubationCycleId",
    label: "Perinimo ciklas",
    hint: "Gyvų jauniklių skaičius cikle bus sumažintas.",
    quantityLabel: "Jauniklių",
    requiredMessage: "Pasirinkite perinimo ciklą",
  },
  meat: {
    field: "birdGroupId",
    label: "Mėsinių grupė",
    hint: GROUP_LOSS_HINT,
    quantityLabel: "Kiekis",
    requiredMessage: "Pasirinkite mėsinių grupę",
  },
};
