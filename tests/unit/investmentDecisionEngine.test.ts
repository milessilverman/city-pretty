import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import zlib from "zlib";
import {
  rankNeighborhoods, recommendForNeighborhood, recommendForParcel, evaluateTransit, buildDecisionBrief, briefForAdvisor,
  percentileRanks, TRANSIT_THRESHOLDS, DATA_CHECKS, ideaAllowed, sourcedRow,
} from "../../src/engines/investmentDecisionEngine.js";
// @ts-ignore plain ES module script
import { grabFunction } from "../../scripts/check_engine_copies.mjs";

const root = path.resolve(__dirname, "../..");
const statutes = JSON.parse(fs.readFileSync(path.join(root, "app/data/statutes.json"), "utf8"));
const verification = JSON.parse(fs.readFileSync(path.join(root, "app/data/intervention_verification.json"), "utf8"));
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
      expect(e.missing.join(" ")).toMatch(/no sourced cost/);
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
    expect(rec.missing[1]).toMatch(/verification/);
    expect(rec.ideas).toEqual([]); // no catalog and no verification table => no idea carries a figure
    const brief = buildDecisionBrief(smallBundle, { blockGroupId: top.id }, { backtest });
    expect(brief.topNeighborhoods.length).toBeLessThanOrEqual(10);
    expect(brief.caveats.length).toBeGreaterThan(2);
    expect(brief.transit.verdict).toMatch(/build|do_not_build|screen_only|not_enough_data/);
    expect(JSON.stringify(brief).length).toBeLessThan(60000);
  });
  // The .ts twin was removed on 19 Nov 2026: it ran nowhere (the tests resolve the .js file, as for every other engine;
  // docs/audit/engine-copies.md), so the old twin test compared the .js file with itself. What matters is that the
  // page loads this same file.
  it("is the one copy: the page loads src/engines/investmentDecisionEngine.js and no .ts twin exists", () => {
    const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
    expect(html).toContain('<script src="src/engines/investmentDecisionEngine.js"></script>');
    expect(html.indexOf("src/engines/investmentDecisionEngine.js")).toBeGreaterThan(html.indexOf('<script src="app/app.js"></script>'));
    expect(fs.existsSync(path.join(root, "src/engines/investmentDecisionEngine.ts"))).toBe(false);
  });
  it("the advisor's copy of the brief keeps every figure's basis and stays small", () => {
    const sel = { blockGroupId: Object.keys(smallBundle.details).sort()[3], parcel: { parcel_id: "p1", state_code: "CA", county_fips: SMALL_FIPS, base_zoning_code: "R-1", is_single_family_residential: true, municipality_pop: 100000, county_pop: 100000 } };
    const brief = buildDecisionBrief(smallBundle as any, sel as any, { backtest, laws: statutes, verification });
    const a = briefForAdvisor(brief);
    expect(a.schema).toBe(brief.schema);
    expect(a.topNeighborhoods).toEqual(brief.topNeighborhoods);
    expect(a.parcel.expansions.length).toBe(brief.parcel.expansions.length);
    expect(JSON.stringify(a).length).toBeLessThan(20000);
    expect(JSON.stringify(a)).not.toMatch(/NaN|undefined/);
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
  // Tiers come from the verification audit (app/data/intervention_verification.json), not the catalog grade: until
  // 19 Nov 2026 a grade-A "local" item was called "measured locally", but that LA sales estimate could not be reproduced.
  const ver = { street_trees: { status: "verified" }, farmers_market: { status: "partially_verified", effect: "checked", cost: "unchecked" }, splash_pad: { status: "unverified" } };
  it("shows figures only for audited ideas, orders by pay-back then catalog grade, and names the rest", () => {
    const la = recommendForNeighborhood(bg, { catalog, verification: ver, countyFips: "06037" });
    expect(la.ideas.map((x: any) => x.id)).toEqual(["street_trees", "farmers_market"]);
    expect(la.ideas.every((x: any) => x.evidence.tier === "borrowed study")).toBe(true);
    expect(la.ideas[1].evidence.note).toMatch(/partly verified/);
    expect(la.byReturn).toEqual(["farmers_market", "street_trees"]);
    expect(la.withheld.map((x: any) => x.id)).toEqual(["splash_pad"]);
    expect(la.withheld[0].reason).toMatch(/could not be confirmed/);
    expect(JSON.stringify(la.withheld)).not.toMatch(/1190000|850000/); // no figure for a withheld idea
    for (const i of la.ideas) for (const k of ["cost", "valueAdded", "valuePerDollar"]) expect(i[k]).toHaveProperty("basis");
    const none = recommendForNeighborhood(bg, { catalog, countyFips: "06037" });
    expect(none.ideas).toEqual([]);
    expect(none.withheld.length).toBe(3);
    expect(none.missing.join(" ")).toMatch(/verification/);
  });
  it("applies the audit's conditions (income, state) like the map panel", () => {
    const v = { street_trees: { status: "verified", applies_if: { median_household_income_below: 60000 } }, farmers_market: { status: "verified", applies_if: { state_fips_in: ["06"] } } };
    expect(ideaAllowed("street_trees", { inc: 50000 }, v, "06037")).toBe(true);
    expect(ideaAllowed("street_trees", { inc: 70000 }, v, "06037")).toBe(false);
    expect(ideaAllowed("street_trees", { inc: null }, v, "06037")).toBe(false);
    expect(ideaAllowed("farmers_market", {}, v, "48453")).toBe(false);
    expect(ideaAllowed("farmers_market", {}, v, "06059")).toBe(true);
  });
  // The page's own gate (ivAllows, ivRow in app/app.js) and the engine's copy must agree on every real row.
  it("gives the same gate and sourced-effect override as the map panel on every row of a real county", () => {
    const app = fs.readFileSync(path.join(root, "app/app.js"), "utf8");
    for (const fips of ["17031", "48453"]) {
      // eslint-disable-next-line no-new-func
      const page = new Function("verification", "fips", `const ivRec = id => (verification && verification[id]) || null; const activeFips = () => fips;\n${grabFunction(app, "ivAllows")}\n${grabFunction(app, "ivRow")}\nreturn { ivAllows, ivRow };`)(verification, fips);
      const B = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root, `counties/bundle_${fips}.json.gz`))).toString("utf8"));
      let n = 0, changed = 0;
      for (const d of Object.values(B.details) as any[]) {
        for (const a of d.r || []) {
          expect(ideaAllowed(a[0], d.m, verification, fips)).toBe(page.ivAllows(a[0], d.m));
          const x = sourcedRow(a, verification), y = page.ivRow(a);
          expect(JSON.stringify(x)).toBe(JSON.stringify(y));
          if (x !== a) changed++;
          n++;
        }
      }
      expect(n).toBeGreaterThan(1000);
      expect(changed).toBeGreaterThan(0);
    }
  });
  it("lists underused sites in the block group only", () => {
    const out = recommendForNeighborhood(bg, { catalog, underusedSites: [{ id: "a", blockGroupId: "060370000001", acres: 2, margin: 5 }, { id: "b", blockGroupId: "other", acres: 9, margin: 9 }] });
    const play = out.housingPlays.find((p: any) => p.play === "underused_site_conversion");
    expect(play.sites.map((s: any) => s.id)).toEqual(["a"]);
  });
});

