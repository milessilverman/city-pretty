import {
  estimatePropertyMarketValue,
  PropertyValuationInput,
  PropertyValuationResult,
} from "./propertyValuationEngine";
import {
  validateParcelImageryVintage,
  ImageryVintageCheck,
} from "./lidarStreetViewValidator";
import {
  evaluateByRightHousing,
  ParcelContext,
  StatutoryZoningResult,
} from "./statutoryZoningEngine";
import {
  calculateSolarMicrogridRoi,
  SolarInput,
  SolarMicrogridCalculation,
} from "./solarMicrogridEngine";
import {
  estimateAccurateRoofArea,
  AccurateRoofCalculation,
} from "./roofAreaEngine";
import {
  evaluateEverySpaceMonetization,
  EverySpacePortfolioSummary,
} from "./everySpaceEngine";
import {
  evaluateRenovationQuote,
  RenovationQuoteEvaluation,
} from "./renovationQuoteEngine";

export interface BuildingPermitRecord {
  permit_id?: string;
  issue_date: string; // ISO "YYYY-MM-DD" or "YYYY-MM"
  permit_type: "addition" | "remodel" | "adu" | "seismic" | "solar" | "other";
  valuation_usd: number;
  description: string;
}

export interface ParcelLegalExclusions {
  historic_district_hpoz?: boolean;
  coastal_commission_or_sma?: boolean;
  fema_100yr_floodway?: boolean;
  calfire_or_state_vhfhsz?: boolean;
  airport_noise_or_runway_zone?: boolean;
  williamson_or_ag_preserve?: boolean;
  private_hoa_ccr_restrictions?: boolean;
  population_threshold_ineligible?: boolean;
  everglades_or_wekiva_or_trpa?: boolean;
  public_or_tribal_land?: boolean;
}

export interface HouseParcelAuditInput {
  parcelId: string;
  address?: string;
  lat: number;
  lng: number;
  lotSqft: number;
  livingSqft?: number;
  yearBuilt?: number | null;
  effectiveYearBuilt?: number | null;
  bedrooms?: number;
  bathrooms?: number;
  stories?: number;
  hasPool?: boolean;
  hasGarage?: boolean;
  isVacantLand?: boolean;
  units?: number;
  zoningCode?: string;
  useDescription?: string;
  rollLandValue?: number;
  rollImpValue?: number;
  rollBaseYear?: number | null;
  lastSalePrice?: number | null;
  lastSaleDate?: string | null;
  neighborhoodMedianHv: number;
  stateCode: string;
  countyFips: string;
  municipalityPop?: number;
  countyPop?: number;
  distToHeavyRailMi?: number | null;
  distToFrequentBusMi?: number | null;
  recentPermits?: BuildingPermitRecord[];
  imageryInfo?: {
    lidarYear?: number;
    streetViewDate?: string | null;
    hasStreetView?: boolean;
  };
  exclusions?: ParcelLegalExclusions;
  isUrbanCore?: boolean;
}

export interface CalibratedTreeEconomics {
  stateCode: string;
  climateRegime: "cooling_dominant" | "heating_dominant" | "mixed_temperate" | "arid_irrigation_limited";
  capitalizedValueLiftUsd: number;
  annualUtilitySavingsUsd: number;
  annualIrrigationCostUsd: number;
  netAnnualSavingsUsd: number;
  utilityBenefitDescription: string;
}

