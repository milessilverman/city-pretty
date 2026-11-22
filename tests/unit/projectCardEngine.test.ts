import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
// @ts-ignore plain CommonJS module
import P from "../../src/engines/projectCardEngine.js";
// @ts-ignore plain CommonJS module
import E from "../../src/engines/investmentDecisionEngine.js";
import { DECISION_BRIEF_MAX_CHARS } from "../../src/ai/advisorGroundingContract";

const root = path.resolve(__dirname, "../..");
const j = (f: string) => JSON.parse(fs.readFileSync(path.join(root, "app/data", f), "utf8"));
const costs = j("building_costs.json").rows;
const ctxFull = {
  laws: j("statutes.json"), buildingCosts: costs, fundingRules: j("housing_funding_rules.json"), incomeLimits: j("hud_income_limits.json"),
  fmr: j("hud_fair_market_rents.json"), valuationModels: j("county_valuation_models.json"), valuationBenchmarks: j("valuation_backtest_benchmarks.json"),
  transitEffects: j("transit_value_effects.json"), corridors: j("intercity_transit_corridors.json"),
};
const ctxPublic = { ...ctxFull, buildingCosts: costs.filter((r: any) => r.display_allowed === true) };

const laParcel = (over: any = {}) => ({ parcel_id: "FIXTURE-LA", state_code: "CA", county_fips: "06037", base_zoning_code: "R1-1", is_single_family_residential: true, is_commercial_or_mixed_use: false, is_multifamily_residential: false,
  exclusions: { historic_district_hpoz: false, fema_100yr_floodway: false, calfire_or_state_vhfhsz: false }, lot_sqft: 6000, ...over });
const laLot = (ctx: any = ctxFull, over: any = {}) => P.buildProjectCard({ kind: "lot", id: "lot-la", name: "Fixture lot (test input)", countyFips: "06037", stateCode: "CA", city: "Los Angeles", parcel: laParcel(), ...over }, ctx);

// every { value: number } object outside internal_only must carry a source and a basis tag
function figures(o: any, out: any[] = [], pathS = ""): any[] {
  if (!o || typeof o !== "object") return out;
  if (Array.isArray(o)) { o.forEach((x, i) => figures(x, out, pathS + "[" + i + "]")); return out; }
  for (const [k, v] of Object.entries(o)) {
    if (k === "internal_only") continue;
    if (v && typeof v === "object" && !Array.isArray(v) && "value" in (v as any) && typeof (v as any).value === "number") out.push({ path: pathS + "." + k, fig: v });
    figures(v, out, pathS + "." + k);
  }
  return out;
}
function ranges(o: any, out: any[] = []): any[] {
  if (!o || typeof o !== "object") return out;
  if (Array.isArray(o)) { o.forEach((x) => ranges(x, out)); return out; }
  for (const [k, v] of Object.entries(o)) {
    if (k === "internal_only") continue;
    if (v && typeof v === "object" && (v as any).low && (v as any).high && typeof (v as any).low.value === "number") out.push(v);
    ranges(v, out);
  }
  return out;
}
const publicPart = (card: any) => { const c = { ...card }; delete c.internal_only; return c; };