describe("one house", () => {
  const parcel = { parcel_id: "p", state_code: "CA", county_fips: "06037", base_zoning_code: "R1", is_single_family_residential: true, marketValue: 800000, municipality_pop: 300000, county_pop: 9000000 };
  // The statute engine on this base reads app/data/statutes.json (passed as ctx.laws) and applies only laws whose text
  // was checked; anything it does not confirm is "not determined" here, with its reason.
  it("delegates legality to the statute engine, which reads app/data/statutes.json", () => {
    const out = recommendForParcel(parcel, { laws: statutes });
    expect(out.zoning.laws_loaded).toBe(true);
    expect(out.zoning.statutes.length).toBeGreaterThan(0);
    const adu = out.expansions.find((e: any) => e.expansion === "adu");
    expect(adu.legal.status).toBe("allowed by state law");
    const law = statutes.find((l: any) => l.id === adu.legal.statute_id);
    expect(["verified", "partially_verified"]).toContain(law.verification.status);
    expect(adu.legal.verification_status).toBe(law.verification.status);
    const split = out.expansions.find((e: any) => e.expansion === "lot_split");
    expect(split.legal.status).toBe("allowed by state law");
    expect(split.legal.citation).toMatch(/lot split/i);
    const bed = out.expansions.find((e: any) => e.expansion === "added_bedroom");
    expect(bed.legal.status).toBe("not determined");
  });
  it("says not determined, with the reason, whenever the statute engine does not confirm a law", () => {
    const noLaws = recommendForParcel(parcel, { laws: [] });
    for (const e of noLaws.expansions) { expect(e.legal.status).toBe("not determined"); expect(e.legal.why).toBeTruthy(); }
    expect(noLaws.expansions.find((e: any) => e.expansion === "adu").legal.why).toMatch(/statutes\.json/);
    // a law whose text was not checked never applies
    const unchecked = statutes.map((l: any) => l.state_code === "CA" ? { ...l, verification: { ...l.verification, status: "unverified" } } : l);
    const out = recommendForParcel(parcel, { laws: unchecked });
    for (const e of out.expansions) expect(e.legal.status).toBe("not determined");
    expect(out.zoning.not_confirmed.join(" ")).toMatch(/could not be checked/);
    // Austin's ordinance needs the city name, which this parcel record lacks: not determined, and the reason says so
    const tx = recommendForParcel({ parcel_id: "t", state_code: "TX", county_fips: "48453", base_zoning_code: "SF-3", is_single_family_residential: true }, { laws: statutes });
    expect(tx.expansions.find((e: any) => e.expansion === "adu").legal.status).toBe("not determined");
    expect(tx.zoning.not_confirmed.join(" ")).toMatch(/city name/);
  });
  it("uses no row of app/data/unit_costs.json for a house addition (it holds public-works items)", () => {
    const rows = JSON.parse(fs.readFileSync(path.join(root, "app/data/unit_costs.json"), "utf8"));
    const out = recommendForParcel(parcel, { laws: statutes, unitCosts: rows });
    for (const e of out.expansions) { expect(e.cost.low.value).toBeNull(); expect(e.missing.join(" ")).toMatch(/public-works items only/); }
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
