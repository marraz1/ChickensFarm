import { describe, it, expect } from "vitest";
import {
  AREA_TABS,
  NAV_ITEMS,
  areaTabHref,
  isAreaSlug,
  navKeyForPath,
  AREA_RECORD_LINKS,
  AREA_NEW_RECORDS,
  groupAreaFromParam,
  AREA_EXPENSE_TARGETS,
  AREA_LOSS_TARGETS,
} from "./v2-navigation";

describe("NAV_ITEMS", () => {
  it("lists the five V2 bar items in design order", () => {
    expect(NAV_ITEMS.map((i) => i.label)).toEqual([
      "Apžvalga",
      "Kiaušiniai",
      "Perekšlės",
      "Perinimas",
      "Mėsa",
    ]);
  });

  it("points each item at its own page", () => {
    expect(NAV_ITEMS.map((i) => i.href)).toEqual([
      "/",
      "/areas/eggs",
      "/areas/hens",
      "/areas/incubation",
      "/areas/meat",
    ]);
  });
});

describe("AREA_TABS / areaTabHref", () => {
  it("has the four area tabs in design order", () => {
    expect(AREA_TABS.map((t) => t.label)).toEqual([
      "Apžvalga",
      "Išlaidos",
      "Nuostoliai",
      "Finansai",
    ]);
  });

  it("builds tab URLs under the area", () => {
    expect(AREA_TABS.map((t) => areaTabHref("meat", t.segment))).toEqual([
      "/areas/meat",
      "/areas/meat/expenses",
      "/areas/meat/losses",
      "/areas/meat/finance",
    ]);
  });
});

describe("isAreaSlug", () => {
  it("accepts the four area slugs", () => {
    for (const slug of ["eggs", "hens", "incubation", "meat"]) expect(isAreaSlug(slug)).toBe(true);
  });

  it("rejects anything else, including inherited object keys", () => {
    for (const slug of ["EGGS", "inc", "shared", "", "toString", "__proto__"]) {
      expect(isAreaSlug(slug)).toBe(false);
    }
  });
});

describe("navKeyForPath", () => {
  it.each([
    ["/", "overview"],
    ["/areas/eggs", "eggs"],
    ["/areas/hens/expenses", "hens"],
    ["/areas/incubation/finance", "incubation"],
    ["/areas/meat/losses", "meat"],
    ["/eggs/collections", "eggs"],
    ["/eggs/collections/new", "eggs"],
    ["/birds/purchases/abc/edit", "eggs"],
    ["/birds/sales", "eggs"],
    ["/bird-groups/g1", "eggs"],
    ["/breeds/new", "eggs"],
    ["/mother-hens/h1/logs/new", "hens"],
    ["/incubation/c1/finish", "incubation"],
    ["/birds/consumptions/new", "meat"],
    ["/expenses", "overview"],
    ["/losses/new", "overview"],
    ["/finance/profit-loss", "overview"],
    ["/birds", "overview"],
  ] as const)("%s → %s", (path, key) => {
    expect(navKeyForPath(path)).toBe(key);
  });

  it.each(["/profile", "/farms/new", "/areas/unknown", "/eggs-x", "/birdsong", "/mother-hensx"])(
    "%s highlights nothing",
    (path) => {
      expect(navKeyForPath(path)).toBeNull();
    },
  );
});

describe("AREA_RECORD_LINKS", () => {
  it("links every area to at least one existing screen", () => {
    for (const links of Object.values(AREA_RECORD_LINKS)) {
      expect(links.length).toBeGreaterThan(0);
      for (const { href } of links) expect(href.startsWith("/")).toBe(true);
    }
  });

  it("keeps each link inside the area it is listed under", () => {
    for (const [area, links] of Object.entries(AREA_RECORD_LINKS)) {
      for (const { href } of links) {
        // Meat-bird sales use the same V1 sales list as laying birds for now.
        if (area === "meat" && href === "/birds/sales") continue;
        const url = new URL(href, "http://x");
        expect(navKeyForPath(url.pathname, url.searchParams.get("area"))).toBe(area);
      }
    }
  });
});

describe("AREA_NEW_RECORDS", () => {
  it("offers the Kiaušiniai sheet's eight actions in design order", () => {
    expect(AREA_NEW_RECORDS.eggs?.map((a) => a.label)).toEqual([
      "Surinkti kiaušinius",
      "Parduoti kiaušinius",
      "Suvartoti kiaušinius",
      "Pirkti paukščių",
      "Parduoti paukščių",
      "Nauja dedeklių grupė",
      "Nauja išlaida",
      "Registruoti nuostolį",
    ]);
  });

  it("offers the Perekšlės sheet's five actions in design order", () => {
    expect(AREA_NEW_RECORDS.hens.map((a) => a.label)).toEqual([
      "Nauja perekšlė",
      "Dienoraščio įrašas",
      "Pradėti perėjimą su perekšle",
      "Nauja išlaida",
      "Registruoti nuostolį",
    ]);
  });

  it("keeps every action inside its area, so the bar stays on it", () => {
    // A brood under a hen is created as a Perinimas cycle, so that one action
    // lights Perinimas — where the farmer then follows the cycle.
    const crossArea = new Set(["hens /incubation/new"]);
    for (const [area, actions] of Object.entries(AREA_NEW_RECORDS)) {
      for (const { href } of actions ?? []) {
        if (crossArea.has(`${area} ${href}`)) continue;
        const url = new URL(href, "http://x");
        expect(navKeyForPath(url.pathname, url.searchParams.get("area"))).toBe(area);
      }
    }
    expect(navKeyForPath("/incubation/new")).toBe("incubation");
  });
});

