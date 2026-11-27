import { describe, expect, it } from "vitest";
import { projectsFromBundle, chooseCutoffYear, backtestLaProjects, OUTCOME_BY_STATUS } from "../../../src/platform/pilot/laProjects.js";

// FIXTURE: not real data. Rows only exercise the adapter's layout [kind, id, address, status, units, year, lat, lon].
const kinds = ["housing completed", "new ADU", "city capital project"];
const noDiscover = () => [] as any[];

describe("laProjects adapter", () => {
  const rows = [
    [0, "A", "x", "completed", 3, "2020", 34, -118],
    [1, "B", "x", "Permit Finaled", 1, "2021", 34, -118],
    [2, "Capital job", null, "Design", null, "2028", 34, -118],
    [2, "Capital job", null, "Design", null, "Deve", 34, -118],
    [0, "C", "x", "Permit Expired", 1, "2022", 34, -118],
  ];
  it("maps outcome only from listed status text and category only from an unambiguous kind", () => {
    const p = projectsFromBundle(rows, kinds);
    expect(p.records.map((r) => r.outcome)).toEqual(["built", "built", null, null, null]);
    expect(p.records.map((r) => r.category)).toEqual([null, "adu", null, null, null]);
    expect(Object.keys(OUTCOME_BY_STATUS)).not.toContain("permit expired");
  });
  it("dates a year at 31 Dec, leaves a non-year undated, and keeps ids unique", () => {
    const p = projectsFromBundle(rows, kinds);
    expect(p.records[0].date).toBe("2020-12-31");
    expect(p.records[3].date).toBeNull();
    expect(p.counts.undated).toBe(1);
    expect(new Set(p.records.map((r) => r.id)).size).toBe(rows.length);
  });
  it("refuses a truth set with no failed or cancelled project instead of weakening the harness", () => {
    const r = backtestLaProjects({ rows, kinds, cutoffYear: 2020, discover: noDiscover });
    expect(r.possible).toBe(false);
    expect(r.refusal?.name).toBe("SurvivorshipError");
    expect(r.result).toBeNull();
  });
  it("chooses no cut-off when no dated row has an outcome", () => {
    expect(chooseCutoffYear([{ date: "2020-12-31", outcome: null }], 0.7)).toBeNull();
  });
});