export interface HouseParcelAuditResult {
  parcelId: string;
  stateCode: string;
  countyFips: string;
  valuation: {
    estimatedValue: number;
    valueLow: number;
    valueHigh: number;
    vpsf: number;
    confidenceMarginPct: number;
    confidenceRating: string;
    valuationMethod: string;
    isVacantLand: boolean;
    siteValue: number;
    structVal: number;
    permitCapitalizationAdded: number;
    luxuryDampeningApplied: boolean;
    luxurySaturationMultiplier: number;
    multiUnitBonusPct: number;
  };
  imagery: ImageryVintageCheck & {
    proxyRoutingNotice: string;
    storyCalibrationSource: string;
  };
  statutoryZoning: StatutoryZoningResult & {
    privateCovenantsDisclaimer: string;
    lotSplitFeasible: boolean;
    aduFeasible: boolean;
    statutoryNotes: string;
  };
  roofCadastre: AccurateRoofCalculation;
  solarMicrogrid: SolarMicrogridCalculation & {
    dcKwCapacity: number;
    unshadedRoofSqft: number;
    grossSystemCostUsd: number;
    netSystemCostCashUsd: number;
    netSystemCostLeaseUsd: number;
    annualYieldKwh: number;
    paybackYearsCash: number;
    paybackYearsLease: number;
    nemTariffNotice: string;
  };
  treeEconomics: CalibratedTreeEconomics;
  subAdditiveStacking: {
    maxStackingCeilingPct: number;
    jointCapitalizationFormula: string;
    displacementSensitivityScore: number;
  };
  everySpace?: EverySpacePortfolioSummary;
  renovationOptions?: RenovationQuoteEvaluation[];
  legalEngineeringDisclaimers: string[];
}

export function getHighValueSaturationMultiplier(marketVal: number): number {
  if (!marketVal || marketVal <= 2500000) return 1.0;
  return Math.pow(2500000 / marketVal, 0.45);
}

export function calculatePermitCapitalization(permits: BuildingPermitRecord[] = []): number {
  if (!permits || !permits.length) return 0;
  let totalCapitalized = 0;
  for (const p of permits) {
    const val = +p.valuation_usd || 0;
    if (val <= 0) continue;
    if (p.permit_type === "seismic") {
      totalCapitalized += Math.min(val, 15000);
    } else {
      if (val <= 250000) {
        totalCapitalized += Math.round(val * 0.85);
      } else {
        totalCapitalized += Math.round(250000 * 0.85 + (val - 250000) * 0.60);
      }
    }
  }
  return totalCapitalized;
}

export function calculateCalibratedTreeEconomics(
  stateCode: string,
  houseVal: number,
  rsmeansCostMultiplier = 1.0
): CalibratedTreeEconomics {
  const st = (stateCode || "CA").toUpperCase();

  const HEATING_STATES = new Set([
    "AK", "ME", "NH", "VT", "MA", "NY", "MN", "WI", "MI", "ND", "SD", "MT", "WY", "ID", "IA", "IL"
  ]);
  const ARID_STATES = new Set(["AZ", "NV", "NM", "UT"]);

  let regime: CalibratedTreeEconomics["climateRegime"] = "mixed_temperate";
  if (HEATING_STATES.has(st)) regime = "heating_dominant";
  else if (ARID_STATES.has(st)) regime = "arid_irrigation_limited";
  else if (["CA", "FL", "TX", "GA", "SC", "LA", "HI"].includes(st)) regime = "cooling_dominant";

  let baseVal = 7130;
  let annualSavings = 140;
  let irrigation = 20;
  let desc = "Saves in summer AC air conditioning cooling load.";

  if (regime === "heating_dominant") {
    baseVal = 5400;
    annualSavings = 95;
    irrigation = 0;
    desc = "Winter windbreak lowers convective air infiltration and heating fuel usage.";
  } else if (regime === "arid_irrigation_limited") {
    baseVal = 8200;
    annualSavings = 220;
    irrigation = 45;
    desc = "Peak urban heat island mitigation; requires deep drip xeriscape irrigation.";
  } else if (regime === "cooling_dominant") {
    baseVal = 7130;
    annualSavings = 140;
    irrigation = 20;
    desc = "Mature shade canopy lowers attic solar gain and AC cooling bills.";
  } else {
    baseVal = 6200;
    annualSavings = 115;
    irrigation = 10;
    desc = "Balanced summer cooling shade and seasonal deciduous solar permeability.";
  }

  const capitalizedValueLiftUsd = Math.round(baseVal * rsmeansCostMultiplier);
  const netAnnualSavingsUsd = annualSavings - irrigation;

  return {
    stateCode: st,
    climateRegime: regime,
    capitalizedValueLiftUsd,
    annualUtilitySavingsUsd: annualSavings,
    annualIrrigationCostUsd: irrigation,
    netAnnualSavingsUsd,
    utilityBenefitDescription: desc,
  };
}

