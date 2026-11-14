/**
 * Property Valuation Engine (AVM - Automated Valuation Model)
 * Zillow Zestimate-Grade Econometric Valuation Architecture
 */

export interface PropertyValuationInput {
  attributes: Record<string, any>;
  lotSqft?: number;
  neighborhood?: {
    hv?: number;
    yb?: number;
    c?: string;
    county?: string;
    [key: string]: any;
  };
  stateCode?: string;
  facts?: {
    bldg?: number;
    foot?: number;
    stories?: number;
    beds?: number;
    baths?: number;
    pool?: boolean;
    garage?: boolean;
    yb?: number;
    eff?: number;
    [key: string]: any;
  };
  salesInfo?: {
    price: number;
    date?: string;
    year?: number;
  } | null;
}

export interface PropertyValuationResult {
  estimatedValue: number;
  valueLow: number;
  valueHigh: number;
  vpsf: number;
  livingSqft: number;
  confidenceMarginPct: number;
  confidenceRating: string;
  valuationMethod: string;
  hedonicEst: number;
  assessorMarketEst: number | null;
  saleCompEst: number | null;
  siteValue?: number;
  structVal?: number;
}

export const HPI_INDEX_TO_2026: Record<number, number> = {
  2026: 1.000,
  2025: 1.042,
  2024: 1.085,
  2023: 1.138,
  2022: 1.182,
  2021: 1.315,
  2020: 1.485,
  2019: 1.580,
  2018: 1.660,
  2017: 1.765,
  2016: 1.880,
  2015: 1.995,
  2014: 2.120,
  2013: 2.270,
  2012: 2.450,
  2011: 2.580,
  2010: 2.520,
  2005: 2.150,
  2000: 3.450,
  1995: 4.600,
  1990: 5.400,
  1985: 7.200,
  1980: 9.800
};

