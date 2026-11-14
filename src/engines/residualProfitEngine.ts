import { StateFinanceProfile, StatutoryZoningResult } from "../types";

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