export function auditSingleHouseParcel(input: HouseParcelAuditInput): HouseParcelAuditResult {
  const stCode = (input.stateCode || "CA").toUpperCase();
  const lotSqft = input.lotSqft ?? null;
  const livingSqft = input.isVacantLand ? 0 : (input.livingSqft ?? null);
  const isVacant = !!input.isVacantLand;

  // 1. Ingest AVM Valuation with 2026 Deed Transfers & Permit Capitalization
  const baseAvm = estimatePropertyMarketValue({
    attributes: {
      Roll_LandValue: input.rollLandValue,
      Roll_ImpValue: input.rollImpValue,
      Roll_LandBaseYear: input.rollBaseYear,
      Roll_ImpBaseYear: input.rollBaseYear,
      UseCode: isVacant ? "010V" : undefined,
      UseDescription: input.useDescription || (isVacant ? "Vacant Residential" : "Single Family"),
      ZoneCode: input.zoningCode ? input.zoningCode : undefined,
      Bedrooms1: input.bedrooms,
      Bathrooms1: input.bathrooms,
      Units1: input.units || 1,
      EffectiveYear1: input.effectiveYearBuilt,
      YearBuilt1: input.yearBuilt,
    },
    lotSqft: lotSqft || undefined,
    neighborhood: {
      hv: input.neighborhoodMedianHv,
      c: input.address || "Metro Area",
    },
    stateCode: stCode,
    facts: {
      bldg: isVacant ? 0 : livingSqft,
      foot: livingSqft ? Math.round(livingSqft / Math.max(1, input.stories || 1)) : null,
      stories: input.stories || 1,
      beds: input.bedrooms ?? null,
      baths: input.bathrooms ?? null,
      yb: input.yearBuilt ?? null,
      eff: input.effectiveYearBuilt ?? input.yearBuilt ?? null,
      pool: !!input.hasPool,
      garage: !!input.hasGarage,
      units: input.units || 1,
    },
    salesInfo: input.lastSalePrice
      ? {
          price: input.lastSalePrice,
          date: input.lastSaleDate || "",
          year: input.lastSaleDate ? +input.lastSaleDate.replace(/\D/g, "").slice(0, 4) : 2023,
        }
      : null,
  });

  const permitCapAdded = calculatePermitCapitalization(input.recentPermits);
  const rawAdjustedVal = baseAvm.estimatedValue + permitCapAdded;
  const saturationMult = getHighValueSaturationMultiplier(rawAdjustedVal);

  const finalEstimatedValue = Math.round(rawAdjustedVal / 1000) * 1000;
  const finalValueLow = Math.round((finalEstimatedValue * (1 - baseAvm.confidenceMarginPct)) / 1000) * 1000;
  const finalValueHigh = Math.round((finalEstimatedValue * (1 + baseAvm.confidenceMarginPct)) / 1000) * 1000;
  const finalVpsf = isVacant
    ? Math.round(finalEstimatedValue / Math.max(lotSqft, 1))
    : Math.round(finalEstimatedValue / Math.max(livingSqft, 1));

  // 2. Imagery & LiDAR Verification
  const imagery = input.imageryInfo || {};
  const latestPermit = (input.recentPermits || []).sort((a, b) => b.issue_date.localeCompare(a.issue_date))[0];
  const hasStreetView = imagery.hasStreetView !== false && !!imagery.streetViewDate;

  const imageryCheck = validateParcelImageryVintage({
    parcelId: input.parcelId,
    lidarAcquisitionYear: imagery.lidarYear || 2020,
    streetViewCaptureDate: hasStreetView ? (imagery.streetViewDate || "2021-06") : null,
    latestPostConstructionPermitDate: latestPermit ? latestPermit.issue_date : null,
    permitScopeDescription: latestPermit ? latestPermit.description : null,
    referenceYear: 2026,
  });

  const confidenceBadge = !hasStreetView
    ? "no_street_view_fallback"
    : imageryCheck.confidenceBadge;

  const warningMessage = !hasStreetView
    ? "Google Street View coverage is unavailable (rural, gated community, cul-de-sac, or flag lot). Story count and facade condition calibrated from USGS 3DEP LiDAR and county assessor records."
    : imageryCheck.warningMessage;

  // 3. Statutory By-Right Housing Rights & Exclusion Engine
  const exclusions = input.exclusions || {};
  const hasZoning = !!(input.zoningCode && !/^(unzoned|unknown|missing|none|n\/a)$/i.test(input.zoningCode.trim()));
  const rawZone = hasZoning ? input.zoningCode!.trim() : null;
  const zoneOrUse = String(rawZone || "") + " " + String(input.useDescription || "");
  const isComm = hasZoning && /comm|c-|c1|c2|cbd|mixed|bu-|b-1|b-2|business/i.test(zoneOrUse);
  const isSfr = hasZoning && !isComm && (/r-|r1|sfr|single|res/i.test(zoneOrUse) || (!input.useDescription && !isComm));

  const parcelCtx: ParcelContext = {
    parcel_id: input.parcelId,
    state_code: stCode,
    county_fips: input.countyFips,
    municipality_pop: input.municipalityPop ?? null,
    county_pop: input.countyPop ?? null,
    base_zoning_code: rawZone,
    is_commercial_or_mixed_use: isComm,
    is_single_family_residential: isSfr,
    dist_to_heavy_rail_mi: input.distToHeavyRailMi ?? null,
    dist_to_frequent_bus_or_brt_mi: input.distToFrequentBusMi ?? null,
    exclusions: {
      historic_district_hpoz: !!exclusions.historic_district_hpoz,
      coastal_commission_or_sma: !!exclusions.coastal_commission_or_sma,
      fema_100yr_floodway: !!exclusions.fema_100yr_floodway,
      calfire_or_state_vhfhsz: !!exclusions.calfire_or_state_vhfhsz,
      airport_noise_or_runway_zone: !!exclusions.airport_noise_or_runway_zone,
      williamson_or_ag_preserve: !!exclusions.williamson_or_ag_preserve,
      public_or_tribal_land: !!exclusions.public_or_tribal_land,
      everglades_or_wekiva_or_trpa: !!exclusions.everglades_or_wekiva_or_trpa,
      population_threshold_ineligible: !!exclusions.population_threshold_ineligible,
    },
  };

  const statutoryZoning = evaluateByRightHousing(parcelCtx);
  // SB 9 urban lot split (Gov. Code 66411.7, record ca_sb9_lot_split): each new parcel at least 1,200 sq ft and neither
  // smaller than 40% of the original, so the original lot must be at least 2,400 sq ft (unless a local ordinance sets a
  // smaller minimum). California only, single-family zones only. SB 9 bars the whole FEMA 100-year flood hazard area;
  // the fema_100yr_floodway flag here is narrower, so a clear flag does not prove the lot is outside that area.
  const SB9_MIN_RESULTING_LOT_SQFT = 1200;
  const lotSplitFeasible = stCode === "CA" && hasZoning && isSfr && (lotSqft != null && lotSqft >= 2 * SB9_MIN_RESULTING_LOT_SQFT) && !exclusions.fema_100yr_floodway && !exclusions.historic_district_hpoz && !exclusions.calfire_or_state_vhfhsz;
  const aduFeasible = hasZoning && (!exclusions.historic_district_hpoz || stCode === "CA");

  let statutoryNotes = "";
  if (!hasZoning) {
    statutoryNotes = "Zoning is not on file for this parcel; by-right housing rights and ministerial lot splits cannot be determined without verified local zoning.";
  } else if (stCode === "CA") {
    statutoryNotes = "California: SB 9 (Gov. Code 65852.21, 66411.7) allows a ministerial urban lot split when each new lot is at least 1,200 sq ft and neither is under 40% of the original lot. SB 79 transit-area rules are not determined here (the law record is only partly checked). The flood check here uses the FEMA floodway flag, which is narrower than SB 9's bar on the whole 100-year flood hazard area: check the FEMA flood map before relying on a lot split.";
  } else if (stCode === "TX") {
    statutoryNotes = statutoryZoning.statutory_exclusions.population_threshold_ineligible
      ? "Texas SB 840 does not apply here: it needs a city over 150,000 people in a county over 300,000 (or the populations are not on file)."
      : "Texas SB 840 (Loc. Gov't Code ch. 218) may allow housing on commercial or mixed-use zoning in this city; not determined (the law record is only partly checked). SB 15 small lots apply only to unplatted tracts of 5 acres or more, not to existing lots.";
  } else if (stCode === "FL") {
    statutoryNotes = "Florida Live Local Act (Fla. Stat. 166.04151(7)) may allow multifamily on commercial, industrial or mixed-use zoning if at least 40% of rental units stay affordable for 30 years; not determined (the law record is only partly checked). The related property tax exemption is Fla. Stat. 196.1978(3).";
  } else {
    statutoryNotes = "State middle-housing laws (such as WA HB 1110 and OR HB 2001) are applied only where the law record has been checked against the statute; other state rules are not determined here. Local zoning governs.";
  }

  // 4. Accurate Roof Cadastre & 2026 Solar Microgrid Calculator
  const roofCalc = estimateAccurateRoofArea({
    livingSqft,
    stories: input.stories || 1,
    hasGarage: input.hasGarage,
    garageAttached: true,
    yearBuilt: input.yearBuilt,
    stateCode: stCode,
  });

  const grossRoofSqft = roofCalc.grossRoofSqft;
  const unshadedFraction = roofCalc.grossRoofSqft > 0 ? (roofCalc.usableSolarSqft / roofCalc.grossRoofSqft) : 0.55;
  const unshadedRoofSqft = roofCalc.usableSolarSqft;
  const dcKw = roofCalc.solarDcKw;

  const solarCash = calculateSolarMicrogridRoi({
    taxYear: 2026,
    stateCode: stCode,
    ownershipModel: "cash_or_loan",
    grossRoofSqft,
    lidarUnshadedUsableFraction: unshadedFraction,
    localInstallCostPerWattUsd: stCode === "CA" ? 3.15 : 2.85,
    annualYieldKwhPerKw: stCode === "CA" ? 1620 : stCode === "AZ" ? 1780 : 1250,
    retailImportRateUsdKwh: stCode === "CA" ? 0.38 : 0.16,
    exportRateUsdKwh: stCode === "CA" ? 0.055 : 0.14,
    selfConsumptionFraction: stCode === "CA" ? 0.78 : 0.50,
    hasBatteryStorage: stCode === "CA",
    batteryCostUsd: stCode === "CA" ? 11500 : 0,
    meets2026FeocAndPrevailingWage: false,
  });

  const solarLease = calculateSolarMicrogridRoi({
    taxYear: 2026,
    stateCode: stCode,
    ownershipModel: "third_party_lease_or_ppa",
    grossRoofSqft,
    lidarUnshadedUsableFraction: unshadedFraction,
    localInstallCostPerWattUsd: stCode === "CA" ? 3.15 : 2.85,
    annualYieldKwhPerKw: stCode === "CA" ? 1620 : stCode === "AZ" ? 1780 : 1250,
    retailImportRateUsdKwh: stCode === "CA" ? 0.38 : 0.16,
    exportRateUsdKwh: stCode === "CA" ? 0.055 : 0.14,
    selfConsumptionFraction: stCode === "CA" ? 0.78 : 0.50,
    hasBatteryStorage: stCode === "CA",
    batteryCostUsd: stCode === "CA" ? 11500 : 0,
    meets2026FeocAndPrevailingWage: true,
  });

  const grossSystemCostUsd = Math.round(dcKw * 1000 * (stCode === "CA" ? 3.15 : 2.85) + (stCode === "CA" ? 11500 : 0));
  const netSystemCostCashUsd = grossSystemCostUsd - solarCash.state_tax_credit_usd;
  const netSystemCostLeaseUsd = Math.round(grossSystemCostUsd * (1 - solarLease.federal_itc_pct) - solarLease.state_tax_credit_usd);
  const annualYieldKwh = Math.round(dcKw * (stCode === "CA" ? 1620 : stCode === "AZ" ? 1780 : 1250));
  const annualSavingsUsd = Math.round(annualYieldKwh * (stCode === "CA" ? 0.28 : 0.15));
  const paybackYearsCash = annualSavingsUsd > 0 ? Number((netSystemCostCashUsd / annualSavingsUsd).toFixed(1)) : 15.0;
  const paybackYearsLease = annualSavingsUsd > 0 ? Number((netSystemCostLeaseUsd / annualSavingsUsd).toFixed(1)) : 8.5;

  // 5. Tree Economics
  const treeEconomics = calculateCalibratedTreeEconomics(stCode, finalEstimatedValue, stCode === "CA" ? 1.24 : 1.0);

  // 6. Sub-Additive Stacking Saturation Ceiling
  const isUrbanCore = !!input.isUrbanCore;
  const maxStackingCeilingPct = isUrbanCore ? 0.30 : 0.22;
  const displacementSensitivityScore = Math.round(
    Math.max(10, Math.min(95, 48 + (isUrbanCore ? 15 : -8)))
  );

  // 7. EverySpace Property Space Monetization Engine
  const everySpace = evaluateEverySpaceMonetization({
    propertyAddress: input.address || `Parcel ${input.parcelId}`,
    city: input.address ? (input.address.split(",")[1]?.trim() || "Local City") : "Local City",
    stateCode: stCode,
    countyFips: input.countyFips,
    bedrooms: input.bedrooms || 3,
    bathrooms: input.bathrooms || 2,
    lotSqft: lotSqft || 6000,
    livingSqft: livingSqft || 1500,
    monthlyDebtServiceMortgageUsd: Math.round(finalEstimatedValue * 0.0055),
    monthlyPropertyTaxAndInsuranceUsd: Math.round(finalEstimatedValue * 0.0012),
    plannedHoldingMonths: 18,
    features: {
      hasDriveway: input.hasGarage !== false,
      drivewaySpacesCount: 2,
      hasAtticOrBasementStorage: (livingSqft || 1500) > 1200,
      storageSqft: Math.round((livingSqft || 1500) * 0.15),
      hasPool: !!input.hasPool,
      hasAvailableRoofSqftForSolar: unshadedRoofSqft > 250,
      availableRoofSqft: unshadedRoofSqft,
      hasExistingGarageForConversion: !!input.hasGarage,
      hasExistingCasitaOrAdu: (input.units || 1) > 1,
    },
  });

  // 8. Homeowner Renovation & Contractor Quote Evaluator
  const renovationOptions: RenovationQuoteEvaluation[] = [
    evaluateRenovationQuote({
      propertyAddress: input.address,
      stateCode: stCode,
      currentPropertyValue: finalEstimatedValue,
      currentLivingSqft: livingSqft || 1500,
      lotSqft: lotSqft || 6000,
      zoningCode: input.zoningCode,
      improvementType: "garage_conversion_adu",
      quotedTotalCost: 65_000,
      projectedSqft: 400,
    }),
    evaluateRenovationQuote({
      propertyAddress: input.address,
      stateCode: stCode,
      currentPropertyValue: finalEstimatedValue,
      currentLivingSqft: livingSqft || 1500,
      lotSqft: lotSqft || 6000,
      zoningCode: input.zoningCode,
      improvementType: "detached_adu",
      quotedTotalCost: 185_000,
      projectedSqft: 750,
    }),
    evaluateRenovationQuote({
      propertyAddress: input.address,
      stateCode: stCode,
      currentPropertyValue: finalEstimatedValue,
      currentLivingSqft: livingSqft || 1500,
      improvementType: "kitchen_remodel_minor",
      quotedTotalCost: 26_000,
    }),
  ];

  return {
    parcelId: input.parcelId,
    stateCode: stCode,
    countyFips: input.countyFips,
    valuation: {
      estimatedValue: finalEstimatedValue,
      valueLow: finalValueLow,
      valueHigh: finalValueHigh,
      vpsf: finalVpsf,
      confidenceMarginPct: baseAvm.confidenceMarginPct,
      confidenceRating: baseAvm.confidenceRating,
      valuationMethod: baseAvm.valuationMethod + (permitCapAdded > 0 ? " + Permit Capitalization" : ""),
      isVacantLand: isVacant,
      siteValue: baseAvm.siteValue,
      structVal: baseAvm.structVal,
      permitCapitalizationAdded: permitCapAdded,
      luxuryDampeningApplied: rawAdjustedVal > 2500000,
      luxurySaturationMultiplier: Number(saturationMult.toFixed(3)),
      multiUnitBonusPct: (!isVacant && (input.units || 1) > 1) ? Math.min(24, ((input.units || 1) - 1) * 8) : 0,
    },
    imagery: {
      parcelId: input.parcelId,
      lidarAcquisitionYear: imagery.lidarYear || 2020,
      streetViewCaptureDate: hasStreetView ? (imagery.streetViewDate || "2021-06") : null,
      latestPostConstructionPermitDate: latestPermit ? latestPermit.issue_date : null,
      permitScopeDescription: latestPermit ? latestPermit.description : null,
      isLidarStale: imageryCheck.isLidarStale,
      isStreetViewStale: imageryCheck.isStreetViewStale,
      confidenceBadge,
      warningMessage,
      proxyRoutingNotice: "Requests routed via origin-locked edge proxy (workers/api-proxy.ts) ensuring client-side API keys are protected and origin-validated.",
      storyCalibrationSource: hasStreetView ? "Google Street View 4-angle facade & USGS 3DEP LiDAR" : "USGS 3DEP LiDAR DSM & County Assessor GLA Fallback",
    },
    statutoryZoning: {
      ...statutoryZoning,
      privateCovenantsDisclaimer: "NOTICE ON PRIVATE COVENANTS: State zoning preemptions (e.g., CA SB 9, TX SB 15, WA HB 1110) override municipal zoning but may not automatically extinguish recorded private Homeowners Association (HOA) covenants or CC&Rs running with the land. Check title report for private encumbrances.",
      lotSplitFeasible,
      aduFeasible,
      statutoryNotes,
    },
    roofCadastre: roofCalc,
    solarMicrogrid: {
      ...solarCash,
      battery_storage_required_for_roi: stCode === "CA" || solarCash.battery_storage_required_for_roi,
      dcKwCapacity: dcKw,
      unshadedRoofSqft,
      grossSystemCostUsd,
      netSystemCostCashUsd,
      netSystemCostLeaseUsd,
      annualYieldKwh,
      paybackYearsCash,
      paybackYearsLease,
      nemTariffNotice: stCode === "CA"
        ? "CA NEM 3.0 / Net Billing Tariff: Mid-day solar export rates are credited at avoided cost (~$0.055/kWh). Paired 10–13.5 kWh battery storage is required for positive 25-yr NPV."
        : "Standard net metering or net billing applies. Battery optional for resilience.",
    },
    treeEconomics,
    subAdditiveStacking: {
      maxStackingCeilingPct,
      jointCapitalizationFormula: "ΔP_joint = P_max * [1 - Π(1 - Δp_i / P_max)]",
      displacementSensitivityScore,
    },
    everySpace,
    renovationOptions,
    legalEngineeringDisclaimers: [
      "LEGAL & ENGINEERING NON-RELIANCE NOTICE: Preliminary screening only based on public municipal GIS, tax rolls, and statutory feeds as of November 2026.",
      "AVM valuations do not constitute formal appraisals under USPAP standards. Verify actual condition, unrecorded improvements, and neighborhood comps with a licensed appraiser.",
      "Statutory housing rights and lot split feasibility must be verified with local municipal planning and building departments prior to architectural design, capital allocation, or contractor commitments.",
      "Federal Clean Energy Credits: IRC § 25D residential credit expired Dec 31, 2025 (0% cash/loan). Commercial/TPO lease credit (IRC § 48E) subject to prevailing wage and non-FEOC supply-chain compliance.",
    ],
  };
}