describe("project card engine: a Los Angeles lot", () => {
  const card = laLot();
  it("prices the ADU course from the Los Angeles permit medians, labelled as declared permit valuations", () => {
    const adu = card.courses.find((c: any) => c.course === "adu");
    expect(adu).toBeTruthy();
    expect(adu.legal.statuteId).toBe("ca_adu_66323");
    const sq = costs.filter((r: any) => r.display_allowed && /^New-construction ADU.*per sq ft$/.test(r.item) && r.year === 2025)[0];
    const pu = costs.filter((r: any) => r.display_allowed && /^New-construction ADU.*per unit$/.test(r.item) && r.year === 2025)[0];
    const size = +String(pu.unit).match(/median size (\d+) sq ft/)![1];
    expect(adu.cost.low.value).toBeCloseTo(sq.range[0] * size, 6);
    expect(adu.cost.high.value).toBeCloseTo(sq.range[1] * size, 6);
    expect(adu.cost.label).toBe("declared permit valuations");
    expect(adu.cost.source).toBe(sq.source_url);
    // income from HUD FMR (studio to 2 bedrooms), labelled as payment standards
    const f = ctxFull.fmr.records.find((r: any) => r.fips === "06037");
    expect(adu.income.perUnitMonthly.low.value).toBe(Math.min(f.zero_bed_eff, f.one_bed_1br, f.two_bed_2br));
    expect(adu.income.perUnitMonthly.high.value).toBe(Math.max(f.zero_bed_eff, f.one_bed_1br, f.two_bed_2br));
    expect(adu.income.label).toMatch(/payment standards/);
    expect(adu.value).toBeNull();
    expect(adu.valueWhy).toMatch(/capitalisation rate/);
  });
  it("lists SB 9 under could not be assessed with the statute engine's reason", () => {
    const n = card.notAssessed.find((x: any) => x.id === "state_law_units");
    expect(n).toBeTruthy();
    expect(n.missing.join(" ")).toMatch(/SB 9.*not been confirmed against the statute text/);
    expect(card.courses.some((c: any) => c.course === "state_law_units")).toBe(false);
  });
  it("outside the City of Los Angeles the ADU course says cost not on file for this place", () => {
    const c = laLot(ctxFull, { city: "Palmdale" });
    const adu = c.courses.find((x: any) => x.course === "adu");
    expect(adu.cost).toBeNull();
    expect(adu.costWhy).toMatch(/^cost not on file for this place/);
    expect(adu.missing.join(" ")).toMatch(/Cost: cost not on file/);
  });
});

describe("honesty checks", () => {
  const cards = [laLot(), laLot(ctxFull, { parcel: laParcel({ base_zoning_code: null }) }),
    P.buildProjectCard({ kind: "neighborhood", id: "120860014011", name: "FL test area", countyFips: "12086", stateCode: "FL", blockGroups: [{ id: "120860014011", hv: 400000 }] }, ctxFull),
    P.buildProjectCard({ kind: "lot", id: "fl-lot", name: "FL commercial lot (test input)", countyFips: "12086", stateCode: "FL", city: "Miami", parcel: { parcel_id: "F", state_code: "FL", county_fips: "12086", base_zoning_code: "CBD", is_commercial_or_mixed_use: true, is_single_family_residential: false, is_multifamily_residential: false, exclusions: {}, lot_sqft: 43560 }, railStationMi: 0.2 }, ctxFull)];
  it("no number without a source and a basis tag", () => {
    for (const c of cards) for (const { path: p, fig } of figures(publicPart(c))) {
      expect(fig.source, p).toBeTruthy();
      expect(["measured", "modelled", "assumed"], p).toContain(fig.basis);
    }
  });
  it("ranges never collapse to a point unless the source is exact", () => {
    for (const c of cards) for (const r of ranges(publicPart(c))) if (r.low.value === r.high.value) expect(r.exact, JSON.stringify(r).slice(0, 200)).toBeTruthy();
  });
  it("a course whose legal basis is not determined never shows a size, cost or income", () => {
    const noZone = cards[1];
    expect(noZone.courses.map((c: any) => c.course)).toEqual(["hold"]);
    for (const n of noZone.notAssessed) {
      expect(n.missing[0]).toMatch(/zoning code is not on file/);
      expect(figures(n)).toEqual([]);
      expect(Object.keys(n).sort()).toEqual(["id", "kind", "label", "missing"]);
    }
  });
  it("rows marked display_allowed: false cannot change anything outside internal_only, nor reach the advisor", () => {
    const full = laLot(ctxFull), pub = laLot(ctxPublic);
    expect(JSON.stringify(publicPart(full))).toBe(JSON.stringify(publicPart(pub)));
    const est = full.internal_only.estimates.find((e: any) => e.computed);
    expect(est).toBeTruthy();   // the internal branch is computed ...
    const adv = JSON.stringify(P.cardsForAdvisor([full]));
    expect(adv).not.toMatch(/internal_only|ICC/);
    for (const v of [est.low, est.high]) expect(adv).not.toContain(String(v));
    const icc = costs.filter((r: any) => r.display_allowed === false && typeof r.value === "number").map((r: any) => String(r.value));
    const pubText = JSON.stringify(publicPart(full));
    for (const v of icc) expect(pubText.includes(`"value":${v},`) || pubText.includes(`"value":${v}}`), v).toBe(false);
    // ... and the decision brief the advisor reads carries only the compact form
    const brief = { schema: "city-pretty/decision-brief@1", county: { fips: "06037" }, neighborhood: null, parcel: null, transit: null, caveats: [], missing: [], sources: [], projectCards: P.cardsForAdvisor([full]) };
    const a = JSON.stringify(E.briefForAdvisor(brief));
    expect(a).toContain("project-cards-for-advisor@1");
    expect(a).not.toMatch(/internal_only/);
  });
});

