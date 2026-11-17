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
      if (r.tier === "R6-R12" || r.commercial) continue;   // checked in the R6-R12 and commercial blocks below
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

describe("zoning_standards.json: New York City R6-R12", () => {
  const HIGH = Object.entries<any>(NYC.districts).filter(([, r]) => r.tier === "R6-R12" && !r.commercial);
  const val = (row: string) => row.split(" | ");

  it("covers every R6-R12 district the ZR 23-22 and 23-432 tables list, and nothing else in that range", () => {
    expect(HIGH.map(([d]) => d).sort()).toEqual(["R10", "R10A", "R10X", "R11", "R11A", "R12", "R6", "R6-1", "R6-2", "R6A", "R6B", "R6D", "R7-1", "R7-2", "R7-3", "R7A", "R7B", "R7D", "R7X",
      "R8", "R8A", "R8B", "R8X", "R9", "R9-1", "R9A", "R9D", "R9X"].sort());
    expect(NYC.not_covered).toMatch(/^Manufacturing \(M\), mixed-use \(MX\) and special purpose district/);
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
    // R11 and R12 (23-22: 12.00 / 15.00 and 15.00 / 18.00; 23-432: R11 60/155/255, R12 60/155/325).
    const R11 = NYC.districts["R11"], R11A = NYC.districts["R11A"], R12 = NYC.districts["R12"];
    expect(R11.far.options.standard.map((o: any) => o.far)).toEqual([12.0]);
    expect(R11.far.options.qualifying.map((o: any) => o.far)).toEqual([15.0]);
    expect(R12.far.options.standard.map((o: any) => o.far)).toEqual([15.0]);
    expect(R12.height.options.standard.map((o: any) => [o.min_base_ft, o.max_base_ft, o.max_height_ft])).toEqual([[60, 155, 325]]);
    expect(R11.height.options.standard.map((o: any) => [o.min_base_ft, o.max_base_ft, o.max_height_ft])).toEqual([[60, 155, 255]]);
    // 23-22 lists R11 only; R11A takes R11's row under ZR 11-25, and says so.
    expect(R11A.far.options.standard[0].row).toBe("R11 | 12.00 | 15.00");
    expect(R11A.far.options.standard[0].via_11_25).toMatch(/ZR 23-22 lists R11 and not R11A; ZR 11-25/);
    expect(R11A.height.options.standard.map((o: any) => o.min_base_ft)).toEqual([125, 60]);
  });
});

