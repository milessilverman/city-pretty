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
  valuationMethod: string;
  hedonicEst: number;
  assessorMarketEst: number | null;
  saleCompEst: number | null;
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
  CA: { medianHv: 880000, medianVpsf: 540, refSqft: 1650, refLot: 6200 },
  MI: { medianHv: 325000, medianVpsf: 195, refSqft: 1700, refLot: 7500 },
  TX: { medianHv: 315000, medianVpsf: 185, refSqft: 2000, refLot: 7200 },
  FL: { medianHv: 420000, medianVpsf: 260, refSqft: 1750, refLot: 7000 },
  NY: { medianHv: 650000, medianVpsf: 420, refSqft: 1550, refLot: 5000 },
  WA: { medianHv: 640000, medianVpsf: 380, refSqft: 1850, refLot: 6800 },
  IL: { medianHv: 310000, medianVpsf: 190, refSqft: 1650, refLot: 6000 },
  NC: { medianHv: 340000, medianVpsf: 200, refSqft: 1850, refLot: 8500 },
  AZ: { medianHv: 440000, medianVpsf: 250, refSqft: 1800, refLot: 6500 },
  DEFAULT: { medianHv: 360000, medianVpsf: 210, refSqft: 1750, refLot: 7000 }
};

export function getHpiMultiplier(year?: number | null): number {
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
    baseNeighborhoodHv = Math.round(baseNeighborhoodHv * 1.165);
  }

  const sqftRatio = Math.max(0.3, Math.min(3.5, livingSqft / profile.refSqft));
  const sqftElasticity = Math.pow(sqftRatio, 0.72);

  const effectiveLot = Math.max(1000, lotSqft || profile.refLot);
  const lotRatio = Math.max(0.4, Math.min(4.0, effectiveLot / profile.refLot));
  const lotFactor = 1.0 + 0.15 * Math.log(lotRatio);

  const beds = F.beds || +(a.Bedrooms1 ?? a.BEDROOMS ?? 3) || 3;
  const baths = F.baths || +(a.Bathrooms1 ?? a.BATHROOMS ?? 2) || 2;
  const bedBathFactor = 1.0 + Math.max(-0.12, Math.min(0.18, (beds - 3) * 0.035 + (baths - 2) * 0.045));

  const effYear = +(F.eff || a.EffectiveYear1 || a.EffectiveYear || a.EFF_YR_BLT || F.yb || a.YearBuilt1 || a.YearBuilt || a.CONST_YEAR || 1975) || 1975;
  const ageFactor = Math.max(0.80, Math.min(1.22, 1.0 + (effYear - 1980) * 0.0035));

  const poolBonus = F.pool ? (baseNeighborhoodHv * 0.045) : 0;
  const hedonicEst = Math.round(baseNeighborhoodHv * sqftElasticity * lotFactor * bedBathFactor * ageFactor + poolBonus);

  let assessorMarketEst: number | null = null;
  let assessorWeight = 0;

  const jv = +(a.JV ?? a.FCV_CUR ?? a.ESTFMKVALUE ?? a.parval ?? a.MarketTot ?? a.TOTAL_MKT_VAL ?? a.MARKET_VALUE ?? 0);
  const sev = +(a.SEV ?? a.CNTASSDVALUE ?? 0);
  const rollLand = +(a.Roll_LandValue ?? a.LND_VAL ?? a.LNDVALUE ?? 0);
  const rollImp = +(a.Roll_ImpValue ?? a.IMPROVVAL ?? a.IMPVALUE ?? 0);
  const rollTot = +(a.Roll_TotalValue ?? a.TOTAL_VAL ?? (rollLand + rollImp)) || 0;
  const baseYear = +(a.Roll_LandBaseYear || a.Roll_ImpBaseYear || 0);

  if (state === "MI" && sev > 10000) {
    assessorMarketEst = Math.round(sev * 2.0 * 1.04);
    assessorWeight = 0.65;
  } else if (jv > 20000) {
    assessorMarketEst = Math.round(jv * 1.03);
    assessorWeight = 0.60;
  } else if (state === "CA" && rollTot > 50000) {
    if (baseYear && baseYear >= 1980 && baseYear <= 2026) {
      const hpiMult = getHpiMultiplier(baseYear);
      const prop13Compounding = Math.pow(1.02, Math.min(2026 - baseYear, 40));
      const inferredPurchasePrice = rollTot / prop13Compounding;
      assessorMarketEst = Math.round(inferredPurchasePrice * hpiMult);
      assessorWeight = baseYear >= 2018 ? 0.60 : 0.40;
    } else if (rollTot > baseNeighborhoodHv * 0.4) {
      assessorMarketEst = Math.round(rollTot * 1.15);
      assessorWeight = 0.30;
    }
  }

  let saleCompEst: number | null = null;
  let saleWeight = 0;
  if (salesInfo && salesInfo.price > 25000) {
    const sYear = salesInfo.year || (salesInfo.date ? +String(salesInfo.date).replace(/\D/g, "").slice(0, 4) : null);
    if (sYear && sYear >= 1980 && sYear <= 2026) {
      const hpiMult = getHpiMultiplier(sYear);
      saleCompEst = Math.round(salesInfo.price * hpiMult);
      saleWeight = sYear >= 2021 ? 0.70 : sYear >= 2015 ? 0.55 : 0.35;
    }
  }

  let totalWeight = 0;
  let weightedSum = 0;
  const methodTokens: string[] = [];

  if (saleCompEst && saleWeight > 0) {
    weightedSum += saleCompEst * saleWeight;
    totalWeight += saleWeight;
    methodTokens.push("HPI Repeat-Sales Index");
  }

  if (assessorMarketEst && assessorWeight > 0) {
    weightedSum += assessorMarketEst * assessorWeight;
    totalWeight += assessorWeight;
    methodTokens.push(state === "MI" ? "Michigan 2x SEV True Cash Value" : state === "CA" ? "Prop 13 Base-Year Index" : "Assessor Market Value");
  }

  const hedonicWeight = Math.max(0.20, 1.0 - totalWeight);
  weightedSum += hedonicEst * hedonicWeight;
  totalWeight += hedonicWeight;
  methodTokens.push("Hedonic Micro-Model");

  const rawEstimatedValue = Math.round(weightedSum / totalWeight);
  const estimatedValue = Math.round(rawEstimatedValue / 1000) * 1000;
  const finalVpsf = Math.round(estimatedValue / Math.max(livingSqft, 1));

  let confMarginPct = 0.065;
  if (saleCompEst && assessorMarketEst) {
    confMarginPct = 0.045;
  } else if (!saleCompEst && !assessorMarketEst) {
    confMarginPct = 0.085;
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
    valuationMethod: methodTokens.join(" + "),
    hedonicEst,
    assessorMarketEst,
    saleCompEst
  };
}
