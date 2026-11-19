// Block groups whose ACS median home value or rent is the surrounding tract's published median (the block group's own is
// suppressed by the Census): app/data/acs_fallback_flags.json, built by scripts/build_acs_fallback_flags.py from the
// Census Bureau's ACS 2020-24 summary files (B25077, B25064). The page labels these values; before 17 Nov 2026 a tract
// rent was shown as the block group's own.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { allBundleFips } from "../r2Only";

const root = path.resolve(__dirname, "../..");
const F = JSON.parse(fs.readFileSync(path.join(root, "app/data/acs_fallback_flags.json"), "utf8"));
const bundle = (fips: string) => JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root, `counties/bundle_${fips}.json.gz`))).toString());
const KEYS = new Set(["hv_tract", "rent_tract", "hv_mismatch", "rent_mismatch"]);

describe("acs_fallback_flags.json", () => {
  it("names its script, the Census files and what each list means", () => {
    expect(F._source.script).toBe("scripts/build_acs_fallback_flags.py");
    expect(F._source.census_files).toEqual(expect.arrayContaining([
      expect.stringMatching(/^https:\/\/www2\.census\.gov\/programs-surveys\/acs\/summary_file\/2024\/.*acsdt5y2024-b25077\.dat$/),
      expect.stringMatching(/acsdt5y2024-b25064\.dat$/),
    ]));
    expect(F._source.meaning).toMatch(/surrounding tract's published median/);
  });

  it("lists only the four kinds, as 7-digit block-group suffixes, sorted and unique, for every county file plus LA and Orange", () => {
    // every county with a data file, including R2-only ones (counties/.r2-only.txt), which may not be on disk here
    for (const fips of [...allBundleFips(), "06037", "06059"]) expect(F.counties[fips], fips).toBeDefined();
    let n = 0;
    for (const [fips, c] of Object.entries<any>(F.counties)) {
      expect(fips).toMatch(/^\d{5}$/);
      for (const [k, list] of Object.entries<any>(c)) {
        expect(KEYS.has(k), `${fips} ${k}`).toBe(true);
        expect(list.every((s: string) => /^\d{7}$/.test(s))).toBe(true);
        expect([...new Set(list)].sort()).toEqual(list);
        n += list.length;
      }
    }
    const t = F._source.totals;
    expect(n).toBe((t.hv_tract || 0) + (t.rent_tract || 0) + (t.hv_mismatch || 0) + (t.rent_mismatch || 0));
  });

  it("found no value that matches neither the block group's nor the tract's Census figure (16-17 Nov 2026 build)", () => {
    expect(F._source.totals.hv_mismatch || 0).toBe(0);
    expect(F._source.totals.rent_mismatch || 0).toBe(0);
  });

  it("agrees with the county files' own home-value notes wherever they exist: every 'surrounding Census tract' note is a tract value", () => {
    expect(F._source.hvs_note_vs_census["tract/says block group"] || 0).toBe(0);
    expect(F._source.hvs_note_vs_census["own/says tract"] || 0).toBe(0);
    expect(F._source.hvs_note_vs_census["tract/says tract"]).toBeGreaterThan(10000);
  });

  it("Anchorage 020200028221: rent is tract 02020002822's published median ($1,517; the block group's is suppressed)", () => {
    // Census files read 17 Nov 2026: 1500000US020200028221|-666666666 and 1400000US02020002822|1517 in acsdt5y2024-b25064.
    const b = bundle("02020");
    expect(b.details["020200028221"].m.rent).toBe(1517);
    expect(F.counties["02020"].rent_tract).toContain("0028221");
    // its home value is its own ($544,700 in acsdt5y2024-b25077)
    expect(b.details["020200028221"].m.hv).toBe(544700);
    expect(F.counties["02020"].hv_tract || []).not.toContain("0028221");
  });

  it("Anchorage 020200002011: rent ($3,111) and home value ($377,100) are the block group's own", () => {
    const b = bundle("02020");
    expect(b.details["020200002011"].m.rent).toBe(3111);
    expect(b.details["020200002011"].m.hv).toBe(377100);
    expect(F.counties["02020"].rent_tract).not.toContain("0002011");
  });

  it("LA is checked for rent only (its home values are rebuilt from assessor transfers on the page)", () => {
    expect(F.counties["06037"].hv_tract).toBeUndefined();
    expect(F.counties["06037"].hv_mismatch).toBeUndefined();
  });
});
