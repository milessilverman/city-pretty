import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import zlib from "zlib";
import { createRequire } from "module";
import {
  rankNeighborhoods, recommendForNeighborhood, recommendForParcel, evaluateTransit, buildDecisionBrief,
  percentileRanks, TRANSIT_THRESHOLDS, DATA_CHECKS,
} from "../../src/engines/investmentDecisionEngine";

const root = path.resolve(__dirname, "../..");
const jsEngine = createRequire(import.meta.url)("../../src/engines/investmentDecisionEngine.js");
const backtest = JSON.parse(fs.readFileSync(path.join(root, "app/data/neighborhood_score_backtest.json"), "utf8"));
const SMALL_FIPS = "06101"; // Sutter County, CA: 69 block groups, not in the back-test sample
const smallBundle = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root, `counties/bundle_${SMALL_FIPS}.json.gz`))).toString("utf8"));

// small synthetic county: values chosen so the cheapest/highest-rent block group is obvious
function fixtureCounty(overrides: Record<string, any> = {}) {
  const bg = (id: string, hv: number, rent: number, inc: number, extra: Record<string, any> = {}) =>
    [id, { m: { n: "N" + id.slice(-2), c: "Town", hv, rent, inc, homes: 400, own: 60, acres: 100, pop: 1000, bt: 2, hvs: "Census ACS 2020-24 median value for this block group", ...extra }, r: [] }];
  const details = Object.fromEntries([
    bg("990010000011", 150000, 1500, 50000),
    bg("990010000012", 300000, 1600, 80000),
    bg("990010000013", 450000, 1800, 110000),
    bg("990010000014", 600000, 2000, 140000),
    bg("990010000015", 900000, 2400, 200000),
    ["990010000016", { m: { n: "NoIncome", c: "Town", hv: 200000, rent: 1400, inc: null, homes: 300, own: 50, acres: 50 }, r: [] }],
  ]);
  return { meta: { fips: "99001", county: "Fixture County", acs: "2020-2024 ACS 5-year" }, details: { ...details, ...overrides } };
}

