"use strict";
// Mirror of auditSingleHouseParcel in app/app.js. Keep the two in step.

const _estVal = require("./propertyValuationEngine").estimatePropertyMarketValue;
const _valVintage = require("./lidarStreetViewValidator").validateParcelImageryVintage;
const _evalHousing = require("./statutoryZoningEngine").evaluateByRightHousing;
const _estRoof = require("./roofAreaEngine").estimateAccurateRoofArea;

function _defaultStatuteLaws() {
  try { return require("../../app/data/statutes.json"); } catch (e) { return []; }
}

// Sum of the construction valuations recorded on permits (a recorded fact). Nothing is added to the home value:
// no sourced rate exists for how much of permitted work shows up in sale prices.
function calculatePermitCapitalization(permits) {
  if (!permits || !permits.length) return 0;
  let total = 0;
  for (const p of permits) {
    const val = +p.valuation_usd || 0;
    if (val > 0) total += val;
  }
  return total;
}

// Climate regime and what a shade tree does there. Dollar figures were removed 2026-11-16: the per-regime
// values had no source (the one cited study's DOI did not resolve), so none are shown.
function calculateCalibratedTreeEconomics(stateCode) {
  const st = String(stateCode || "").toUpperCase();
  const HEATING_STATES = new Set(["AK", "ME", "NH", "VT", "MA", "NY", "MN", "WI", "MI", "ND", "SD", "MT", "WY", "ID", "IA", "IL"]);
  const ARID_STATES = new Set(["AZ", "NV", "NM", "UT"]);
  let regime = "mixed_temperate";
  if (HEATING_STATES.has(st)) regime = "heating_dominant";
  else if (ARID_STATES.has(st)) regime = "arid_irrigation_limited";
  else if (["CA", "FL", "TX", "GA", "SC", "LA", "HI"].includes(st)) regime = "cooling_dominant";
  const desc = {
    heating_dominant: "Evergreen windbreaks can cut winter heat loss; summer shade matters less here.",
    arid_irrigation_limited: "Shade cools pavement and roofs, but trees need drip irrigation in this climate.",
    cooling_dominant: "Shade on west and south walls lowers summer cooling load.",
    mixed_temperate: "Deciduous shade cools in summer and lets winter sun through.",
  }[regime];
  return {
    stateCode: st,
    climateRegime: regime,
    capitalizedValueLiftUsd: null,
    annualUtilitySavingsUsd: null,
    annualIrrigationCostUsd: null,
    netAnnualSavingsUsd: null,
    utilityBenefitDescription: desc,
    dollarStatus: "Not modeled yet — no sourced tree value or utility savings data",
  };
}

