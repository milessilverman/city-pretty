// Recomputed crash comparisons and crash-dependent rows (scripts/recompute_crash_gaps.py).
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "../..");
const dir = path.join(root, "app/data/crash_gaps");
const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /^\d{5}\.json$/.test(f)) : [];
const CRASH_IDS = ["traffic_calming", "crosswalks", "ped_signals", "slow_streets", "protected_bike", "street_lighting"];

describe("recomputed crash comparisons", () => {
  it("every county with rebuilt crash counts has a recomputed file", () => {
    const counts = fs.readdirSync(path.join(root, "app/data/crash_counts")).filter((f) => /^\d{5}\.json$/.test(f));
    expect(files.sort()).toEqual(counts.sort());
  });

  for (const f of files) {
    it(`${f.slice(0, 5)}: method recorded; comparisons follow the thresholds; rows are engine-shaped`, () => {
      const d = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
      const fips = f.slice(0, 5), mt = d._meta;
      expect(mt.script).toBe("scripts/recompute_crash_gaps.py");
      expect(mt.crash_counts).toBe(`app/data/crash_counts/${fips}.json`);
      // California compares within CCRS (LA + county); other counties within their own state source
      expect(mt.peers).toMatch(fips.startsWith("06") ? /LA County/ : /within this county/);
      expect(mt.pedbike_count_is_lower_bound).toBe(fips.startsWith("06") || fips.startsWith("17"));
      for (const [g, a] of Object.entries(d.bg) as [string, any][]) {
        expect(g.startsWith(fips)).toBe(true);
        if (a.p) {
          const [x, med, worse, cls] = a.p;
          expect(Number.isInteger(x)).toBe(true);
          expect(worse).toBeGreaterThanOrEqual(0);
          expect(worse).toBeLessThanOrEqual(1);
          if (cls === "g") expect(worse).toBeGreaterThanOrEqual(0.8);
          else expect(cls === "s" && worse <= 0.2).toBe(true);
          expect(Math.abs(x - med)).toBeGreaterThanOrEqual(med ? 0.1 * Math.abs(med) - 1e-9 : 0);
        }
        // a lower-bound count can prove a block group qualifies, never that it doesn't
        if (mt.pedbike_count_is_lower_bound) expect(a.drop).toBeUndefined();
        if (fips === "06037") expect(a.add).toBeUndefined(); // LA rows come from an LA build not in this repo
        for (const r of [...(a.add || []), ...(a.repl || [])]) {
          expect(r.length).toBe(12);
          expect(CRASH_IDS).toContain(r[0]);
        }
        for (const id of a.drop || []) expect(CRASH_IDS).toContain(id);
      }
    });
  }
});
