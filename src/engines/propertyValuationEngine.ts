// Mirror of the browser engine in app/app.js (estimatePropertyMarketValue). Keep the two in step.
export interface PropertyValuationInput {
  attributes?: Record<string, any>;
  lotSqft?: number | null;
  neighborhood?: { hv?: number | null; c?: string; [k: string]: any };
  stateCode?: string | null;
  facts?: Record<string, any>;
  salesInfo?: { price: number; date?: string; year?: number | null } | null;
}

export interface PropertyValuationResult {
  estimatedValue: number | null;
  valueLow: null;
  valueHigh: null;
  vpsf: number | null;
  livingSqft: number | null;
  lotSqft: number | null;
  isVacantLand: boolean;
  confidenceMarginPct: null;
  confidenceRating: string;
  valuationMethod: string | null;
  withheldReason: string | null;
  notes: string[];
  hedonicEst: number | null;
  assessorMarketEst: number | null;
  saleCompEst: number | null;
  siteValue: number | null;
  structVal: number | null;
}

/**
 * Property value screening estimate (NOT an appraisal).
 *
 * Status: UNVALIDATED. No back-test against recorded sales has been run. (An earlier "back-test" was computed on
 * invented sales and was removed 2026-11-16.) Because no error rate has been measured, no ± range is produced.
 *
 * Only inputs actually on file are used; nothing is filled in with a "typical" number:
 *   1. A recorded sale from the last two calendar years, at its recorded price. No house-price index is loaded yet,
 *      so older sales are not indexed forward and are not used.
 *   2. The assessor's market value, converted with the state's statutory assessment ratio where one applies.
 *      (Ratios are listed in-line with their statute; they are being re-verified by the laws audit.) California
 *      Prop 13 roll values are used only when the base year is within the last two years, since older base years
 *      cannot be brought to market without a price index.
 *   3. A hedonic model anchored on the block group's Census ACS median home value. Every coefficient in it is an
 *      uncalibrated modeling assumption (VALUATION_ASSUMPTIONS); none has been fit to local sales.
 * If none of the three can run, the estimate is withheld (estimatedValue = null) with the reason.
 */

export const VALUATION_CURRENT_YEAR = 2026;
export const VALUATION_STATUS_LABEL = "Unvalidated estimate — no back-test against sales yet";

// Uncalibrated modeling assumptions. Listed together so they can be shown, questioned and replaced.
export const VALUATION_ASSUMPTIONS = {
  refSqft: 1750,          // living area treated as "typical" for the ACS median (assumption)
  refLot: 7500,           // lot size treated as "typical" for the ACS median (assumption)
  glaElasticity: 0.68,    // value elasticity of living area (assumption)
  lotUtility: 0.18,       // share of site value per unit of excess lot (assumption)
  acsTopCode: 2000000,    // ACS median home value is top-coded near $2,000,001 (Census table B25077)
};