function auditSingleHouseParcel(input) {
  const stCode = String(input.stateCode || "").toUpperCase();
  const lotSqft = input.lotSqft ?? null;
  const livingSqft = input.isVacantLand ? 0 : (input.livingSqft ?? null);
  const isVacant = !!input.isVacantLand;

  // 1. Value screening estimate (unvalidated; see estimatePropertyMarketValue)
  const saleYear = input.lastSaleDate ? +String(input.lastSaleDate).replace(/\D/g, "").slice(0, 4) || null : null;
  const baseAvm = _estVal({
    attributes: {
      Roll_LandValue: input.rollLandValue,
      Roll_ImpValue: input.rollImpValue,
      Roll_LandBaseYear: input.rollBaseYear,
      Roll_ImpBaseYear: input.rollBaseYear,
      UseCode: isVacant ? "010V" : undefined,
      UseDescription: input.useDescription || (isVacant ? "Vacant Residential" : ""),
      ZoneCode: input.zoningCode ? input.zoningCode : undefined,
      Bedrooms1: input.bedrooms,
      Bathrooms1: input.bathrooms,
      Units1: input.units || 1,
      EffectiveYear1: input.effectiveYearBuilt,
      YearBuilt1: input.yearBuilt,
    },
    lotSqft: lotSqft || null,
    neighborhood: { hv: input.neighborhoodMedianHv, c: input.address || "" },
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
    salesInfo: input.lastSalePrice && saleYear ? { price: input.lastSalePrice, date: input.lastSaleDate || "", year: saleYear } : null,
  });

  const permitValuationTotal = calculatePermitCapitalization(input.recentPermits);
  const finalEstimatedValue = baseAvm.estimatedValue;
  const finalVpsf = baseAvm.vpsf;

  // 2. Imagery dates: only real capture dates are checked. Unknown dates stay unknown.
  const imagery = input.imageryInfo || {};
  const latestPermit = (input.recentPermits || []).filter(p => p && p.issue_date).slice().sort((a, b) => String(b.issue_date).localeCompare(String(a.issue_date)))[0];
  const hasStreetView = imagery.hasStreetView !== false && !!imagery.streetViewDate;
  const lidarYear = imagery.lidarYear || null;
  const datesKnown = !!(lidarYear || hasStreetView);
  const imageryCheck = datesKnown ? _valVintage({
    parcelId: input.parcelId,
    lidarAcquisitionYear: lidarYear,
    streetViewCaptureDate: hasStreetView ? imagery.streetViewDate : null,
    latestPostConstructionPermitDate: latestPermit ? latestPermit.issue_date : null,
    permitScopeDescription: latestPermit ? latestPermit.description : null,
    referenceYear: 2026,
  }) : { isLidarStale: null, isStreetViewStale: null, confidenceBadge: "imagery_dates_unknown", warningMessage: "Imagery capture dates are not on file, so whether photos and LiDAR predate recent work is unknown." };
  const confidenceBadge = datesKnown ? imageryCheck.confidenceBadge : "imagery_dates_unknown";
  const warningMessage = imageryCheck.warningMessage;

  // 3. By-right housing rights (statute engine; zoning must be on file)
  const exclusions = input.exclusions || {};
  const hasZoning = !!(input.zoningCode && !/^(unzoned|unknown|missing|none|n\/a)$/i.test(String(input.zoningCode).trim()));
  const rawZone = hasZoning ? String(input.zoningCode).trim() : null;
  const zoneOrUse = String(rawZone || "") + " " + String(input.useDescription || "");
  const isComm = hasZoning && /comm|c-|c1|c2|cbd|mixed|bu-|b-1|b-2|business/i.test(zoneOrUse);
  const isSfr = hasZoning && !isComm && /r-|r1|sfr|single|res/i.test(zoneOrUse);

  const parcelCtx = {
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
  const statutoryZoning = _evalHousing(parcelCtx, input.statuteLaws || _defaultStatuteLaws());
  // A lot split is only flagged where a statute the engine applies actually covers this parcel. (CA SB 9 requires
  // single-family zoning and a resulting lot of at least 1,200 sq ft; 2,400 sq ft is the smallest lot that splits.)
  const splitStatute = (statutoryZoning.applicable_statutes || []).find(s => s.id === "ca_sb9_lot_split");
  const lotSplitFeasible = !!(hasZoning && isSfr && splitStatute && lotSqft != null && lotSqft >= 2400 && !exclusions.fema_100yr_floodway && !exclusions.historic_district_hpoz);
  const aduFeasible = !!(hasZoning && (isSfr || isComm) && !exclusions.historic_district_hpoz);

  let statutoryNotes = "";
  if (!hasZoning) {
    statutoryNotes = "Zoning is not on file for this parcel; by-right housing rights and lot splits cannot be determined without recorded local zoning.";
  } else if ((statutoryZoning.applicable_statutes || []).length) {
    statutoryNotes = "State laws the screening engine applies here: " + statutoryZoning.applicable_statutes.map(s => s.short_name || s.citation).filter(Boolean).join(", ") + ". Unverified screening — confirm with the planning department.";
  } else {
    statutoryNotes = "No state housing law in the screening engine applies to this parcel as recorded. Local zoning governs.";
  }

  // 4. Roof area (geometry model; see roof engine assumptions) and solar system size. No dollar outputs: install
  //    cost, utility rates and export credits are not on file from a source, so savings and payback are not shown.
  const roofCalc = (_estRoof && livingSqft) ? _estRoof({
    livingSqft,
    stories: input.stories || 1,
    hasGarage: input.hasGarage,
    garageAttached: true,
    yearBuilt: input.yearBuilt,
    stateCode: stCode,
  }) : null;
  // Solar size is not reported: the roof model's usable share (64%, or 88% if flat) is an assumption and roof
  // orientation and shading are not on file, so any kW figure would be invented.
  const unshadedRoofSqft = null;
  const dcKw = null;
  const taxYear = 2026;

  // 5. Trees: regime only
  const treeEconomics = calculateCalibratedTreeEconomics(stCode);

  return {
    parcelId: input.parcelId,
    stateCode: stCode,
    countyFips: input.countyFips,
    valuation: {
      estimatedValue: finalEstimatedValue,
      valueLow: null,
      valueHigh: null,
      vpsf: finalVpsf,
      confidenceMarginPct: null,
      confidenceRating: baseAvm.confidenceRating,
      valuationMethod: baseAvm.valuationMethod,
      withheldReason: baseAvm.withheldReason,
      notes: baseAvm.notes,
      isVacantLand: isVacant,
      siteValue: baseAvm.siteValue,
      structVal: baseAvm.structVal,
      permitValuationTotal,
      permitCapitalizationAdded: 0,
      multiUnitBonusPct: (!isVacant && (input.units || 1) > 1) ? Math.min(24, ((input.units || 1) - 1) * 8) : 0,
    },
    imagery: {
      parcelId: input.parcelId,
      lidarAcquisitionYear: lidarYear,
      streetViewCaptureDate: hasStreetView ? imagery.streetViewDate : null,
      latestPostConstructionPermitDate: latestPermit ? latestPermit.issue_date : null,
      permitScopeDescription: latestPermit ? latestPermit.description : null,
      isLidarStale: imageryCheck.isLidarStale,
      isStreetViewStale: imageryCheck.isStreetViewStale,
      confidenceBadge,
      warningMessage,
      storyCalibrationSource: hasStreetView ? "Street View photo and assessor records" : "Assessor records",
    },
    statutoryZoning: {
      parcel_id: statutoryZoning.parcel_id,
      state_code: statutoryZoning.state_code,
      base_zoning_code: statutoryZoning.base_zoning_code,
      applicable_statutes: statutoryZoning.applicable_statutes,
      statutory_exclusions: statutoryZoning.statutory_exclusions,
      net_by_right_feasible: statutoryZoning.net_by_right_feasible,
      privateCovenantsDisclaimer: "Private covenants: state housing laws override city zoning but may not cancel recorded HOA covenants or CC&Rs. Check the title report.",
      lotSplitFeasible,
      aduFeasible,
      statutoryNotes,
    },
    roofCadastre: roofCalc,
    solarMicrogrid: {
      tax_year: taxYear,
      federal_itc_pct_owner: 0, // IRC § 25D ended for expenditures after Dec 31, 2025 (P.L. 119-21 § 70506)
      dcKwCapacity: dcKw,
      unshadedRoofSqft,
      grossSystemCostUsd: null,
      netSystemCostCashUsd: null,
      netSystemCostLeaseUsd: null,
      annualYieldKwh: null,
      paybackYearsCash: null,
      paybackYearsLease: null,
      dollarStatus: "Not modeled yet — roof orientation and shading, install cost, solar yield and utility rates are not on file",
      federalCreditNotice: "The 30% federal credit for homeowner-owned solar (IRC § 25D) ended for systems paid for after Dec 31, 2025.",
    },
    treeEconomics,
    subAdditiveStacking: {
      maxStackingCeilingPct: input.isUrbanCore ? 0.30 : 0.22, // modeling assumption, not measured
      jointCapitalizationFormula: "ΔP_joint = P_max * [1 - Π(1 - Δp_i / P_max)]",
      displacementSensitivityScore: null,
    },
    legalEngineeringDisclaimers: [
      "Screening only, from public records as of November 2026. Not an appraisal, legal opinion or engineering review.",
      "The value figure is an unvalidated estimate: it has not been tested against recorded sales. Use a licensed appraiser for decisions.",
      "Housing-law eligibility must be confirmed with the local planning department before design or spending.",
      "Federal homeowner solar credit (IRC § 25D) ended for expenditures after Dec 31, 2025.",
    ],
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { auditSingleHouseParcel, calculatePermitCapitalization, calculateCalibratedTreeEconomics };
}
