import { describe, expect, it } from "vitest";
import { AREA_LOSS_COPY, buildAreaLossSummary, type AreaLossInput } from "./area-losses";
import { countNounLT } from "./format";

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`); // as @db.Date comes back
let seq = 0;

function loss(over: Partial<AreaLossInput> = {}): AreaLossInput {
  seq += 1;
  return {
    id: `l${seq}`,
    reasonType: "DISEASE",
    quantity: 1,
    lossDate: day("2026-10-01"),
    createdAt: new Date(Date.UTC(2026, 9, 1, 12, 0, seq)),
    comment: null,
    targetName: null,
    ...over,
  };
}

describe("countNounLT", () => {
  const birds = AREA_LOSS_COPY.eggs.unit;
  it.each([
    [0, "0 paukščių"],
    [1, "1 paukštis"],
    [2, "2 paukščiai"],
    [9, "9 paukščiai"],
    [10, "10 paukščių"],
    [11, "11 paukščių"],
    [12, "12 paukščių"],
    [19, "19 paukščių"],
    [21, "21 paukštis"],
    [22, "22 paukščiai"],
    [25, "25 paukščiai"],
    [111, "111 paukščių"],
  ])("%i → %s", (n, text) => {
    expect(countNounLT(n, birds)).toBe(text);
  });

  it("counts chicks in Perinimas", () => {
    expect(countNounLT(1, AREA_LOSS_COPY.incubation.unit)).toBe("1 jauniklis");
    expect(countNounLT(3, AREA_LOSS_COPY.incubation.unit)).toBe("3 jaunikliai");
  });
});

describe("buildAreaLossSummary — the year card", () => {
  it("counts the year's birds by cause, all three always shown", () => {
    const s = buildAreaLossSummary({
      year: 2026,
      losses: [
        loss({ reasonType: "PREDATOR", quantity: 2 }),
        loss({ reasonType: "DISEASE", quantity: 1 }),
        loss({ reasonType: "PREDATOR", quantity: 1 }),
      ],
    });
    expect(s.byReason).toEqual([
      { reason: "DISEASE", label: "Liga", count: 1 },
      { reason: "PREDATOR", label: "Plėšrūnas", count: 3 },
      { reason: "OTHER", label: "Kita", count: 0 },
    ]);
    expect(s.total).toBe(4);
  });

  it("leaves last year's losses out of the card but keeps them in the list", () => {
    const s = buildAreaLossSummary({
      year: 2026,
      losses: [loss({ lossDate: day("2025-12-31"), quantity: 5 }), loss({ quantity: 1 })],
    });
    expect(s.total).toBe(1);
    expect(s.rows).toHaveLength(2);
  });

  it("is zero with no losses", () => {
    const s = buildAreaLossSummary({ year: 2026, losses: [] });
    expect(s.total).toBe(0);
    expect(s.byReason.map((r) => r.count)).toEqual([0, 0, 0]);
    expect(s.rows).toEqual([]);
  });
});

describe("buildAreaLossSummary — the records", () => {
  it("lists newest first, and the one entered last first on the same day", () => {
    const older = loss({ id: "older", lossDate: day("2026-09-02") });
    const first = loss({ id: "first", lossDate: day("2026-10-26") });
    const second = loss({ id: "second", lossDate: day("2026-10-26") });
    const s = buildAreaLossSummary({ year: 2026, losses: [older, first, second] });
    expect(s.rows.map((r) => r.key)).toEqual(["second", "first", "older"]);
  });

  it("titles a row with its cause and date, and names what was lost and why", () => {
    const s = buildAreaLossSummary({
      year: 2026,
      linkQuery: "?area=eggs",
      losses: [
        loss({
          id: "x",
          reasonType: "PREDATOR",
          quantity: 2,
          lossDate: day("2026-09-02"),
          targetName: "Sussex",
          comment: "lapė",
        }),
      ],
    });
    expect(s.rows).toEqual([
      {
        key: "x",
        title: "Plėšrūnas · 2026 m. rugsėjo 2 d.",
        detail: "Sussex · lapė",
        quantity: 2,
        href: "/losses/x/edit?area=eggs",
      },
    ]);
  });

  it.each([
    ["Vištidė A", null, "Vištidė A"],
    [null, "lapė", "lapė"],
    [null, null, null],
  ])("detail of target %s and comment %s → %s", (targetName, comment, detail) => {
    const s = buildAreaLossSummary({ year: 2026, losses: [loss({ targetName, comment })] });
    expect(s.rows[0].detail).toBe(detail);
  });
});

describe("AREA_LOSS_COPY", () => {
  it("calls Perinimas losses dead chicks and the rest dead birds", () => {
    expect(AREA_LOSS_COPY.incubation.heading).toBe("Žuvę jaunikliai");
    for (const area of ["eggs", "hens", "meat"] as const) {
      expect(AREA_LOSS_COPY[area].heading).toBe("Nugaišo");
    }
  });

  it("says Perekšlės had no losses this year, as designed", () => {
    expect(AREA_LOSS_COPY.hens.empty).toBe("Šiais metais perekšlių nuostolių nebuvo.");
    expect(AREA_LOSS_COPY.eggs.empty).toBe("Šioje srityje dar nėra nuostolių.");
  });
});