describe("Florida: a county whose valuation model passed", () => {
  const vm = ctxFull.valuationModels.counties["12086"];
  const bg = Object.keys(vm.stats.bg).find((k) => vm.stats.bg[k][0] >= 5)!;
  it("a neighborhood's hold course is priced from the recorded sales median, as an exact statistic", () => {
    const c = P.buildProjectCard({ kind: "neighborhood", id: bg, name: "FL test area", countyFips: "12086", stateCode: "FL", blockGroups: [{ id: bg, hv: 1 }] }, ctxFull);
    const h = c.courses.find((x: any) => x.course === "hold");
    expect(h.cost.low.value).toBe(vm.stats.bg[bg][1]);
    expect(h.cost.exact).toMatch(/median of recorded sales/);
    expect(h.incomeWhy).toMatch(/research prompt 9/);
  });
  it("an opened lot's hold course uses the back-tested estimate with its price band's tested error", () => {
    const c = P.buildProjectCard({ kind: "lot", id: "fl", name: "FL lot", countyFips: "12086", stateCode: "FL", parcel: { parcel_id: "F", state_code: "FL", county_fips: "12086", base_zoning_code: "RU-1", is_single_family_residential: true, exclusions: {}, lot_sqft: 6000 }, currentValue: { value: 600000, source: "test estimate" } }, ctxFull);
    const h = c.courses.find((x: any) => x.course === "hold");
    const p80 = vm.tested.by_price_band["$500k-$1M"].p80_abs_error;
    expect(h.cost.low.value).toBeCloseTo(600000 * (1 - p80), 6);
    expect(h.cost.high.value).toBeCloseTo(600000 * (1 + p80), 6);
    // Florida has no ADU law on file: the ADU course is not assessed, with that reason
    expect(c.notAssessed.find((x: any) => x.id === "adu").missing[0]).toMatch(/no state ADU law on file for FL/);
  });
  it("an affordable share gets HUD rent ceilings and lists LIHTC as could apply, not computed", () => {
    // a lot the zoning map classes as multifamily: the course's legal basis is the zoning on file, and it is not sized
    const c = P.buildProjectCard({ kind: "lot", id: "fl-m", name: "FL multifamily lot (test input)", countyFips: "12086", stateCode: "FL", parcel: { parcel_id: "F", state_code: "FL", county_fips: "12086", base_zoning_code: "RU-4", is_multifamily_residential: true, exclusions: {}, lot_sqft: 43560 } }, ctxFull);
    const aff = c.courses.find((x: any) => x.course === "small_multifamily" && x.affordable);
    expect(aff.legal.basis).toBe("zoning on file");
    expect(aff.size).toEqual({ units: null, sqft: null });
    expect(aff.missing.join(" ")).toMatch(/density limit for RU-4 is not in the zoning standards on file/);
    const il = ctxFull.incomeLimits.counties.find((r: any) => r.fips === "12086");
    expect(aff.income.perUnitMonthly.low.value).toBeCloseTo(il.il50[0] * 0.3 / 12, 6);
    expect(aff.income.perUnitMonthly.high.value).toBeCloseTo(il.il50[3] * 0.3 / 12, 6);
    const l = aff.publicMoney.find((p: any) => /Low-Income Housing Tax Credit/.test(p.programme));
    expect(l.status).toBe("could apply; not computed");
    expect(l.why.join(" ")).toMatch(/development cost/);
  });
});