describe("groupAreaFromParam", () => {
  it.each([
    ["eggs", "EGGS"],
    ["meat", "MEAT"],
    ["incubation", "INC"],
  ] as const)("%s → %s", (param, area) => {
    expect(groupAreaFromParam(param)).toBe(area);
  });

  it.each([undefined, null, "", "hens", "EGGS", "toString", ["eggs"]])(
    "%j means all areas",
    (param) => {
      expect(groupAreaFromParam(param as string | string[] | null | undefined)).toBeNull();
    },
  );
});

describe("navKeyForPath with an area", () => {
  it.each([
    ["/bird-groups", "meat", "meat"],
    ["/bird-groups/g1/edit", "meat", "meat"],
    ["/bird-groups/new", "incubation", "incubation"],
    ["/birds/purchases/new", "meat", "meat"],
    ["/birds/sales/new", "eggs", "eggs"],
    ["/bird-groups", null, "eggs"],
    ["/bird-groups", "hens", "eggs"],
    // The area only steers the shared group and trade screens.
    ["/eggs/collections", "meat", "eggs"],
    ["/mother-hens", "meat", "hens"],
    // #192: the expense form opened from any area, Perekšlės included.
    ["/expenses/new", "eggs", "eggs"],
    ["/expenses/new", "hens", "hens"],
    ["/expenses/new", "incubation", "incubation"],
    ["/expenses/new", "meat", "meat"],
    ["/expenses/new", null, "overview"],
    ["/expenses/new", "shared", "overview"],
    ["/expenses/new", "toString", "overview"],
    // The farm-wide list is not filtered by area, so it never claims one.
    ["/expenses", "meat", "overview"],
    // An expense opened from an area's list keeps that area (#194).
    ["/expenses/abc/edit", "hens", "hens"],
    ["/expenses/abc/edit", null, "overview"],
    // #195: the loss form and a loss opened from an area keep that area.
    ["/losses/new", "incubation", "incubation"],
    ["/losses/new", "hens", "hens"],
    ["/losses/abc/edit", "meat", "meat"],
    ["/losses/new", null, "overview"],
    ["/losses", "eggs", "overview"],
  ] as const)("%s?area=%s → %s", (path, area, key) => {
    expect(navKeyForPath(path, area)).toBe(key);
  });
});

describe("AREA_EXPENSE_TARGETS", () => {
  it.each([
    ["eggs", "birdGroupId", "Dedeklių grupė (neprivaloma)"],
    ["hens", "motherHenId", "Perekšlė (neprivaloma)"],
    ["incubation", "incubationCycleId", "Perinimo ciklas (neprivaloma)"],
    ["meat", "birdGroupId", "Mėsinių grupė (neprivaloma)"],
  ] as const)("%s → %s labelled %s", (area, field, label) => {
    expect(AREA_EXPENSE_TARGETS[area]).toEqual({ field, label });
  });
});

describe("AREA_LOSS_TARGETS", () => {
  it.each([
    ["eggs", "birdGroupId", "Dedeklių grupė", "Kiekis", "Pasirinkite dedeklių grupę"],
    ["hens", "motherHenId", "Perekšlė", "Kiekis", "Pasirinkite perekšlę"],
    [
      "incubation",
      "incubationCycleId",
      "Perinimo ciklas",
      "Jauniklių",
      "Pasirinkite perinimo ciklą",
    ],
    ["meat", "birdGroupId", "Mėsinių grupė", "Kiekis", "Pasirinkite mėsinių grupę"],
  ] as const)("%s → %s labelled %s", (area, field, label, quantityLabel, requiredMessage) => {
    expect(AREA_LOSS_TARGETS[area]).toMatchObject({ field, label, quantityLabel, requiredMessage });
  });

  it("spells out what the loss does to its target", () => {
    expect(AREA_LOSS_TARGETS.eggs.hint).toBe(
      "Grupės kiekis bus sumažintas ir įrašytas į istoriją.",
    );
    expect(AREA_LOSS_TARGETS.meat.hint).toBe(AREA_LOSS_TARGETS.eggs.hint);
    expect(AREA_LOSS_TARGETS.hens.hint).toBe("Perekšlė bus pažymėta kaip nugaišusi.");
    expect(AREA_LOSS_TARGETS.incubation.hint).toBe("Gyvų jauniklių skaičius cikle bus sumažintas.");
  });
});
