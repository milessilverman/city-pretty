import os

BASE_DIR = "/Users/milessilverman/.gemini/antigravity/scratch/city-pretty-pipeline"

# 2. src/engines/statutoryZoningEngine.ts
STATUTORY_ZONING = """import { StatutoryZoningResult } from "../types";

export interface ParcelContext {
  parcel_id: string;
  state_code: string;
  county_fips: string;
  municipality_pop: number;
  county_pop: number;
  base_zoning_code: string;
  is_commercial_or_mixed_use: boolean;
  is_single_family_residential: boolean;
  dist_to_heavy_rail_mi: number | null;
  dist_to_frequent_bus_or_brt_mi: number | null;
  exclusions: StatutoryZoningResult["statutory_exclusions"];
}

const CA_SB79_ELIGIBLE_COUNTIES = new Set([
  "06037", // Los Angeles
  "06059", // Orange
  "06073", // San Diego
  "06075", // San Francisco
  "06001", // Alameda
  "06013", // Contra Costa
  "06081", // San Mateo
  "06085", // Santa Clara
  "06067", // Sacramento
]);

export function evaluateByRightHousing(parcel: ParcelContext): StatutoryZoningResult {
  const statutes: StatutoryZoningResult["applicable_statutes"] = [];
  const ex = parcel.exclusions;

  const hasHardPhysicalExclusion =
    ex.fema_100yr_floodway ||
    ex.calfire_or_state_vhfhsz ||
    ex.williamson_or_ag_preserve ||
    ex.public_or_tribal_land ||
    ex.everglades_or_wekiva_or_trpa;

  if (!hasHardPhysicalExclusion) {
    // CALIFORNIA (SB 79 [2026], AB 2097, SB 9, Gov. Code § 66314)
    if (parcel.state_code === "CA") {
      if (
        CA_SB79_ELIGIBLE_COUNTIES.has(parcel.county_fips) &&
        parcel.dist_to_heavy_rail_mi !== null &&
        parcel.dist_to_heavy_rail_mi <= 0.25 &&
        !ex.historic_district_hpoz &&
        !ex.coastal_commission_or_sma
      ) {
        statutes.push({
          citation: "CA SB 79 (Effective July 1, 2026) — Tier 1 Heavy Rail",
          max_units_by_right: 120,
          max_height_ft: 75,
          max_far: 3.5,
          min_parking_spaces_per_unit: 0,
          affordability_mandate_pct: 0.1,
          tax_exemption_pct: 0,
        });
      } else if (
        CA_SB79_ELIGIBLE_COUNTIES.has(parcel.county_fips) &&
        parcel.dist_to_heavy_rail_mi !== null &&
        parcel.dist_to_heavy_rail_mi <= 0.5 &&
        !ex.historic_district_hpoz &&
        !ex.coastal_commission_or_sma
      ) {
        statutes.push({
          citation: "CA SB 79 (Effective July 1, 2026) — Tier 2 Heavy Rail",
          max_units_by_right: 100,
          max_height_ft: 65,
          max_far: 3.0,
          min_parking_spaces_per_unit: 0,
          affordability_mandate_pct: 0.1,
          tax_exemption_pct: 0,
        });
      }

      if (parcel.is_single_family_residential && !ex.historic_district_hpoz) {
        statutes.push({
          citation: "CA SB 9 + Gov. Code § 66314 (Lot Split + ADU/JADU)",
          max_units_by_right: 4,
          max_height_ft: 25,
          max_far: null,
          min_parking_spaces_per_unit:
            (parcel.dist_to_heavy_rail_mi ?? 99) <= 0.5 ||
            (parcel.dist_to_frequent_bus_or_brt_mi ?? 99) <= 0.5
              ? 0
              : 1,
          affordability_mandate_pct: 0,
          tax_exemption_pct: 0,
        });
      }
    }

    // TEXAS (SB 840 Commercial-to-Residential + SB 15 Small-Lot Gating)
    if (parcel.state_code === "TX") {
      const meetsPopulationGate = parcel.municipality_pop > 150000 && parcel.county_pop > 300000;
      if (meetsPopulationGate && parcel.is_commercial_or_mixed_use && !ex.airport_noise_or_runway_zone) {
        statutes.push({
          citation: "TX SB 840 (By-Right Commercial/Office-to-Multifamily)",
          max_units_by_right: 999,
          max_height_ft: null,
          max_far: null,
          min_parking_spaces_per_unit: 1.0,
          affordability_mandate_pct: 0,
          tax_exemption_pct: 0,
        });
      } else if (!meetsPopulationGate) {
        ex.population_threshold_ineligible = true;
      }
    }

    // FLORIDA (Live Local Act 4.0 — July 2026 Statutory Exclusions + § 196.1979)
    if (parcel.state_code === "FL") {
      if (
        parcel.is_commercial_or_mixed_use &&
        !ex.airport_noise_or_runway_zone &&
        !ex.everglades_or_wekiva_or_trpa
      ) {
        statutes.push({
          citation: "FL Live Local Act 4.0 (Fla. Stat. § 166.04151 + § 196.1979)",
          max_units_by_right: 999,
          max_height_ft: null,
          max_far: null,
          min_parking_spaces_per_unit:
            (parcel.dist_to_heavy_rail_mi ?? 99) <= 0.5 ? 0.5 : 1.0,
          affordability_mandate_pct: 0.4,
          tax_exemption_pct: 0.75,
        });
      }
    }

    // WASHINGTON (HB 1110 Middle Housing + HB 1337 ADUs + SB 5184 Parking Cap)
    if (parcel.state_code === "WA" && parcel.is_single_family_residential) {
      const nearTransit =
        (parcel.dist_to_heavy_rail_mi ?? 99) <= 0.25 ||
        (parcel.dist_to_frequent_bus_or_brt_mi ?? 99) <= 0.25;
      const units =
        parcel.municipality_pop > 75000 ? (nearTransit ? 6 : 4) :
        parcel.municipality_pop >= 25000 ? (nearTransit ? 4 : 2) : 2;
      statutes.push({
        citation: "WA HB 1110 + HB 1337 + SB 5184 (2025 Parking Reform)",
        max_units_by_right: units,
        max_height_ft: 35,
        max_far: null,
        min_parking_spaces_per_unit: nearTransit ? 0 : 0.5,
        affordability_mandate_pct: nearTransit && units === 6 ? 0.17 : 0,
        tax_exemption_pct: 0,
      });
    }

    // OREGON (HB 2001 Middle Housing inside Urban Growth Boundary)
    if (parcel.state_code === "OR" && parcel.is_single_family_residential) {
      const units = parcel.municipality_pop > 25000 ? 4 : parcel.municipality_pop > 10000 ? 2 : 1;
      if (units > 1) {
        statutes.push({
          citation: "OR HB 2001 (Middle Housing inside UGB)",
          max_units_by_right: units,
          max_height_ft: 35,
          max_far: null,
          min_parking_spaces_per_unit: 0,
          affordability_mandate_pct: 0,
          tax_exemption_pct: 0,
        });
      }
    }

    // ARIZONA (HB 2720 ADUs + HB 2721 Middle Housing in cities > 75k)
    if (parcel.state_code === "AZ" && parcel.municipality_pop > 75000 && parcel.is_single_family_residential) {
      statutes.push({
        citation: "AZ HB 2720 + HB 2721 (By-Right ADUs & 2-4 Unit Middle Housing)",
        max_units_by_right: 4,
        max_height_ft: 30,
        max_far: null,
        min_parking_spaces_per_unit: 1.0,
        affordability_mandate_pct: 0,
        tax_exemption_pct: 0,
      });
    }
  }

  return {
    parcel_id: parcel.parcel_id,
    state_code: parcel.state_code,
    base_zoning_code: parcel.base_zoning_code,
    applicable_statutes: statutes,
    statutory_exclusions: ex,
    net_by_right_feasible: statutes.length > 0 && !hasHardPhysicalExclusion,
  };
}
"""

