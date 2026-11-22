import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
// @ts-ignore plain CommonJS module
import P from "../../src/engines/projectCardEngine.js";
// @ts-ignore plain CommonJS module
import SS from "../../src/engines/stationSites.js";

// Site cards' place rows (22 Nov 2026): HUD QCT / DDA status, tax-credit rent ceilings, HUD Fair Market Rents and the
// county's declared permit value per new home. Each test reads the source rows on file and re-derives the figure.
const root = path.resolve(__dirname, "../..");
const j = (f: string) => JSON.parse(fs.readFileSync(path.join(root, "app/data", f), "utf8"));
const costs = j("building_costs.json").rows;
const rules = j("housing_funding_rules.json");
const qd = j("hud_qct_dda.json");
const mtsp = j("hud_mtsp_income_limits.json");
const fmr = j("hud_fair_market_rents.json");
const ctx: any = { laws: j("statutes.json"), buildingCosts: costs, fundingRules: rules, incomeLimits: j("hud_income_limits.json"), fmr,
  transitEffects: j("transit_value_effects.json"), corridors: j("intercity_transit_corridors.json"), qctDda: qd, mtspLimits: mtsp };

const site = (over: any = {}) => ({ kind: "site", id: "ss:fixture", name: "Fixture site (test input)", siteKind: "Surface parking lot", countyFips: "48453", stateCode: "TX",
  acres: { value: 2, source: "https://www.openstreetmap.org/way/1" }, nearStops: [], parcel: { parcel_id: "fx", base_zoning_code: null, exclusions: {} }, ...over });
const pf = (card: any, id: string) => card.placeFacts.find((p: any) => p.id === id);
const tractWith = (y27: number, county?: string) => Object.entries(qd.tracts).find(([t, v]: any) => v[1] === y27 && (!county || t.startsWith(county)))![0];
const zctaWith = (y27: number | null) => Object.entries(qd.zctas).find(([, v]: any) => v[1] === y27)![0];