describe("Travis County: a planned-rail stop city", () => {
  const corr = ctxFull.corridors.find((c: any) => c.id === "corridor_atx_sat");
  const stop = corr.proposed_stations.find((s: any) => s.fips === "48453");
  const near = P.stopsNear({ lat: stop.lat, lng: stop.lng }, ctxFull.corridors, "48453", 1);
  const c = P.buildProjectCard({ kind: "stop_area", id: stop.id, name: "Around the " + stop.city + " stop city", countyFips: "48453", stateCode: "TX", city: stop.city, nearStops: near, blockGroups: [{ id: "a", hv: 300000, hvSource: "Census ACS" }, { id: "b", hv: 500000, hvSource: "Census ACS" }], sitesNearby: 0 }, ctxFull);
  it("shows the measured transit range for the corridor's mode with the study named and the caution", () => {
    expect(near.length).toBeGreaterThan(0);
    const h = c.courses.find((x: any) => x.course === "hold");
    expect(h.transitUplift.modeUsed).toBe("commuter rail");
    expect(h.transitUplift.bands.length).toBeGreaterThan(0);
    for (const b of h.transitUplift.bands) { expect(b.study).toMatch(/Debrezion|Lee|Ko/); expect(b.range.low.value).toBeLessThan(b.range.high.value); }
    expect(h.transitUplift.caution).toMatch(/station site is not chosen/);
  });
  it("building courses are listed as not assessed, with no cost on file", () => {
    expect(c.courses.map((x: any) => x.course)).toEqual(["hold"]);
    expect(c.notAssessed.map((x: any) => x.id)).toEqual(["adu", "state_law_units", "small_multifamily", "station_conventional", "station_prefab"]);
    expect(c.notAssessed[3].missing[0]).toMatch(/no redevelopment site with a record is within 1 mile/);
  });
});

describe("fitToBudget", () => {
  const lot = laLot();
  const adu = lot.courses.find((c: any) => c.course === "adu");
  const area = P.buildProjectCard({ kind: "neighborhood", id: "x", name: "Area", countyFips: "48453", stateCode: "TX", blockGroups: [{ id: "x", hv: 250000, hvSource: "Census ACS" }] }, ctxFull);
  it("splits courses into within, straddling and over the budget, and counts those with no cost", () => {
    const a = P.fitToBudget([lot, area], adu.cost.high.value);
    expect(a.within.map((x: any) => x.course)).toEqual(["adu"]);
    expect(a.uncosted).toBe(lot.courses.filter((c: any) => !c.cost).length + area.courses.filter((c: any) => !c.cost).length);
    const b = P.fitToBudget([lot, area], (adu.cost.low.value + adu.cost.high.value) / 2);
    expect(b.straddle.map((x: any) => x.course)).toEqual(["adu"]);
    const c = P.fitToBudget([lot, area], 1000);
    expect(c.within).toEqual([]);
    expect(c.over.map((x: any) => x.course).sort()).toEqual(["adu", "hold"]);
    expect(P.fitToBudget([lot, area], 1e9).within.length).toBe(2);
  });
  it("orders by evidence (measured cost before modelled), never by a return figure", () => {
    const a = P.fitToBudget([lot, area], 1e9);
    expect(a.within.map((x: any) => x.costLabel)).toEqual(["Census median home value", "declared permit valuations"]);
    expect(a.ordering).toMatch(/never by a return figure/);
  });
});

describe("advisor form", () => {
  it("stays within its size cap and within the decision brief limit", () => {
    const many = Array.from({ length: 40 }, (_, i) => laLot(ctxFull, { id: "lot" + i }));
    const adv = P.cardsForAdvisor(many);
    expect(JSON.stringify(adv).length).toBeLessThanOrEqual(6000);
    expect(adv.truncated).toBeGreaterThan(0);
    expect(JSON.stringify(adv).length + 12000).toBeLessThan(DECISION_BRIEF_MAX_CHARS);
  });
});