describe("back-test file", () => {
  it("records sources, periods and an honest verdict", () => {
    expect(backtest.sources.length).toBeGreaterThanOrEqual(4);
    for (const s of backtest.sources) expect(s.url).toMatch(/^https:\/\//);
    expect(backtest.periods.map((p: any) => p.outcome_years.join("-"))).toEqual(["2015-2020", "2020-2025"]);
    expect(backtest.sample.counties).toBeGreaterThanOrEqual(30);
    expect(["screen", "predictor"]).toContain(backtest.verdict.engine_role);
  });
  it("gives unsupported signals zero weight", () => {
    for (const w of backtest.engine_model.weights) {
      if (!w.supported) expect(w.weight).toBe(0);
      expect(w.assumed).toBe(false);
    }
  });
});

describe("null propagation", () => {
  it("refuses to score without the back-test", () => {
    const r = rankNeighborhoods(fixtureCounty() as any, { backtest: null });
    expect(r.ranked).toEqual([]);
    expect(r.missing[0]).toMatch(/backtest/);
  });
  it("leaves a block group with a missing input unscored and says which input", () => {
    const r = rankNeighborhoods(fixtureCounty() as any, { backtest });
    const u = r.unscored.find((x: any) => x.id === "990010000016");
    expect(u.score).toBeNull();
    expect(u.missing).toContain("inc");
    expect(r.ranked.some((x: any) => x.id === "990010000016")).toBe(false);
  });
  it("returns null costs and values for a house when no sourced table is given", () => {
    const out = recommendForParcel({ parcel_id: "p", state_code: "TX", county_fips: "48453", base_zoning_code: null, marketValue: 400000 }, {});
    expect(out.missing).toContain("base_zoning_code");
    for (const e of out.expansions) {
      expect(e.legal.status).toBe("not determined");
      expect(e.cost.low.value).toBeNull();
      expect(e.valueAdded.value).toBeNull();
      expect(e.netValue.value).toBeNull();
      expect(e.missing.join(" ")).toMatch(/unit cost/);
    }
  });
  it("says not enough data for transit without density", () => {
    const t = evaluateTransit({}, {});
    expect(t.verdict).toBe("not_enough_data");
    expect(t.scale).toBeNull();
    expect(t.missing[0]).toMatch(/density|Acre/i);
  });
});

describe("ranking invariants and determinism", () => {
  it("ranks are 1..n, scores non-increasing, and the result does not depend on key order", () => {
    const a = rankNeighborhoods(fixtureCounty() as any, { backtest });
    a.ranked.forEach((x: any, i: number) => expect(x.rank).toBe(i + 1));
    for (let i = 1; i < a.ranked.length; i++) expect(a.ranked[i - 1].score.value).toBeGreaterThanOrEqual(a.ranked[i].score.value);
    const c = fixtureCounty();
    const reversed = { ...c, details: Object.fromEntries(Object.entries(c.details).reverse()) };
    const b = rankNeighborhoods(reversed as any, { backtest });
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });
  it("puts the cheapest, highest-rent-to-value block group first when the measured weights favour it", () => {
    const signs = Object.fromEntries(backtest.engine_model.weights.filter((w: any) => w.supported).map((w: any) => [w.signal, Math.sign(w.weight)]));
    const r = rankNeighborhoods(fixtureCounty() as any, { backtest });
    if (signs.log_value === -1 && (signs.rent_to_value ?? 1) >= 0) expect(r.ranked[0].id).toBe("990010000011");
    expect(r.ranked[0].components.every((c: any) => c.weight.source.includes("neighborhood_score_backtest.json"))).toBe(true);
  });
  it("uses the weights in the back-test file, not built-in ones", () => {
    const flipped = JSON.parse(JSON.stringify(backtest));
    flipped.engine_model.weights.forEach((w: any) => { w.weight = -w.weight; });
    const a = rankNeighborhoods(fixtureCounty() as any, { backtest }).ranked.map((x: any) => x.id);
    const b = rankNeighborhoods(fixtureCounty() as any, { backtest: flipped }).ranked.map((x: any) => x.id);
    expect(b).toEqual(a.slice().reverse());
  });
  it("never grades A when the back-test calls the score a screen", () => {
    const r = rankNeighborhoods(smallBundle, { backtest });
    if (backtest.verdict.engine_role === "screen") for (const x of r.ranked) expect(x.confidence.grade).not.toBe("A");
  });
  it("flags implausible inputs with the engine's named checks", () => {
    const c = fixtureCounty({ "990010000017": { m: { n: "Mobile", c: "Town", hv: 20000, rent: 900, inc: 30000, homes: 200, own: 50, acres: 40 }, r: [] } });
    const x = rankNeighborhoods(c as any, { backtest }).ranked.find((y: any) => y.id === "990010000017");
    expect(x.dataFlags.length).toBeGreaterThan(0);
    expect(x.dataFlags[0]).toContain(String(DATA_CHECKS.maxRentToValue * 100));
    expect(x.confidence.grade).toBe("D");
  });
  it("percentile ranks average ties", () => {
    expect(percentileRanks([1, 2, 2, 3])).toEqual([0.125, 0.5, 0.5, 0.875]);
  });
});

describe("real bundle smoke test", () => {
  it(`ranks ${SMALL_FIPS}, recommends ideas and builds a compact brief`, () => {
    const r = rankNeighborhoods(smallBundle, { backtest });
    expect(r.rankedCount + r.unscored.length).toBe(Object.keys(smallBundle.details).length);
    expect(r.rankedCount).toBeGreaterThan(20);
    const top = r.ranked[0];
    expect(top.reasons.length).toBeGreaterThan(1);
    expect(["B", "C", "D"]).toContain(top.confidence.grade);
    expect(top.confidence.reasons.join(" ")).toMatch(/not in the back-test sample/);
    const d = smallBundle.details[top.id];
    const rec = recommendForNeighborhood({ id: top.id, m: d.m, r: d.r }, { countyFips: SMALL_FIPS });
    expect(rec.missing[0]).toMatch(/catalog/);
    for (const i of rec.ideas) expect(i.evidence.tier).toBe("assumed"); // no catalog => no evidence claimed
    const brief = buildDecisionBrief(smallBundle, { blockGroupId: top.id }, { backtest });
    expect(brief.topNeighborhoods.length).toBeLessThanOrEqual(10);
    expect(brief.caveats.length).toBeGreaterThan(2);
    expect(brief.transit.verdict).toMatch(/build|do_not_build|screen_only|not_enough_data/);
    expect(JSON.stringify(brief).length).toBeLessThan(60000);
  });
  it("the browser twin (.js) gives the same answers as the .ts source", () => {
    const sel = { blockGroupId: Object.keys(smallBundle.details).sort()[3], corridor: { dwellingUnitsPerNetAcre: 10, cbdMillionSqft: 40, mode: "light rail", annualizedCapitalCostUsd: 3e7, annualOperatingCostUsd: 1e7, annualTrips: 3e6 }, parcel: { parcel_id: "p1", state_code: "CA", county_fips: SMALL_FIPS, base_zoning_code: "R-1", is_single_family_residential: true, marketValue: 450000, municipality_pop: 100000, county_pop: 100000 } };
    const ctx = { backtest };
    expect(JSON.stringify(jsEngine.buildDecisionBrief(smallBundle, sel, ctx))).toBe(JSON.stringify(buildDecisionBrief(smallBundle as any, sel as any, ctx)));
    expect(JSON.stringify(jsEngine.TRANSIT_THRESHOLDS)).toBe(JSON.stringify(TRANSIT_THRESHOLDS));
  });
});

describe("neighborhood recommendations", () => {
  const catalog = {
    street_trees: { name: "Trees", kind: "value", grade: "A", evidence: "strong (local)", sources: ["local hedonic"] },
    farmers_market: { name: "Market", kind: "value", grade: "D", evidence: "limited", sources: ["study"] },
    splash_pad: { name: "Splash pad", kind: "qol", grade: "none", sources: [] },
  };
  const bg = { id: "060370000001", m: { n: "X", c: "Y" }, r: [
    ["farmers_market", "weekly market", 398, 341000, 0, 0, 40000, 621000, 1.821, 0.25, "why", 0.19],
    ["street_trees", "39 trees", 117, 97500, 75855, 0, 2535, 151000, 1.549, 0.24, "why", 0.79],
    ["splash_pad", "1 pad", 398, 1190000, 850000, 0, 40000, 0, 0, 0, "why", 0.79],
  ] };
  it("orders by evidence tier, then pay-back, and grades every item", () => {
    const la = recommendForNeighborhood(bg, { catalog, countyFips: "06037" });
    expect(la.ideas.map((x: any) => x.id)).toEqual(["street_trees", "farmers_market", "splash_pad"]);
    expect(la.ideas[0].evidence.tier).toBe("measured locally");
    expect(la.ideas[2].evidence.tier).toBe("assumed");
    expect(la.ideas[2].valuePerDollar.value).toBeNull(); // quality-of-life item: no return claimed
    expect(la.byReturn).toEqual(["farmers_market", "street_trees"]);
    const elsewhere = recommendForNeighborhood({ ...bg, id: "170310000001" }, { catalog, countyFips: "17031" });
    expect(elsewhere.ideas[0].evidence.tier).toBe("borrowed study");
    for (const i of la.ideas) for (const k of ["cost", "valueAdded", "valuePerDollar"]) expect(i[k]).toHaveProperty("basis");
  });
  it("lists underused sites in the block group only", () => {
    const out = recommendForNeighborhood(bg, { catalog, underusedSites: [{ id: "a", blockGroupId: "060370000001", acres: 2, margin: 5 }, { id: "b", blockGroupId: "other", acres: 9, margin: 9 }] });
    const play = out.housingPlays.find((p: any) => p.play === "underused_site_conversion");
    expect(play.sites.map((s: any) => s.id)).toEqual(["a"]);
  });
});

describe("one house", () => {
  const parcel = { parcel_id: "p", state_code: "CA", county_fips: "06037", base_zoning_code: "R1", is_single_family_residential: true, marketValue: 800000, municipality_pop: 300000, county_pop: 9000000 };
  it("delegates legality to the statutory zoning engine", () => {
    const out = recommendForParcel(parcel, {});
    expect(out.zoning.statutes.length).toBeGreaterThan(0);
    const adu = out.expansions.find((e: any) => e.expansion === "adu");
    expect(adu.legal.status).toBe("allowed by state law");
    const bed = out.expansions.find((e: any) => e.expansion === "added_bedroom");
    expect(bed.legal.status).toBe("not determined");
  });
  it("prices an expansion only from injected sourced rows and checks the ceiling", () => {
    const out = recommendForParcel(parcel, {
      unitCosts: [{ item: "adu", state: "CA", low: 300, high: 400, unit: "USD/sqft", source_url: "https://example.org/cost" }],
      valueCoefficients: [{ item: "adu", state: "CA", value_per_sqft: 450, source_url: "https://example.org/hedonic" }],
      sizes: { aduSqft: 600 },
      neighborhood: { ceilingValue: 1000000 },
    });
    const adu = out.expansions.find((e: any) => e.expansion === "adu");
    expect(adu.cost.low.value).toBe(180000);
    expect(adu.cost.high.value).toBe(240000);
    expect(adu.valueAdded.value).toBe(270000);
    expect(adu.netValue.value).toBe(60000);
    expect(adu.overCapitalisation.status).toBe("over-capitalises");
    expect(out.expansions[0].expansion).toBe("adu"); // only priced item sorts first
  });
  it("needs a size before it multiplies a per-sq-ft row", () => {
    const out = recommendForParcel(parcel, { unitCosts: [{ item: "adu", state: "CA", low: 300, high: 400, unit: "USD/sqft", source_url: "x" }] });
    const adu = out.expansions.find((e: any) => e.expansion === "adu");
    expect(adu.cost.low.value).toBeNull();
    expect(adu.missing).toContain("ctx.sizes.aduSqft");
  });
});

describe("transit thresholds match the cited tables", () => {
  const q = TRANSIT_THRESHOLDS.tcqsm_density.source.quote;
  it("TCQSM Exhibit 3-8 densities", () => {
    for (const r of TRANSIT_THRESHOLDS.tcqsm_density.rows) {
      const d = Array.isArray(r.du_per_net_acre) ? r.du_per_net_acre.join("-") : String(r.du_per_net_acre);
      expect(q).toContain(`${r.label} ${d} dwelling units/net acre`);
    }
    expect(TRANSIT_THRESHOLDS.tcqsm_density.source.quote_gross_net).toContain(`factor of ${TRANSIT_THRESHOLDS.tcqsm_density.gross_to_net_factor}`);
  });
  it("FTA CIG land-use, cost-effectiveness and warrant breakpoints", () => {
    const s = TRANSIT_THRESHOLDS.fta_cig.source;
    const fmt = (n: number) => n.toLocaleString("en-US");
    for (const r of TRANSIT_THRESHOLDS.fta_cig.population_density_per_sq_mi.filter((x: any) => x.min > 0)) expect(s.quote_land_use).toContain(`${r.rating} ${r.rating === "High" ? ">= " : ""}${fmt(r.min)}`);
    for (const r of TRANSIT_THRESHOLDS.fta_cig.employment_served.filter((x: any) => x.min > 0)) expect(s.quote_land_use).toContain(`${r.rating} ${r.rating === "High" ? ">= " : ""}${fmt(r.min)}`);
    for (const r of TRANSIT_THRESHOLDS.fta_cig.cost_per_trip_usd_2025.filter((x: any) => isFinite(x.max_exclusive))) expect(s.quote_cost_effectiveness).toContain(`$${r.max_exclusive}.00`);
    for (const w of TRANSIT_THRESHOLDS.fta_cig.warrants) { expect(s.quote_warrants).toContain(`${w.max_capital_musd} million`); expect(s.quote_warrants).toContain(`${fmt(w.min_existing_riders)} Transit Riders`); }
    expect(s.quote_new_starts).toContain(`$${TRANSIT_THRESHOLDS.fta_cig.new_starts_min_capital_musd} million`);
    expect(TRANSIT_THRESHOLDS.fra_hsr.source.quote).toContain(`${TRANSIT_THRESHOLDS.fra_hsr.distance_miles[0]} to ${TRANSIT_THRESHOLDS.fra_hsr.distance_miles[1]} miles`);
  });
});

describe("transit decisions", () => {
  const bench = [
    { mode: "light_rail", cost_per_mile: 200e6, year: 2023, source_url: "https://example.org/a" },
    { mode: "LRT", cost_per_mile: 300e6, year: 2022, source_url: "https://example.org/b" },
    { mode: "brt", cost_per_mile: 30e6, year: 2024, source_url: "https://example.org/c" },
  ];
  const effects = [{ mode: "light_rail", distance_band: "0-0.5 mi", effect_pct: 4, source_url: "https://example.org/e" }];
  it("rates cost per trip on the FTA breakpoints", () => {
    const rate = (cpt: number) => evaluateTransit({ dwellingUnitsPerNetAcre: 20, annualizedCapitalCostUsd: cpt * 1e6, annualOperatingCostUsd: 0, annualTrips: 1e6 }, {}).costEffectiveness.rating;
    expect(rate(7.99)).toBe("High"); expect(rate(8)).toBe("Medium-High"); expect(rate(10)).toBe("Medium"); expect(rate(20)).toBe("Medium-Low"); expect(rate(35)).toBe("Low");
  });
  it("scales up the ladder with density and downtown size, using injected cost tables", () => {
    const t = evaluateTransit({ lengthMiles: 10, dwellingUnitsPerNetAcre: 10, cbdMillionSqft: 40, mode: "light rail", existingCorridorRiders: 12000, annualizedCapitalCostUsd: 4e7, annualOperatingCostUsd: 1e7, annualTrips: 4e6 }, { costBenchmarks: bench, valueEffects: effects });
    expect(t.scale).toBe("light_rail");
    expect(t.verdict).toBe("build");
    expect(t.costByMode.light_rail.costPerMile.value).toBe(250e6);
    expect(t.capitalCost.value).toBe(2.5e9);
    expect(t.warrant.eligible).toBe(false); // above the $600M warrant ceiling
    expect(t.valueEffects[0].effect.value).toBe(4);
  });
  it("says do not build when the proposal is bigger than density supports", () => {
    const t = evaluateTransit({ dwellingUnitsPerNetAcre: 5, mode: "heavy rail", cbdMillionSqft: 80 }, {});
    expect(t.scale).toBe("bus_frequency");
    expect(t.proposedModeSupported).toBe(false);
    expect(t.verdict).toBe("do_not_build");
  });
  it("reads BRT-level frequency and a frequency upgrade from bus density", () => {
    const t = evaluateTransit({ householdsPerGrossAcre: 11, currentBusesPerHour: 3 }, {});
    expect(t.density.homesPerNetAcre.value).toBeCloseTo(16.5);
    expect(t.density.homesPerNetAcre.basis).toBe("modelled");
    expect(t.scale).toBe("brt");
    expect(t.verdict).toBe("screen_only");
    expect(t.reasons.join(" ")).toMatch(/raise frequency/);
  });
  it("leaves rail undecided when downtown size is unknown", () => {
    const t = evaluateTransit({ dwellingUnitsPerNetAcre: 13, mode: "light_rail" }, {});
    expect(t.proposedModeSupported).toBeNull();
    expect(t.verdict).toBe("not_enough_data");
  });
  it("checks the FRA high-speed-rail distance band", () => {
    expect(evaluateTransit({ mode: "hsr", intercityDistanceMiles: 80 }, {}).verdict).toBe("do_not_build");
    expect(evaluateTransit({ mode: "hsr", intercityDistanceMiles: 300 }, {}).verdict).toBe("screen_only");
    expect(evaluateTransit({ mode: "hsr" }, {}).verdict).toBe("not_enough_data");
  });
});