describe("site cards: HUD qualified census tracts and difficult development areas", () => {
  it("a site in a 2027 QCT: the 130% basis applies, with the statute's own words", () => {
    const tract = tractWith(1, "48453");
    const card = P.buildProjectCard(site({ place: { tract, tractEdgeM: 500, zcta: zctaWith(0), zctaEdgeM: 900, zctaHow: "c" } }), ctx);
    const q = pf(card, "qct_dda");
    expect(q.status).toBe("known");
    expect(q.boost).toBe("applies");
    expect(q.years.map((y: any) => y.year)).toEqual(["2026", "2027"]);
    expect(q.years[1].qct).toBe(true);
    const row = rules.rows.find((r: any) => r.measure === "basis_boost_clause");
    expect(q.rules[0].quote).toBe(row.quote);
    expect(row.quote).toMatch(/130 percent of such basis$/);
    expect(row.verification.status).toBe("quote_matched_in_fetched_text");
    expect(q.years[1].qctUrl).toBe("https://www.huduser.gov/portal/datasets/qct/QCT2027CSV.zip");
    expect(q.effective.quote).toMatch(/^The 2027 lists of QCTs and DDAs are effective/);
  });
  it("a site in neither: no 130% basis by location, and the state-designation clause is quoted", () => {
    const tract = tractWith(0);
    const card = P.buildProjectCard(site({ countyFips: tract.slice(0, 5), place: { tract, tractEdgeM: 500, zcta: zctaWith(0), zctaEdgeM: 900, zctaHow: "c" } }), ctx);
    const q = pf(card, "qct_dda");
    expect(q.boost).toBe("does not apply by location");
    expect(q.rules[0].citation).toBe("26 U.S.C. 42(d)(5)(B)(v)");
  });
  it("a Small DDA ZIP area alone is enough for the 130% basis", () => {
    const tract = tractWith(0);
    const card = P.buildProjectCard(site({ countyFips: tract.slice(0, 5), place: { tract, zcta: zctaWith(1), zctaHow: "c" } }), ctx);
    const q = pf(card, "qct_dda");
    expect(q.years[1].dda).toBe(true);
    expect(q.boost).toBe("applies");
  });
  it("withheld paths: lists not loaded, tract not on file, tract not in the table, ZIP area unknown", () => {
    const tract = tractWith(0);
    expect(pf(P.buildProjectCard(site({ place: { tract } }), { ...ctx, qctDda: undefined }), "qct_dda").why).toMatch(/not loaded/);
    const none = pf(P.buildProjectCard(site(), ctx), "qct_dda");
    expect(none.status).toBe("not on file");
    expect(none.why).toMatch(/census tract of this site is not on file/);
    expect(pf(P.buildProjectCard(site({ place: { tract: "99999999999" } }), ctx), "qct_dda").why).toMatch(/not in the QCT table/);
    const part = pf(P.buildProjectCard(site({ countyFips: tract.slice(0, 5), place: { tract, zcta: null, zctaHow: "u" } }), ctx), "qct_dda");
    expect(part.status).toBe("partly known");
    expect(part.boost).toBeNull();
    expect(part.why).toMatch(/could not be determined/);
  });
  it("cautions: a point near a tract edge, a ZIP area read from the full outline, a site over a county line", () => {
    const tract = tractWith(1, "36081");
    const q = pf(P.buildProjectCard(site({ countyFips: "36047", stateCode: "NY", place: { tract, tractEdgeM: 12, zcta: zctaWith(0), zctaHow: "t" } }), ctx), "qct_dda");
    expect(q.cautions.join(" ")).toMatch(/12 m from the edge/);
    expect(q.cautions.join(" ")).toMatch(/TIGERweb/);
    expect(q.cautions.join(" ")).toMatch(/lies in county 36081, not in county 36047/);
  });
  it("the LIHTC entry of an affordable course states the location rule instead of 'HUD's list download was not read'", () => {
    const tract = tractWith(1, "48453");
    const zc = (_p: any) => ({ applicable_statutes: [{ id: "fixture_mf", name: "Fixture law", citation: "Fixture law (test input)", min_allowed_density_du_per_acre: 30 }], not_confirmed: [], excluded_by_statute: [] });
    const card = P.buildProjectCard(site({ railStationMi: 0.2, place: { tract, zcta: zctaWith(0), zctaHow: "c" }, parcel: { parcel_id: "fx", base_zoning_code: "FX", is_multifamily_residential: true, exclusions: {}, lot_sqft: 87120 } }), { ...ctx, zoningEngine: zc, laws: [{ id: "fixture_mf", min_allowed_density_du_per_acre: 30 }] });
    const aff = card.courses.find((x: any) => x.course === "small_multifamily" && x.affordable);
    const l = aff.publicMoney.find((p: any) => /Low-Income Housing Tax Credit/.test(p.programme));
    expect(l.why.join(" ")).not.toMatch(/download was not read/);
    expect(l.locationRule.boost).toBe("applies");
    expect(l.locationRule.text).toMatch(/2027 qualified census tract/);
  });
});

