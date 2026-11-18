/**
 * StreetForge Civil Engineering & Opportunity Cost Engine (ES6 / Browser & Node compatible)
 */

export function evaluateRightOfWayReallocation(input) {
  const miles = Math.max(0.1, input.lengthMiles);

  let costPerMile = 240000;
  if (input.reallocationType === "protected_bike_lane") costPerMile = 285000;
  else if (input.reallocationType === "buffered_bike_lane") costPerMile = 115000;
  else if (input.reallocationType === "dedicated_bus_lane") costPerMile = 95000;
  else if (input.reallocationType === "pedestrian_promenade") costPerMile = 850000;

  const capitalCost = Math.round(costPerMile * miles);
  const grantShare = input.reallocationType === "protected_bike_lane" || input.reallocationType === "pedestrian_promenade" ? 0.75 : 0.60;
  const grantFunding = Math.round(capitalCost * grantShare);
  const netMunicipalCost = capitalCost - grantFunding;

  const aadt = input.currentAadt ?? null;   // no stand-in traffic count
  const capacityPerLane = 800;
  const isConstrained = aadt != null && (aadt / (input.currentDriveLanes * 10)) > capacityPerLane;
  const delaySec = aadt == null ? null : isConstrained ? Math.min(65, Math.round((aadt / 1000) * 2.8)) : 12;
  const divertedPct = isConstrained ? 8.5 : 3.0;
  const newBikeRiders = Math.round(miles * (input.reallocationType === "protected_bike_lane" ? 620 : 310));

  const dailyVehicleMilesReduced = Math.round(newBikeRiders * 2.5 * 0.7);
  const annualVmtReduced = dailyVehicleMilesReduced * 310;
  const co2TonsAvoided = Math.round((annualVmtReduced * 0.000404) * 10) / 10;
  const noxLbsAvoided = Math.round(annualVmtReduced * 0.00078 * 10) / 10;
  const socialCostOfCarbon = Math.round(co2TonsAvoided * 190);

  const crashReductionPct = input.reallocationType === "protected_bike_lane" ? 42 : 28;
  const avoidedCrashes = Math.round((miles * 1.8 * (crashReductionPct / 100)) * 10) / 10;
  const economicSafetySavings = Math.round(avoidedCrashes * 145000);

  const businesses = input.adjacentRetailBusinessesCount || Math.round(miles * 18);
  const salesLiftPct = input.reallocationType === "protected_bike_lane" ? 14.5 : 8.0;
  const annualSalesTaxGain = Math.round(businesses * 350000 * (salesLiftPct / 100) * 0.02);
  const propertyAppreciationPct = 6.5;

  const tenYearBenefits = (socialCostOfCarbon * 10) + (economicSafetySavings * 10) + (annualSalesTaxGain * 10);
  const bcr = Math.round((tenYearBenefits / capitalCost) * 10) / 10;

  const narrative = `Converting 1 drive lane to a ${input.reallocationType.replace(/_/g, " ")} over ${miles} miles costs $${(capitalCost / 1e3).toFixed(0)}k ($${(netMunicipalCost / 1e3).toFixed(0)}k net after 75% federal SS4A match). It avoids ${co2TonsAvoided} tons of CO2 annually, eliminates ~${avoidedCrashes} severe crashes/year, and drives a +${salesLiftPct}% sales uplift for ${businesses} corridor businesses (BCR: ${bcr}:1).`;

  return {
    corridorName: input.corridorName,
    reallocationType: input.reallocationType,
    lengthMiles: miles,
    capitalCostUsd: capitalCost,
    grantFundingAvailableUsd: grantFunding,
    netMunicipalCostUsd: netMunicipalCost,
    applicableGrants: [
      "USDOT Safe Streets and Roads for All (SS4A) Discretionary Grant",
      "FHWA Carbon Reduction Program (CRP)",
      "State Active Transportation Program (ATP)"
    ],
    trafficImpact: {
      peakHourDelaySecondsPerVehicle: delaySec,
      divertedVehiclesDailyPct: divertedPct,
      modeShiftTransitBikeDailyRiders: newBikeRiders,
      congestionCostAnnualUsd: (aadt != null && delaySec != null) ? Math.round(delaySec * aadt * 0.005 * 250) : null
    },
    pollutionAndEmissions: {
      co2TonsAvoidedAnnual: co2TonsAvoided,
      noxPoundsAvoidedAnnual: noxLbsAvoided,
      monetizedSocialCostOfCarbonUsd: socialCostOfCarbon
    },
    safetyAndWalkability: {
      crashReductionPct,
      annualAvoidedInjuryCrashes: avoidedCrashes,
      annualEconomicSafetySavingsUsd: economicSafetySavings,
      walkabilityScoreIncreasePoints: 16
    },
    economicUplift: {
      projectedAdjacentRetailSalesLiftPct: salesLiftPct,
      annualSalesTaxGainUsd: annualSalesTaxGain,
      commercialPropertyAppreciationPct: propertyAppreciationPct
    },
    benefitCostRatio: bcr,
    verdictNarrative: narrative
  };
}

