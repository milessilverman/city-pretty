import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
// @ts-ignore plain CommonJS module
import P from "../../src/engines/projectCardEngine.js";
// @ts-ignore plain CommonJS module
import SS from "../../src/engines/stationSites.js";

// Station-site zoning (app/data/site_zoning, pipeline/site_zoning_build.py, docs/audit/site-zoning-2026-11-23.md): the
// site's zone and the city's code row reach the card engine as parcel facts; a multifamily or mixed-use course is sized
// from the code's own density times the mapped lot, and costed with the county's permit value per home. Every withheld
// path says why.
const root = path.resolve(__dirname, "../..");
const j = (f: string) => JSON.parse(fs.readFileSync(path.join(root, "app/data", f), "utf8"));
const costs = j("building_costs.json").rows;
const ctx: any = { laws: j("statutes.json"), buildingCosts: costs, fundingRules: j("housing_funding_rules.json"), incomeLimits: j("hud_income_limits.json"), fmr: j("hud_fair_market_rents.json"),
  transitEffects: j("transit_value_effects.json"), corridors: j("intercity_transit_corridors.json"), qctDda: j("hud_qct_dda.json"), mtspLimits: j("hud_mtsp_income_limits.json") };
const ZI = j("site_zoning/index.json");
// the tables with their shared quotes put back in place (StationSites.resolveRefs, as the page reads them)
const table = (k: string) => { const T = j(`site_zoning/codes/${k}.json`); return Object.assign({}, T, { codes: SS.resolveRefs(T.codes, T.quotes) }); };
const SD = table("san_diego"), NYC = table("nyc"), LA = table("los_angeles");
const permit = (fips: string) => costs.filter((r: any) => r.source_key === "census_bps_county" && r.county_fips === fips && r.measure === "cost_per_unit" && r.display_allowed === true).map((r: any) => r.value);

const CAT: any = { "single-family": "single-family", multifamily: "multifamily", commercial: "commercial", "mixed-use": "commercial / mixed use" };
function site(zone: string, T: any, over: any = {}, key?: string) {
  const row = T.codes[key || zone];
  const zl = SS.limitsOf(row, T, zone, { kind: "point", url: "https://example.test/zoning", asked: "2026-11-22" });
  const fips = over.countyFips || "06073", st = over.stateCode || "CA";
  return { kind: "site", id: "ss:fx", name: "Fixture site (test input)", siteKind: "Surface parking lot", countyFips: fips, stateCode: st, city: "Fixture",
    acres: { value: over.acres ?? 2, source: "https://www.openstreetmap.org/way/1" }, nearStops: [], railStationMi: over.railStationMi ?? 0.3, parcelRatio: over.parcelRatio ?? null,
    parcel: { parcel_id: "fx", state_code: st, county_fips: fips, base_zoning_code: zone, municipality_name: "Fixture", exclusions: {}, lot_sqft: (over.acres ?? 2) * 43560,
      is_commercial_or_mixed_use: /commercial/.test(CAT[row.category] || ""), is_single_family_residential: row.category === "single-family", is_multifamily_residential: row.category === "multifamily", zoning_limits: zl } };
}
const course = (card: any, id: string) => card.courses.find((c: any) => c.course === id && !c.affordable);
const skipped = (card: any, id: string) => card.notAssessed.find((n: any) => n.id === id);

