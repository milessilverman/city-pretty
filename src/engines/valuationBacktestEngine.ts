/**
 * Valuation Back-Testing Engine
 * Implements Item 8 of ACCURACY-ROADMAP.md:
 * Validates the Automated Valuation Model (AVM) against arm's-length recorder sales.
 * Reports sample size, Median Absolute Percentage Error (MdAPE), MAPE,
 * share within 10%, share within 20%, and enforces error-withholding thresholds.
 */

import {
  estimatePropertyMarketValue,
  PropertyValuationInput,
  PropertyValuationResult
} from "./propertyValuationEngine";

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
  supportedConfidenceMarginPct: number;
  priceBands: PriceBandBreakdown[];
  evaluations: SaleBacktestEvaluation[];
  lastVerified: string;
  sourceUrl?: string;
}

/**
 * Calculates median of an array of numbers
 */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Runs a valuation back-test against a collection of recorder sales for a county
 */
export function runCountyValuationBacktest(
  sales: RecordedSaleFact[],
  options?: {
    countyFips?: string;
    countyName?: string;
    stateCode?: string;
    sourceUrl?: string;
    lastVerified?: string;
  }
): ValuationBacktestSummary {
  const fips = options?.countyFips || (sales[0] ? sales[0].countyFips : "00000");
  const countyName = options?.countyName || (sales[0] ? sales[0].countyName : "Unknown County");
  const stateCode = (options?.stateCode || (sales[0] ? sales[0].stateCode : "CA")).toUpperCase();
  const sourceUrl = options?.sourceUrl || (sales[0] ? sales[0].sourceUrl : undefined);
  const lastVerified = options?.lastVerified || "2026-11-15";

  // Filter to valid arm's-length sales with non-trivial transaction value
  const validSales = sales.filter(s => s.isArmsLength && s.salePrice >= 25000);

  if (validSales.length === 0) {
    return {
      countyFips: fips,
      countyName,
      stateCode,
      sampleCount: 0,
      mdape: 0,
      mape: 0,
      medianBiasPct: 0,
      shareWithin5Pct: 0,
      shareWithin10Pct: 0,
      shareWithin20Pct: 0,
      status: "insufficient_data",
      withhold: true,
      withholdReason: "No arm's-length recorder sales available for back-testing.",
      supportedConfidenceMarginPct: 0.15,
      priceBands: [],
      evaluations: [],
      lastVerified,
      sourceUrl
    };
  }

  const evaluations: SaleBacktestEvaluation[] = [];

  for (const s of validSales) {
    // Model estimate run strictly using pre-sale context (prior sale, assessor roll, attributes)
    const valInput: PropertyValuationInput = {
      attributes: s.attributes || {},
      lotSqft: s.lotSqft || s.attributes?.LotSqft || 6000,
      neighborhood: {
        hv: s.neighborhoodMedianHv || 750000,
        county: s.countyName
      },
      stateCode: s.stateCode || stateCode,
      facts: {
        bldg: s.livingSqft || s.attributes?.LIVING_AREA || s.attributes?.total_lvg_area,
        beds: s.attributes?.Bedrooms || s.attributes?.BEDROOMS || 3,
        baths: s.attributes?.Bathrooms || s.attributes?.BATHROOMS || 2,
        yb: s.attributes?.YearBuilt || s.attributes?.CONST_YEAR || 1980
      },
      // Pass prior sale if available (never pass current tested sale)
      salesInfo: s.priorSale || null
    };

    const result: PropertyValuationResult = estimatePropertyMarketValue(valInput);
    const est = result.estimatedValue;
    const dollarError = est - s.salePrice;
    const percentageError = dollarError / s.salePrice;
    const absPercentageError = Math.abs(percentageError);

    evaluations.push({
      parcelId: s.parcelId,
      salePrice: s.salePrice,
      saleDate: s.saleDate,
      estimatedValue: est,
      dollarError,
      percentageError: Math.round(percentageError * 10000) / 10000,
      absPercentageError: Math.round(absPercentageError * 10000) / 10000,
      valuationMethod: result.valuationMethod,
      within5Pct: absPercentageError <= 0.05,
      within10Pct: absPercentageError <= 0.10,
      within20Pct: absPercentageError <= 0.20
    });
  }

  const absErrors = evaluations.map(e => e.absPercentageError);
  const signedErrors = evaluations.map(e => e.percentageError);

  const sampleCount = evaluations.length;
  const mdape = Math.round(median(absErrors) * 10000) / 10000;
  const mape = Math.round((absErrors.reduce((sum, v) => sum + v, 0) / sampleCount) * 10000) / 10000;
  const medianBiasPct = Math.round(median(signedErrors) * 10000) / 10000;

  const within5Count = evaluations.filter(e => e.within5Pct).length;
  const within10Count = evaluations.filter(e => e.within10Pct).length;
  const within20Count = evaluations.filter(e => e.within20Pct).length;

  const shareWithin5Pct = Math.round((within5Count / sampleCount) * 1000) / 1000;
  const shareWithin10Pct = Math.round((within10Count / sampleCount) * 1000) / 1000;
  const shareWithin20Pct = Math.round((within20Count / sampleCount) * 1000) / 1000;

  // Price band analysis
  const bands = [
    { name: "< $500k", filter: (p: number) => p < 500000 },
    { name: "$500k - $1M", filter: (p: number) => p >= 500000 && p < 1000000 },
    { name: "$1M - $2M", filter: (p: number) => p >= 1000000 && p < 2000000 },
    { name: "> $2M", filter: (p: number) => p >= 2000000 }
  ];

  const priceBands: PriceBandBreakdown[] = bands.map(b => {
    const bandEvals = evaluations.filter(e => b.filter(e.salePrice));
    const bandAbsErrors = bandEvals.map(e => e.absPercentageError);
    const band10Count = bandEvals.filter(e => e.within10Pct).length;
    return {
      band: b.name,
      sampleCount: bandEvals.length,
      mdape: bandEvals.length > 0 ? Math.round(median(bandAbsErrors) * 10000) / 10000 : 0,
      shareWithin10Pct: bandEvals.length > 0 ? Math.round((band10Count / bandEvals.length) * 1000) / 1000 : 0
    };
  }).filter(b => b.sampleCount > 0);

  // Status and withholding determination per Roadmap P1 Item 8
  let status: "reliable" | "acceptable" | "withhold" | "insufficient_data";
  let withhold = false;
  let withholdReason: string | null = null;
  let supportedConfidenceMarginPct = Math.max(0.045, Math.min(0.18, Math.round(mdape * 1.25 * 1000) / 1000));

  if (sampleCount < 5) {
    status = "insufficient_data";
    withhold = true;
    withholdReason = `Insufficient recorder arm's-length sales to support statistical validation (${sampleCount} records; min 5 required).`;
  } else if (mdape <= 0.08 && shareWithin20Pct >= 0.80) {
    status = "reliable";
    withhold = false;
  } else if (mdape <= 0.14 && shareWithin20Pct >= 0.65) {
    status = "acceptable";
    withhold = false;
  } else {
    status = "withhold";
    withhold = true;
    withholdReason = `County valuation back-test against recorder sales indicates error exceeding acceptable tolerance (MdAPE: ${(mdape * 100).toFixed(1)}%, 20% share: ${(shareWithin20Pct * 100).toFixed(1)}%). Valuation withheld pending model recalibration.`;
  }

  return {
    countyFips: fips,
    countyName,
    stateCode,
    sampleCount,
    mdape,
    mape,
    medianBiasPct,
    shareWithin5Pct,
    shareWithin10Pct,
    shareWithin20Pct,
    status,
    withhold,
    withholdReason,
    supportedConfidenceMarginPct,
    priceBands,
    evaluations,
    lastVerified,
    sourceUrl
  };
}

/**
 * Checks whether an automated valuation should be withheld based on county back-test performance
 */
export function checkCountyBacktestWithholding(
  countyFips: string,
  benchmarks: Record<string, ValuationBacktestSummary>
): { withhold: boolean; reason: string | null; supportedMargin?: number } {
  const benchmark = benchmarks[countyFips];
  if (!benchmark) {
    // Unbenchmarked county: allow preliminary screening with standard default margin
    return {
      withhold: false,
      reason: null,
      supportedMargin: 0.08
    };
  }

  if (benchmark.withhold) {
    return {
      withhold: true,
      reason: benchmark.withholdReason || `Back-test against recorder sales failed error tolerance (MdAPE: ${(benchmark.mdape * 100).toFixed(1)}%).`,
      supportedMargin: benchmark.supportedConfidenceMarginPct
    };
  }

  return {
    withhold: false,
    reason: null,
    supportedMargin: benchmark.supportedConfidenceMarginPct
  };
}
