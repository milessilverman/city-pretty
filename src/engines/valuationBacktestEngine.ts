/**
 * Valuation Back-Testing Engine
 * ACCURACY-ROADMAP.md Item 8: measure the home-value estimate against recorded arm's-length sales.
 *
 * What lives here (and is shared by scripts/run_valuation_backtests.mjs and the unit tests):
 *   - selectPreSaleAssessment(): the leakage guard. Picks the assessment roll that was available BEFORE a sale,
 *     so the assessor value fed to the model cannot already reflect that sale.
 *   - selectPriorSale(): the prior sale of the same parcel, strictly before the tested sale.
 *   - applySaleFilters(): arm's-length / single-family filters with per-filter drop counts.
 *   - parcelSplit(): deterministic calibration / evaluation split BY PARCEL (a parcel never sits in both halves).
 *   - summarizeErrors(): n, MdAPE, MAPE, share within 5/10/20%, median signed bias, by price band and by method.
 *   - runCountyValuationBacktest(): runs estimatePropertyMarketValue() over a list of sales and summarizes.
 *   - checkCountyBacktestWithholding(): what the page should do for a county.
 *
 * Status thresholds (unchanged in value from the 15 Nov 2026 version; see docs/VALUATION-BACKTEST.md):
 *   reliable   : MdAPE <= 8%  and >= 80% of sales within 20%
 *   acceptable : MdAPE <= 14% and >= 65% of sales within 20%
 *   withhold   : anything worse
 * Minimum sample raised from 5 to MIN_BACKTEST_SAMPLE (100). Rationale: with n sales the distribution-free 95%
 * confidence interval for a median runs from roughly the (n/2 - 1.96*sqrt(n)/2)-th to the (n/2 + 1.96*sqrt(n)/2)-th
 * ordered error; at n = 5 that interval is the whole sample (the MdAPE could be anything), at n = 100 it spans the
 * 40th-60th percentile errors, which is narrow enough to separate an 8% model from a 14% one in practice.
 */

import {
  estimatePropertyMarketValue,
  PropertyValuationInput,
  PropertyValuationResult
} from "./propertyValuationEngine";

export const MIN_BACKTEST_SAMPLE = 100;

export interface RecordedSaleFact {
  parcelId: string;
  salePrice: number;
  saleDate: string; // ISO "YYYY-MM-DD"
  isArmsLength: boolean;
  countyFips: string;
  countyName: string;
  stateCode: string;
  attributes: Record<string, any>;
  lotSqft?: number;
  livingSqft?: number;
  neighborhoodMedianHv?: number;
  priorSale?: {
    price: number;
    date: string;
    year?: number;
  } | null;
  /** When given, used verbatim as the engine input (the back-test script builds it from pre-sale data only). */
  valuationInput?: PropertyValuationInput;
  sourceUrl?: string;
  documentId?: string;
}

export interface SaleBacktestEvaluation {
  parcelId: string;
  salePrice: number;
  saleDate: string;
  estimatedValue: number;
  dollarError: number;
  percentageError: number;
  absPercentageError: number;
  valuationMethod: string;
  within5Pct: boolean;
  within10Pct: boolean;
  within20Pct: boolean;
}

export interface PriceBandBreakdown {
  band: string;
  sampleCount: number;
  mdape: number;
  shareWithin10Pct: number;
  medianBiasPct?: number;
}

export interface MethodBreakdown {
  method: string;
  sampleCount: number;
  mdape: number;
  shareWithin10Pct: number;
  medianBiasPct: number;
}

export interface ErrorSummary {
  sampleCount: number;
  mdape: number | null;
  mape: number | null;
  medianBiasPct: number | null;
  shareWithin5Pct: number | null;
  shareWithin10Pct: number | null;
  shareWithin20Pct: number | null;
  priceBands: PriceBandBreakdown[];
  methods: MethodBreakdown[];
}

