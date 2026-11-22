// Transit demand engine (src/engines/transitDemandEngine.js): every formula against a hand-computed fixture, the
// leave-one-system-out test re-run on the committed station features (it must reproduce the model file), and the
// mode comparison as it reaches evaluateTransit.
import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const T = require("../../src/engines/transitDemandEngine.js");
const IDE = require("../../src/engines/investmentDecisionEngine.js");
const root = path.resolve(__dirname, "../..");
const data = (f: string) => JSON.parse(fs.readFileSync(path.join(root, f), "utf8"));

// ---- fixtures, every expected value worked by hand in the comments
const LN100 = Math.log(100);
const modeModel = {
  systems: ["A", "B"], stations: 10,
  coef: { ln_pop_half: 0.5, ln_jobs_half: 0.5, ln_pop_ring: 0, ln_jobs_ring: 0, terminal: 0, transfer: 0 },
  intercepts: { A: 0, B: Math.log(2) },
  loso_summary: { log_error_after_scaling_p10_p90: [-1, 1], median_mdape_after_scaling: { model: 0.4 }, median_spearman: { model: 0.6 } },
  beats_people_plus_jobs_baseline: true,
};
// pop_half = jobs_half = 99: ln(1+99) = ln 100; xb = 0.5 ln100 + 0.5 ln100 = ln 100 -> exp = 100
const stop = { name: "S1", pop_half: 99, jobs_half: 99, pop_ring: 0, jobs_ring: 0, homes_half: 40, homes_ring: 0, terminal: 0, transfer: 0 };
const model = {
  modes: { LR: modeModel },
  annual_trips_per_weekday_count: { rows: [{ system: "A", mode: "LR", factor: 300 }, { system: "B", mode: "LR", factor: 400 }] },
  ntd_extras: { report_year: "2025", source_url: "https://data.transportation.gov/d/npsm-38gk", by_mode: {
    LR: { upt_per_drm: { n: 3, p25: 1000, median: 2000, p75: 4000 }, avg_speed_mph: { n: 3, p25: 10, median: 15, p75: 20 } },
    RB: { upt_per_drm: { n: 3, p25: 1000, median: 2000, p75: 4000 }, avg_speed_mph: { n: 3, p25: 10, median: 15, p75: 20 } } } },
};
const cut = { fare_per_upt: { n: 3, p25: 0.5, median: 1, p75: 2 }, vrh_per_route_mile: { n: 3, p25: 1000, median: 2000, p75: 3000 }, opex_per_vrh: { n: 3, p25: 100, median: 200, p75: 300 }, opex_per_upt: { n: 3, p25: 10, median: 20, p75: 30 } };
const operating = { by_mode: { LR: { years: { "2025": { cuts: { all: cut } } } }, RB: { years: { "2025": { cuts: { all: cut } } } } },
  agency_rows_rail_brt_latest_year: [{ ntd_id: "99999", agency_name: "Test Transit", mode: "LR", report_year: "2025", fare_per_upt: 1.5, opex_per_vrh: 250, source_url: "x" }] };
const costRows = [100, 200, 300, 400].map((v, i) => ({ id: "r" + i, mode: "light_rail", cost_per_mile_usd_millions: v, tunnel_share_pct: i < 2 ? 0 : 100 }));