with open(os.path.join(BASE_DIR, "src/engines/statutoryZoningEngine.ts"), "w", encoding="utf-8") as f:
    f.write(STATUTORY_ZONING)

print("Wrote src/engines/statutoryZoningEngine.ts")

# 3. src/engines/hedonicCapitalizationEngine.ts
HEDONIC = """export interface CandidateIntervention {
  id: string;
  name: string;
  evidenceGrade: "A" | "B" | "C" | "D" | "U";
  rawPriceLiftPct: number;       // Distance-decayed study price effect (e.g., 0.042 for +4.2%)
  studyStandardErrorPct: number; // Meta-analytic SE replacing arbitrary judgment bands
  lifecycleCostUsd: number;      // RSMeans-adjusted capital + 10-yr discounted upkeep
  localContextMultiplier: number;// Derived from ecoregion heat anomaly, canopy deficit, transit gap
}

export interface NeighborhoodBaseline {
  blockGroupGeoid: string;
  ecoregionId: string;
  medianHomeValueUsd: number;
  reachedHomesCount: number;
  isUrbanCore: boolean;
  renterShare: number;           // 0.0 to 1.0
  severeRentBurdenShare: number; // 0.0 to 1.0
  rentControlCoverage: number;   // 0.0 to 1.0
}

export function computeSubAdditivePackage(
  baseline: NeighborhoodBaseline,
  candidates: CandidateIntervention[],
  applyLocalContext: boolean
) {
  // Empirical neighborhood capitalization ceiling (prevents +30-50% linear stacking hallucinations)
  const pMax = baseline.isUrbanCore ? 0.30 : 0.22;

  // Sort by standalone marginal value per dollar first
  const scored = candidates
    .map((c) => {
      const adjLift = applyLocalContext
        ? c.rawPriceLiftPct * c.localContextMultiplier
        : c.rawPriceLiftPct;
      const standaloneValueAdded =
        baseline.medianHomeValueUsd * baseline.reachedHomesCount * adjLift;
      return {
        ...c,
        effectiveLiftPct: adjLift,
        standaloneRoiPerDollar: standaloneValueAdded / Math.max(1, c.lifecycleCostUsd),
        ci95HalfWidthPct: 1.96 * c.studyStandardErrorPct,
      };
    })
    .sort((a, b) => b.standaloneRoiPerDollar - a.standaloneRoiPerDollar);

  // Greedy marginal sub-additive accumulation: ΔP_joint = P_max * [1 - Π (1 - Δp_i / P_max)]
  let survivalProduct = 1.0;
  let cumulativeCostUsd = 0;

  const rankedMarginal = scored.map((item) => {
    const prevJointPct = pMax * (1 - survivalProduct);
    const clampedLift = Math.min(item.effectiveLiftPct, pMax * 0.95);
    survivalProduct *= 1 - clampedLift / pMax;
    const newJointPct = pMax * (1 - survivalProduct);

    const marginalLiftPct = newJointPct - prevJointPct;
    const marginalValueAddedUsd =
      baseline.medianHomeValueUsd * baseline.reachedHomesCount * marginalLiftPct;
    const marginalRoiPerDollar = marginalValueAddedUsd / Math.max(1, item.lifecycleCostUsd);

    if (marginalRoiPerDollar >= 1.0) {
      cumulativeCostUsd += item.lifecycleCostUsd;
    }

    return {
      ...item,
      marginalLiftPct,
      marginalRoiPerDollar,
      paysBackMarginally: marginalRoiPerDollar >= 1.0,
    };
  });

  const jointCapitalizationPct = pMax * (1 - survivalProduct);
  const jointValueAddedUsd =
    baseline.medianHomeValueUsd * baseline.reachedHomesCount * jointCapitalizationPct;

  // Renter Displacement Sensitivity Score (0-100)
  const vulnerabilityBase =
    0.4 * baseline.renterShare +
    0.35 * baseline.severeRentBurdenShare +
    0.25 * (1 - baseline.rentControlCoverage);
  const displacementRiskScore = Math.round(
    100 * vulnerabilityBase * Math.min(1, jointCapitalizationPct / 0.1)
  );

  return {
    jointCapitalizationPct,
    jointValueAddedUsd: Math.round(jointValueAddedUsd),
    totalPaybackPackageCostUsd: Math.round(cumulativeCostUsd),
    displacementRiskScore,
    projects: rankedMarginal,
  };
}
"""

