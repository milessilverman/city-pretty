/**
 * EverySpace Holding Asset & Property Space Monetization Engine
 * Implements EverySpace Tripartite Integration Architecture:
 * Models short-term, medium-term, and micro-space monetization across an entire property
 * (attic, basement storage, driveway parking, RV storage, pool, roof solar, ADU)
 * to offset debt service and eliminate negative holding carry during pre-construction
 * entitlement and zoning windows.
 */

export interface EverySpacePropertyInput {
  propertyAddress: string;
  city: string;
  stateCode: string;
  countyFips: string;
  bedrooms: number;
  bathrooms: number;
  lotSqft: number;
  livingSqft: number;

  monthlyDebtServiceMortgageUsd: number;
  monthlyPropertyTaxAndInsuranceUsd: number;
  plannedHoldingMonths: number; // e.g. 12 to 24 months before redevelopment

  features: {
    hasDriveway: boolean;
    drivewaySpacesCount?: number;
    hasAtticOrBasementStorage: boolean;
    storageSqft?: number;
    hasPool: boolean;
    hasAvailableRoofSqftForSolar: boolean;
    availableRoofSqft?: number;
    hasExistingGarageForConversion: boolean;
    hasExistingCasitaOrAdu: boolean;
  };

  localHudFmr?: {
    zero_bed_eff?: number;
    one_bed_1br?: number;
    two_bed_2br?: number;
  };
}

export interface SpaceMonetizationChannel {
  channelId: string;
  name: string;
  spaceDescription: string;
  monthlyRevenueLowUsd: number;
  monthlyRevenueHighUsd: number;
  monthlyRevenueExpectedUsd: number;
  upfrontSetupCostUsd: number;
  operationalComplexity: "zero_touch_passive" | "low_touch_digital" | "moderate_active";
  holdingPhaseApplicability: "pre_construction_only" | "permanent_ongoing" | "both";
  revenueNotes: string;
}

export interface EverySpacePortfolioSummary {
  propertyAddress: string;
  monthlyGrossHoldingExpenseUsd: number; // mortgage + taxes + insurance
  totalHoldingMonths: number;
  cumulativeUnmitigatedHoldingCostUsd: number;

  channels: SpaceMonetizationChannel[];

  totalMonthlyEverySpaceGrossRevenueUsd: number;
  netMonthlyHoldingCashFlowUsd: number; // EverySpace revenue - holding expenses
  monthlyHoldingDeficitReductionPct: number;
  cumulativeEverySpaceEarningsOverHoldUsd: number;
  netEquityPreservedOverHoldUsd: number;

  isCashFlowPositiveDuringHold: boolean;
  holdingStrategyRecommendation: string;
}

/**
 * Evaluates the full EverySpace monetization potential for a property
 */