describe("site cards: declared permit value per new home (Census Building Permits Survey)", () => {
  const bps = (f: string) => costs.filter((r: any) => r.source_key === "census_bps_county" && r.county_fips === f);
  it("every row re-derives from its own file line: value = reported 5+ unit valuation / units", () => {
    expect(bps("48453").length).toBe(3);
    for (const r of costs.filter((x: any) => x.source_key === "census_bps_county")) {
      const f = r.quote.split(",");
      expect(f[1] + f[2]).toBe(r.county_fips);
      expect(+f[28]).toBe(r.homes);
      expect(+f[29]).toBe(r.valuation_total);
      expect(r.value).toBe(Math.round(+f[29] / +f[28]));
      expect(r.display_allowed).toBe(true);
      expect(r.source_url).toBe(`https://www2.census.gov/econ/bps/County/co${r.year}a.txt`);
      expect(r.definition_quote).toMatch(/^Valuation - The valuation is the estimated value of the residential structure/);
    }
  });
  it("the place row is the lowest to highest year, measured, with each year's homes", () => {
    const c = pf(P.buildProjectCard(site(), ctx), "cost");
    const v = bps("48453").map((r: any) => r.value);
    expect(c.range.low.value).toBe(Math.min(...v));
    expect(c.range.high.value).toBe(Math.max(...v));
    expect(c.range.basis).toBe("measured");
    expect(c.rows.map((r: any) => r.homes)).toEqual(bps("48453").map((r: any) => r.homes));
    expect(c.cautions[0]).toMatch(/no land, fees, financing/);
  });
  it("withheld for a county with no rows", () => {
    const c = pf(P.buildProjectCard(site({ countyFips: "01001", stateCode: "AL" }), ctx), "cost");
    expect(c.range).toBeNull();
    expect(c.why).toMatch(/no displayable construction cost per home is on file for county 01001/);
  });
  it("a multifamily course is priced only when its homes are sized: homes x the per-home range, labelled modelled", () => {
    const zc = (_p: any) => ({ applicable_statutes: [{ id: "fixture_mf", name: "Fixture law", citation: "Fixture law (test input)", min_allowed_density_du_per_acre: 30 }], not_confirmed: [], excluded_by_statute: [] });
    const sub = site({ railStationMi: 0.2, parcel: { parcel_id: "fx", base_zoning_code: "FX", is_multifamily_residential: true, exclusions: {}, lot_sqft: 87120 } });
    const card = P.buildProjectCard(sub, { ...ctx, zoningEngine: zc, laws: [{ id: "fixture_mf", min_allowed_density_du_per_acre: 30 }] });
    const mf = card.courses.find((x: any) => x.course === "small_multifamily" && !x.affordable);
    expect(mf.size.units.low.value).toBe(60);   // 2 acres x 30 homes per acre (the fixture law's minimum)
    const v = bps("48453").map((r: any) => r.value);
    expect(mf.cost.low.value).toBe(60 * Math.min(...v));
    expect(mf.cost.high.value).toBe(60 * Math.max(...v));
    expect(mf.cost.basis).toBe("modelled");
    expect(mf.cost.label).toMatch(/structure only/);
    // the same course with its zoning on file but no density: not sized, so no cost, and the reason says so
    const card2 = P.buildProjectCard(sub, ctx);
    const mf2 = card2.courses.find((x: any) => x.course === "small_multifamily" && !x.affordable);
    expect(mf2.cost).toBeNull();
    expect(mf2.costWhy).toMatch(/number of homes is not sized/);
  });
});

describe("site cards: rent ceilings and Fair Market Rents", () => {
  it("60% and 50% ceilings: 0.30 x the HUD MTSP limit for 1 person (studio) and 3 persons (2 bedrooms) / 12", () => {
    const r = mtsp.counties.find((x: any) => x.fips === "48453");
    const card = P.buildProjectCard(site(), ctx);
    const rl = pf(card, "rent_limits");
    expect(rl.range.low.value).toBeCloseTo(r.il60[0] * 0.3 / 12, 9);
    expect(rl.range.high.value).toBeCloseTo(r.il60[2] * 0.3 / 12, 9);
    expect(rl.at50.low.value).toBeCloseTo(r.il50[0] * 0.3 / 12, 9);
    expect(rl.range.basis).toBe("modelled");
    expect(rl.limits).toEqual({ persons: [1, 3], il60: [r.il60[0], r.il60[2]], il50: [r.il50[0], r.il50[2]] });
    expect(rl.formula).toMatch(/1 person with no separate bedroom, 1.5 per bedroom/);
    expect(rl.cautions[0]).toMatch(/limits, not market rents/);
    const hh = rules.rows.find((x: any) => x.measure === "imputed_household_size");
    expect(hh.quote).toMatch(/1\.5 individuals for each separate bedroom/);
  });
  it("the affordable course shows the 60% ceiling and no longer says the 60% limit is missing", () => {
    const zc = (_p: any) => ({ applicable_statutes: [{ id: "fixture_mf", name: "Fixture law", citation: "Fixture law (test input)", min_allowed_density_du_per_acre: 30 }], not_confirmed: [], excluded_by_statute: [] });
    const card = P.buildProjectCard(site({ railStationMi: 0.2, parcel: { parcel_id: "fx", base_zoning_code: "FX", is_multifamily_residential: true, exclusions: {}, lot_sqft: 87120 } }), { ...ctx, zoningEngine: zc, laws: [{ id: "fixture_mf", min_allowed_density_du_per_acre: 30 }] });
    const aff = card.courses.find((x: any) => x.course === "small_multifamily" && x.affordable);
    expect(aff.income.at60.high.value).toBeCloseTo(pf(card, "rent_limits").range.high.value, 9);
    expect(aff.missing.join(" ")).not.toMatch(/60% limit .* not on file/);
  });
  it("withheld for a county HUD sets limits for by town (Suffolk County, MA), with HUD's reason", () => {
    const card = P.buildProjectCard(site({ countyFips: "25025", stateCode: "MA" }), ctx);
    expect(pf(card, "rent_limits").range).toBeNull();
    expect(pf(card, "rent_limits").why).toMatch(/New England/);
    expect(pf(card, "fmr").range).toBeNull();
    expect(P.buildProjectCard(site(), { ...ctx, mtspLimits: undefined }).placeFacts.find((p: any) => p.id === "rent_limits").why).toMatch(/not loaded/);
  });
  it("Fair Market Rents: studio to 3-bedroom from the county record", () => {
    const f = fmr.records.find((x: any) => x.fips === "48453");
    const row = pf(P.buildProjectCard(site(), ctx), "fmr");
    expect(row.range.low.value).toBe(Math.min(f.zero_bed_eff, f.one_bed_1br, f.two_bed_2br, f.three_bed_3br));
    expect(row.range.high.value).toBe(Math.max(f.zero_bed_eff, f.one_bed_1br, f.two_bed_2br, f.three_bed_3br));
    expect(row.label2).toMatch(/not market rents/);
  });
});