with open(os.path.join(BASE_DIR, "src/engines/hedonicCapitalizationEngine.ts"), "w", encoding="utf-8") as f:
    f.write(HEDONIC)

print("Wrote src/engines/hedonicCapitalizationEngine.ts")

# 4. src/engines/solarMicrogridEngine.ts
SOLAR = """import { SolarMicrogridCalculation } from "../types";

export interface SolarInput {
  taxYear: number;
  stateCode: string;
  ownershipModel: "cash_or_loan" | "third_party_lease_or_ppa";
  grossRoofSqft: number;
  lidarUnshadedUsableFraction: number; // From USGS 3DEP DSM pitch/azimuth/tree-shade mask (0.25-0.75)
  localInstallCostPerWattUsd: number;  // RSMeans adjusted (e.g., $2.85-$3.60/W)
  annualYieldKwhPerKw: number;         // NREL PVWatts regional yield (e.g., 1,620 in LA, 1,180 in Chicago)
  retailImportRateUsdKwh: number;
  exportRateUsdKwh: number;            // e.g., $0.055 avoided cost under CA NEM 3.0 vs. retail 1:1
  selfConsumptionFraction: number;     // ~0.40 without battery, ~0.78 with paired battery
  hasBatteryStorage: boolean;
  batteryCostUsd: number;
  meets2026FeocAndPrevailingWage: boolean; // Required for 30% § 48E commercial/TPO rate
}

const STATE_SOLAR_CREDITS: Record<string, { pct: number; capUsd: number }> = {
  NY: { pct: 0.25, capUsd: 5000 },
  MA: { pct: 0.15, capUsd: 1000 },
  AZ: { pct: 0.25, capUsd: 1000 },
  SC: { pct: 0.25, capUsd: 3500 },
};

export function calculateSolarMicrogridRoi(input: SolarInput): SolarMicrogridCalculation {
  const usableRoofSqft = input.grossRoofSqft * input.lidarUnshadedUsableFraction;
  // ~18.5 W DC per usable sq ft for modern 410W-430W monocrystalline modules
  const systemSizeDcKw = (usableRoofSqft * 18.5) / 1000;
  const grossCapex =
    systemSizeDcKw * 1000 * input.localInstallCostPerWattUsd +
    (input.hasBatteryStorage ? input.batteryCostUsd : 0);

  // CRITICAL 2026 RULE: IRC § 25D (30% residential cash/loan ITC) expired Dec 31, 2025.
  let federalItcPct = 0;
  if (input.taxYear <= 2025) {
    federalItcPct = 0.3;
  } else if (input.ownershipModel === "third_party_lease_or_ppa") {
    federalItcPct = input.meets2026FeocAndPrevailingWage ? 0.3 : 0.06;
  }

  let stateTaxCreditUsd = 0;
  if (input.ownershipModel === "cash_or_loan" && STATE_SOLAR_CREDITS[input.stateCode]) {
    const rule = STATE_SOLAR_CREDITS[input.stateCode];
    stateTaxCreditUsd = Math.min(grossCapex * rule.pct, rule.capUsd);
  }

  const netCapex = grossCapex * (1 - federalItcPct) - stateTaxCreditUsd;

  // 25-year discounted cashflow (0.5%/yr module degradation, 3.0%/yr utility escalation, 5% discount rate)
  const annualGenYear1 = systemSizeDcKw * input.annualYieldKwhPerKw;
  let pvSavings = 0;
  for (let yr = 1; yr <= 25; yr++) {
    const deg = Math.pow(0.995, yr - 1);
    const esc = Math.pow(1.03, yr - 1);
    const gen = annualGenYear1 * deg;
    const selfConsumed = gen * input.selfConsumptionFraction;
    const exported = gen * (1 - input.selfConsumptionFraction);
    const yrSavings =
      (selfConsumed * input.retailImportRateUsdKwh + exported * input.exportRateUsdKwh) * esc;
    pvSavings += yrSavings / Math.pow(1.05, yr);
  }

  const isAvoidedCostTariff = input.exportRateUsdKwh < input.retailImportRateUsdKwh * 0.5;

  return {
    tax_year: input.taxYear,
    ownership_model: input.ownershipModel,
    usable_roof_sqft_lidar: Math.round(usableRoofSqft),
    system_size_dc_kw: Number(systemSizeDcKw.toFixed(2)),
    federal_itc_pct: federalItcPct,
    state_tax_credit_usd: Math.round(stateTaxCreditUsd),
    net_metering_tariff: isAvoidedCostTariff ? "ca_nem_3_avoided_cost" : "retail_1_to_1",
    battery_storage_required_for_roi: isAvoidedCostTariff && !input.hasBatteryStorage,
    net_25yr_npv_usd: Math.round(pvSavings - netCapex),
  };
}
"""

