/**
 * EverySpace Holding Asset & Property Space Monetization Engine (ES6 / Browser & Node compatible)
 */

export function evaluateEverySpaceMonetization(input) {
  const channels = [];
  const holdMonths = Math.max(1, input.plannedHoldingMonths || 12);
  const monthlyExpenses = (input.monthlyDebtServiceMortgageUsd || 0) + (input.monthlyPropertyTaxAndInsuranceUsd || 0);

  if (input.features && input.features.hasDriveway) {
    const spaces = Math.max(1, input.features.drivewaySpacesCount || 2);
    const perSpaceExpected = 180;
    channels.push({
      channelId: "driveway_parking",
      name: "Driveway Commuter & RV / Fleet Parking",
      spaceDescription: `${spaces} designated driveway vehicle parking / equipment staging stalls`,
      monthlyRevenueLowUsd: spaces * 120,
      monthlyRevenueHighUsd: spaces * 240,
      monthlyRevenueExpectedUsd: spaces * perSpaceExpected,
      upfrontSetupCostUsd: 250,
      operationalComplexity: "zero_touch_passive",
      holdingPhaseApplicability: "both",
      revenueNotes: "High demand in transit-adjacent walksheds and urban residential neighborhoods."
    });
  }

  // No stand-in size: a storage channel is listed only when the storage area is known.
  if (input.features && input.features.hasAtticOrBasementStorage && input.features.storageSqft) {
    const sqft = input.features.storageSqft;
    const expected = Math.round(sqft * 1.25);
    channels.push({
      channelId: "enclosed_storage",
      name: "Enclosed Attic / Basement Storage Depot",
      spaceDescription: `~${sqft} sq ft secure interior climate-shielded storage space`,
      monthlyRevenueLowUsd: Math.round(sqft * 0.90),
      monthlyRevenueHighUsd: Math.round(sqft * 1.60),
      monthlyRevenueExpectedUsd: expected,
      upfrontSetupCostUsd: 400,
      operationalComplexity: "zero_touch_passive",
      holdingPhaseApplicability: "pre_construction_only",
      revenueNotes: "Monetizes vacant interior volume during the 12-month architectural & permitting phase."
    });
  }

  if (input.features && input.features.hasPool) {
    channels.push({
      channelId: "private_pool_rental",
      name: "Private Backyard Pool Hourly Rental",
      spaceDescription: "Private pool and patio terrace rented by the hour for family/private events",
      monthlyRevenueLowUsd: 450,
      monthlyRevenueHighUsd: 1250,
      monthlyRevenueExpectedUsd: 750,
      upfrontSetupCostUsd: 500,
      operationalComplexity: "low_touch_digital",
      holdingPhaseApplicability: "pre_construction_only",
      revenueNotes: "Generates high seasonal cash flow prior to ground-breaking or site demolition."
    });
  }

  if (input.features && input.features.hasAvailableRoofSqftForSolar && input.features.availableRoofSqft) {
    const roofSqft = input.features.availableRoofSqft;
    const kwCapacity = Math.round(roofSqft / 100);
    const solarRev = Math.round(kwCapacity * 18);
    channels.push({
      channelId: "rooftop_solar_lease",
      name: "Rooftop Solar Generation & Community Power Lease",
      spaceDescription: `~${roofSqft} sq ft unshaded roof hosting ~${kwCapacity} kW solar microgrid`,
      monthlyRevenueLowUsd: Math.round(kwCapacity * 14),
      monthlyRevenueHighUsd: Math.round(kwCapacity * 24),
      monthlyRevenueExpectedUsd: solarRev,
      upfrontSetupCostUsd: 0,
      operationalComplexity: "zero_touch_passive",
      holdingPhaseApplicability: "both",
      revenueNotes: "Eliminates property power bills and exports clean energy to neighboring parcels."
    });
  }

  // Rent only from HUD's Fair Market Rent for the county; with no HUD rent on file the channel is left out.
  const hudOneBed = (input.localHudFmr && input.localHudFmr.one_bed_1br != null) ? input.localHudFmr.one_bed_1br : null;
  if (input.features && input.features.hasExistingCasitaOrAdu && hudOneBed != null) {
    const aduRent = hudOneBed;
    channels.push({
      channelId: "existing_casita_adu",
      name: "Secondary Unit / Casita Tenant Rental",
      spaceDescription: "Independent secondary dwelling unit rented to traveling medical or local workforce",
      monthlyRevenueLowUsd: Math.round(aduRent * 0.90),
      monthlyRevenueHighUsd: Math.round(aduRent * 1.15),
      monthlyRevenueExpectedUsd: aduRent,
      upfrontSetupCostUsd: 600,
      operationalComplexity: "low_touch_digital",
      holdingPhaseApplicability: "both",
      revenueNotes: `Rent is HUD's ${input.localHudFmr && input.localHudFmr.fiscal_year ? "FY" + input.localHudFmr.fiscal_year + " " : ""}one-bedroom Fair Market Rent for the county; actual demand is not checked.`
    });
  }

  // Every per-sq-ft rate, flat monthly figure and range multiplier in this engine is a typed-in assumption; only the
  // HUD rent (input.localHudFmr) is sourced. The page labels this block "Illustrative only".
  const assumptions = [
    { name: "parking space rent per month", value: 180, assumed: true },
    { name: "storage rent per sq ft per month", value: 1.25, assumed: true },
    { name: "pool rental per month", value: 750, assumed: true },
    { name: "solar lease per kW per month", value: 18, assumed: true },
    { name: "low / high range multipliers", value: "0.90-1.60", assumed: true }
  ];

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
    holdingStrategyRecommendation: recommendation,
    illustrative: true,
    assumptions
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    evaluateEverySpaceMonetization,
  };
}

if (typeof window !== "undefined") {
  window.evaluateEverySpaceMonetization = evaluateEverySpaceMonetization;
}
