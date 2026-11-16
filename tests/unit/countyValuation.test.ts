// County home-value back-tests on recorded sales (scripts/county_valuation_models.mjs, scripts/lib/countyValuationModels.mjs).
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
// @ts-ignore plain ES modules
import { avUsable, features, neighborhoodStats, neighborhoodFor, fitAssessorRatio, fitRegression, predictor, leakageCount } from "../../scripts/lib/countyValuationModels.mjs";
// @ts-ignore
import { errorMetrics } from "../../scripts/lib/backtestMetrics.mjs";

const root = path.resolve(__dirname, "../..");
const cfg = JSON.parse(fs.readFileSync(path.join(root, "scripts/backtests/county_config.json"), "utf8"));
const bench = JSON.parse(fs.readFileSync(path.join(root, "app/data/valuation_backtest_benchmarks.json"), "utf8"));

const row = (o: any) => ({ id: "x", price: 300000, date: "2026-06-15", bg: "421010001001", tract: "42101000100", sqft: 1400, lot: 1200, yb: 1925, eff: null, beds: 3, baths: 1, av: 280000, av_date: "2026-04-29", ...o });

describe("leakage rules", () => {
  it("an assessor value is usable only if it was set before the sale", () => {
    expect(avUsable(row({}))).toBe(true);
    expect(avUsable(row({ av_date: "2026-07-01" }))).toBe(false);
    expect(avUsable(row({ av_date: "2026-06-15" }))).toBe(false);
    const stats = neighborhoodStats(Array.from({ length: 6 }, (_, i) => row({ id: "n" + i, date: "2025-03-01" })));
    expect(features("regression_with_assessor", stats, row({ av_date: "2026-07-01" }))).toBeNull();
    expect(features("regression_with_assessor", stats, row({}))).not.toBeNull();
  });

  it("neighborhood statistics come only from the rows given, and a home in them is counted as a leak", () => {
    const prior = Array.from({ length: 6 }, (_, i) => row({ id: "p" + i, date: "2025-01-01", price: 200000 + i }));
    const stats = neighborhoodStats(prior);
    expect(neighborhoodFor(stats, row({})).n).toBe(6);
    expect(leakageCount(stats, [row({ id: "new" })])).toBe(0);
    expect(leakageCount(stats, [row({ id: "p3" })])).toBe(1);
  });
});

describe("page models for passing counties", () => {
  const models = JSON.parse(fs.readFileSync(path.join(root, "app/data/county_valuation_models.json"), "utf8"));
  for (const [fips, C] of Object.entries(models.counties) as [string, any][]) {
    it(`${fips}: only a passing county has a page model, and the page's rounded neighborhood figures barely move the estimate`, () => {
      expect(bench.counties[fips].gate.pass).toBe(true);
      // either the page can supply the inputs, or it withholds with a stated reason
      if (!C.input_map) expect(String(C.page_inputs_missing || "")).toMatch(/\S{20,}|.{40,}/);
      const c = cfg[fips];
      const data = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root, c.sales_file))).toString());
      const inWin = (r: any, [a, b]: string[]) => r.date >= a && r.date <= b;
      const test = data.rows.filter((r: any) => inWin(r, c.test));
      const ids = new Set(test.map((r: any) => r.id));
      const prior = data.rows.filter((r: any) => r.date < c.test[0] && (inWin(r, c.fit) || inWin(r, c.dev)) && !ids.has(r.id));
      const exact = predictor(C.model, neighborhoodStats(prior));
      const toMap = (o: any) => new Map(Object.entries(o).map(([k, v]: any) => [k, { n: v[0], median: v[1], ppsf: v[2], d0: v[3], d1: v[4], ids: new Set() }]));
      const rounded = predictor(C.model, { bg: toMap(C.stats.bg), tract: toMap(C.stats.tract) });
      let worst = 0, n = 0;
      for (const r of test) { const a = exact(r), b = rounded(r); if (a && b) { worst = Math.max(worst, Math.abs(b / a - 1)); n++; } }
      expect(n).toBeGreaterThan(500);
      expect(worst).toBeLessThan(0.002);
    });
  }
});

describe("published county back-tests reproduce from their committed sales files", () => {
  for (const [fips, c] of Object.entries(cfg) as [string, any][]) {
    const resultFile = path.join(root, `data/backtests/county_model_test_${fips}.json`);
    if (!fs.existsSync(resultFile)) continue;
    it(`${fips}: locked before testing, no leakage, metrics match the published result`, () => {
      const t = JSON.parse(fs.readFileSync(resultFile, "utf8"));
      expect(t.locked.spec).toBe(c.locked.spec);
      expect(t.test_homes_in_their_own_statistics).toBe(0);
      const data = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root, c.sales_file))).toString());
      const inWin = (r: any, [a, b]: string[]) => r.date >= a && r.date <= b;
      const test = data.rows.filter((r: any) => inWin(r, c.test));
      const testIds = new Set(test.map((r: any) => r.id));
      const prior = data.rows.filter((r: any) => r.date < c.test[0] && (inWin(r, c.fit) || inWin(r, c.dev)) && !testIds.has(r.id));
      const stats = neighborhoodStats(prior);
      const spec = c.locked.spec;
      const m = spec === "assessor_ratio" ? fitAssessorRatio(prior, { allowAvAnyDate: true })
        : spec.startsWith("regression") ? fitRegression(spec, prior, { allowAvAnyDate: spec.includes("assessor") }) : { spec };
      const p = predictor(m, stats);
      const res = errorMetrics(test.map((r: any) => ({ est: p(r), target: r.price })));
      expect(res.n).toBe(t.model.n);
      expect(res.mdape).toBe(t.model.mdape);
      // and the page's benchmarks file publishes exactly this result
      expect(bench.counties[fips].model.mdape).toBe(t.model.mdape);
      expect(bench.counties[fips].gate.pass).toBe(t.gate.pass);
    });
  }
});