export function evaluateEvChargerSiting(input) {
  const ports = Math.max(2, input.numberOfPorts);

  let hardwarePerPort = 45000;
  let civilPerPort = 18000;
  let transformerBase = 32000;

  if (input.chargerType === "dc_fast_charger_350kw") {
    hardwarePerPort = 85000;
    civilPerPort = 26000;
    transformerBase = 65000;
  } else if (input.chargerType === "level_2_dual_port") {
    hardwarePerPort = 5500;
    civilPerPort = 4200;
    transformerBase = 6000;
  }

  const distancePenalty = Math.round(input.distanceToThreePhasePowerMeters * 85);
  const hwTotal = hardwarePerPort * ports;
  const civilTotal = (civilPerPort * ports) + distancePenalty;
  const transformerTotal = input.distanceToThreePhasePowerMeters > 80 ? transformerBase * 1.5 : transformerBase;
  const softCosts = Math.round((hwTotal + civilTotal + transformerTotal) * 0.12);
  const grossCost = hwTotal + civilTotal + transformerTotal + softCosts;

  let neviGrant = 0;
  let sec30cCredit = 0;

  if (input.isJustice40DisadvantagedTract || String(input.chargerType).includes("dc_fast")) {
    neviGrant = Math.round(grossCost * 0.65);
  }
  if (input.isJustice40DisadvantagedTract) {
    const eligibleAmount = Math.max(0, grossCost - neviGrant);
    sec30cCredit = Math.min(100000 * ports, Math.round(eligibleAmount * 0.30));
  }

  const totalIncentives = Math.min(grossCost * 0.85, neviGrant + sec30cCredit);
  const netProjectCost = grossCost - totalIncentives;

  const dailySessions = Math.round(ports * 4.2);
  const kwhPerSession = String(input.chargerType).includes("dc_fast") ? 36 : 14;
  const annualKwh = Math.round(dailySessions * kwhPerSession * 365);

  const revenuePerKwh = String(input.chargerType).includes("dc_fast") ? 0.48 : 0.28;
  const grossRev = Math.round(annualKwh * revenuePerKwh);
  const electricityCost = Math.round(annualKwh * 0.21);
  const networkAndOpex = Math.round(1800 * ports);
  const noi = grossRev - electricityCost - networkAndOpex;

  const payback = noi > 0 ? Math.round((netProjectCost / noi) * 10) / 10 : 99;

  let score = 75;
  if (input.distanceToThreePhasePowerMeters <= 50) score += 15;
  else if (input.distanceToThreePhasePowerMeters > 150) score -= 20;
  if (input.isJustice40DisadvantagedTract) score += 10;
  if (payback <= 4.0) score += 10;
  score = Math.min(100, Math.max(10, score));

  const recommendation = score >= 80
    ? `PRIME SITING OPPORTUNITY: ${input.locationName} is within ${input.distanceToThreePhasePowerMeters}m of 3-phase power, unlocking a ${(totalIncentives / grossCost * 100).toFixed(0)}% federal match ($${(totalIncentives / 1e3).toFixed(0)}k). Net cost of $${(netProjectCost / 1e3).toFixed(0)}k pays back in ${payback} years via $${(noi / 1e3).toFixed(1)}k annual NOI.`
    : `SECONDARY SITE: Higher grid interconnect distance (${input.distanceToThreePhasePowerMeters}m) incurs $${(distancePenalty / 1e3).toFixed(0)}k in civil trenching penalties. Consider co-locating with an existing commercial service panel to improve capital efficiency.`;

  return {
    locationName: input.locationName,
    chargerType: input.chargerType,
    numberOfPorts: ports,
    grossCapitalCostUsd: {
      equipmentHardware: hwTotal,
      civilWorkAndTrenching: civilTotal,
      utilityTransformerUpgrade: transformerTotal,
      permittingAndEngineering: softCosts,
      totalGrossCost: grossCost
    },
    taxCreditsAndGrants: {
      federalNeviGrantUsd: neviGrant,
      iraSection30cTaxCreditUsd: sec30cCredit,
      totalIncentiveFundingUsd: totalIncentives,
      incentiveFundingSharePct: Math.round((totalIncentives / grossCost) * 100)
    },
    netProjectCostUsd: netProjectCost,
    economics: {
      estimatedDailyChargingSessions: dailySessions,
      annualKwhDispensed: annualKwh,
      projectedGrossAnnualRevenueUsd: grossRev,
      annualElectricityAndOpexUsd: electricityCost + networkAndOpex,
      netAnnualOperatingIncomeUsd: noi,
      simplePaybackYears: payback
    },
    sitingSuitabilityScore: score,
    sitingRecommendation: recommendation
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    evaluateRightOfWayReallocation,
    evaluateEvChargerSiting,
  };
}

if (typeof window !== "undefined") {
  window.evaluateRightOfWayReallocation = evaluateRightOfWayReallocation;
  window.evaluateEvChargerSiting = evaluateEvChargerSiting;
}
