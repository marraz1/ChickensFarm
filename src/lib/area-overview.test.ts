import { describe, expect, it } from "vitest";
import {
  cycleCardLines,
  cycleStatus,
  flockByBreed,
  hatchEfficiency,
  henStatus,
  incubationSheetItems,
  sittingDay,
  sittingDetail,
} from "@/lib/area-overview";
import { formatShareLT } from "@/lib/format";
import { AREA_NEW_RECORDS } from "@/lib/v2-navigation";

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const running = { hatchDate: null, eggsFertile: null, hatchedCount: null };

describe("cycleStatus", () => {
  it("is Pradėta, then Apšviesta once candled, then Išsiritę", () => {
    expect(cycleStatus(running)).toBe("Pradėta");
    expect(cycleStatus({ ...running, eggsFertile: 20 })).toBe("Apšviesta");
    expect(cycleStatus({ hatchDate: d("2026-10-01"), eggsFertile: 20, hatchedCount: 16 })).toBe(
      "Išsiritę",
    );
  });
});

describe("hatchEfficiency", () => {
  it("divides hatched by fertile eggs over hatched cycles only", () => {
    const e = hatchEfficiency([
      { hatchDate: d("2026-09-23"), eggsFertile: 20, hatchedCount: 16 },
      { hatchDate: d("2026-08-01"), eggsFertile: 18, hatchedCount: 15 },
      // Candled, not hatched yet: its fertile eggs have no result to count.
      { hatchDate: null, eggsFertile: 22, hatchedCount: null },
    ]);
    expect(e).toMatchObject({ hatched: 31, fertile: 38 });
    expect(formatShareLT(e.rate!)).toMatch(/^81,6\s?%$/);
  });

  it("has no rate before any fertile eggs have hatched", () => {
    expect(hatchEfficiency([running, { ...running, eggsFertile: 10 }]).rate).toBeNull();
    // A hatch recorded without candling has no fertile count to divide by.
    expect(
      hatchEfficiency([{ hatchDate: d("2026-09-01"), eggsFertile: null, hatchedCount: 9 }]).rate,
    ).toBeNull();
  });
});

describe("cycleCardLines", () => {
  const base = {
    ...running,
    startDate: d("2026-10-12"),
    eggsTotal: 24,
    henName: null,
    sourceBreed: null,
    sourceDescription: null,
    latestAlive: null,
  };
  const today = d("2026-10-26");

  it("shows a running cycle's start, day and source", () => {
    expect(cycleCardLines({ ...base, sourceBreed: "Brama" }, today)).toEqual({
      started: "Pradėta 2026 m. spalio 12 d. · 15-a diena",
      source: "Šaltinis: Brama · 24 kiaušiniai",
      result: null,
    });
  });

  it("names the hen first, then the breed, the description or nothing", () => {
    const line = (o: object) => cycleCardLines({ ...base, ...o }, today).source;
    expect(line({ henName: "Rita", sourceBreed: "Brama", eggsTotal: 18 })).toBe(
      "Perekšlė Rita · 18 kiaušinių",
    );
    expect(line({ sourceDescription: "iš kaimyno", eggsTotal: null })).toBe("iš kaimyno");
    expect(line({ eggsTotal: 1 })).toBe("Šaltinis nenurodytas · 1 kiaušinis");
  });

  it("drops the day once hatched and shows the chicks", () => {
    const hatched = { ...base, hatchDate: d("2026-11-02"), eggsFertile: 20, hatchedCount: 16 };
    expect(cycleCardLines({ ...hatched, latestAlive: 15 }, today)).toMatchObject({
      started: "Pradėta 2026 m. spalio 12 d.",
      result: "Išsirito 16 · dabar gyvų 15",
    });
    expect(cycleCardLines(hatched, today).result).toBe("Išsirito 16");
  });
});

