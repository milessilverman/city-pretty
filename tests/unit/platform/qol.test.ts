import { describe, expect, it } from "vitest";
import { makeQuantity, unknownQuantity } from "../../../src/platform/schema/index.js";
import { QOL_DIMENSIONS, QOL_DIMENSION_COUNT, QOL_DIMENSION_IDS, compareWithReturns, scoreQualityOfLife } from "../../../src/platform/qol/index.js";

// FIXTURE: not real data
const SRC = { title: "FIXTURE", url: "https://example.invalid/fixture", retrieved: "2000-01-01" };
const q = (value: number, unit = "fx") =>
  makeQuantity({ value, unit, low: value, high: value, status: "verified", source: SRC, jurisdiction: "XX", effectiveDate: "2000-01-01" });
const range = (lo: number, hi: number) => ({ low: q(lo), high: q(hi) });
const allWeights = (n = 1) => Object.fromEntries(QOL_DIMENSION_IDS.map((id) => [id, n]));
const refs = () => ({ housing: range(0, 10), access_jobs: range(0, 10), noise: range(0, 10) });

describe("dimensions", () => {
  it("has 14 dimensions with directions and inputs and no numbers", () => {
    expect(QOL_DIMENSION_COUNT).toBe(14);
    expect(new Set(QOL_DIMENSION_IDS).size).toBe(14);
    for (const d of QOL_DIMENSIONS) {
      expect(["higher_is_better", "lower_is_better"]).toContain(d.direction);
      expect(d.inputs.length).toBeGreaterThan(0);
    }
  });
});

describe("scoreQualityOfLife", () => {
  it("normalises by direction and lists unknown dimensions without scoring them", () => {
    const r = scoreQualityOfLife({ indicators: { access_jobs: q(8), noise: q(8) }, weights: allWeights(), reference: refs() });
    const jobs = r.results.find((x) => x.dimension === "access_jobs")!;
    const noise = r.results.find((x) => x.dimension === "noise")!;
    expect(jobs.score).toBeCloseTo(0.8);
    expect(noise.score).toBeCloseTo(0.2);
    expect(r.index).toBeCloseTo(0.5);
    expect(r.coverage).toBeCloseTo(2 / 14);
    expect(r.unknown).toHaveLength(12);
    expect(r.results.find((x) => x.dimension === "air")!.score).toBeNull();
  });
  it("treats a null-valued indicator as unknown, and returns null index with no data", () => {
    const r = scoreQualityOfLife({ indicators: { noise: unknownQuantity("fx", "no data") }, weights: allWeights(), reference: refs() });
    expect(r.unknown).toContain("noise");
    expect(r.index).toBeNull();
    expect(r.coverage).toBe(0);
  });
  it("re-normalises weights over dimensions that have data", () => {
    const w = { ...allWeights(0), access_jobs: 3, noise: 1, heat: 6 };
    const r = scoreQualityOfLife({ indicators: { access_jobs: q(10), noise: q(10) }, weights: w, reference: refs() });
    expect(r.index).toBeCloseTo((3 * 1 + 1 * 0) / 4);
    expect(r.coverage).toBeCloseTo(4 / 10);
  });
  it("clamps outside the reference range and says so", () => {
    const r = scoreQualityOfLife({ indicators: { access_jobs: q(50) }, weights: allWeights(), reference: refs() });
    expect(r.results.find((x) => x.dimension === "access_jobs")).toMatchObject({ score: 1, clamped: true });
  });
  it("lists worsening dimensions as tradeoffs against a baseline", () => {
    const r = scoreQualityOfLife({
      indicators: { access_jobs: q(8), noise: q(8) }, baseline: { access_jobs: q(5), noise: q(2) },
      weights: allWeights(), reference: refs(),
    });
    expect(r.tradeoffs).toEqual(["noise"]);
  });
  it("rejects bad weights, missing references, unit mismatch and unsourced references", () => {
    const base = { indicators: { access_jobs: q(1) }, reference: refs() };
    expect(() => scoreQualityOfLife({ ...base, weights: { ...allWeights(), noise: -1 } })).toThrow();
    expect(() => scoreQualityOfLife({ ...base, weights: { noise: 1 } as any })).toThrow();
    expect(() => scoreQualityOfLife({ ...base, weights: allWeights(0) })).toThrow();
    expect(() => scoreQualityOfLife({ ...base, weights: allWeights(), reference: {} })).toThrow();
    expect(() => scoreQualityOfLife({ indicators: { access_jobs: q(1, "other") }, weights: allWeights(), reference: refs() })).toThrow();
    const assumedRef = makeQuantity({ value: 1, unit: "fx", low: 1, high: 1, status: "assumed", assumptions: ["fixture"], jurisdiction: "XX", effectiveDate: "2000-01-01" });
    expect(() => scoreQualityOfLife({ indicators: { access_jobs: q(1) }, weights: allWeights(), reference: { access_jobs: { low: q(0), high: assumedRef } } })).toThrow();
  });
});

describe("compareWithReturns", () => {
  it("places quality of life beside returns and never converts to dollars", () => {
    const qol = scoreQualityOfLife({ indicators: { access_jobs: q(5) }, weights: allWeights(), reference: refs() });
    const fin = { npv: q(7, "fx_currency") };
    const c = compareWithReturns({ qol, financial: fin });
    expect(c.convertedToDollars).toBe(false);
    expect(c.financial).toBe(fin);
    expect(c.qualityOfLife.index).toBeCloseTo(0.5);
    expect(JSON.stringify(c.qualityOfLife)).not.toMatch(/dollar|usd|\$/i);
  });
});