export const STATE_BASELINE_PROFILES: Record<string, { medianHv: number; medianVpsf: number; refSqft: number; refLot: number }> = {
  AL: { medianHv: 235000, medianVpsf: 145, refSqft: 1850, refLot: 12000 },
  AK: { medianHv: 365000, medianVpsf: 215, refSqft: 1750, refLot: 10000 },
  AZ: { medianHv: 445000, medianVpsf: 250, refSqft: 1800, refLot: 6800 },
  AR: { medianHv: 210000, medianVpsf: 130, refSqft: 1750, refLot: 11000 },
  CA: { medianHv: 885000, medianVpsf: 545, refSqft: 1650, refLot: 6200 },
  CO: { medianHv: 565000, medianVpsf: 315, refSqft: 2000, refLot: 7500 },
  CT: { medianHv: 415000, medianVpsf: 240, refSqft: 1850, refLot: 18000 },
  DE: { medianHv: 370000, medianVpsf: 215, refSqft: 1900, refLot: 9500 },
  DC: { medianHv: 680000, medianVpsf: 510, refSqft: 1450, refLot: 3200 },
  FL: { medianHv: 415000, medianVpsf: 255, refSqft: 1750, refLot: 7200 },
  GA: { medianHv: 340000, medianVpsf: 185, refSqft: 2100, refLot: 14000 },
  HI: { medianHv: 895000, medianVpsf: 650, refSqft: 1450, refLot: 6500 },
  ID: { medianHv: 465000, medianVpsf: 255, refSqft: 1950, refLot: 8000 },
  IL: { medianHv: 295000, medianVpsf: 185, refSqft: 1650, refLot: 6500 },
  IN: { medianHv: 245000, medianVpsf: 145, refSqft: 1750, refLot: 8500 },
  IA: { medianHv: 225000, medianVpsf: 145, refSqft: 1600, refLot: 8500 },
  KS: { medianHv: 235000, medianVpsf: 140, refSqft: 1800, refLot: 9000 },
  KY: { medianHv: 215000, medianVpsf: 135, refSqft: 1700, refLot: 10500 },
  LA: { medianHv: 220000, medianVpsf: 135, refSqft: 1750, refLot: 8000 },
  ME: { medianHv: 395000, medianVpsf: 245, refSqft: 1650, refLot: 30000 },
  MD: { medianHv: 435000, medianVpsf: 245, refSqft: 1850, refLot: 9000 },
  MA: { medianHv: 640000, medianVpsf: 410, refSqft: 1700, refLot: 12000 },
  MI: { medianHv: 265000, medianVpsf: 175, refSqft: 1650, refLot: 8000 },
  MN: { medianHv: 345000, medianVpsf: 200, refSqft: 1900, refLot: 9500 },
  MS: { medianHv: 185000, medianVpsf: 115, refSqft: 1800, refLot: 14000 },
  MO: { medianHv: 255000, medianVpsf: 150, refSqft: 1750, refLot: 9000 },
  MT: { medianHv: 475000, medianVpsf: 270, refSqft: 1900, refLot: 12000 },
  NE: { medianHv: 265000, medianVpsf: 160, refSqft: 1700, refLot: 8000 },
  NV: { medianHv: 455000, medianVpsf: 260, refSqft: 1750, refLot: 6000 },
  NH: { medianHv: 470000, medianVpsf: 285, refSqft: 1800, refLot: 35000 },
  NJ: { medianHv: 535000, medianVpsf: 305, refSqft: 1800, refLot: 8500 },
  NM: { medianHv: 315000, medianVpsf: 185, refSqft: 1750, refLot: 8000 },
  NY: { medianHv: 475000, medianVpsf: 310, refSqft: 1650, refLot: 7000 },
  NC: { medianHv: 345000, medianVpsf: 195, refSqft: 1900, refLot: 14000 },
  ND: { medianHv: 265000, medianVpsf: 150, refSqft: 1850, refLot: 9000 },
  OH: { medianHv: 235000, medianVpsf: 145, refSqft: 1650, refLot: 8000 },
  OK: { medianHv: 215000, medianVpsf: 130, refSqft: 1750, refLot: 8500 },
  OR: { medianHv: 515000, medianVpsf: 305, refSqft: 1750, refLot: 7000 },
  PA: { medianHv: 275000, medianVpsf: 165, refSqft: 1650, refLot: 9500 },
  RI: { medianHv: 465000, medianVpsf: 310, refSqft: 1550, refLot: 8000 },
  SC: { medianHv: 315000, medianVpsf: 175, refSqft: 1950, refLot: 12000 },
  SD: { medianHv: 310000, medianVpsf: 175, refSqft: 1800, refLot: 9000 },
  TN: { medianHv: 335000, medianVpsf: 190, refSqft: 1900, refLot: 15000 },
  TX: { medianHv: 315000, medianVpsf: 175, refSqft: 2050, refLot: 7500 },
  UT: { medianHv: 535000, medianVpsf: 265, refSqft: 2300, refLot: 8500 },
  VT: { medianHv: 400000, medianVpsf: 240, refSqft: 1700, refLot: 40000 },
  VA: { medianHv: 405000, medianVpsf: 225, refSqft: 1950, refLot: 14000 },
  WA: { medianHv: 620000, medianVpsf: 365, refSqft: 1850, refLot: 7500 },
  WV: { medianHv: 165000, medianVpsf: 105, refSqft: 1650, refLot: 15000 },
  WI: { medianHv: 300000, medianVpsf: 185, refSqft: 1700, refLot: 9000 },
  WY: { medianHv: 355000, medianVpsf: 200, refSqft: 1950, refLot: 11000 },
  PR: { medianHv: 185000, medianVpsf: 125, refSqft: 1400, refLot: 4500 },
  DEFAULT: { medianHv: 360000, medianVpsf: 210, refSqft: 1750, refLot: 7500 }
};

export const LUXURY_TIER_MUNICIPALITIES: Record<string, number> = {
  "beverly hills": 3950000,
  "bel air": 4500000,
  "pacific palisades": 3650000,
  "malibu": 4100000,
  "rolling hills": 3400000,
  "san marino": 2950000,
  "manhattan beach": 3250000,
  "hermosa beach": 2550000,
  "newport beach": 3350000,
  "laguna beach": 3100000,
  "atherton": 6800000,
  "hillsborough": 5400000,
  "los altos hills": 5600000,
  "palo alto": 3750000,
  "saratoga": 3500000,
  "tiburon": 3250000,
  "aspen": 5800000,
  "palm beach": 4800000
};