describe("incubationSheetItems", () => {
  const hrefs = (cycles: { active: string[]; growing: string[] }) =>
    Object.fromEntries(
      incubationSheetItems(AREA_NEW_RECORDS.incubation, cycles).map((i) => [i.label, i.href]),
    );

  it("points the per-cycle actions at the only cycle that fits", () => {
    expect(hrefs({ active: ["c1"], growing: ["c9"] })).toMatchObject({
      "Apšvietimas / patikra": "/incubation/c1",
      "Registruoti išsiritimą": "/incubation/c1",
      "Jauniklių sekimo įrašas": "/incubation/c9/growth-logs/new",
      "Naujas perinimo ciklas": "/incubation/new",
    });
  });

  it("opens the cycle list to pick from with none or several", () => {
    expect(hrefs({ active: [], growing: ["c8", "c9"] })).toMatchObject({
      "Apšvietimas / patikra": "/incubation",
      "Registruoti išsiritimą": "/incubation",
      "Jauniklių sekimo įrašas": "/incubation",
    });
  });
});

describe("sittingDetail", () => {
  it("shows one sitting hen's eggs and day", () => {
    expect(sittingDetail([{ name: "Rita", eggs: 8, day: 6 }])).toBe("8 kiaušiniai · 6-a diena");
    expect(sittingDetail([{ name: "Rita", eggs: 1, day: 1 }])).toBe("1 kiaušinis · 1-a diena");
    expect(sittingDetail([{ name: "Rita", eggs: 12, day: 21 }])).toBe("12 kiaušinių · 21-a diena");
  });

  it("leaves out the eggs when their number is not known", () => {
    expect(sittingDetail([{ name: "Rita", eggs: null, day: 3 }])).toBe("3-a diena");
  });

  it("names several sitting hens, or says nobody sits", () => {
    expect(
      sittingDetail([
        { name: "Rita", eggs: 8, day: 6 },
        { name: "Rudė", eggs: 5, day: 2 },
      ]),
    ).toBe("Rita · Rudė");
    expect(sittingDetail([])).toBe("Šiuo metu niekas neperi");
  });
});

const day = (s: string) => new Date(`${s}T00:00:00Z`);

describe("henStatus", () => {
  it("is Peri while sitting, Ilsisi between broods", () => {
    expect(henStatus({ diedAt: null }, true)).toBe("Peri");
    expect(henStatus({ diedAt: null }, false)).toBe("Ilsisi");
  });

  it("is Nugaišusi for a dead hen, even with an unhatched cycle", () => {
    expect(henStatus({ diedAt: day("2026-10-01") }, true)).toBe("Nugaišusi");
  });
});

describe("sittingDay", () => {
  it("counts the start day as day 1", () => {
    expect(sittingDay(day("2026-10-24"), day("2026-10-24"))).toBe(1);
    expect(sittingDay(day("2026-10-24"), day("2026-10-29"))).toBe(6);
  });

  it("never goes below 1 for a start date set in the future", () => {
    expect(sittingDay(day("2026-11-02"), day("2026-10-29"))).toBe(1);
  });
});

describe("flockByBreed", () => {
  it("merges groups of one breed and lists the largest first", () => {
    expect(
      flockByBreed([
        { breedName: "Sussex", quantity: 6 },
        { breedName: "Brama", quantity: 20 },
        { breedName: "Brama", quantity: 4 },
      ]),
    ).toEqual([
      { name: "Brama", quantity: 24 },
      { name: "Sussex", quantity: 6 },
    ]);
  });

  it("leaves out groups with no birds and breaks ties by name", () => {
    expect(
      flockByBreed([
        { breedName: "Sussex", quantity: 3 },
        { breedName: "Australorp", quantity: 3 },
        { breedName: "Leghorn", quantity: 0 },
      ]),
    ).toEqual([
      { name: "Australorp", quantity: 3 },
      { name: "Sussex", quantity: 3 },
    ]);
  });
});