describe("site cards: data files, loader and advisor form", () => {
  it("every site's tract is in the QCT table with two 0/1 flags; every ZCTA row has two flags or null", () => {
    let n = 0;
    for (const f of fs.readdirSync(path.join(root, "app/data/station_site_places"))) {
      const d = JSON.parse(fs.readFileSync(path.join(root, "app/data/station_site_places", f), "utf8"));
      expect(fs.existsSync(path.join(root, "app/data/station_sites", f))).toBe(true);
      for (const v of Object.values(d.sites) as any[]) {
        n++;
        if (v[0]) { expect(v[0]).toMatch(/^\d{11}$/); expect(qd.tracts[v[0]].every((x: number) => x === 0 || x === 1)).toBe(true); }
        if (v[2]) { expect(v[2]).toMatch(/^\d{5}$/); expect(qd.zctas[v[2]]).toBeTruthy(); }
        expect(["c", "s", "t", "u"]).toContain(v[4]);
      }
    }
    expect(n).toBe(7098);
    expect(qd._source.qct_files["2027"].url).toBe("https://www.huduser.gov/portal/datasets/qct/QCT2027CSV.zip");
    expect(qd._source.qct_files["2027"].sha256).toMatch(/^[0-9a-f]{64}$/);
  });
  it("the loader attaches each site's tract and ZIP area by its OpenStreetMap id", () => {
    const doc = j("station_sites/48453.json");
    const L = SS.normalize(doc);
    SS.attachPlaces(L, j("station_site_places/48453.json"));
    expect(L.every((s: any) => s.place && /^48453\d{6}$/.test(s.place.tract))).toBe(true);
    expect(SS.placeOf(null)).toBeNull();
  });
  it("cardsForAdvisor stays within its cap with place rows, and keeps them short", () => {
    const doc = j("station_sites/06037.json");
    const L = SS.normalize(doc).slice(0, 12);
    SS.attachPlaces(L, j("station_site_places/06037.json"));
    const cards = L.map((s: any) => P.buildProjectCard(site({ id: s.id, name: s.name, countyFips: "06037", stateCode: "CA", place: s.place }), ctx));
    for (const cap of [800, 2500, 6000]) {
      const a = P.cardsForAdvisor(cards, cap);
      expect(JSON.stringify(a).length).toBeLessThanOrEqual(cap);
    }
    const a = P.cardsForAdvisor(cards, 6000);
    expect(a.cards[0].place.qctDda).toMatch(/^2027: QCT (yes|no), DDA (yes|no|\?); 130% basis /);
    expect(a.cards[0].place.permitValuePerHome.length).toBe(3);
  });
});
