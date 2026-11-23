// Crash counts use the 1/k boundary rule: a crash within 10 m of the edges of k block groups counts 1/k in each, so each
// county's block groups must add up to the number of crashes that were placed (scripts/build_crash_counts_ca.py for
// California's CCRS counties, scripts/build_state_crash_counts.py for San Francisco and every county outside California).
// A count built under the older rule (a boundary crash counted in full in each bordering block group) fails this test.
// California was rebuilt 19 Nov 2026, the 175 files outside California (states 08, 17, 23, 42, 47, 49, 51) 21 Nov 2026; 47 more (11 Maine, 36 Pennsylvania) were built with the 1/k rule by the northeast small-counties batch, 21 Nov 2026; 23 more (Utah) by the west small-counties batch, 21 Nov 2026.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const dir = path.resolve(__dirname, "../../app/data/crash_counts");
const files = fs.readdirSync(dir).filter((f) => /^\d{5}\.json$/.test(f));
const perState = (st: string) => files.filter((f) => f.startsWith(st)).length;

describe("crash counts: block groups add up to the located crashes (1/k rule), every county", () => {
  it("has all 58 California counties", () => expect(perState("06")).toBe(58));
  it("has the 443 counties outside California that have a state or city crash source", () => {
    const want: Record<string, number> = { "08": 1, "17": 102, "23": 16, "42": 67, "47": 95, "49": 29, "51": 133 };
    for (const [st, n] of Object.entries(want)) expect(perState(st), `state ${st}`).toBe(n);
    expect(files.length).toBe(58 + 443);
  });
  for (const f of files) {
    it(`${f.slice(0, 5)} uses the 1/k rule and its block-group sums equal the located crashes`, () => {
      const d = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
      const m = d._meta;
      const bgs = Object.keys(d).filter((g) => g !== "_meta");
      expect(m.weighting).toBe("1/k");
      expect(m.rule).toMatch(/1\/k/);
      const sums = [0, 1, 2].map((j) => bgs.reduce((s, g) => s + d[g][j], 0));
      const tol = 5e-5 * bgs.length + 1e-6; // each block group is rounded to 4 decimals
      expect(Math.abs(sums[2] - m.matched)).toBeLessThanOrEqual(tol);
      expect(m.matched).toBeLessThanOrEqual(m.with_coordinates);
      expect(m.with_coordinates).toBeLessThanOrEqual(m.crashes);
      if (m.block_group_sums) {
        // the builder records the sums it wrote; they must be the sums of the file's own rows
        for (const j of [0, 1, 2]) expect(Math.abs(sums[j] - m.block_group_sums[j])).toBeLessThanOrEqual(tol + 1e-3);
      }
      if (m.located_crashes) {
        // CCRS counties record the exact located totals for all three fields
        expect(m.located_crashes[2]).toBe(m.matched);
        for (const j of [0, 1]) expect(Math.abs(sums[j] - m.located_crashes[j])).toBeLessThanOrEqual(tol);
      }
      for (const g of bgs) {
        expect(d[g][0]).toBeLessThanOrEqual(d[g][2] + 1e-9);
        expect(d[g][1]).toBeLessThanOrEqual(d[g][2] + 1e-9);
      }
    });
  }
});