export function getHpiMultiplier(year: number): number {
  if (!year || isNaN(year) || year >= 2026) return 1.0;
  if (year < 1980) year = 1980;
  if (HPI_INDEX_TO_2026[year]) return HPI_INDEX_TO_2026[year];
  
  const keys = Object.keys(HPI_INDEX_TO_2026).map(Number).sort((a, b) => b - a);
  for (let i = 0; i < keys.length - 1; i++) {
    const yHigh = keys[i], yLow = keys[i + 1];
    if (year <= yHigh && year >= yLow) {
      const frac = (year - yLow) / (yHigh - yLow);
      return HPI_INDEX_TO_2026[yLow] + frac * (HPI_INDEX_TO_2026[yHigh] - HPI_INDEX_TO_2026[yLow]);
    }
  }
  return 1.0;
}

export function getTierElasticity(salePrice: number): number {
  if (!salePrice || salePrice <= 450000) return 1.05;
  if (salePrice <= 950000) return 1.00;
  if (salePrice <= 1750000) return 0.82;
  if (salePrice <= 3200000) return 0.70;
  return 0.58;
}

export function estimatePropertyMarketValue(params: PropertyValuationInput): PropertyValuationResult {
  const { attributes: a = {}, lotSqft = 6000, neighborhood: m = {}, stateCode = "CA", facts: F = {}, salesInfo = null } = params;
  const state = (stateCode || "CA").toUpperCase();
  const profile = STATE_BASELINE_PROFILES[state] || STATE_BASELINE_PROFILES.DEFAULT;

  let livingSqft = F.bldg || 0;
  if (!livingSqft || livingSqft < 300) {
    const rawSqft = +(a.LIVING_AREA ?? a.BLDG_SQFT ?? a.total_lvg_area ?? a.BldgArea ?? a.RESFLRAREA ?? a.SQFT_LIVING ?? a.SQFTmain1 ?? a.FIN_SIZE ?? 0);
    if (rawSqft > 300 && (!lotSqft || rawSqft < lotSqft * 0.95 || rawSqft < 4500)) {
      livingSqft = rawSqft;
    }
  }
  if (!livingSqft || livingSqft < 300) {
    livingSqft = F.foot ? Math.round(F.foot * (F.stories || 1)) : profile.refSqft;
  }

  let baseNeighborhoodHv = m.hv;
  if (!baseNeighborhoodHv || baseNeighborhoodHv <= 10000) {
    baseNeighborhoodHv = profile.medianHv;
  } else {
    const cityKey = (m.c || a.county || "").toLowerCase().trim();
    if (baseNeighborhoodHv >= 1990000 && LUXURY_TIER_MUNICIPALITIES[cityKey]) {
      baseNeighborhoodHv = LUXURY_TIER_MUNICIPALITIES[cityKey];
    } else {
      baseNeighborhoodHv = Math.round(baseNeighborhoodHv * 1.165);
    }
  }

  let landShare = 0.45;
  if (["CA", "NY", "HI", "DC", "MA"].includes(state)) landShare = 0.58;
  else if (["CO", "FL", "WA", "OR", "IL", "NJ", "CT", "MD", "VA"].includes(state)) landShare = 0.42;
  else if (["TX", "GA", "NC", "AZ", "NV", "SC", "TN", "UT"].includes(state)) landShare = 0.35;
  else landShare = 0.28;

  const siteValue = baseNeighborhoodHv * landShare;
  const structBaseValue = baseNeighborhoodHv * (1 - landShare);

  const sqftRatio = Math.max(0.3, Math.min(3.8, livingSqft / profile.refSqft));
  const structVal = structBaseValue * Math.pow(sqftRatio, 0.68);

  const isCondo = /condo|condominium|pud|apt|apartment/i.test(a.UseDescription || a.ZoneCode || "") || lotSqft === 0 || (F.units > 1 && !F.yard);
  let lotAdj = 0;
  if (!isCondo && lotSqft > 0) {
    const effectiveLot = Math.max(1000, lotSqft);
    const lotDiff = effectiveLot - profile.refLot;
    const excessDecay = Math.pow(profile.refLot / Math.max(effectiveLot, 1000), 0.35);
    lotAdj = lotDiff * (siteValue / profile.refLot) * 0.18 * excessDecay;
    lotAdj = Math.max(-siteValue * 0.22, Math.min(siteValue * 0.30, lotAdj));
  }

  const beds = F.beds || +(a.Bedrooms1 ?? a.BEDROOMS ?? 3) || 3;
  const baths = F.baths || +(a.Bathrooms1 ?? a.BATHROOMS ?? 2) || 2;
  const bedBathAdj = Math.max(-0.15, Math.min(0.20, (beds - 3) * 0.025 + (baths - 2) * 0.035)) * structVal;

  const effYear = +(F.eff || a.EffectiveYear1 || a.EffectiveYear || a.EFF_YR_BLT || F.yb || a.YearBuilt1 || a.YearBuilt || a.CONST_YEAR || 1975) || 1975;
  const ageAdj = Math.max(-0.25, Math.min(0.25, (effYear - 1980) * 0.003)) * structVal;

  let qualityAdj = 0;
  const qClass = String(a.QualityClass || a.QualityClass1 || a.GRADE || a.IMPRV_QUAL || "").toUpperCase();
  if (/D[89]|DX|EXCELLENT|LUXURY/i.test(qClass)) qualityAdj = structVal * 0.16;
  else if (/D7|VERY GOOD|GOOD/i.test(qClass)) qualityAdj = structVal * 0.08;
  else if (/FAIR|LOW/i.test(qClass)) qualityAdj = -structVal * 0.08;

  const poolShare = ["CA", "FL", "AZ", "NV", "TX", "HI"].includes(state) ? 0.050 : 0.025;
  const poolBonus = F.pool ? (baseNeighborhoodHv * poolShare) : 0;
  const garageBonus = (F.garage || a.GARAGE || a.GARAGESQFT || /garage/i.test(a.UseDescription || "")) ? (baseNeighborhoodHv * 0.025) : 0;
  const viewBonus = (a.VIEW || /view|hill|ocean|waterfront|lake/i.test(a.ZoneCode || a.UseDescription || "")) ? (baseNeighborhoodHv * 0.035) : 0;

  const hasBasement = (a.BASEMENT || /basement/i.test(a.UseDescription || "")) && ["MI", "IL", "OH", "WI", "MN", "NY", "PA", "CO", "MA"].includes(state);
  const basementBonus = hasBasement ? (structVal * 0.10) : 0;

  const condoFactor = isCondo ? 0.92 : 1.0;
  const hedonicEst = Math.round((siteValue + structVal + lotAdj + bedBathAdj + ageAdj + qualityAdj + poolBonus + garageBonus + viewBonus + basementBonus) * condoFactor);

  let assessorMarketEst: number | null = null;
  let assessorWeight = 0;
  let assessorMethodName = "Assessor Market Value";

  const mktVal = +(a.MARKET_VALUE ?? a.TOT_MKT_VAL ?? a.TOTAL_MKT_VAL ?? a.TOTAL_MARKET ?? a.JV ?? a.FCV_CUR ?? a.ESTFMKVALUE ?? a.parval ?? a.MarketTot ?? a.APPRAISED_VALUE ?? a.TOTAL_APPRAISED ?? a.APPRAISED_VAL ?? a.ACTUAL_VAL ?? a.TOTAL_ACTUAL ?? a.RMV ?? a.RMV_TOTAL ?? a.AppraisedValue ?? a.TRUE_CASH_VALUE ?? 0);
  const sev = +(a.SEV ?? a.CNTASSDVALUE ?? 0);
  const rollLand = +(a.Roll_LandValue ?? a.LND_VAL ?? a.LNDVALUE ?? 0);
  const rollImp = +(a.Roll_ImpValue ?? a.IMPROVVAL ?? a.IMPVALUE ?? 0);
  const rollTot = +(a.Roll_TotalValue ?? a.TOTAL_VAL ?? a.ASSESSED_VAL ?? a.TAXABLE_VAL ?? (rollLand + rollImp)) || 0;
  const baseYear = +(a.Roll_LandBaseYear || a.Roll_ImpBaseYear || 0);

  if (state === "MI" && sev > 10000) {
    assessorMarketEst = Math.round(sev * 2.0 * 1.04);
    assessorWeight = 0.65;
    assessorMethodName = "Michigan 2x SEV True Cash Value";
  } else if (state === "FL" && (mktVal > 20000 || +(a.JV || 0) > 20000)) {
    const fVal = +(a.JV || mktVal);
    assessorMarketEst = Math.round(fVal * 1.03);
    assessorWeight = 0.60;
    assessorMethodName = "Florida Statutory Just Value";
  } else if (state === "TX" && mktVal > 20000) {
    assessorMarketEst = Math.round(mktVal * 1.03);
    assessorWeight = 0.60;
    assessorMethodName = "Texas CAD Total Market Value";
  } else if (state === "NY" && mktVal > 20000) {
    assessorMarketEst = Math.round(mktVal * 1.02);
    assessorWeight = 0.60;
    assessorMethodName = "NYC MapPLUTO Market Value";
  } else if (state === "WI" && (mktVal > 20000 || +(a.ESTFMKVALUE || 0) > 20000)) {
    const wVal = +(a.ESTFMKVALUE || mktVal);
    assessorMarketEst = Math.round(wVal * 1.02);
    assessorWeight = 0.60;
    assessorMethodName = "Wisconsin Estimated Fair Market Value";
  } else if (state === "NC" && (mktVal > 20000 || +(a.parval || 0) > 20000)) {
    const nVal = +(a.parval || mktVal);
    assessorMarketEst = Math.round(nVal * 1.02);
    assessorWeight = 0.60;
    assessorMethodName = "NC Appraised Market Value";
  } else if (state === "OH" && rollTot > 10000 && !mktVal) {
    assessorMarketEst = Math.round((rollTot / 0.35) * 1.02);
    assessorWeight = 0.60;
    assessorMethodName = "Ohio 35% Assessment Ratio Fair Market Value";
  } else if (state === "IL" && rollTot > 10000 && !mktVal) {
    assessorMarketEst = Math.round(rollTot * 10.0 * 1.02);
    assessorWeight = 0.55;
    assessorMethodName = "Cook County 10% Assessment Ratio Market Value";
  } else if (state === "GA" && rollTot > 10000 && !mktVal) {
    assessorMarketEst = Math.round((rollTot / 0.40) * 1.02);
    assessorWeight = 0.55;
    assessorMethodName = "Georgia 40% Assessment Ratio Market Value";
  } else if (state === "NV" && rollTot > 10000 && !mktVal) {
    assessorMarketEst = Math.round((rollTot / 0.35) * 1.02);
    assessorWeight = 0.55;
    assessorMethodName = "Nevada 35% Taxable Value Ratio";
  } else if (state === "TN" && rollTot > 10000 && !mktVal) {
    assessorMarketEst = Math.round((rollTot / 0.25) * 1.02);
    assessorWeight = 0.55;
    assessorMethodName = "Tennessee 25% Assessment Ratio";
  } else if (state === "CO" && rollTot > 5000 && !mktVal) {
    assessorMarketEst = Math.round((rollTot / 0.067) * 1.02);
    assessorWeight = 0.55;
    assessorMethodName = "Colorado 6.7% Residential Assessment Rate";
  } else if (state === "CA" && rollTot > 50000) {
    let effBaseYear = baseYear;
    if (!effBaseYear && salesInfo && salesInfo.year) {
      effBaseYear = salesInfo.year;
    }

    if (effBaseYear && effBaseYear >= 1980 && effBaseYear <= 2026) {
      const hpiMult = getHpiMultiplier(effBaseYear);
      const prop13Compounding = Math.pow(1.02, Math.min(2026 - effBaseYear, 40));
      const inferredPurchasePrice = rollTot / prop13Compounding;
      const tierEl = getTierElasticity(inferredPurchasePrice);
      const effectiveHpi = 1.0 + (hpiMult - 1.0) * tierEl;
      assessorMarketEst = Math.round(inferredPurchasePrice * effectiveHpi);
      assessorWeight = effBaseYear >= 2018 ? 0.60 : 0.45;
      assessorMethodName = "Prop 13 Base-Year Index (" + effBaseYear + ")";
    } else if (rollTot < baseNeighborhoodHv * 0.80) {
      const tenureYears = Math.max(1, Math.min(42, Math.log(baseNeighborhoodHv / Math.max(rollTot, 25000)) / 0.035));
      const impliedYear = Math.round(2026 - tenureYears);
      const hpiMult = getHpiMultiplier(impliedYear);
      const prop13Compounding = Math.pow(1.02, tenureYears);
      const inferredPurchasePrice = rollTot / prop13Compounding;
      const tierEl = getTierElasticity(inferredPurchasePrice);
      const effectiveHpi = 1.0 + (hpiMult - 1.0) * tierEl;
      assessorMarketEst = Math.round(inferredPurchasePrice * effectiveHpi);
      assessorWeight = 0.40;
      assessorMethodName = "Prop 13 Inferred Base-Year (" + impliedYear + ")";
    } else {
      assessorMarketEst = Math.round(rollTot * 1.08);
      assessorWeight = 0.55;
      assessorMethodName = "Recent County Assessor Roll Total";
    }
  } else if (mktVal > 25000) {
    assessorMarketEst = Math.round(mktVal * 1.03);
    assessorWeight = 0.60;
    assessorMethodName = "Assessor Full Market Value";
  }

  let saleCompEst: number | null = null;
  let saleWeight = 0;
  
  const rawSalePrice = salesInfo?.price || +(a.SALEPRICE ?? a.DOCUMENTVALUE ?? a.SalePrice ?? a.FORMATTED_SALEPRICE ?? a.LAST_SALE_PRICE ?? a.LastSalePrice ?? a.SALE_PRICE ?? a.SALES_PRICE ?? a.SALE_AMT ?? a.PRICE ?? 0);
  const rawSaleDate = salesInfo?.date || a.SALEDATE || a.SaleDate || a.FORMATTED_SALEDATE || a.LAST_SALE_DATE || a.LastSaleDate || a.SALE_DATE || "";
  const rawSaleYear = salesInfo?.year || (rawSaleDate ? +String(rawSaleDate).replace(/\D/g, "").slice(0, 4) : null);

  if (rawSalePrice > 25000 && rawSaleYear && rawSaleYear >= 1980 && rawSaleYear <= 2026) {
    const rawHpi = getHpiMultiplier(rawSaleYear);
    const tierEl = getTierElasticity(rawSalePrice);
    const effectiveHpi = 1.0 + (rawHpi - 1.0) * tierEl;
    saleCompEst = Math.round(rawSalePrice * effectiveHpi);
    saleWeight = rawSaleYear >= 2021 ? 0.70 : rawSaleYear >= 2015 ? 0.55 : 0.35;
  }

  let totalWeight = 0;
  let weightedSum = 0;
  let methodTokens: string[] = [];

  if (saleCompEst && saleWeight > 0) {
    weightedSum += saleCompEst * saleWeight;
    totalWeight += saleWeight;
    methodTokens.push("HPI Repeat-Sales Index");
  }

  if (assessorMarketEst && assessorWeight > 0) {
    weightedSum += assessorMarketEst * assessorWeight;
    totalWeight += assessorWeight;
    methodTokens.push(assessorMethodName);
  }

  const hedonicWeight = Math.max(0.20, 1.0 - totalWeight);
  weightedSum += hedonicEst * hedonicWeight;
  totalWeight += hedonicWeight;
  methodTokens.push("Hedonic Micro-Model");

  const rawEstimatedValue = Math.round(weightedSum / totalWeight);
  const estimatedValue = Math.round(rawEstimatedValue / 1000) * 1000;
  const finalVpsf = Math.round(estimatedValue / Math.max(livingSqft, 1));

  let confMarginPct = 0.065;
  let confidenceRating = "⭐⭐⭐ Good Precision (Hedonic & Assessment Grounded)";

  if (saleCompEst && assessorMarketEst) {
    const divergence = Math.abs(saleCompEst - assessorMarketEst) / Math.max(saleCompEst, assessorMarketEst);
    if (divergence <= 0.08) {
      confMarginPct = 0.038;
      confidenceRating = "⭐⭐⭐⭐ High Precision (Dual-Source Sales & Assessor Agreement)";
    } else {
      confMarginPct = 0.050;
      confidenceRating = "⭐⭐⭐ High Confidence (Multi-Model Synthesis)";
    }
  } else if (!saleCompEst && !assessorMarketEst) {
    confMarginPct = 0.078;
    confidenceRating = "⭐⭐ Preliminary Screening (Census Block-Group Grounded)";
  }

  const valueLow = Math.round((estimatedValue * (1 - confMarginPct)) / 1000) * 1000;
  const valueHigh = Math.round((estimatedValue * (1 + confMarginPct)) / 1000) * 1000;

  return {
    estimatedValue,
    valueLow,
    valueHigh,
    vpsf: finalVpsf,
    livingSqft,
    confidenceMarginPct: confMarginPct,
    confidenceRating,
    valuationMethod: methodTokens.join(" + "),
    hedonicEst,
    assessorMarketEst,
    saleCompEst,
    siteValue: Math.round(siteValue),
    structVal: Math.round(structVal)
  };
}