describe("zoning_standards.json: New York City commercial districts", () => {
  const COMM = Object.entries<any>(NYC.districts).filter(([, r]) => r.commercial);

  it("each district's residential equivalent is the one ZR 34-112's row names (or 34-03 for C3A), and its bulk is that district's", () => {
    expect(COMM.length).toBeGreaterThan(50);
    for (const [d, r] of COMM) {
      const C = r.commercial, eq = NYC.districts[C.equivalent];
      expect(C.district, d).toBe(d);
      expect(eq && !eq.commercial, d).toBe(true);
      if (d === "C3A") {
        expect(C.equivalent).toBe("R3A");
        expect(C.how.quote).toContain("In C3A Districts, the bulk regulations of this Chapter shall not apply. In lieu thereof, the bulk regulations for R3A Districts");
      } else {
        const row = C.how.quote.split("table: ")[1];
        const [cells, eqCell] = row.split(" (")[0].split(" | ");
        expect(eqCell, d).toBe(C.equivalent);
        const listed = cells.split(" ");
        if (C.how.section === "34-112") expect(listed, d).toContain(d);
        else {
          expect(C.how.section, d).toBe("34-112, 11-25");
          expect(listed.some((t: string) => d.startsWith(t) && /^-\d$/.test(d.slice(t.length))), d).toBe(true);
        }
      }
      expect(r.min_lot, d).toEqual(eq.min_lot);
      expect(r.far, d).toEqual(eq.far);
      if (r.height.withheld) expect(r.height.section, d).toBe("35-62");
      else expect({ ...r.height, commercial_note: undefined }, d).toEqual({ ...eq.height, commercial_note: undefined });
      expect(C.residential_only.quote).toMatch(/^The bulk regulations of this Chapter apply to any zoning lot containing only residential buildings/);
      expect(r.housing_types.url, d).toMatch(/\/article-iii\/chapter-2\/32-12[12]$/);
    }
  });

  it("matches ZR 34-112, 32-121 and 35-62 for spot-checked districts (as published 17 Nov 2026)", () => {
    const eqOf = (d: string) => NYC.districts[d].commercial.equivalent;
    expect(eqOf("C3")).toBe("R3-2");
    expect(eqOf("C4-1")).toBe("R5");
    expect(eqOf("C4-4")).toBe("R7-2");
    expect(eqOf("C4-4D")).toBe("R8A");
    expect(eqOf("C6-2A")).toBe("R8A");
    expect(eqOf("C1-8X")).toBe("R9X");
    expect(eqOf("C6-4X")).toBe("R10X");
    expect(eqOf("C6-11")).toBe("R11");
    expect(eqOf("C6-12")).toBe("R12");
    // "C5" in the R10 row covers C5-3 (ZR 11-25); C5-1A and C5-2A have their own R10A row.
    expect(eqOf("C5-3")).toBe("R10");
    expect(NYC.districts["C5-3"].commercial.how.section).toBe("34-112, 11-25");
    expect(eqOf("C5-2A")).toBe("R10A");
    // R1-R5 equivalents: 35-62 changes heights for non-qualifying sites, so none is shown; C3A uses R3A's (34-03).
    expect(NYC.districts["C3"].height.withheld).toBe(true);
    expect(NYC.districts["C4-1"].height.quote).toContain("located within R3 and R4 Districts, the height and setback regulations for R4 Districts without a letter or number suffix shall apply");
    expect(NYC.districts["C3A"].height.max_height_ft).toBe(NYC.districts["R3A"].height.max_height_ft);
    // 32-121: every residence type in C1, C2, C4, C5, C6; C3A only detached or zero lot line (32-122); C4-1's Staten Island condition (32-123).
    expect(NYC.districts["C6-2"].housing_types.limited_to).toBeNull();
    expect(NYC.districts["C6-2"].housing_types.quote).toContain("C6 column: Single-family residence Detached: ●");
    expect(NYC.districts["C3A"].housing_types.limited_to).toBe("single- or two-family detached or zero lot line residences");
    expect(NYC.districts["C4-1"].housing_types.condition).toMatch(/^In C4 Districts, all residential uses shall be permitted except that in lower density growth management areas within the Borough of Staten Island/);
  });

  it("C7 and C8 have no residences; designations 34-112 doesn't name are withheld with the reason", () => {
    for (const z of ["C7", "C8-1", "C8-4"]) {
      expect(NYC.no_residences[z].section, z).toBe("32-121");
      expect(NYC.no_residences[z].quote, z).toMatch(new RegExp(`${z.slice(0, 2)} column: Single-family residence Detached: –`));
      expect(NYC.districts[z], z).toBeUndefined();
    }
    for (const z of ["C6-4.5", "C6-1G", "C6-2M", "C5-P", "C6-7T"]) {
      expect(NYC.commercial_withheld[z], z).toMatch(/^ZR 34-112's table doesn't list/);
      expect(NYC.districts[z], z).toBeUndefined();
    }
  });

  it("C1/C2 overlays: R1 and R2 lots take R3-2's bulk within the overlay (34-111); R3/R4 non-qualifying sites take R4 heights (35-62)", () => {
    const O = NYC.commercial_overlay;
    expect(O.districts).toEqual(["C1-1", "C1-2", "C1-3", "C1-4", "C1-5", "C2-1", "C2-2", "C2-3", "C2-4", "C2-5"]);
    expect(O.quote).toContain("on non-qualifying residential sites, where such districts are mapped within R1 or R2 Districts, the bulk regulations for R3-2 Districts shall apply");
    expect(O.within["R2"].bulk_from).toBe("R3-2");
    expect(O.within["R1-2A"].bulk_from).toBe("R3-2");
    expect(O.within["R4B"]).toMatchObject({ bulk_from: "R4B", height_from_non_qrs: "R4" });
    expect(O.within["R5B"]).toMatchObject({ bulk_from: "R5B", height_from_non_qrs: "R5" });
    expect(O.within["R6A"]).toMatchObject({ bulk_from: "R6A" });
    expect(O.within["R6A"].height_from_non_qrs).toBeUndefined();
    expect(NYC.zone_source.extra_fields.fields).toEqual(["Overlay1", "Overlay2", "SPDist1", "SPDist2", "LotFront"]);
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

  it("San Diego: the Assessor's NUCLEUS_USE_CD list is read from the SanGIS parcel metadata, typed by the Assessor's group heading", () => {
    const s = USES.systems.find((x: any) => x.id === "sandiego_nucleus_use");
    expect(s.counties).toEqual(["06073"]);
    expect(s.field).toBe("nucleus_use_cd");
    expect(s.source.url).toBe("https://geo.sandag.org/server/rest/services/Hosted/Parcels/FeatureServer/0/metadata");
    expect(s.codes["111"]).toEqual({ label: "SINGLE FAMILY RESIDENCE", group: "RESIDENTIAL", type: "residential", form: "single-family" });
    expect(s.codes["120"]).toMatchObject({ label: "DUPLEX - GENERIC", form: "small-multi" });
    expect(s.codes["171"]).toMatchObject({ group: "CONDOMINIUMS", form: "unit" });
    expect(s.codes["210"].type).toBe("non-residential");
    expect(s.codes["000"].type).toBe("unknown");
    expect(Object.keys(s.codes).length).toBeGreaterThanOrEqual(200);
  });
});

const SD = ZS.jurisdictions.find((j: any) => j.id === "sd");
describe("zoning_standards.json: City of San Diego (SDMC Chapter 13, RS zones)", () => {
  it("covers RS-1-1 to RS-1-14 in San Diego County, read from the City's Official Zoning Map at the point", () => {
    expect(SD.counties).toEqual(["06073"]);
    expect(SD.zone_source.kind).toBe("point_layer");
    expect(SD.zone_source.url).toBe("https://webmaps.sandiego.gov/arcgis/rest/services/DSD/Zoning_Base/MapServer/0");
    expect(SD.zone_source.no_feature_reason).toMatch(/outside the City of San Diego's Official Zoning Map/);
    expect(SD.districts_covered).toEqual(Array.from({ length: 14 }, (_, i) => `RS-1-${i + 1}`));
    expect(Object.keys(SD.districts).sort()).toEqual([...SD.districts_covered].sort());
  });

  it("every number appears in the Table 131-04D row it was parsed from, in the zone's column", () => {
    const col = (z: string) => { const n = +z.split("-")[2]; return n <= 7 ? n - 1 : n - 8; };
    const cells = (row: string) => row.replace(/^\D*?(?=\d|varies)/, "").match(/\d[\d,]*(?:\.\d+)?(?:\/\d+)?(?:\(\d\))?|varies\s?\(\d\)/g) || [];
    for (const [z, r] of Object.entries<any>(SD.districts)) {
      const i = col(z);
      const [area, width, frontage, corner, depth] = r.min_lot.rows.map((row: string) => cells(row)[i]);
      expect(area.replace(/,/g, ""), `${z} area`).toBe(String(r.min_lot.area_sqft));
      expect(width, `${z} width`).toBe(String(r.min_lot.width_ft));
      expect(frontage, `${z} frontage`).toBe(String(r.min_lot.frontage_ft));
      expect(corner, `${z} corner`).toBe(String(r.min_lot.corner_width_ft));
      expect(depth, `${z} depth`).toBe(String(r.min_lot.depth_ft));
      const sb = r.setbacks.rows.map((row: string) => Number(cells(row)[i].replace(/\(\d\)$/, "")));
      expect(sb, `${z} setbacks`).toEqual([r.setbacks.front_ft, r.setbacks.side_ft, r.setbacks.street_side_ft, r.setbacks.rear_ft]);
      expect(cells(r.density.row)[i], `${z} density`).toBe(String(r.density.du_per_lot));
      const h = cells(r.height.row)[i];
      expect(h, `${z} height`).toBe(r.height.listed || String(r.height.max_height_ft));
      if (r.height.listed) expect(r.height.max_height_ft).toBe(Math.max(...r.height.listed.split("/").map(Number)));
      const f = cells(r.far.row)[i].replace(/\s/g, "");
      if (r.far.standard != null) expect(Number(f), `${z} FAR`).toBe(r.far.standard);
      else expect(f, `${z} FAR`).toBe("varies(5)");
      for (const k of ["purpose", "density", "min_lot", "setbacks", "height", "far"]) expect(r[k].url, `${z} ${k}`).toBe(SD.code_url);
    }
  });

  it("Table 131-04J (FAR by lot area) has contiguous lot-area bands and falling ratios, each from its printed row", () => {
    const J = SD.districts["RS-1-4"].far.by_lot_area;
    expect(J.length).toBe(18);
    for (let k = 1; k < J.length; k++) {
      expect(J[k].min_sqft).toBe(J[k - 1].max_sqft + 1);
      expect(J[k].far).toBeLessThan(J[k - 1].far);
    }
    for (const t of J) expect(t.row.endsWith(t.far.toFixed(2))).toBe(true);
    expect(J[0]).toMatchObject({ min_sqft: 0, max_sqft: 3000, far: 0.7 });
    expect(J[J.length - 1]).toMatchObject({ min_sqft: 19001, max_sqft: null, far: 0.45 });
    for (const z of ["RS-1-2", "RS-1-3", "RS-1-4", "RS-1-5", "RS-1-6", "RS-1-7"]) expect(SD.districts[z].far.standard, z).toBeNull();
    for (const z of ["RS-1-1", "RS-1-8"]) expect(SD.districts[z].far.standard, z).toBe(0.45);
  });

  it("matches the SDMC as published by the City (edition 9-2026) on 17 Nov 2026 (spot checks)", () => {
    expect(SD.as_amended).toMatch(/edition 9-2026/);
    expect(SD.districts["RS-1-7"].min_lot).toMatchObject({ area_sqft: 5000, width_ft: 50, frontage_ft: 50, corner_width_ft: 55, depth_ft: 95 });
    expect(SD.districts["RS-1-7"].setbacks).toMatchObject({ front_ft: 15, side_ft: 4, street_side_ft: 5, rear_ft: 13 });
    expect(SD.districts["RS-1-1"].min_lot.area_sqft).toBe(40000);
    expect(SD.districts["RS-1-14"].height.max_height_ft).toBe(35);
    expect(SD.districts["RS-1-14"].far.garage_excluded.sqft).toBe(400);
    expect(SD.districts["RS-1-4"].height.envelope.quote).toMatch(/^Maximum structure height shall not exceed the height of the angled building envelope plane/);
  });
});
