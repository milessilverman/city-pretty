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
      if (r.tier === "R6-R10") continue;   // checked in the R6-R10 block below
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

describe("zoning_standards.json: New York City R6-R10", () => {
  const HIGH = Object.entries<any>(NYC.districts).filter(([, r]) => r.tier === "R6-R10");
  const val = (row: string) => row.split(" | ");

  it("covers every R6-R10 district the ZR 23-22 and 23-432 tables list, and nothing else in that range", () => {
    expect(HIGH.map(([d]) => d).sort()).toEqual(["R10", "R10A", "R10X", "R6", "R6-1", "R6-2", "R6A", "R6B", "R6D", "R7-1", "R7-2", "R7-3", "R7A", "R7B", "R7D", "R7X",
      "R8", "R8A", "R8B", "R8X", "R9", "R9-1", "R9A", "R9D", "R9X"].sort());
    expect(NYC.not_covered).toMatch(/^R11, R12, commercial/);
    for (const [d] of HIGH) expect(NYC.districts_covered, d).toContain(d);
  });

  it("each option's numbers appear in the table row they were parsed from, with section URLs", () => {
    for (const [d, r] of HIGH) {
      expect(r.housing_types.limited_to, d).toBeNull();
      expect(r.housing_types.url, d).toBe("https://zr.planning.nyc.gov/article-ii/chapter-2/22-121");
      expect(r.min_lot.row, d).toContain(`R6 - R12 | ${fmt(r.min_lot.area_sqft)} | ${r.min_lot.width_ft}`);
      expect(r.far.url, d).toBe("https://zr.planning.nyc.gov/article-ii/chapter-3/23-22");
      expect(r.height.url, d).toBe("https://zr.planning.nyc.gov/article-ii/chapter-3/23-432");
      expect(r.far.standard, d).toBeNull();          // no single figure: the page must read the options
      expect(r.height.max_height_ft, d).toBeNull();
      for (const o of r.far.options.standard) expect(val(o.row)[1], d).toMatch(new RegExp(`^${o.far.toFixed(2)}(\\^\\d)?$`));
      for (const o of r.far.options.qualifying) expect(val(o.row)[2], d).toMatch(new RegExp(`^${o.far.toFixed(2)}(\\^\\d)?$`));
      for (const o of r.height.options.standard) expect(val(o.row).slice(1, 4), d).toEqual([String(o.min_base_ft), String(o.max_base_ft), String(o.max_height_ft)]);
      for (const o of r.height.options.qualifying) expect([val(o.row)[1], ...val(o.row).slice(4)], d).toEqual([String(o.min_base_ft), String(o.max_base_ft), String(o.max_height_ft)]);
      // A district whose value depends on a condition never has two unconditioned options.
      for (const opts of [r.far.options.standard, r.far.options.qualifying, r.height.options.standard, r.height.options.qualifying])
        expect(opts.filter((o: any) => !o.condition).length, d).toBeLessThanOrEqual(1);
    }
  });

  it("matches the Zoning Resolution tables for spot-checked districts (as published 17 Nov 2026)", () => {
    const R6 = NYC.districts["R6"], R71 = NYC.districts["R7-1"], R8 = NYC.districts["R8"], R10A = NYC.districts["R10A"], R6B = NYC.districts["R6B"];
    expect(R6.min_lot).toMatchObject({ area_sqft: 2375, width_ft: 25 });
    expect(R6.min_lot_other_residences).toMatchObject({ area_sqft: 1700, width_ft: 18 });
    // 23-22: R6 3.00 within 100 ft of a wide street (footnote 1), 2.20 otherwise; 3.90 for qualifying housing either way.
    expect(R6.far.options.standard.map((o: any) => [o.far, !!o.condition])).toEqual([[3.0, true], [2.2, false]]);
    expect(R6.far.options.standard[0].condition).toMatch(/^For zoning lots, or portions thereof, located within 100 feet of a wide street/);
    expect(R6.far.options.qualifying.map((o: any) => o.far)).toEqual([3.9, 3.9]);
    expect(R71.far.options.standard.map((o: any) => o.far)).toEqual([4.0, 3.44]);
    expect(R8.far.options.qualifying.map((o: any) => o.far)).toEqual([7.2, 8.64]);
    expect(R8.far.options.qualifying[1].condition).toMatch(/^Outside of Mandatory Inclusionary Housing areas/);
    expect(R6B.far.options.standard).toHaveLength(1);
    expect(R6B.far.options.standard[0]).toMatchObject({ far: 2.0, condition: null });
    // 23-432: R7-1 wide street 40/75/85 (qualifying 85/115), narrow street 40/65/75 (85/105).
    expect(R71.height.options.standard.map((o: any) => [o.min_base_ft, o.max_base_ft, o.max_height_ft])).toEqual([[40, 75, 85], [40, 65, 75]]);
    expect(R71.height.options.qualifying.map((o: any) => [o.max_base_ft, o.max_height_ft])).toEqual([[85, 115], [85, 105]]);
    expect(R71.height.options.standard[1].condition).toMatch(/^For zoning lots or portions thereof on a narrow street/);
    // R8's footnote-3 row (outside MIH areas, UAP or senior housing) adds a qualifying option only.
    expect(R8.height.options.standard.map((o: any) => o.max_height_ft)).toEqual([115, 135]);
    expect(R8.height.options.qualifying.map((o: any) => o.max_height_ft)).toEqual([145, 145, 175]);
    expect(R10A.height.options.standard.map((o: any) => [o.min_base_ft, o.max_height_ft])).toEqual([[125, 215], [60, 185]]);
  });
});