describe("station model", () => {
  it("predicts a stop as a bracket across system levels", () => {
    const p = T.predictStop(stop, modeModel);
    expect(p.weekday.low).toBeCloseTo(100, 9);          // exp(0 + ln100)
    expect(p.weekday.high).toBeCloseTo(200, 9);         // exp(ln2 + ln100)
    expect(p.weekday.mid).toBeCloseTo(100 * Math.SQRT2, 9); // exp(mean(0, ln2) + ln100)
    expect(p.errorBand.lowFactor).toBeCloseTo(Math.exp(-1), 12);
    expect(T.featureVector(stop)[0]).toBeCloseTo(LN100, 12);
  });
  it("names a missing stop input instead of guessing", () => {
    const p = T.predictStop({ pop_half: 1, jobs_half: null, pop_ring: 1, jobs_ring: 1 }, modeModel);
    expect(p.weekday).toBeNull();
    expect(p.missing).toContain("stop jobs_half");
  });
  it("annualises with each system's NTD factor and brackets across systems", () => {
    const r = T.lineRidersFromStations([stop], modeModel, model.annual_trips_per_weekday_count.rows);
    expect(r.annual.low).toBeCloseTo(30000, 6);  // 100 x 300
    expect(r.annual.high).toBeCloseTo(80000, 6); // 200 x 400
    expect(r.annual.mid).toBeCloseTo(55000, 6);  // median of the two
    const two = T.lineRidersFromStations([stop, stop], modeModel, model.annual_trips_per_weekday_count.rows);
    expect(two.weekday.low).toBeCloseTo(200, 9);
  });
  it("riders from NTD trips per directional route mile", () => {
    const r = T.ridersFromRouteMiles(5, "LR", model); // 2 x 5 = 10 directional route miles
    expect([r.annual.low, r.annual.mid, r.annual.high]).toEqual([10000, 20000, 40000]);
    expect(T.ridersFromRouteMiles(null, "LR", model).missing).toEqual(["line length in miles"]);
  });
});

describe("money", () => {
  const annual = { low: 30000, high: 80000, mid: 55000, unit: "trips" };
  it("fare revenue from NTD quartiles, or the named agency's own figure", () => {
    const f = T.fareRevenue(annual, "LR", operating).value;
    expect([f.low, f.mid, f.high]).toEqual([15000, 55000, 160000]); // 30000x0.5, 55000x1, 80000x2
    const own = T.fareRevenue(annual, "LR", operating, { ntdId: "99999" }).value;
    expect([own.low, own.high]).toEqual([45000, 120000]); // x 1.5
  });
  it("operating cost from revenue hours per route mile x cost per revenue hour", () => {
    const c = T.operatingCost(5, "LR", operating, model);
    expect([c.revenueHours.low, c.revenueHours.mid, c.revenueHours.high]).toEqual([10000, 20000, 30000]);
    expect([c.value.low, c.value.mid, c.value.high]).toEqual([1e6, 4e6, 9e6]); // 10000x100, 20000x200, 30000x300
  });
  it("operating cost from a stated service plan", () => {
    // 2 directions x 20 h x 60 / 10 min = 240 trips/day; hours = 240 x (5 mi / speed) x 2 cars x 365
    const c = T.operatingCost(5, "LR", operating, model, { spanHours: 20, headwayMin: 10, carsPerTrain: 2, daysPerYear: 365 });
    expect(c.revenueHours.low).toBeCloseTo(43800, 6);   // speed 20
    expect(c.revenueHours.high).toBeCloseTo(87600, 6);  // speed 10
    expect(c.revenueHours.mid).toBeCloseTo(58400, 6);   // speed 15
    expect(c.value.low).toBeCloseTo(43800 * 100, 3);
    const miss = T.operatingCost(5, "LR", operating, model, { spanHours: 20, headwayMin: 10, daysPerYear: 365 });
    expect(miss.value).toBeNull();
    expect(miss.missing[0]).toMatch(/carsPerTrain/);
  });
  it("cost-per-trip cross-check, gap, capital", () => {
    const x = T.costPerTripCrossCheck(annual, "LR", operating);
    expect([x.low, x.high]).toEqual([300000, 2400000]);
    const g = T.operatingGap({ low: 1e6, high: 9e6, mid: 4e6 }, { low: 15000, high: 160000, mid: 55000 });
    expect([g.low, g.mid, g.high]).toEqual([840000, 3945000, 8985000]);
    const k = T.capitalCost(5, "light_rail", costRows).value; // per-mile quartiles of 100,200,300,400 = 175, 250, 325
    expect([k.low, k.mid, k.high]).toEqual([875e6, 1250e6, 1625e6]);
    const tun = T.capitalCost(1, "light_rail", costRows, 100).value; // rows with 100% tunnel: 300, 400 -> 325, 350, 375
    expect([tun.low, tun.mid, tun.high]).toEqual([325e6, 350e6, 375e6]);
    expect(T.capitalCost(5, "bus_frequency", costRows).value).toBeNull();
  });
});