with open(os.path.join(BASE_DIR, "src/engines/solarMicrogridEngine.ts"), "w", encoding="utf-8") as f:
    f.write(SOLAR)

print("Wrote src/engines/solarMicrogridEngine.ts")

# 5. src/engines/residualProfitEngine.ts
PROFIT = """import { StateFinanceProfile, StatutoryZoningResult } from "../types";

export interface ResidualProfitInput {
  parcelLotSqft: number;
  existingStructureValueUsd: number;
  existingLandValueUsd: number;
  submarketPricePerSqftUsd: number;
  zoningResult: StatutoryZoningResult;
  financeProfile: StateFinanceProfile;
  targetDeveloperMarginPct?: number; // Default: 0.15 (15%)
  softCostPct?: number;              // Default: 0.22 (22% architecture, permitting, impact fees)
  financingCarryPct?: number;        // Default: 0.08 (8% construction loan interest & carry)
}

export interface ResidualProfitOutput {
  feasible: boolean;
  maxBuildableSqft: number;
  grossDevelopmentValueUsd: number;
  totalDevelopmentCostUsd: number;
  residualLandValueUsd: number;
  netProfitPotentialUsd: number;
  profitMarginOnCostPct: number;
  disclaimers: string[];
}

export function calculateResidualProfitPotential(
  input: ResidualProfitInput
): ResidualProfitOutput {
  const disclaimers = [
    "UNVERIFIED EXPERIMENTAL MODEL: Preliminary residual land value screen; requires site-specific geotechnical, utility capacity, and municipal fee verification.",
  ];

  if (!input.zoningResult.net_by_right_feasible || input.zoningResult.applicable_statutes.length === 0) {
    return {
      feasible: false,
      maxBuildableSqft: 0,
      grossDevelopmentValueUsd: 0,
      totalDevelopmentCostUsd: 0,
      residualLandValueUsd: 0,
      netProfitPotentialUsd: 0,
      profitMarginOnCostPct: 0,
      disclaimers: [...disclaimers, "Blocked by statutory exclusion or lack of by-right upzoning eligibility."],
    };
  }

  // Select highest-yield applicable statute
  const bestStatute = [...input.zoningResult.applicable_statutes].sort(
    (a, b) => b.max_units_by_right - a.max_units_by_right
  )[0];

  // Estimate max buildable gross floor area (capped by FAR if defined, else 950 avg sqft/unit + 15% circulation)
  const farCapSqft = bestStatute.max_far
    ? input.parcelLotSqft * bestStatute.max_far
    : input.parcelLotSqft * 2.5;
  const unitDrivenSqft = bestStatute.max_units_by_right * 950 * 1.15;
  const maxBuildableSqft = Math.min(farCapSqft, unitDrivenSqft);

  // Discount Gross Development Value (GDV) for mandatory below-market affordable units (45% revenue haircut on BMR share)
  const effectiveRevenueMultiplier = 1 - bestStatute.affordability_mandate_pct * 0.45;
  const grossDevelopmentValueUsd =
    maxBuildableSqft * 0.85 * input.submarketPricePerSqftUsd * effectiveRevenueMultiplier;

  // Baseline national hard cost $265/sqft scaled by state RSMeans multiplier
  const hardCostPerSqft = 265 * input.financeProfile.rsmeans_cost_multiplier;
  const hardCostsUsd = maxBuildableSqft * hardCostPerSqft;

  const softCostPct = input.softCostPct ?? 0.22;
  const financingCarryPct = input.financingCarryPct ?? 0.08;
  const targetMarginPct = input.targetDeveloperMarginPct ?? 0.15;

  const softAndCarryUsd = hardCostsUsd * (softCostPct + financingCarryPct);
  const demolitionAndAcquisitionUsd =
    input.existingLandValueUsd + input.existingStructureValueUsd * 0.15; // Assumes teardown/rehab basis
  const totalDevelopmentCostUsd =
    hardCostsUsd + softAndCarryUsd + demolitionAndAcquisitionUsd;

  const requiredDeveloperProfitUsd = totalDevelopmentCostUsd * targetMarginPct;
  const residualLandValueUsd =
    grossDevelopmentValueUsd - (hardCostsUsd + softAndCarryUsd + requiredDeveloperProfitUsd);
  const netProfitPotentialUsd =
    grossDevelopmentValueUsd - totalDevelopmentCostUsd - requiredDeveloperProfitUsd;
  const profitMarginOnCostPct =
    totalDevelopmentCostUsd > 0
      ? (grossDevelopmentValueUsd - totalDevelopmentCostUsd) / totalDevelopmentCostUsd
      : 0;

  return {
    feasible: netProfitPotentialUsd > 0,
    maxBuildableSqft: Math.round(maxBuildableSqft),
    grossDevelopmentValueUsd: Math.round(grossDevelopmentValueUsd),
    totalDevelopmentCostUsd: Math.round(totalDevelopmentCostUsd),
    residualLandValueUsd: Math.round(residualLandValueUsd),
    netProfitPotentialUsd: Math.round(netProfitPotentialUsd),
    profitMarginOnCostPct: Number((profitMarginOnCostPct * 100).toFixed(2)),
    disclaimers,
  };
}
"""

with open(os.path.join(BASE_DIR, "src/engines/residualProfitEngine.ts"), "w", encoding="utf-8") as f:
    f.write(PROFIT)

print("Wrote src/engines/residualProfitEngine.ts")