const DC = ZS.jurisdictions.find((j: any) => j.id === "dc");

describe("zoning_standards.json: Washington, DC", () => {
  it("covers the four base R zones, with the zone read from DC's zoning map at the point", () => {
    expect(DC.counties).toEqual(["11001"]);
    expect(Object.keys(DC.districts).sort()).toEqual(["R-1A", "R-1B", "R-2", "R-3"]);
    expect(DC.zone_source).toMatchObject({ kind: "point_layer", field: "ZONING", attr: "ZoningDC", lot_area_field: "LANDAREA" });
    expect(DC.zone_source.url).toMatch(/^https:\/\/maps2\.dcgis\.dc\.gov\/.*Planning_Landuse_and_Zoning_WebMercator\/MapServer\/32$/);
    expect(DC.overlay_rule.quote).toContain("Geographically modified zones are indicated by letters following the base zone name");
  });

  it("every rule cites its 11 DCMR section page and the text file it was read from", () => {
    for (const [z, r] of Object.entries<any>(DC.districts))
      for (const x of [r.purpose, r.dwelling_units, r.height, ...r.min_lot, ...r.lot_occupancy]) {
        expect(x.url, z).toMatch(/^https:\/\/www\.dcregs\.dc\.gov\/Common\/DCMR\/SectionList\.aspx\?SectionNumber=11-[DU]\d{3}$/);
        expect(x.text_file, z).toMatch(/^https:\/\/dcregs\.dc\.gov\/Common\/DCMR\/RuleList\.aspx\?DownloadFile=\{[0-9A-F-]+\}$/);
      }
  });

  it("each number appears in the table row it was parsed from", () => {
    for (const [z, r] of Object.entries<any>(DC.districts)) {
      for (const m of r.min_lot) expect(m.row, z).toContain(`${m.structure} | ${m.width_ft} | ${fmt(m.area_sqft)}`);
      expect(r.height.row, z).toContain(`| ${r.height.max_height_ft} | ${r.height.max_stories}`);
      for (const o of r.lot_occupancy) expect(o.row, z).toContain(`${o.structure} | ${o.max_pct}`);
      expect(r.dwelling_units.quote).toContain("one (1) principal dwelling unit and one (1) accessory apartment shall be permitted per lot of record");
    }
    for (const [z, g] of Object.entries<any>(DC.accessory_apartment.min_gfa)) expect(g.row, z).toContain(`${fmt(g.sqft)} sq. ft.`);
    expect(DC.accessory_apartment.quotes.share).toContain(`(${DC.accessory_apartment.max_share_pct}%)`);
    expect(DC.accessory_apartment.quotes.persons).toContain("shall not exceed three (3)");
  });

  it("matches 11 DCMR as published on dcregs.dc.gov on 16 Nov 2026 (spot checks)", () => {
    // Table D § 202.1 (as amended 10 Jul 2026), Table D § 203.2, Table D § 210.1, Table U § 253.7(a).
    expect(DC.districts["R-1A"].min_lot).toEqual([expect.objectContaining({ structure: "All Structures", width_ft: 75, area_sqft: 7500 })]);
    expect(DC.districts["R-1B"].min_lot).toEqual([expect.objectContaining({ structure: "All Structures", width_ft: 50, area_sqft: 5000 })]);
    expect(DC.districts["R-3"].min_lot.map((x: any) => [x.structure, x.width_ft, x.area_sqft])).toEqual([["Row", 20, 2000], ["Semi-detached", 30, 3000], ["All Other Structures", 40, 4000]]);
    for (const z of ["R-1A", "R-1B", "R-2", "R-3"]) expect(DC.districts[z].height).toMatchObject({ max_height_ft: 40, max_stories: 3 });
    expect(DC.districts["R-3"].lot_occupancy.find((x: any) => x.structure === "Single Household Row Building").max_pct).toBe(60);
    expect(DC.districts["R-2"].lot_occupancy.find((x: any) => x.structure === "All Other Structures").max_pct).toBe(40);
    expect(DC.accessory_apartment.min_gfa).toEqual({ "R-1A": expect.objectContaining({ sqft: 2000 }), "R-1B": expect.objectContaining({ sqft: 2000 }), "R-2": expect.objectContaining({ sqft: 1200 }) });
    expect(DC.accessory_apartment.max_share_pct).toBe(35);
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

  it("DC use codes come from OTR's own USECODE table, with the building form", () => {
    const s = USES.systems.find((x: any) => x.id === "dc_otr_usecode");
    expect(s.counties).toEqual(["11001"]);
    expect(s.field).toBe("USECODE");
    expect(s.source.url).toMatch(/Property_and_Land_WebMercator\/MapServer\/54$/);
    expect(s.codes["012"]).toEqual({ label: "Residential-Detached-Single-Family", type: "residential", form: "single-family" });
    expect(s.codes["011"].form).toBe("single-family");
    expect(s.codes["016"]).toMatchObject({ type: "residential", form: "unit" });            // condominium unit
    expect(s.codes["023"]).toMatchObject({ type: "residential", form: "small-multi" });     // flats, fewer than 5
    expect(s.codes["022"]).toMatchObject({ type: "residential", form: "multi-family" });    // elevator apartment building
    expect(s.codes["014"].type).toBe("non-residential");                                     // garage, no living quarters
    expect(s.codes["003"].type).toBe("non-residential");                                     // transient (hotel-type)
    expect(s.codes["081"].type).toBe("non-residential");                                     // religious
    expect(s.codes["091"].type).toBe("vacant");
    expect(s.codes["000"].type).toBe("unknown");
    expect(s.codes["995"].type).toBe("unknown");
  });

  it("Nashville uses are the Assessor's LUDesc labels, typed by label (the same label has urban and rural codes)", () => {
    const s = USES.systems.find((x: any) => x.id === "nashville_ludesc");
    expect(s.counties).toEqual(["47037"]);
    expect(s.field).toBe("LUDesc");
    expect(s.source.name).toContain("General Land Use assigned by the Assessor of Property");
    expect(s.codes["SINGLE FAMILY"]).toMatchObject({ type: "residential", form: "single-family" });
    expect(s.codes["SINGLE FAMILY"].codes).toEqual(expect.arrayContaining(["011", "081"]));
    expect(s.codes["DUPLEX"]).toMatchObject({ type: "residential", form: "small-multi" });
    expect(s.codes["RESIDENTIAL CONDO"]).toMatchObject({ type: "residential", form: "unit" });
    expect(s.codes["VACANT RESIDENTIAL LAND"].type).toBe("vacant");
    expect(s.codes["CHURCH"].type).toBe("non-residential");
    expect(s.codes["PARSONAGE"].type).toBe("unknown");
    for (const [k, v] of Object.entries<any>(s.codes)) expect(v.label, k).toBe(k.replace(/\s+/g, " "));
  });
});