describe("mode comparison and evaluateTransit", () => {
  const tables = { model, operating, costRows, thresholds: IDE.TRANSIT_THRESHOLDS };
  it("operating cost per trip and the best possible FTA rating", () => {
    const r = T.evaluateMode({ lengthMiles: 5, stops: [stop] }, "light_rail", tables);
    expect(r.riders.basis).toBe("station model");
    expect(r.operatingCostPerTrip.low).toBeCloseTo(1e6 / 80000, 9);  // 12.5
    expect(r.operatingCostPerTrip.mid).toBeCloseTo(4e6 / 55000, 9);  // 72.7
    expect(r.bestPossibleFtaRating).toBe("Low");
    expect(r.capitalPerAnnualRider.low).toBeCloseTo(875e6 / 80000, 6);
  });
  it("of the modes that pass on operating cost, the lowest capital per annual rider fits; the next is the runner-up", () => {
    // BRT: NTD route-mile riders 10000-40000 (mid 20000), cost mid 4e6 -> $200/trip: fails. Light rail: $72.7: fails.
    const rows2 = costRows.concat([{ id: "b1", mode: "brt", cost_per_mile_usd_millions: 10, tunnel_share_pct: null } as any]);
    let c = T.compareModes({ lengthMiles: 5, stops: [stop], modes: ["brt", "light_rail"] }, Object.assign({}, tables, { costRows: rows2 }));
    expect(c.verdict).toBe("none_fits");
    expect(c.fit).toBeNull();
    // make operating cheap: $10 per revenue hour -> light rail mid 20000x10/55000 = $3.64 (High); BRT 200000/20000 = $10 (Medium)
    const cheap = JSON.parse(JSON.stringify(operating)); cheap.by_mode.LR.years["2025"].cuts.all.opex_per_vrh = { n: 3, p25: 5, median: 10, p75: 15 }; cheap.by_mode.RB.years["2025"].cuts.all.opex_per_vrh = { n: 3, p25: 5, median: 10, p75: 15 };
    const t2 = Object.assign({}, tables, { operating: cheap, costRows: rows2 });
    c = T.compareModes({ lengthMiles: 5, stops: [stop], modes: ["brt", "light_rail"] }, t2);
    // capital per annual rider (mid): BRT 5 mi x $10M / 20000 = $2,500; light rail 5 x $250M / 55000 = $22,727
    expect(c.modes.find((m: any) => m.mode === "brt").capitalPerAnnualRider.mid).toBeCloseTo(2500, 6);
    expect(c.modes.find((m: any) => m.mode === "light_rail").capitalPerAnnualRider.mid).toBeCloseTo(1250e6 / 55000, 6);
    expect(c.fit).toBe("brt");
    expect(c.runnerUp).toBe("light_rail");
    // without a BRT capital row, BRT passes but is not ranked on capital
    c = T.compareModes({ lengthMiles: 5, stops: [stop], modes: ["brt", "light_rail"] }, Object.assign({}, t2, { costRows }));
    expect(c.fit).toBe("light_rail");
    expect(c.notRankedOnCapital).toEqual(["brt"]);
    // density below the light-rail guideline: light rail is not a candidate
    c = T.compareModes({ lengthMiles: 5, stops: [stop], modes: ["brt", "light_rail"] }, t2, ["bus_frequency", "brt"]);
    expect(c.fit).toBe("brt");
    expect(c.runnerUp).toBeNull();
  });
  it("evaluateTransit keeps 'not enough data' and names the missing input", () => {
    const ev = IDE.evaluateTransit({ name: "x", householdsPerGrossAcre: 10, demand: { lengthMiles: null, stops: [] } }, { demandEngine: T, demandTables: tables });
    expect(ev.modeFit.verdict).toBe("not_enough_data");
    expect(ev.missing.join(" ")).toMatch(/line length in miles/);
    const ev2 = IDE.evaluateTransit({ name: "x", householdsPerGrossAcre: 10 }, {});
    expect(ev2.modeFit).toBeNull();
  });
  it("lineArea gives density inputs from the half-mile rings", () => {
    const a = T.lineArea([stop, stop]); // 80 homes over 2 x pi x 0.25 sq mi x 640 acres
    expect(a.householdsPerGrossAcre).toBeCloseTo(80 / (2 * Math.PI * 0.25 * 640), 12);
    expect(a.employmentServed).toBe(198);
  });
  it("funding: lists programmes with their quoted rule, never an invented share", () => {
    const f = T.fundingOptions({ low: 1, high: 2 }, { state: "TX", fips: "48453" }, { thresholds: IDE.TRANSIT_THRESHOLDS, funding: data("app/data/funding_programs.json") });
    const names = f.programs.map((p: any) => p.program);
    expect(names.some((n: string) => /New Starts/.test(n))).toBe(true);
    expect(names.some((n: string) => /Texas Tax Increment/.test(n))).toBe(true);
    expect(names.some((n: string) => /Florida/.test(n))).toBe(false);
    expect(names.some((n: string) => /Intercity/.test(n))).toBe(false); // not an intercity line
    for (const p of f.programs) expect(p.share === "share not on file" || /^up to \d+%/.test(p.share)).toBe(true);
    const ic = T.fundingOptions(null, { state: "TX", intercity: true }, { funding: data("app/data/funding_programs.json") });
    expect(ic.programs.find((p: any) => /Intercity/.test(p.program)).share).toMatch(/^up to 80%/);
  });
});