describe("the code tables: every value carries its quote, and the number is in the quote", () => {
  it("each table names its city, code and categories", () => {
    for (const [jur, c] of Object.entries<any>(ZI.cities)) {
      const T = table(c.key);
      expect(T.jurisdiction).toBe(jur);
      expect(T.categories).toContain("mixed-use");
    }
  });
  it("San Diego lot area per home: the figure is the one the code's sentence states", () => {
    let n = 0;
    for (const r of Object.values<any>(SD.codes)) {
      if (r.density && r.density.method === "lot_area_per_home") {
        n++;
        expect(r.density.rule.quote).toContain(`1 dwelling unit for each ${r.density.sqftPerHome.toLocaleString("en-US")} square feet of lot area`);
        expect(r.density.rule.quote).toContain(r.zone);
        expect(r.density.rule.url).toMatch(/^https:\/\/docs\.sandiego\.gov\/municode\/MuniCodeChapter13\/Ch13Art01Division0[45]\.pdf$/);
        expect(r.housing.permitted).toBe(true);
      }
    }
    expect(n).toBeGreaterThan(5);
  });
  it("New York: homes = floor area / the dwelling-unit factor the Zoning Resolution states", () => {
    const rows = Object.values<any>(NYC.codes).filter((r: any) => r.density && r.density.method === "floor_area_over_factor");
    expect(rows.length).toBeGreaterThan(5);
    for (const r of rows) {
      expect(r.density.factor.quote).toContain(`the applicable dwelling unit factor shall be ${r.density.duFactor}`);
      expect(r.density.factor.url).toBe("https://zr.planning.nyc.gov/article-ii/chapter-3/23-52");
      expect(r.far.low).toBeLessThanOrEqual(r.far.high);
      for (const x of r.far.rows) expect(x).toMatch(/\d\.\d\d/);
    }
  });
  it("a row either states its rules with sources or says why they are not determined", () => {
    for (const T of [SD, NYC, LA]) for (const r of Object.values<any>(T.codes)) {
      if (r.notDetermined) { expect(r.density && r.density.method).toBeFalsy(); continue; }
      expect(r.housing).toBeTruthy();
      if (r.housing.permitted === true || r.housing.permitted === false) expect(String(r.housing.quote || "").length, r.zone).toBeGreaterThan(20);
      else expect(r.housing.why, r.zone).toBeTruthy();
      expect(r.density && (r.density.method || r.density.why), r.zone).toBeTruthy();
    }
  });
  it("Los Angeles: the category is the City's own map category; housing and density are withheld with the host's answer", () => {
    for (const r of Object.values<any>(LA.codes)) {
      expect(r.categorySource.field).toBe("CATEGORY");
      expect(r.categoryBasis).toContain(r.categorySource.value);
      expect(r.housing.permitted).toBeNull();
      expect(r.housing.why).toMatch(/HTTP 403/);
      expect(r.density.method).toBeUndefined();
    }
  });
  it("Austin: no code table, with the URLs tried", () => {
    const A = table("austin");
    expect(Object.keys(A.codes)).toEqual([]);
    expect(A.notOnFile.tried.map((t: any) => t.url)).toContain("https://library.municode.com/tx/austin/codes/land_development_code");
  });
});

describe("a site's zoning reaches the building courses", () => {
  const zoneWith = (sqft: number) => Object.values<any>(SD.codes).find((r: any) => r.density && r.density.sqftPerHome === sqft && r.category === "mixed-use");
  it("mixed-use with a stated density: homes = lot area / sq ft per home, cost = homes x the county permit value", () => {
    const r = zoneWith(1000) || Object.values<any>(SD.codes).find((x: any) => x.density && x.density.sqftPerHome);
    const card = P.buildProjectCard(site(r.zone, SD, { acres: 2 }), ctx);
    const c = course(card, "small_multifamily");
    // §113.0222(a)(1): a quotient that exceeds a whole number by 0.50 or more rounds up
    const q = 2 * 43560 / r.density.sqftPerHome, homes = q - Math.floor(q) >= 0.5 ? Math.floor(q) + 1 : Math.floor(q);
    expect(r.density.roundUpFrom).toBe(0.5);
    expect(r.density.rounding.quote).toContain("exceeds a whole number by 0.50 or more");
    expect(c.legal.basis).toBe("zoning on file");
    expect(c.size.units.low.value).toBe(homes);
    expect(c.size.units.basis).toBe("modelled");
    const v = permit("06073");
    expect(c.cost.low.value).toBeCloseTo(Math.min(...v) * homes, 6);
    expect(c.cost.high.value).toBeCloseTo(Math.max(...v) * homes, 6);
    expect(c.cost.label).toBe("declared permit valuations, structure only");
    expect(c.inputs.some((i: any) => /^Density the zoning allows/.test(i.name) && i.value === r.density.sqftPerHome && i.note.includes(r.density.rule.quote))).toBe(true);
    expect(c.inputs.some((i: any) => i.name === "Site area used for sizing" && i.value === 2 && /OpenStreetMap/.test(i.note))).toBe(true);
    expect(c.risks.some((t: string) => /commercial building on the lot/.test(t))).toBe(true);
  });
  it("the mapped lot is used when the parcel is much larger, and the card says so", () => {
    const r = Object.values<any>(SD.codes).find((x: any) => x.density && x.density.sqftPerHome)!;
    const c = course(P.buildProjectCard(site(r.zone, SD, { parcelRatio: 14.16 }), ctx), "small_multifamily");
    expect(c.inputs.find((i: any) => i.name === "Site area used for sizing").note).toMatch(/the county parcel is 14.16 times this area, so its area is not used/);
  });
  it("New York: a range of floor-area ratios gives a range of homes, with the three-quarters rule", () => {
    const r = Object.values<any>(NYC.codes).find((x: any) => x.density && x.density.method && x.far.low !== x.far.high) || Object.values<any>(NYC.codes).find((x: any) => x.density && x.density.method);
    const acres = 1.3;
    const card = P.buildProjectCard(site(r.zone, NYC, { acres, countyFips: "36047", stateCode: "NY" }), ctx);
    const c = course(card, "small_multifamily");
    const at = (far: number) => { const x = far * acres * 43560 / r.density.duFactor, f = Math.floor(x); return x - f >= 0.75 ? f + 1 : f; };
    expect(c.size.units.low.value).toBe(at(r.far.low));
    expect(c.size.units.high.value).toBe(at(r.far.high));
    expect(c.size.sqft.low.value).toBe(Math.floor(r.far.low * acres * 43560));
    const v = permit("36047");
    expect(c.cost.low.value).toBeCloseTo(Math.min(...v) * at(r.far.low), 6);
    expect(c.cost.high.value).toBeCloseTo(Math.max(...v) * at(r.far.high), 6);
  });
  it("San Diego's own worked example (§113.0222(a)(3)): 1.5 acres at 1 home per 2,000 sq ft is 33 homes", () => {
    const T = { city: "Fixture", code: "fixture", codes: { X: { zone: "X", category: "multifamily", housing: { permitted: true, quote: "q".repeat(30), section: "s", url: "https://example.test" },
      density: { method: "lot_area_per_home", sqftPerHome: 2000, roundUpFrom: 0.5, rule: { quote: "permits a maximum density of 1 dwelling unit for each 2,000 square feet of lot area", section: "s", url: "https://example.test" } } } } };
    expect(course(P.buildProjectCard(site("X", T, { acres: 1.5 }), ctx), "small_multifamily").size.units.low.value).toBe(33);
    expect(course(P.buildProjectCard(site("X", T, { acres: 2000 * 32.49 / 43560 }), ctx), "small_multifamily").size.units.low.value).toBe(32);
  });
  it("the three-quarters rule rounds 0.75 up and 0.74 down", () => {
    const T = { city: "Fixture", code: "fixture", codes: { X: { zone: "X", category: "multifamily", housing: { permitted: true, quote: "q".repeat(30), section: "s", url: "https://example.test" },
      density: { method: "floor_area_over_factor", duFactor: 100, roundUpFrom: 0.75, factor: { quote: "the applicable dwelling unit factor shall be 100", section: "s", url: "https://example.test" } }, far: { low: 1, high: 1, section: "s", url: "https://example.test" } } } };
    const homes = (acres: number) => course(P.buildProjectCard(site("X", T, { acres }), ctx), "small_multifamily").size.units.low.value;
    expect(homes(10.75 * 100 / 43560)).toBe(11);
    expect(homes(10.74 * 100 / 43560)).toBe(10);
  });
});

