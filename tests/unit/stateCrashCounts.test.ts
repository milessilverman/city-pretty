// Provenance of the rebuilt non-California crash counts (scripts/build_state_crash_counts.py).
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const dir = path.resolve(__dirname, "../../app/data/crash_counts");
// California's files come from scripts/build_crash_counts_ca.py and are checked in provenance.test.ts.
const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /^\d{5}\.json$/.test(f) && !f.startsWith("06")) : [];

describe("rebuilt state crash counts", () => {
  it("exist for counties outside California", () => {
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) expect(f.slice(0, 2)).not.toBe("06");
  });

  for (const f of files) {
    const fips = f.slice(0, 5);
    it(`${fips}: meta records source, service, years, rule and script; counts are consistent`, () => {
      const d = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
      const m = d._meta;
      expect(m.script).toBe("scripts/build_state_crash_counts.py");
      expect(m.rule).toMatch(/within 10 m of its boundary/);
      expect(m.service_url.every((u: string) => /^https:\/\//.test(u))).toBe(true);
      expect(m.years[1] - m.years[0]).toBe(2); // three full years
      expect(m.matched).toBeLessThanOrEqual(m.with_coordinates);
      expect(m.with_coordinates).toBeLessThanOrEqual(m.crashes);
      expect(m.on_boundary).toBeLessThanOrEqual(m.matched);
      const rows = Object.entries(d).filter(([k]) => k !== "_meta") as [string, number[]][];
      expect(rows.length).toBeGreaterThan(0);
      for (const [g, v] of rows) {
        expect(g.startsWith(fips) && g.length === 12).toBe(true);
        expect(v[0]).toBeLessThanOrEqual(v[2]);
        expect(v[1]).toBeLessThanOrEqual(v[2]);
      }
      // the boundary rule can only add crashes relative to strictly-inside counting. Each count is stored rounded to 4
      // decimals (1/k parts, scripts/build_state_crash_counts.py), so the stored sum can fall short of the exact sum by
      // at most 0.00005 per block group (e.g. 23003, built 21 Nov 2026: stored sum 3993.9998, strictly-inside total 3994).
      const rounding = rows.length * 0.00005;
      expect(rows.reduce((s, [, v]) => s + v[2], 0) + rounding).toBeGreaterThanOrEqual(m.strict_within_totals[2]);
    });
  }
});