describe("the committed model file is reproduced from the committed station features", () => {
  const m = data("app/data/transit_demand_model.json");
  const lines = fs.readFileSync(path.join(root, "data/transit/station_ring_features.csv"), "utf8").trim().split("\n");
  const head = lines[0].split(",");
  // the CSV quotes names with commas; parse minimally
  const parse = (l: string) => { const out: string[] = []; let cur = "", q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === "," && !q) { out.push(cur); cur = ""; } else cur += ch; } out.push(cur); return out; };
  const rows = lines.slice(1).map(l => { const v = parse(l); const o: any = {}; head.forEach((h, i) => { o[h] = v[i]; }); return o; });
  for (const r of rows) for (const k of ["boardings", "pop_half", "jobs_half", "pop_ring", "jobs_ring"]) r[k] = Number(r[k]);
  for (const r of rows) { r.terminal = Number(r.terminal); r.transfer = Number(r.transfer); r.in_block_group = Number(r.in_block_group); }
  for (const code of Object.keys(m.modes)) {
    it(`mode ${code}: leave-one-system-out errors and rank correlations match the file`, () => {
      let rs = rows.filter((r: any) => r.mode === code && r.in_block_group === 1 && r.boardings > 0);
      const n: Record<string, number> = {}; rs.forEach((r: any) => { n[r.system] = (n[r.system] || 0) + 1; });
      rs = rs.filter((r: any) => n[r.system] >= 2);
      expect(rs.length).toBe(m.modes[code].stations);
      const full = T.fitLogLinear(rs);
      for (const f of T.FEATURES) expect(full.coef[f]).toBeCloseTo(m.modes[code].coef[f], 6);
      const res = T.leaveOneSystemOut(rs);
      expect(res.length).toBe(m.modes[code].loso.length);
      res.forEach((r: any, i: number) => {
        const f = m.modes[code].loso[i];
        expect(r.held_out).toBe(f.held_out);
        expect(r.model.mdape_after_scaling).toBeCloseTo(f.model.mdape_after_scaling, 6);
        expect(r.model.spearman).toBeCloseTo(f.model.spearman, 6);
        expect(r.model.level_factor).toBeCloseTo(f.model.level_factor, 6);
        expect(r.baseline_system_average.mdape_after_scaling).toBeCloseTo(f.baseline_system_average.mdape_after_scaling, 6);
        expect(r.baseline_people_plus_jobs_half_mile.mdape_after_scaling).toBeCloseTo(f.baseline_people_plus_jobs_half_mile.mdape_after_scaling, 6);
        expect(r.baseline_people_plus_jobs_half_mile.spearman).toBeCloseTo(f.baseline_people_plus_jobs_half_mile.spearman, 6);
      });
    });
  }
  it("the method doc carries the same results", () => {
    const doc = fs.readFileSync(path.join(root, "docs/TRANSIT-DEMAND-MODEL.md"), "utf8");
    for (const code of Object.keys(m.modes)) {
      const e = m.modes[code].loso_summary.median_mdape_after_scaling.model;
      expect(doc).toContain(`error ${Math.round(e * 100)}%`);
    }
  });
});