describe("withheld paths", () => {
  it("a zone whose code does not permit housing: the multifamily courses are not assessed, with the code's section", () => {
    const r = Object.values<any>(SD.codes).find((x: any) => x.housing && x.housing.permitted === false)!;
    const card = P.buildProjectCard(site(r.zone, SD), ctx);
    const n = skipped(card, "small_multifamily");
    expect(n.missing[0]).toMatch(/code does not permit housing there/);
    expect(n.missing[0]).toContain(r.zone);
  });
  it("a planned or special district: not determined, with the reason", () => {
    const r = Object.values<any>(SD.codes).find((x: any) => x.notDetermined)!;
    const n = skipped(P.buildProjectCard(site(r.zone, SD), ctx), "small_multifamily");
    expect(n.missing[0]).toContain("not determined");
    expect(n.missing[0]).toContain(r.notDetermined);
  });
  it("a mixed-use zone with no density in the code (FAR only): assessed, homes withheld, floor area shown, no cost", () => {
    const r = SD.codes["RMX-2"] || Object.values<any>(SD.codes).find((x: any) => x.category === "mixed-use" && x.housing.permitted === true && !x.density.method);
    if (!r) return;
    const c = course(P.buildProjectCard(site(r.zone, SD), ctx), "small_multifamily");
    expect(c.size.units).toBeNull();
    expect(c.size.sqft.low.value).toBe(Math.floor(r.far.low * 2 * 43560));
    expect(c.missing.join(" ")).toMatch(/not determined: the RMX and EMX zones set no dwelling units per lot area/);
    expect(c.cost).toBeNull();
    expect(c.costWhy).toMatch(/number of homes is not sized/);
  });
  it("Los Angeles multifamily by the map's category: assessed, density withheld with the host's answer, no cost", () => {
    const r = Object.values<any>(LA.codes).find((x: any) => x.category === "multifamily");
    if (!r) return;
    const c = course(P.buildProjectCard(site(r.zone, LA, { countyFips: "06037" }), ctx), "small_multifamily");
    expect(c.size.units).toBeNull();
    expect(c.missing.join(" ")).toMatch(/HTTP 403/);
    expect(c.cost).toBeNull();
  });
  it("Los Angeles commercial by the map: multifamily not assessed; whether housing is permitted is not on file", () => {
    const r = Object.values<any>(LA.codes).find((x: any) => x.category === "commercial")!;
    const n = skipped(P.buildProjectCard(site(r.zone, LA, { countyFips: "06037" }), ctx), "small_multifamily");
    expect(n.missing[0]).toMatch(/whether City of Los Angeles's code permits housing there is not on file/);
  });
  it("a state law that applies decides over the zoning row (the statute engine is not duplicated)", () => {
    const r = Object.values<any>(SD.codes).find((x: any) => x.density && x.density.sqftPerHome && x.category === "mixed-use")!;
    const law = { id: "fixture_mf_law", state_code: "CA", short_name: "Fixture law", statute_citation: "Fixture 1", statute_url: "https://example.test/law", applies_to_zone: "commercial",
      min_allowed_density_du_per_acre: 50, verification: { status: "verified", unverified_fields: [] }, exclusions_review: { status: "confirmed" }, exclusion_sources: [] };
    const c = course(P.buildProjectCard(site(r.zone, SD), Object.assign({}, ctx, { laws: [law] })), "small_multifamily");
    expect(c.legal.basis).toBe("statute");
    expect(c.size.units.low.value).toBe(100);
  });
  it("no zoning attached: the course stays not assessed for want of the zoning code", () => {
    const s: any = site("RS-1-7", SD);
    s.parcel.base_zoning_code = null; s.parcel.zoning_limits = null;
    expect(skipped(P.buildProjectCard(s, ctx), "small_multifamily").missing[0]).toBe("the zoning code is not on file for this site");
  });
});

describe("attaching the files to the sites", () => {
  it("every county file's sites map to a site in the station-site file, and the code row is found by its key", () => {
    for (const fips of ZI.counties) {
      const doc = j(`site_zoning/${fips}.json`), list = SS.normalize(j(`station_sites/${fips}.json`));
      const tables: any = Object.fromEntries(Object.values<any>(ZI.cities).map((c: any) => [c.key, table(c.key)]));
      SS.attachZoning(list, doc, tables, ZI);
      expect(list.filter((s: any) => s.zoning).length, fips).toBe(Object.keys(doc.sites).length);
      for (const s of list) if (s.zoning && s.zoning.zone && s.zoning.table && !s.zoning.tableWhy) expect(s.zoning.row, s.id).toBeTruthy();
      for (const s of list) if (s.zoningLimits) expect(s.baseZoning).toBe(s.zoning.zone);
    }
  });
  it("a site with no table says why; the fact row shows the zone and where it was read", () => {
    const fips = "48453", doc = j(`site_zoning/${fips}.json`), list = SS.normalize(j(`station_sites/${fips}.json`));
    SS.attachZoning(list, doc, { austin: table("austin") }, ZI);
    const s = list.find((x: any) => x.zoning && x.zoning.zone)!;
    expect(s.zoning.row).toBeNull();
    expect(s.zoning.tableWhy).toMatch(/code text could not be fetched|no row/);
    const f = SS.facts(s).find((r: any) => r[0] === "Zoning");
    expect(f[1]).toContain(s.zoning.zone);
    expect(f[1]).toContain("maps.austintexas.gov");
    expect(s.cityName).toBe("Austin");
    // the card then says the rules are not determined and why, with the first URL tried
    expect(s.zoningLimits.category).toBeNull();
    expect(s.zoningLimits.notDetermined).toMatch(/could not be fetched \(library\.municode\.com: HTTP 403/);
    expect(s.zoningLimits.notDeterminedSource.url).toBe("https://library.municode.com/tx/austin/codes/land_development_code");
    const card = P.buildProjectCard({ kind: "site", id: s.id, name: s.name, countyFips: fips, stateCode: "TX", acres: { value: s.acres, source: s.sourceUrl }, nearStops: [],
      parcel: { parcel_id: s.id, state_code: "TX", county_fips: fips, base_zoning_code: s.baseZoning, municipality_name: s.cityName, exclusions: {}, zoning_limits: s.zoningLimits } }, ctx);
    expect(skipped(card, "small_multifamily").missing[0]).toContain("has rules that are not determined: the city's code text could not be fetched");
  });
});

describe("the advisor form stays within its caps with zoned cards", () => {
  it("6,000 and 2,500 characters", () => {
    const r = Object.values<any>(SD.codes).find((x: any) => x.density && x.density.sqftPerHome)!;
    const cards = Array.from({ length: 12 }, () => P.buildProjectCard(site(r.zone, SD), ctx));
    for (const cap of [6000, 2500]) expect(JSON.stringify(P.cardsForAdvisor(cards, cap)).length).toBeLessThanOrEqual(cap);
  });
});
