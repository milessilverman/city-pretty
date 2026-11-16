/**
 * Valuation Back-Testing Engine (CommonJS companion)
 * Implements Item 8 of ACCURACY-ROADMAP.md
 */

const {
  estimatePropertyMarketValue
} = (typeof require !== "undefined")
  ? require("./propertyValuationEngine")
  : { estimatePropertyMarketValue: (typeof window !== "undefined" ? window.estimatePropertyMarketValue : null) };

function median(values) {
  if (!values || values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function runCountyValuationBacktest(sales, options = {}) {
  const fips = options.countyFips || (sales[0] ? sales[0].countyFips : "00000");
  const countyName = options.countyName || (sales[0] ? sales[0].countyName : "Unknown County");
  const stateCode = (options.stateCode || (sales[0] ? sales[0].stateCode : "CA")).toUpperCase();
  const sourceUrl = options.sourceUrl || (sales[0] ? sales[0].sourceUrl : undefined);
  const lastVerified = options.lastVerified || "2026-11-15";

  const validSales = (sales || []).filter(s => s.isArmsLength && s.salePrice >= 25000);

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

  const evaluations = [];

  for (const s of validSales) {
    const valInput = {
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
      salesInfo: s.priorSale || null
    };

    const result = estimatePropertyMarketValue(valInput);
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

  const bands = [
    { name: "< $500k", filter: p => p < 500000 },
    { name: "$500k - $1M", filter: p => p >= 500000 && p < 1000000 },
    { name: "$1M - $2M", filter: p => p >= 1000000 && p < 2000000 },
    { name: "> $2M", filter: p => p >= 2000000 }
  ];

  const priceBands = bands.map(b => {
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

  let status;
  let withhold = false;
  let withholdReason = null;
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

function checkCountyBacktestWithholding(countyFips, benchmarks) {
  const benchmark = benchmarks ? benchmarks[countyFips] : null;
  if (!benchmark) {
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

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    runCountyValuationBacktest,
    checkCountyBacktestWithholding,
    median
  };
}
