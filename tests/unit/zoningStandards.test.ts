// Local zoning standards (app/data/zoning_standards.json) and parcel-use code tables (app/data/parcel_use_codes.json).
// Both are built by scripts/build_zoning_standards.py from the codes' own text. These tests check that every number
// still agrees with the verbatim text it was parsed from, so a hand edit to a number (without its quote) fails.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "../..");
const load = (rel: string) => JSON.parse(fs.readFileSync(path.join(root, rel), "utf8"));
const ZS = load("app/data/zoning_standards.json");
const USES = load("app/data/parcel_use_codes.json");
const NYC = ZS.jurisdictions.find((j: any) => j.id === "nyc");
const fmt = (n: number) => n.toLocaleString("en-US");

describe("zoning_standards.json: New York City", () => {
  it("covers the five NYC counties and the R1-R5 districts, read from MapPLUTO's ZoneDist1", () => {
    expect(NYC.counties.sort()).toEqual(["36005", "36047", "36061", "36081", "36085"]);
    expect(NYC.zone_source.field).toBe("ZoneDist1");
    expect(Object.keys(NYC.districts).sort()).toEqual([...NYC.districts_covered].sort());
    expect(NYC.districts_covered).toEqual(expect.arrayContaining(["R1-1", "R2A", "R3-2", "R4", "R4B", "R5D"]));
  });

  it("every rule cites a Zoning Resolution section URL", () => {
    for (const [d, r] of Object.entries<any>(NYC.districts))
      for (const k of ["housing_types", "min_lot", "far", "height"]) {
        expect(r[k], `${d} ${k}`).toBeTruthy();
        expect(r[k].url, `${d} ${k}`).toMatch(/^https:\/\/zr\.planning\.nyc\.gov\/article-[iv]+\/chapter-\d\/\d{2}-\d{2,3}$/);
      }
  });

  it("each number appears in the table row or sentence it was parsed from", () => {
    for (const [d, r] of Object.entries<any>(NYC.districts)) {
      expect(r.min_lot.row, d).toContain(`| ${fmt(r.min_lot.area_sqft)} | ${r.min_lot.width_ft}`);
      expect(r.far.row, d).toContain(r.far.standard.toFixed(2));
      expect(r.far.row, d).toContain(r.far.qualifying_residential_site.toFixed(2));
      expect(r.height.quote, d).toContain(`${r.height.max_height_ft} feet`);
      if (r.height.perimeter_wall_ft) expect(r.height.quote, d).toContain(`${r.height.perimeter_wall_ft} feet`);
      if (r.housing_types.limited_to) expect(r.housing_types.quote, d).toContain(`shall be limited to ${r.housing_types.limited_to}`);
    }
  });

  it("matches the Zoning Resolution text for spot-checked districts (as published 16 Nov 2026)", () => {
    // ZR 23-11 table rows and 22-122 limitations, read on zr.planning.nyc.gov.
    expect(NYC.districts["R1-1"].min_lot).toMatchObject({ area_sqft: 7125, width_ft: 75 });
    expect(NYC.districts["R2A"].min_lot).toMatchObject({ area_sqft: 2850, width_ft: 30 });
    expect(NYC.districts["R4B"].min_lot).toMatchObject({ area_sqft: 2375, width_ft: 25 });
    expect(NYC.districts["R2"].housing_types.limited_to).toBe("single-family detached residences");
    expect(NYC.districts["R4"].housing_types.limited_to).toBeNull();   // no ZR 22-122 limit
    expect(NYC.districts["R4B"].height.max_height_ft).toBe(25);         // 23-422, lower than 23-421's 35
    expect(NYC.districts["R5"].height).toMatchObject({ max_height_ft: 45, max_base_height_ft: 35 });
    expect(NYC.districts["R1-2A"].far.per_unit_cap).toMatchObject({ far: 0.6, min_lot_sqft: 4000 });
    expect(NYC.adu.max_sqft).toBe(800);
    expect(NYC.adu.quote).toContain("does not exceed eight hundred square feet of floor area");
    expect(NYC.adu.no_backyard_outside_greater_transit_zone).toEqual(["R1-2A", "R2A", "R3A"]);
  });
});

describe("zoning_standards.json: withheld jurisdictions", () => {
  it("each says why, with what was tried", () => {
    expect(ZS.withheld.length).toBeGreaterThan(0);
    for (const w of ZS.withheld) {
      expect(w.reason.length).toBeGreaterThan(30);
      expect(w.counties.every((c: string) => /^\d{5}$/.test(c))).toBe(true);
      expect(w.tried.length).toBeGreaterThan(0);
      for (const t of w.tried) expect(t.url).toMatch(/^https:\/\//);
    }
  });
  it("no county is both covered and withheld", () => {
    const covered = new Set(ZS.jurisdictions.flatMap((j: any) => j.counties));
    for (const w of ZS.withheld) for (const c of w.counties) expect(covered.has(c)).toBe(false);
  });
});

describe("parcel_use_codes.json", () => {
  it("NYC PLUTO land use codes come from the PLUTO data dictionary", () => {
    const s = USES.systems.find((x: any) => x.id === "nyc_pluto_landuse");
    expect(s.field).toBe("LandUse");
    expect(s.source.url).toMatch(/pluto_datadictionary\.pdf$/);
    expect(Object.keys(s.codes)).toHaveLength(11);
    expect(s.codes["01"]).toEqual({ label: "One & Two Family Buildings", type: "residential" });
    expect(s.codes["04"].type).toBe("mixed");
    expect(s.codes["05"].type).toBe("non-residential");
    expect(s.codes["11"].type).toBe("vacant");
  });
});
