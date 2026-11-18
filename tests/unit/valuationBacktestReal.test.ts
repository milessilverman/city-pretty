import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  selectPreSaleAssessment,
  selectPriorSale,
  applySaleFilters,
  parcelSplit,
  summarizeErrors,
  runCountyValuationBacktest,
  checkCountyBacktestWithholding,
  MIN_BACKTEST_SAMPLE
} from "../../src/engines/valuationBacktestEngine";
import { estimatePropertyMarketValue } from "../../src/engines/propertyValuationEngine";

const rootDir = path.resolve(__dirname, "../..");
const benchmarks = JSON.parse(fs.readFileSync(path.join(rootDir, "app/data/valuation_backtest_benchmarks.json"), "utf-8"));

describe("valuation_backtest_benchmarks.json holds real, downloaded back-tests only", () => {
  const entries = Object.entries(benchmarks) as [string, any][];

  it("has at least 5 counties in at least 4 states", () => {
    expect(entries.length).toBeGreaterThanOrEqual(5);
    expect(new Set(entries.map(([, b]) => b.stateCode)).size).toBeGreaterThanOrEqual(4);
  });

  it("every county has n >= 500, provenance and the required fields", () => {
    for (const [fips, b] of entries) {
      expect(b.countyFips).toBe(fips);
      expect(b.sampleCount).toBeGreaterThanOrEqual(500);
      expect(b.source_url).toMatch(/^https:\/\//);
      expect(b.sourceUrl).toBe(b.source_url);
      expect(typeof b.source_dataset).toBe("string");
      expect(b.retrieved).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(b.sale_window.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(b.sale_window.end).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Array.isArray(b.filters)).toBe(true);
      expect(b.filters.length).toBeGreaterThanOrEqual(4);
      for (const f of b.filters) expect(typeof f.description).toBe("string");
      expect(typeof b.leakage_rule).toBe("string");
      for (const k of ["mdape", "mape", "medianBiasPct", "shareWithin5Pct", "shareWithin10Pct", "shareWithin20Pct"]) {
        expect(typeof b[k]).toBe("number");
      }
      expect(b.baseline.assessor_ratio.sampleCount).toBe(b.sampleCount);
      expect(typeof b.baseline.assessor_ratio.mdape).toBe("number");
      expect(typeof b.baseline.engine_beats_assessor_ratio).toBe("boolean");
      expect(b.baseline.prior_sale_hpi.source_url).toMatch(/^https:\/\/www\.fhfa\.gov\//);
      expect(b.evaluations.length).toBeLessThanOrEqual(20);
      expect(b.sample.evaluation).toBe(b.sampleCount);
      expect(["reliable", "acceptable", "withhold"]).toContain(b.status);
      if (b.status === "withhold") expect(b.withholdReason).toBeTruthy();
      expect(b.priceBands.length).toBeGreaterThan(0);
    }
  });

  it("contains none of the hand-typed sample counties of the 15 Nov 2026 build", () => {
    const typedSources = [
      "https://downloads.hcpafl.org/",
      "https://hcad.org/pdata/pdata.html",
      "https://kingcounty.gov/en/dept/assessor",
      "https://data.lacounty.gov/datasets/lacounty::assessor-parcels-data-2024",
      "https://datacatalog.cookcountyil.gov/Property-Taxation/Assessor-Parcel-Sales/77sq-953v"
    ];
    for (const [, b] of entries) {
      expect(typedSources).not.toContain(b.sourceUrl);
      // a typed sample has a handful of sales; a real one has hundreds per price band at least somewhere
      expect(Math.max(...b.priceBands.map((p: any) => p.sampleCount))).toBeGreaterThanOrEqual(100);
    }
    const script = fs.readFileSync(path.join(rootDir, "scripts/run_valuation_backtests.mjs"), "utf-8");
    expect(script).not.toMatch(/COUNTY_SALES_SAMPLES/);
  });
});

describe("leakage guard: selectPreSaleAssessment", () => {
  const rolls = [
    { year: 2023, total: 300000 },
    { year: 2024, total: 320000 },
    { year: 2025, total: 410000 } // e.g. reassessed after the 2025 sale
  ];

  it("never uses the roll of the sale's own year when maxYearOffset = 1", () => {
    expect(selectPreSaleAssessment(rolls, "2025-06-01", { maxYearOffset: 1 })!.year).toBe(2024);
    expect(selectPreSaleAssessment(rolls, "2026-01-15", { maxYearOffset: 1 })!.year).toBe(2025);
  });

  it("returns null rather than a later roll when nothing qualifies", () => {
    expect(selectPreSaleAssessment(rolls, "2023-03-01", { maxYearOffset: 1 })).toBeNull();
    expect(selectPreSaleAssessment([], "2025-03-01", { maxYearOffset: 1 })).toBeNull();
    expect(selectPreSaleAssessment([{ year: 2020, total: null }], "2025-03-01", { maxYearOffset: 1 })).toBeNull();
  });

  it("with requireChangeDateBefore, rejects a value set on or after the sale date", () => {
    const king = [
      { year: 2025, total: 900000, changeDate: "2024-07-01" },
      { year: 2025, total: 950000, changeDate: "2025-05-20" }, // correction after the sale
      { year: 2026, total: 990000, changeDate: "2025-06-30" }
    ];
    const r = selectPreSaleAssessment(king, "2025-05-20", { maxYearOffset: 0, requireChangeDateBefore: true });
    expect(r!.total).toBe(900000);
    const r2 = selectPreSaleAssessment(king, "2025-09-01", { maxYearOffset: 0, requireChangeDateBefore: true });
    expect(r2!.total).toBe(950000); // 2026 roll excluded by year, even though set before the sale
    expect(selectPreSaleAssessment([{ year: 2024, total: 5 }], "2025-01-01", { maxYearOffset: 0, requireChangeDateBefore: true })).toBeNull();
  });
});

describe("selectPriorSale, filters and parcel split", () => {
  it("takes the latest strictly earlier sale with a different document", () => {
    const hist = [
      { price: 200000, date: "2015-04-01", docId: "a" },
      { price: 260000, date: "2019-08-01", docId: "b" },
      { price: 400000, date: "2025-05-01", docId: "c" }, // the tested sale itself
      { price: 5000, date: "2021-01-01", docId: "d" } // nominal
    ];
    expect(selectPriorSale(hist, { date: "2025-05-01", docId: "c" })).toEqual({ price: 260000, date: "2019-08-01", year: 2019 });
    expect(selectPriorSale(hist, { date: "2015-04-01", docId: "a" })).toBeNull();
    expect(selectPriorSale([{ price: 300000, date: "2025-05-01", docId: "x" }], { date: "2025-05-01", docId: "c" })).toBeNull();
  });

  it("applySaleFilters drops each sale at its first failed filter and counts it", () => {
    const sales = [
      { price: 0, type: "Warranty", parcels: 1 },
      { price: 300000, type: "Quit claim", parcels: 1 },
      { price: 300000, type: "Warranty", parcels: 3 },
      { price: 300000, type: "Warranty", parcels: 1 }
    ];
    const { kept, report } = applySaleFilters(sales, [
      { id: "price", description: ">= $10k", test: s => s.price >= 10000 },
      { id: "deed", description: "warranty", test: s => s.type === "Warranty" },
      { id: "single", description: "one parcel", test: s => s.parcels === 1 }
    ]);
    expect(kept.length).toBe(1);
    expect(report.map(r => r.dropped)).toEqual([1, 1, 1]);
  });

  it("parcelSplit is deterministic and puts all sales of a parcel in one half", () => {
    const ids = Array.from({ length: 2000 }, (_, i) => "P" + i);
    const halves = ids.map(id => parcelSplit(id));
    expect(ids.map(id => parcelSplit(id))).toEqual(halves);
    const share = halves.filter(h => h === "calibration").length / ids.length;
    expect(share).toBeGreaterThan(0.45);
    expect(share).toBeLessThan(0.55);
  });

  it("summarizeErrors computes MdAPE, bias and shares and skips missing estimates", () => {
    const s = summarizeErrors([
      { price: 100, estimate: 110 }, { price: 100, estimate: 95 }, { price: 100, estimate: 130 },
      { price: 100, estimate: null }
    ]);
    expect(s.sampleCount).toBe(3);
    expect(s.mdape).toBe(0.1);
    expect(s.medianBiasPct).toBe(0.1);
    expect(s.shareWithin5Pct).toBe(0.333);
    expect(s.shareWithin20Pct).toBe(0.667);
  });
});

describe("back-test engine status and engine calibration hook", () => {
  it("withholds below the minimum sample and reports untested counties as not back-tested", () => {
    const r = runCountyValuationBacktest([
      { parcelId: "1", salePrice: 300000, saleDate: "2025-01-01", isArmsLength: true, countyFips: "99999", countyName: "Test", stateCode: "PA", attributes: { MarketValue: 290000 } }
    ]);
    expect(r.sampleCount).toBe(1);
    expect(r.sampleCount).toBeLessThan(MIN_BACKTEST_SAMPLE);
    expect(r.status).toBe("insufficient_data");
    expect(r.withhold).toBe(true);
    const c = checkCountyBacktestWithholding("00000", {});
    expect(c.backtested).toBe(false);
    expect(c.supportedMargin).toBeNull();
  });

  it("calibration input replaces the statutory multiplier; absent calibration leaves results unchanged", () => {
    const base = { attributes: { MarketValue: 200000 }, stateCode: "PA", lotSqft: 1200, facts: { bldg: 1100 } };
    const plain = estimatePropertyMarketValue(base);
    expect(plain.assessorMarketEst).toBe(204000);
    expect(plain.calibrated).toBe(false);
    const cal = estimatePropertyMarketValue({ ...base, calibration: { assessorRatio: 1.2, hedonicScale: 1, weights: { assessor: 1, priorSale: 0, hedonic: 0 } } });
    expect(cal.assessorMarketEst).toBe(240000);
    expect(cal.estimatedValue).toBe(240000);
    expect(cal.calibrated).toBe(true);
  });

  it("a caller-supplied hpiRatio replaces the built-in index table for the prior sale", () => {
    const r = estimatePropertyMarketValue({ attributes: {}, stateCode: "WA", salesInfo: { price: 500000, date: "2018-06-01", year: 2018, hpiRatio: 1.5 } });
    expect(r.saleCompEst).toBe(750000);
  });
});