export function evaluateEverySpaceMonetization(input: EverySpacePropertyInput): EverySpacePortfolioSummary {
  const channels: SpaceMonetizationChannel[] = [];
  const holdMonths = Math.max(1, input.plannedHoldingMonths || 12);
  const monthlyExpenses = input.monthlyDebtServiceMortgageUsd + input.monthlyPropertyTaxAndInsuranceUsd;

  // 1. Driveway & Commuter/RV Parking
  if (input.features.hasDriveway) {
    const spaces = Math.max(1, input.features.drivewaySpacesCount || 2);
    // Typical storage/parking rent ~$150-$250 per stall monthly
    const perSpaceExpected = 180;
    channels.push({
      channelId: "driveway_parking",
      name: "Driveway Commuter & RV / Fleet Parking",
      spaceDescription: `${spaces} designated driveway vehicle parking / equipment staging stalls`,
      monthlyRevenueLowUsd: spaces * 120,
      monthlyRevenueHighUsd: spaces * 240,
      monthlyRevenueExpectedUsd: spaces * perSpaceExpected,
      upfrontSetupCostUsd: 250, // lock box / signage
      operationalComplexity: "zero_touch_passive",
      holdingPhaseApplicability: "both",
      revenueNotes: "High demand in transit-adjacent walksheds and urban residential neighborhoods."
    });
  }

  // 2. Attic or Basement Enclosed Storage
  if (input.features.hasAtticOrBasementStorage) {
    const sqft = input.features.storageSqft || 250;
    // Self-storage peer rate: ~$1.00 - $1.60 / sqft / month
    const expected = Math.round(sqft * 1.25);
    channels.push({
      channelId: "enclosed_storage",
      name: "Enclosed Attic / Basement Storage Depot",
      spaceDescription: `~${sqft} sq ft secure interior climate-shielded storage space`,
      monthlyRevenueLowUsd: Math.round(sqft * 0.90),
      monthlyRevenueHighUsd: Math.round(sqft * 1.60),
      monthlyRevenueExpectedUsd: expected,
      upfrontSetupCostUsd: 400, // shelving and smart lock
      operationalComplexity: "zero_touch_passive",
      holdingPhaseApplicability: "pre_construction_only",
      revenueNotes: "Monetizes vacant interior volume during the 12-month architectural & permitting phase."
    });
  }

  // 3. Pool Rental (Swimply / EverySpace Micro-Lease)
  if (input.features.hasPool) {
    // ~$45-$75/hour, ~15 hours/month average weather-normalized
    channels.push({
      channelId: "private_pool_rental",
      name: "Private Backyard Pool Hourly Rental",
      spaceDescription: "Private pool and patio terrace rented by the hour for family/private events",
      monthlyRevenueLowUsd: 450,
      monthlyRevenueHighUsd: 1250,
      monthlyRevenueExpectedUsd: 750,
      upfrontSetupCostUsd: 500, // outdoor lock, chemical maintenance
      operationalComplexity: "low_touch_digital",
      holdingPhaseApplicability: "pre_construction_only",
      revenueNotes: "Generates high seasonal cash flow prior to ground-breaking or site demolition."
    });
  }

  // 4. Rooftop Solar Community Leasing
  if (input.features.hasAvailableRoofSqftForSolar) {
    const roofSqft = input.features.availableRoofSqft || 1200;
    const kwCapacity = Math.round(roofSqft / 100); // ~10W/sqft = 12 kW system
    // Community solar host PPA or avoided utility cost: ~$15-$22/kW/month
    const solarRev = Math.round(kwCapacity * 18);
    channels.push({
      channelId: "rooftop_solar_lease",
      name: "Rooftop Solar Generation & Community Power Lease",
      spaceDescription: `~${roofSqft} sq ft unshaded roof hosting ~${kwCapacity} kW solar microgrid`,
      monthlyRevenueLowUsd: Math.round(kwCapacity * 14),
      monthlyRevenueHighUsd: Math.round(kwCapacity * 24),
      monthlyRevenueExpectedUsd: solarRev,
      upfrontSetupCostUsd: 0, // third-party PPA / developer capital
      operationalComplexity: "zero_touch_passive",
      holdingPhaseApplicability: "both",
      revenueNotes: "Eliminates property power bills and exports clean energy to neighboring parcels."
    });
  }

  // 5. Existing Casita / ADU Rental
  if (input.features.hasExistingCasitaOrAdu) {
    const aduRent = input.localHudFmr?.one_bed_1br || 1850;
    channels.push({
      channelId: "existing_casita_adu",
      name: "Secondary Unit / Casita Tenant Rental",
      spaceDescription: "Independent secondary dwelling unit rented to traveling medical or local workforce",
      monthlyRevenueLowUsd: Math.round(aduRent * 0.90),
      monthlyRevenueHighUsd: Math.round(aduRent * 1.15),
      monthlyRevenueExpectedUsd: aduRent,
      upfrontSetupCostUsd: 600, // turnover cleaning and paint
      operationalComplexity: "low_touch_digital",
      holdingPhaseApplicability: "both",
      revenueNotes: "Backed by HUD FY2026 Fair Market Rent benchmarks for guaranteed workforce demand."
    });
  }

  // Totals
  const totalMonthlyRev = channels.reduce((sum, ch) => sum + ch.monthlyRevenueExpectedUsd, 0);
  const netMonthlyCashFlow = totalMonthlyRev - monthlyExpenses;
  const deficitReductionPct = monthlyExpenses > 0
    ? Math.min(100, Math.round((totalMonthlyRev / monthlyExpenses) * 100))
    : 100;
  const cumulativeEarnings = totalMonthlyRev * holdMonths;
  const cumulativeHoldingCost = monthlyExpenses * holdMonths;
  const isPositive = netMonthlyCashFlow >= 0;

  let recommendation = "";
  if (isPositive) {
    recommendation = `CASH-FLOW POSITIVE HOLD: EverySpace generates $${totalMonthlyRev.toLocaleString()}/mo across ${channels.length} space channels, fully covering monthly carrying costs ($${monthlyExpenses.toLocaleString()}/mo) with +$${netMonthlyCashFlow.toLocaleString()}/mo net positive cash flow during the ${holdMonths}-month pre-development period.`;
  } else {
    recommendation = `HOLDING CARRY DEFICIT REDUCED BY ${deficitReductionPct}%: EverySpace generates $${totalMonthlyRev.toLocaleString()}/mo, offsetting $${cumulativeEarnings.toLocaleString()} of the $${cumulativeHoldingCost.toLocaleString()} holding expense over ${holdMonths} months. Reduces project burn rate to just $${Math.abs(netMonthlyCashFlow).toLocaleString()}/mo during entitlements.`;
  }

  return {
    propertyAddress: input.propertyAddress,
    monthlyGrossHoldingExpenseUsd: monthlyExpenses,
    totalHoldingMonths: holdMonths,
    cumulativeUnmitigatedHoldingCostUsd: cumulativeHoldingCost,
    channels,
    totalMonthlyEverySpaceGrossRevenueUsd: totalMonthlyRev,
    netMonthlyHoldingCashFlowUsd: netMonthlyCashFlow,
    monthlyHoldingDeficitReductionPct: deficitReductionPct,
    cumulativeEverySpaceEarningsOverHoldUsd: cumulativeEarnings,
    netEquityPreservedOverHoldUsd: Math.min(cumulativeHoldingCost, cumulativeEarnings),
    isCashFlowPositiveDuringHold: isPositive,
    holdingStrategyRecommendation: recommendation
  };
}