export interface ValuationBacktestSummary {
  countyFips: string;
  countyName: string;
  stateCode: string;
  sampleCount: number;
  mdape: number; // Median Absolute Percentage Error
  mape: number;  // Mean Absolute Percentage Error
  medianBiasPct: number; // Signed median bias (+ over-predicted, - under-predicted)
  shareWithin5Pct: number;
  shareWithin10Pct: number;
  shareWithin20Pct: number;
  status: "reliable" | "acceptable" | "withhold" | "insufficient_data";
  withhold: boolean;
  withholdReason: string | null;
  supportedConfidenceMarginPct: number | null;
  priceBands: PriceBandBreakdown[];
  methods?: MethodBreakdown[];
  evaluations: SaleBacktestEvaluation[];
  lastVerified: string | null;
  sourceUrl?: string;
}

/* ------------------------------------------------------------------ */
/* Small statistics helpers                                            */
/* ------------------------------------------------------------------ */

export function median(values: number[]): number {
  if (!values || values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const r4 = (v: number) => Math.round(v * 10000) / 10000;
const r3 = (v: number) => Math.round(v * 1000) / 1000;

export const PRICE_BANDS: { name: string; lo: number; hi: number }[] = [
  { name: "< $250k", lo: 0, hi: 250000 },
  { name: "$250k - $500k", lo: 250000, hi: 500000 },
  { name: "$500k - $1M", lo: 500000, hi: 1000000 },
  { name: "$1M - $2M", lo: 1000000, hi: 2000000 },
  { name: "> $2M", lo: 2000000, hi: Infinity }
];

/**
 * Error metrics for (sale price, estimate) pairs. Pairs whose estimate is null / non-positive are skipped
 * (a model that returns nothing is reported through coverage, not as an error).
 */
export function summarizeErrors(pairs: { price: number; estimate: number | null; method?: string | null }[]): ErrorSummary {
  const ok = (pairs || []).filter(p => p && p.price > 0 && p.estimate != null && p.estimate > 0);
  const empty: ErrorSummary = {
    sampleCount: 0, mdape: null, mape: null, medianBiasPct: null,
    shareWithin5Pct: null, shareWithin10Pct: null, shareWithin20Pct: null, priceBands: [], methods: []
  };
  if (!ok.length) return empty;
  const signed = ok.map(p => ((p.estimate as number) - p.price) / p.price);
  const abs = signed.map(Math.abs);
  const n = ok.length;
  const share = (t: number) => r3(abs.filter(e => e <= t).length / n);
  const group = (keyOf: (i: number) => string | null) => {
    const g: Record<string, number[]> = {};
    ok.forEach((_, i) => { const k = keyOf(i); if (k == null) return; (g[k] = g[k] || []).push(i); });
    return g;
  };
  const sub = (idx: number[]) => {
    const a = idx.map(i => abs[i]);
    const s = idx.map(i => signed[i]);
    return {
      sampleCount: idx.length,
      mdape: r4(median(a)),
      shareWithin10Pct: r3(a.filter(e => e <= 0.10).length / idx.length),
      medianBiasPct: r4(median(s))
    };
  };
  const bandGroups = group(i => { const b = PRICE_BANDS.find(b => ok[i].price >= b.lo && ok[i].price < b.hi); return b ? b.name : null; });
  const priceBands = PRICE_BANDS.filter(b => bandGroups[b.name]).map(b => ({ band: b.name, ...sub(bandGroups[b.name]) }));
  const methodGroups = group(i => ok[i].method || null);
  const methods = Object.keys(methodGroups).map(m => ({ method: m, ...sub(methodGroups[m]) }))
    .sort((a, b) => b.sampleCount - a.sampleCount);
  return {
    sampleCount: n,
    mdape: r4(median(abs)),
    mape: r4(abs.reduce((s, v) => s + v, 0) / n),
    medianBiasPct: r4(median(signed)),
    shareWithin5Pct: share(0.05),
    shareWithin10Pct: share(0.10),
    shareWithin20Pct: share(0.20),
    priceBands,
    methods
  };
}

/* ------------------------------------------------------------------ */
/* Leakage guard, prior sale, filters, split                           */
/* ------------------------------------------------------------------ */

export interface AssessmentRollRecord {
  /** Roll label as the source publishes it (assessment year, tax year or fiscal year). */
  year: number;
  total: number | null;
  land?: number | null;
  bldg?: number | null;
  /** Date the source says this value was set / changed, when it publishes one (ISO). */
  changeDate?: string | null;
  stage?: string;
}

export interface PreSaleAssessmentRule {
  /** Use only rolls whose label year <= sale year - maxYearOffset. 1 = never the roll of the sale's own year. */
  maxYearOffset: number;
  /** Also require changeDate < sale date (rolls without a changeDate are then rejected). */
  requireChangeDateBefore?: boolean;
}

/**
 * Leakage guard. Returns the latest roll that could not have seen the sale:
 *   - label year <= saleYear - rule.maxYearOffset, and
 *   - if rule.requireChangeDateBefore: the value's own change date is strictly before the sale date.
 * Rolls with a missing / non-positive total are ignored. Returns null when nothing qualifies (no fallback).
 */
export function selectPreSaleAssessment(
  rolls: AssessmentRollRecord[] | null | undefined,
  saleDate: string,
  rule: PreSaleAssessmentRule
): AssessmentRollRecord | null {
  if (!rolls || !rolls.length || !saleDate) return null;
  const saleYear = +String(saleDate).slice(0, 4);
  if (!saleYear) return null;
  const offset = Math.max(0, rule && Number.isFinite(rule.maxYearOffset) ? rule.maxYearOffset : 1);
  const saleDay = String(saleDate).slice(0, 10);
  const eligible = rolls.filter(r => {
    if (!r || !(r.total != null && r.total > 0)) return false;
    if (!(r.year <= saleYear - offset)) return false;
    if (rule && rule.requireChangeDateBefore) {
      if (!r.changeDate) return false;
      if (!(String(r.changeDate).slice(0, 10) < saleDay)) return false;
    }
    return true;
  });
  if (!eligible.length) return null;
  eligible.sort((a, b) => (b.year - a.year) || String(b.changeDate || "").localeCompare(String(a.changeDate || "")));
  return eligible[0];
}

export interface SaleHistoryRow { price: number; date: string; docId?: string | null }

/**
 * Most recent earlier sale of the same parcel: strictly before the tested sale by at least minDaysBefore days,
 * not the same document, price >= minPrice. Returns null if there is none.
 */
export function selectPriorSale(
  history: SaleHistoryRow[] | null | undefined,
  sale: { date: string; docId?: string | null },
  opts: { minDaysBefore?: number; minPrice?: number } = {}
): { price: number; date: string; year: number } | null {
  if (!history || !history.length || !sale || !sale.date) return null;
  const minDays = opts.minDaysBefore != null ? opts.minDaysBefore : 1;
  const minPrice = opts.minPrice != null ? opts.minPrice : 10000;
  const saleT = Date.parse(String(sale.date).slice(0, 10) + "T00:00:00Z");
  let best: SaleHistoryRow | null = null;
  for (const h of history) {
    if (!h || !h.date || !(h.price >= minPrice)) continue;
    if (sale.docId && h.docId && String(h.docId) === String(sale.docId)) continue;
    const t = Date.parse(String(h.date).slice(0, 10) + "T00:00:00Z");
    if (!Number.isFinite(t) || saleT - t < minDays * 86400000) continue;
    if (!best || String(h.date) > String(best.date)) best = h;
  }
  return best ? { price: best.price, date: String(best.date).slice(0, 10), year: +String(best.date).slice(0, 4) } : null;
}

export interface SaleFilter<T> { id: string; description: string; test: (s: T) => boolean }

/** Applies filters in order; a sale is dropped by the first filter it fails. Returns kept sales and drop counts. */
export function applySaleFilters<T>(sales: T[], filters: SaleFilter<T>[]): {
  kept: T[];
  report: { id: string; description: string; dropped: number }[];
} {
  const report = filters.map(f => ({ id: f.id, description: f.description, dropped: 0 }));
  const kept: T[] = [];
  for (const s of sales || []) {
    let ok = true;
    for (let i = 0; i < filters.length; i++) {
      let pass = false;
      try { pass = !!filters[i].test(s); } catch (e) { pass = false; }
      if (!pass) { report[i].dropped++; ok = false; break; }
    }
    if (ok) kept.push(s);
  }
  return { kept, report };
}

/** FNV-1a 32-bit hash of a string (deterministic sampling / splitting). */
export function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Calibration / evaluation split by parcel id: every sale of a parcel lands in the same half. */
export function parcelSplit(parcelId: string, salt: string = "cp-backtest-v1"): "calibration" | "evaluation" {
  return (fnv1a(salt + ":" + parcelId) % 2 === 0) ? "calibration" : "evaluation";
}

/* ------------------------------------------------------------------ */
/* County back-test                                                    */
/* ------------------------------------------------------------------ */

function statusFor(sampleCount: number, mdape: number, shareWithin20Pct: number) {
  let status: ValuationBacktestSummary["status"];
  let withhold = false;
  let withholdReason: string | null = null;
  if (sampleCount < MIN_BACKTEST_SAMPLE) {
    status = "insufficient_data";
    withhold = true;
    withholdReason = `Valuation withheld: only ${sampleCount} recorded arm's-length sales were available to test the model here (at least ${MIN_BACKTEST_SAMPLE} needed).`;
  } else if (mdape <= 0.08 && shareWithin20Pct >= 0.80) {
    status = "reliable";
  } else if (mdape <= 0.14 && shareWithin20Pct >= 0.65) {
    status = "acceptable";
  } else {
    status = "withhold";
    withhold = true;
    withholdReason = `Valuation withheld: tested against ${sampleCount} recorded sales in this county, the model's typical error was ${(mdape * 100).toFixed(1)}% and only ${(shareWithin20Pct * 100).toFixed(0)}% of estimates were within 20% of the sale price.`;
  }
  return { status, withhold, withholdReason };
}

/** Engine input built only from the record's own fields; nothing is invented when a field is missing. */
function inputFromSale(s: RecordedSaleFact): PropertyValuationInput {
  if (s.valuationInput) return s.valuationInput;
  const a = s.attributes || {};
  const facts: Record<string, any> = {};
  const bldg = s.livingSqft ?? a.LIVING_AREA ?? a.total_lvg_area;
  if (bldg != null) facts.bldg = +bldg;
  const beds = a.Bedrooms ?? a.BEDROOMS;
  if (beds != null) facts.beds = +beds;
  const baths = a.Bathrooms ?? a.BATHROOMS;
  if (baths != null) facts.baths = +baths;
  const yb = a.YearBuilt ?? a.CONST_YEAR;
  if (yb != null) facts.yb = +yb;
  const lot = s.lotSqft ?? a.LotSqft;
  const input: PropertyValuationInput = {
    attributes: a,
    neighborhood: { hv: s.neighborhoodMedianHv, county: s.countyName },
    stateCode: s.stateCode,
    facts,
    salesInfo: s.priorSale || null
  };
  if (lot != null) input.lotSqft = +lot;
  return input;
}

/**
 * Runs the valuation engine over recorded sales and summarizes the error.
 */
export function runCountyValuationBacktest(
  sales: RecordedSaleFact[],
  options?: {
    countyFips?: string;
    countyName?: string;
    stateCode?: string;
    sourceUrl?: string;
    lastVerified?: string;
    maxEvaluations?: number;
  }
): ValuationBacktestSummary {
  const fips = options?.countyFips || (sales[0] ? sales[0].countyFips : "00000");
  const countyName = options?.countyName || (sales[0] ? sales[0].countyName : "Unknown County");
  const stateCode = (options?.stateCode || (sales[0] ? sales[0].stateCode : "")).toUpperCase();
  const sourceUrl = options?.sourceUrl || (sales[0] ? sales[0].sourceUrl : undefined);
  const lastVerified = options?.lastVerified || null;

  const validSales = (sales || []).filter(s => s.isArmsLength && s.salePrice >= 25000);

  const evaluations: SaleBacktestEvaluation[] = [];
  for (const s of validSales) {
    const result: PropertyValuationResult = estimatePropertyMarketValue(inputFromSale({ ...s, stateCode: s.stateCode || stateCode }));
    const est = result.estimatedValue;
    if (!(est > 0)) continue;
    const dollarError = est - s.salePrice;
    const percentageError = dollarError / s.salePrice;
    const absPercentageError = Math.abs(percentageError);
    evaluations.push({
      parcelId: s.parcelId,
      salePrice: s.salePrice,
      saleDate: s.saleDate,
      estimatedValue: est,
      dollarError,
      percentageError: r4(percentageError),
      absPercentageError: r4(absPercentageError),
      valuationMethod: result.valuationMethod,
      within5Pct: absPercentageError <= 0.05,
      within10Pct: absPercentageError <= 0.10,
      within20Pct: absPercentageError <= 0.20
    });
  }

  const summary = summarizeErrors(evaluations.map(e => ({ price: e.salePrice, estimate: e.estimatedValue, method: e.valuationMethod })));
  const sampleCount = summary.sampleCount;
  const mdape = summary.mdape ?? 0;
  const shareWithin20Pct = summary.shareWithin20Pct ?? 0;
  const st = sampleCount === 0
    ? { status: "insufficient_data" as const, withhold: true, withholdReason: "Valuation withheld: no recorded arm's-length sales were available to test the model here." }
    : statusFor(sampleCount, mdape, shareWithin20Pct);

  // Supported margin: the half-width that covers the middle half of tested sales is the MdAPE itself; report it
  // directly (null when untested) instead of a hand-picked floor/ceiling.
  const supportedConfidenceMarginPct = sampleCount ? r3(mdape) : null;

  const maxEval = options?.maxEvaluations != null ? options.maxEvaluations : evaluations.length;

  return {
    countyFips: fips,
    countyName,
    stateCode,
    sampleCount,
    mdape,
    mape: summary.mape ?? 0,
    medianBiasPct: summary.medianBiasPct ?? 0,
    shareWithin5Pct: summary.shareWithin5Pct ?? 0,
    shareWithin10Pct: summary.shareWithin10Pct ?? 0,
    shareWithin20Pct,
    status: st.status,
    withhold: st.withhold,
    withholdReason: st.withholdReason,
    supportedConfidenceMarginPct,
    priceBands: summary.priceBands,
    methods: summary.methods,
    evaluations: evaluations.slice(0, maxEval),
    lastVerified,
    sourceUrl
  };
}

/**
 * What the page should do for a county. A county with no entry in the benchmarks file has NOT been back-tested:
 * the estimate is not withheld for that reason alone, but no tested error margin exists (supportedMargin null).
 */
export function checkCountyBacktestWithholding(
  countyFips: string,
  benchmarks: Record<string, ValuationBacktestSummary>
): { withhold: boolean; reason: string | null; supportedMargin: number | null; backtested: boolean } {
  const benchmark = benchmarks ? benchmarks[countyFips] : undefined;
  if (!benchmark) {
    return { withhold: false, reason: null, supportedMargin: null, backtested: false };
  }
  if (benchmark.withhold) {
    return {
      withhold: true,
      reason: benchmark.withholdReason || `Valuation withheld: back-test against recorded sales failed the error tolerance (MdAPE: ${(benchmark.mdape * 100).toFixed(1)}%).`,
      supportedMargin: benchmark.supportedConfidenceMarginPct ?? null,
      backtested: true
    };
  }
  return { withhold: false, reason: null, supportedMargin: benchmark.supportedConfidenceMarginPct ?? null, backtested: true };
}
