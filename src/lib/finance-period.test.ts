import { describe, expect, it } from "vitest";
import { parseUtcDateInput, resolveFinancePeriod } from "@/lib/finance-period";

const NOW = new Date("2026-10-29T10:00:00Z");
const day = (s: string) => new Date(`${s}T00:00:00Z`);

describe("resolveFinancePeriod", () => {
  it("defaults to the farm's current year", () => {
    const p = resolveFinancePeriod({}, NOW);
    expect(p).toMatchObject({ kind: "year", label: "2026 m.", year: 2026 });
    expect(p.from).toEqual(day("2026-01-01"));
    expect(p.to).toEqual(day("2026-12-31"));
    expect(p.today).toEqual(day("2026-10-29"));
  });

  it("covers this whole month for ?period=month", () => {
    const p = resolveFinancePeriod({ period: "month" }, NOW);
    expect(p).toMatchObject({ kind: "month", label: "Spalis 2026" });
    expect(p.from).toEqual(day("2026-10-01"));
    expect(p.to).toEqual(day("2026-10-31"));
  });

  it("reads this month and year in Vilnius, not UTC", () => {
    // 23:30 UTC on Dec 31 is already 01:30 on Jan 1 in Vilnius.
    const newYear = new Date("2026-12-31T23:30:00Z");
    expect(resolveFinancePeriod({}, newYear)).toMatchObject({ label: "2027 m.", year: 2027 });
    const month = resolveFinancePeriod({ period: "month" }, newYear);
    expect(month.label).toBe("Sausis 2027");
    expect(month.from).toEqual(day("2027-01-01"));
  });

  it("uses the chosen range and labels it with both dates", () => {
    const p = resolveFinancePeriod({ period: "range", from: "2026-03-01", to: "2026-05-15" }, NOW);
    expect(p).toMatchObject({ kind: "range", label: "2026-03-01 – 2026-05-15" });
    expect(p.from).toEqual(day("2026-03-01"));
    expect(p.to).toEqual(day("2026-05-15"));
  });

  it("swaps a reversed range", () => {
    const p = resolveFinancePeriod({ period: "range", from: "2026-05-15", to: "2026-03-01" }, NOW);
    expect(p.from).toEqual(day("2026-03-01"));
    expect(p.to).toEqual(day("2026-05-15"));
  });

  it("fills a missing or invalid range end with the year start or today", () => {
    const p = resolveFinancePeriod({ period: "range", from: "2026-02-31" }, NOW);
    expect(p.from).toEqual(day("2026-01-01"));
    expect(p.to).toEqual(day("2026-10-29"));
  });

  it("starts a range given only its end on January 1st of that year", () => {
    const p = resolveFinancePeriod({ period: "range", to: "2020-05-01" }, NOW);
    expect(p.from).toEqual(day("2020-01-01"));
    expect(p.to).toEqual(day("2020-05-01"));
  });

  it("ends a range no later than this year's end, so the month list stays bounded", () => {
    const p = resolveFinancePeriod({ period: "range", from: "2000-01-01", to: "2099-12-31" }, NOW);
    expect(p.from).toEqual(day("2000-01-01"));
    expect(p.to).toEqual(day("2026-12-31"));

    const future = resolveFinancePeriod({ period: "range", from: "2050-01-01" }, NOW);
    expect(future.from).toEqual(day("2026-10-29"));
    expect(future.to).toEqual(day("2026-12-31"));
  });

  it("keeps the first of repeated parameters and ignores unknown periods", () => {
    expect(resolveFinancePeriod({ period: ["month", "range"] }, NOW).kind).toBe("month");
    expect(resolveFinancePeriod({ period: "week" }, NOW).kind).toBe("year");
  });
});

describe("parseUtcDateInput", () => {
  it("accepts only real YYYY-MM-DD dates", () => {
    expect(parseUtcDateInput("2026-02-28")).toEqual(day("2026-02-28"));
    expect(parseUtcDateInput("2026-02-31")).toBeNull();
    expect(parseUtcDateInput("2026-2-3")).toBeNull();
    expect(parseUtcDateInput(undefined)).toBeNull();
  });

  it("rejects years outside 2000–2099 instead of shifting them", () => {
    // Date.UTC would read year 50 as 1950.
    expect(parseUtcDateInput("0050-06-01")).toBeNull();
    expect(parseUtcDateInput("1000-01-01")).toBeNull();
    expect(parseUtcDateInput("9999-12-31")).toBeNull();
    expect(parseUtcDateInput("2000-01-01")).toEqual(day("2000-01-01"));
  });
});