export function estimatePropertyMarketValue(params: PropertyValuationInput): PropertyValuationResult {
  const { attributes: a = {}, lotSqft = null, neighborhood: m = {}, stateCode = "", facts: F = {}, salesInfo = null } = (params || {}) as PropertyValuationInput;
  const state = String(stateCode || "").toUpperCase();
  const A = VALUATION_ASSUMPTIONS;
  const notes: string[] = [];

  // 1. Vacant land vs. improved, and living area (only from records; never a default)
  const useDesc = String(a.UseDescription || a.UseType || a.USE_CODE_DESC || a.DESCRIPT || a.LAND_USE || "").toLowerCase();
  const useCode = String(a.UseCode || a.USECODE || a.DOR_UC || a.StateClassCode || "").toUpperCase();
  const rollImpVal = +(a.Roll_ImpValue ?? a.IMPROVVAL ?? a.IMPVALUE ?? a.IMPRV_VAL ?? 0);
  const isVacantLand = (/vacant|unimproved|bare land|raw land|vac res/i.test(useDesc) || /^010V|^0000|^VAC/i.test(useCode)) &&
    (!F.bldg || F.bldg === 0) &&
    (!F.foot || F.foot < 150) &&
    (!a.YearBuilt1 && !a.YearBuilt && !F.yb) &&
    rollImpVal === 0;

  let livingSqft: number | null = null;
  if (!isVacantLand) {
    if (F.bldg && F.bldg >= 300) livingSqft = F.bldg;
    if (!livingSqft) {
      const rawSqft = +(a.LIVING_AREA ?? a.BLDG_SQFT ?? a.total_lvg_area ?? a.BldgArea ?? a.RESFLRAREA ?? a.SQFT_LIVING ?? a.SQFTmain1 ?? a.FIN_SIZE ?? 0);
      if (rawSqft > 300 && (!lotSqft || rawSqft < (lotSqft as number) * 0.95 || rawSqft < 4500)) livingSqft = rawSqft;
    }
    if (!livingSqft && F.foot) livingSqft = Math.round(F.foot * (F.stories || 1));
    if (!livingSqft) notes.push("Living area not on file; the model treats the home as neighborhood-typical in size.");
  }

  // 2. Hedonic anchor: the block group's ACS median home value, as published (no inflation factor is applied).
  let hedonicEst: number | null = null, siteValue: number | null = null, structVal: number | null = null;
  const acsHv = +(m.hv ?? 0) || 0;
  if (acsHv > 10000 && acsHv < A.acsTopCode) {
    // Land share of value by state group (assumption)
    let landShare = 0.28;
    if (["CA", "NY", "HI", "DC", "MA"].includes(state)) landShare = 0.58;
    else if (["CO", "FL", "WA", "OR", "IL", "NJ", "CT", "MD", "VA"].includes(state)) landShare = 0.42;
    else if (["TX", "GA", "NC", "AZ", "NV", "SC", "TN", "UT"].includes(state)) landShare = 0.35;

    const site: number = acsHv * landShare;
    siteValue = site;
    const structBase = isVacantLand ? 0 : acsHv * (1 - landShare);
    const sqftRatio = (isVacantLand || !livingSqft) ? 1 : Math.max(0.3, Math.min(3.8, livingSqft / A.refSqft));
    const sv: number = isVacantLand ? 0 : structBase * Math.pow(sqftRatio, A.glaElasticity);
    structVal = sv;

    const isCondo = /condo|condominium|pud|apt|apartment/i.test(a.UseDescription || a.ZoneCode || "") || lotSqft === 0 || (!lotSqft && F.units > 1);
    let lotAdj = 0;
    if (!isCondo && (lotSqft || 0) > 0) {
      const effectiveLot = Math.max(1000, lotSqft as number);
      const excessDecay = Math.pow(A.refLot / effectiveLot, 0.35);
      lotAdj = (effectiveLot - A.refLot) * (siteValue / A.refLot) * A.lotUtility * excessDecay;
      lotAdj = Math.max(-siteValue * 0.22, Math.min(siteValue * 0.30, lotAdj));
    }

    // Adjustments run only on recorded facts; an unknown fact contributes nothing.
    const beds = +(F.beds || a.Bedrooms1 || a.BEDROOMS || 0) || null;
    const baths = +(F.baths || a.Bathrooms1 || a.BATHROOMS || 0) || null;
    const bedBathAdj = (beds || baths) ? Math.max(-0.15, Math.min(0.20, (beds ? (beds - 3) * 0.025 : 0) + (baths ? (baths - 2) * 0.035 : 0))) * sv : 0;
    const effYear = +(F.eff || a.EffectiveYear1 || a.EffectiveYear || a.EFF_YR_BLT || F.yb || a.YearBuilt1 || a.YearBuilt || a.CONST_YEAR || 0) || null;
    const ageAdj = effYear ? Math.max(-0.25, Math.min(0.25, (effYear - 1980) * 0.003)) * sv : 0;

    let qualityAdj = 0;
    const qClass = String(a.QualityClass || a.QualityClass1 || a.GRADE || a.IMPRV_QUAL || "").toUpperCase();
    if (/D[89]|DX|EXCELLENT|LUXURY/i.test(qClass)) qualityAdj = sv * 0.16;
    else if (/D7|VERY GOOD|GOOD/i.test(qClass)) qualityAdj = sv * 0.08;
    else if (/FAIR|LOW/i.test(qClass)) qualityAdj = -sv * 0.08;

    const poolShare = ["CA", "FL", "AZ", "NV", "TX", "HI"].includes(state) ? 0.050 : 0.025;
    const poolBonus = F.pool ? acsHv * poolShare : 0;
    const garageBonus = (F.garage || a.GARAGE || a.GARAGESQFT) ? acsHv * 0.025 : 0;
    const viewBonus = a.VIEW ? acsHv * 0.035 : 0;
    const hasBasement = (a.BASEMENT || /basement/i.test(a.UseDescription || "")) && ["MI", "IL", "OH", "WI", "MN", "NY", "PA", "CO", "MA"].includes(state);
    const basementBonus = hasBasement ? sv * 0.10 : 0;
    const condoFactor = isCondo ? 0.92 : 1.0;
    const unitsCount = +(F.units || a.Units1 || a.Units || 1) || 1;
    const multiUnitBonus = (!isVacantLand && unitsCount > 1) ? Math.min(0.24, (unitsCount - 1) * 0.08) * sv : 0;

    hedonicEst = isVacantLand ? Math.round(siteValue + lotAdj) :
      Math.round((siteValue + structVal + lotAdj + bedBathAdj + ageAdj + qualityAdj + poolBonus + garageBonus + viewBonus + basementBonus + multiUnitBonus) * condoFactor);
  } else if (acsHv >= A.acsTopCode) {
    notes.push("The block group's ACS median home value is top-coded (about $2M+), so the neighborhood model cannot anchor on it.");
  } else {
    notes.push("No Census ACS median home value on file for this block group.");
  }

  // 3. Assessor market value via statutory ratio (no markups)
  let assessorMarketEst: number | null = null, assessorWeight = 0, assessorMethodName: string | null = null;
  const mktVal = +(a.MARKET_VALUE ?? a.TOT_MKT_VAL ?? a.TOTAL_MKT_VAL ?? a.TOTAL_MARKET ?? a.JV ?? a.FCV_CUR ?? a.FCV ?? a.FCVTOT ?? a.TOTAL_FCV ?? a.ESTFMKVALUE ?? a.parval ?? a.MarketTot ?? a.APPRAISED_VALUE ?? a.TOTAL_APPRAISED ?? a.APPRAISED_VAL ?? a.APPR_VALUE ?? a.ACTUAL_VAL ?? a.TOTAL_ACTUAL ?? a.RMV ?? a.RMV_TOTAL ?? a.AppraisedValue ?? a.MarketValue ?? a.MARKET_VAL ?? a.TRUE_CASH_VALUE ?? 0);
  const sev = +(a.SEV ?? a.CNTASSDVALUE ?? 0);
  const rollLand = +(a.Roll_LandValue ?? a.LND_VAL ?? a.LNDVALUE ?? 0);
  const rollImp = +(a.Roll_ImpValue ?? a.IMPROVVAL ?? a.IMPVALUE ?? 0);
  const rollTot = +(a.Roll_TotalValue ?? a.TOTAL_VAL ?? a.ASSESSED_VAL ?? a.TAXABLE_VAL ?? (rollLand + rollImp)) || 0;
  const baseYear = +(a.Roll_LandBaseYear || a.Roll_ImpBaseYear || 0);
  const ratioStates: Record<string, [number, string]> = {
    // state: [ratio of assessed to market, statute as cited in the code; pending verification]
    OH: [0.35, "Ohio R.C. 5715.01 35% assessment"],
    IL: [0.10, "Cook County Class 2 10% assessment level"],
    GA: [0.40, "Georgia O.C.G.A. 48-5-7 40% assessment"],
    NV: [0.35, "Nevada NRS 361.225 35% of taxable value"],
    TN: [0.25, "Tennessee 25% residential assessment"],
  };

  if (state === "MI" && sev > 10000) {
    assessorMarketEst = Math.round(sev * 2.0);
    assessorWeight = 0.65;
    assessorMethodName = "Michigan SEV x 2 (SEV is 50% of true cash value)";
  } else if (["FL", "TX", "AZ", "WA", "OR", "PA", "NY", "WI", "NC"].includes(state) && mktVal > 20000) {
    const v = +(a.JV || a.FCV || a.FCVTOT || a.TOTAL_FCV || a.AppraisedValue || a.APPR_VALUE || a.APPRAISED_VALUE || a.RMV || a.RMV_TOTAL || a.MarketValue || a.MARKET_VAL || a.ESTFMKVALUE || a.parval || mktVal);
    assessorMarketEst = Math.round(v);
    assessorWeight = 0.60;
    assessorMethodName = state + " assessor market value (as recorded)";
  } else if (ratioStates[state] && rollTot > 10000 && !mktVal) {
    const [ratio, label] = ratioStates[state];
    assessorMarketEst = Math.round(rollTot / ratio);
    assessorWeight = 0.55;
    assessorMethodName = label;
  } else if (state === "CA" && rollTot > 50000) {
    const effBaseYear = baseYear || (salesInfo && salesInfo.year) || null;
    if (effBaseYear && effBaseYear >= VALUATION_CURRENT_YEAR - 1) {
      assessorMarketEst = Math.round(rollTot);
      assessorWeight = 0.55;
      assessorMethodName = "Prop 13 roll value, recent base year (" + effBaseYear + ")";
    } else {
      notes.push("California roll value has an older Prop 13 base year; without a price index it cannot be brought to market value, so it is not used.");
    }
  } else if (mktVal > 25000) {
    assessorMarketEst = Math.round(mktVal);
    assessorWeight = 0.60;
    assessorMethodName = "Assessor market value (as recorded)";
  }

  // 4. Recent recorded sale (no index)
  let saleCompEst: number | null = null, saleWeight = 0;
  const rawSalePrice = (salesInfo && salesInfo.price) || +(a.SALEPRICE ?? a.DOCUMENTVALUE ?? a.SalePrice ?? a.FORMATTED_SALEPRICE ?? a.LAST_SALE_PRICE ?? a.LastSalePrice ?? a.SALE_PRICE ?? a.SALES_PRICE ?? a.SALE_AMT ?? a.PRICE ?? 0);
  const rawSaleDate = (salesInfo && salesInfo.date) || a.SALEDATE || a.SaleDate || a.FORMATTED_SALEDATE || a.LAST_SALE_DATE || a.LastSaleDate || a.SALE_DATE || "";
  const rawSaleYear = (salesInfo && salesInfo.year) || (rawSaleDate ? +String(rawSaleDate).replace(/\D/g, "").slice(0, 4) : null);
  if (rawSalePrice > 25000 && rawSaleYear && rawSaleYear >= VALUATION_CURRENT_YEAR - 1 && rawSaleYear <= VALUATION_CURRENT_YEAR) {
    saleCompEst = Math.round(rawSalePrice);
    saleWeight = 0.70;
  } else if (rawSalePrice > 25000 && rawSaleYear) {
    notes.push("Last recorded sale (" + rawSaleYear + ") is too old to use without a house-price index.");
  }

  // 5. Weighted blend of the components that ran (weights are judgment, not fitted)
  let totalWeight = 0, weightedSum = 0;
  const methodTokens: string[] = [];
  if (saleCompEst) { weightedSum += saleCompEst * saleWeight; totalWeight += saleWeight; methodTokens.push("Recent recorded sale"); }
  if (assessorMarketEst) { weightedSum += assessorMarketEst * assessorWeight; totalWeight += assessorWeight; methodTokens.push(assessorMethodName || "Assessor value"); }
  if (hedonicEst) { const w = Math.max(0.20, 1.0 - totalWeight); weightedSum += hedonicEst * w; totalWeight += w; methodTokens.push("Neighborhood model on ACS median (uncalibrated)"); }

  const estimatedValue = totalWeight > 0 ? Math.round(weightedSum / totalWeight / 1000) * 1000 : null;
  let vpsf: number | null = null;
  if (estimatedValue) {
    if (isVacantLand && (lotSqft || 0) > 0) vpsf = Math.round(estimatedValue / (lotSqft as number));
    else if (livingSqft) vpsf = Math.round(estimatedValue / livingSqft);
  }

  return {
    estimatedValue,
    valueLow: null,
    valueHigh: null,
    vpsf,
    livingSqft: isVacantLand ? 0 : livingSqft,
    lotSqft,
    isVacantLand: !!isVacantLand,
    confidenceMarginPct: null,
    confidenceRating: estimatedValue ? VALUATION_STATUS_LABEL : "Withheld — not enough on file to estimate",
    valuationMethod: methodTokens.length ? methodTokens.join(" + ") : null,
    withheldReason: estimatedValue ? null : (notes.join(" ") || "No sale, assessor value or ACS median on file."),
    notes,
    hedonicEst,
    assessorMarketEst,
    saleCompEst,
    siteValue: siteValue == null ? null : Math.round(siteValue),
    structVal: structVal == null ? null : Math.round(structVal),
  };
}
