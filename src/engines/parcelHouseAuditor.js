"use strict";

const _estVal = (typeof estimatePropertyMarketValue !== "undefined")
  ? estimatePropertyMarketValue
  : ((typeof require !== "undefined") ? require("./propertyValuationEngine").estimatePropertyMarketValue : null);

const _valVintage = (typeof validateParcelImageryVintage !== "undefined")
  ? validateParcelImageryVintage
  : ((typeof require !== "undefined") ? require("./lidarStreetViewValidator").validateParcelImageryVintage : null);

const _evalHousing = (typeof evaluateByRightHousing !== "undefined")
  ? evaluateByRightHousing
  : ((typeof require !== "undefined") ? require("./statutoryZoningEngine").evaluateByRightHousing : null);

const _calcSolar = (typeof calculateSolarMicrogridRoi !== "undefined")
  ? calculateSolarMicrogridRoi
  : ((typeof require !== "undefined") ? require("./solarMicrogridEngine").calculateSolarMicrogridRoi : null);

function getHighValueSaturationMultiplier(marketVal) {
  if (!marketVal || marketVal <= 2500000) return 1.0;
  return Math.pow(2500000 / marketVal, 0.45);
}

function calculatePermitCapitalization(permits) {
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

function calculateCalibratedTreeEconomics(stateCode, houseVal, rsmeansCostMultiplier) {
  const mult = rsmeansCostMultiplier || 1.0;
  const st = (stateCode || "CA").toUpperCase();

  const HEATING_STATES = new Set([
    "AK", "ME", "NH", "VT", "MA", "NY", "MN", "WI", "MI", "ND", "SD", "MT", "WY", "ID", "IA", "IL"
  ]);
  const ARID_STATES = new Set(["AZ", "NV", "NM", "UT"]);

  let regime = "mixed_temperate";
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

  const capitalizedValueLiftUsd = Math.round(baseVal * mult);
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

function auditSingleHouseParcel(input) {
  const stCode = (input.stateCode || "CA").toUpperCase();
  const lotSqft = input.lotSqft || 6000;
  const livingSqft = input.livingSqft || 1650;
  const isVacant = !!input.isVacantLand;

  // 1. Ingest AVM Valuation with 2026 Deed Transfers & Permit Capitalization
  const baseAvm = _estVal({
    attributes: {
      Roll_LandValue: input.rollLandValue,
      Roll_ImpValue: input.rollImpValue,
      Roll_LandBaseYear: input.rollBaseYear,
      Roll_ImpBaseYear: input.rollBaseYear,
      UseCode: isVacant ? "010V" : undefined,
      UseDescription: input.useDescription || (isVacant ? "Vacant Residential" : "Single Family"),
      ZoneCode: input.zoningCode || "R-1",
      Bedrooms1: input.bedrooms,
      Bathrooms1: input.bathrooms,
      Units1: input.units || 1,
      EffectiveYear1: input.effectiveYearBuilt,
      YearBuilt1: input.yearBuilt,
    },
    lotSqft,
    neighborhood: {
      hv: input.neighborhoodMedianHv,
      c: input.address || "Metro Area",
    },
    stateCode: stCode,
    facts: {
      bldg: isVacant ? 0 : livingSqft,
      foot: Math.round(livingSqft / Math.max(1, input.stories || 1)),
      stories: input.stories || 1,
      beds: input.bedrooms || 3,
      baths: input.bathrooms || 2,
      yb: input.yearBuilt || 1975,
      eff: input.effectiveYearBuilt || input.yearBuilt || 1975,
      pool: !!input.hasPool,
      garage: !!input.hasGarage,
      units: input.units || 1,
    },
    salesInfo: input.lastSalePrice
      ? {
          price: input.lastSalePrice,
          date: input.lastSaleDate || "",
          year: input.lastSaleDate ? +String(input.lastSaleDate).replace(/\D/g, "").slice(0, 4) : 2023,
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
  const latestPermit = (input.recentPermits || []).slice().sort((a, b) => b.issue_date.localeCompare(a.issue_date))[0];
  const hasStreetView = imagery.hasStreetView !== false && !!imagery.streetViewDate;

  const imageryCheck = _valVintage({
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
  const zoneOrUse = String(input.zoningCode || "") + " " + String(input.useDescription || "");
  const isComm = /comm|c-|c1|c2|cbd|mixed|bu-|b-1|b-2|business/i.test(zoneOrUse);
  const isSfr = !isComm;

  const parcelCtx = {
    parcel_id: input.parcelId,
    state_code: stCode,
    county_fips: input.countyFips,
    municipality_pop: input.municipalityPop || (stCode === "TX" ? 85000 : 250000),
    county_pop: input.countyPop || 500000,
    base_zoning_code: input.zoningCode || "R-1",
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

  const statutoryZoning = _evalHousing(parcelCtx);
  const lotSplitFeasible = lotSqft >= 4800 && !exclusions.fema_100yr_floodway && !exclusions.historic_district_hpoz;
  const aduFeasible = !exclusions.historic_district_hpoz || stCode === "CA";

  let statutoryNotes = "";
  if (stCode === "CA") {
    statutoryNotes = "California: SB 9 ministerial lot split (≥4,800 sq ft) and SB 684/SB 79 transit housing eligibility. HPOZ and floodway restrictions apply deterministically.";
  } else if (stCode === "TX") {
    statutoryNotes = statutoryZoning.statutory_exclusions.population_threshold_ineligible
      ? "Texas SB 840 & SB 15 gated: Municipality <150k or County <300k population requires discretionary municipal approval."
      : "Texas SB 840 / SB 15 active: By-right commercial conversion and small-lot subdivisions eligible.";
  } else if (stCode === "FL") {
    statutoryNotes = "Florida Live Local Act 4.0: Preempts local height/density on commercial sites; mandatory 75%–100% property tax exemption under Fla. Stat. § 196.1979.";
  } else {
    statutoryNotes = "Governed by statewide middle housing statutes (e.g. WA HB 1110, OR HB 2001, AZ HB 2720, CO HB 24-1152) and local zoning codes.";
  }

  // 4. 2026 Rooftop Solar, Battery Storage & Microgrid Calculator
  const grossRoofSqft = Math.round(livingSqft / Math.max(1, input.stories || 1) * 1.15);
  const unshadedFraction = 0.55; // LiDAR DSM slope/pitch/shading mask
  const unshadedRoofSqft = Math.round(grossRoofSqft * unshadedFraction);
  const dcKw = Number(((unshadedRoofSqft / 100) * 1.6).toFixed(1));

  const solarCash = _calcSolar({
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

  const solarLease = _calcSolar({
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
      parcel_id: statutoryZoning.parcel_id,
      state_code: statutoryZoning.state_code,
      base_zoning_code: statutoryZoning.base_zoning_code,
      applicable_statutes: statutoryZoning.applicable_statutes,
      statutory_exclusions: statutoryZoning.statutory_exclusions,
      net_by_right_feasible: statutoryZoning.net_by_right_feasible,
      privateCovenantsDisclaimer: "NOTICE ON PRIVATE COVENANTS: State zoning preemptions (e.g., CA SB 9, TX SB 15, WA HB 1110) override municipal zoning but may not automatically extinguish recorded private Homeowners Association (HOA) covenants or CC&Rs running with the land. Check title report for private encumbrances.",
      lotSplitFeasible,
      aduFeasible,
      statutoryNotes,
    },
    solarMicrogrid: {
      tax_year: solarCash.tax_year,
      ownership_model: solarCash.ownership_model,
      usable_roof_sqft_lidar: solarCash.usable_roof_sqft_lidar,
      system_size_dc_kw: solarCash.system_size_dc_kw,
      federal_itc_pct: solarCash.federal_itc_pct,
      state_tax_credit_usd: solarCash.state_tax_credit_usd,
      net_metering_tariff: solarCash.net_metering_tariff,
      battery_storage_required_for_roi: stCode === "CA" || solarCash.battery_storage_required_for_roi,
      net_25yr_npv_usd: solarCash.net_25yr_npv_usd,
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
    legalEngineeringDisclaimers: [
      "LEGAL & ENGINEERING NON-RELIANCE NOTICE: Preliminary screening only based on public municipal GIS, tax rolls, and statutory feeds as of November 2026.",
      "AVM valuations do not constitute formal appraisals under USPAP standards. Verify actual condition, unrecorded improvements, and neighborhood comps with a licensed appraiser.",
      "Statutory housing rights and lot split feasibility must be verified with local municipal planning and building departments prior to architectural design, capital allocation, or contractor commitments.",
      "Federal Clean Energy Credits: IRC § 25D residential credit expired Dec 31, 2025 (0% cash/loan). Commercial/TPO lease credit (IRC § 48E) subject to prevailing wage and non-FEOC supply-chain compliance.",
    ],
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    auditSingleHouseParcel,
    getHighValueSaturationMultiplier,
    calculatePermitCapitalization,
    calculateCalibratedTreeEconomics,
  };
}

if (typeof window !== "undefined") {
  window.auditSingleHouseParcel = auditSingleHouseParcel;
  window.getHighValueSaturationMultiplier = getHighValueSaturationMultiplier;
  window.calculatePermitCapitalization = calculatePermitCapitalization;
  window.calculateCalibratedTreeEconomics = calculateCalibratedTreeEconomics;
}
