/**
 * Homeowner Renovation Quote Evaluator Engine (ES6 / Browser & Node compatible)
 * Implements User Mandate & Roadmap P1/P2
 */

const RENOVATION_BENCHMARKS = {
  detached_adu: { lowPerSqft: 240, highPerSqft: 340, typicalTurnkeyMin: 140000, typicalTurnkeyMax: 260000, typicalEquityLiftPct: 0.28 },
  attached_adu: { lowPerSqft: 200, highPerSqft: 290, typicalTurnkeyMin: 110000, typicalTurnkeyMax: 210000, typicalEquityLiftPct: 0.24 },
  garage_conversion_adu: { lowPerSqft: 130, highPerSqft: 195, typicalTurnkeyMin: 55000, typicalTurnkeyMax: 95000, typicalEquityLiftPct: 0.20 },
  junior_adu: { lowPerSqft: 110, highPerSqft: 175, typicalTurnkeyMin: 35000, typicalTurnkeyMax: 70000, typicalEquityLiftPct: 0.15 },
  second_story_addition: { lowPerSqft: 260, highPerSqft: 380, typicalTurnkeyMin: 175000, typicalTurnkeyMax: 320000, typicalEquityLiftPct: 0.22 },
  kitchen_remodel_major: { lowPerSqft: 150, highPerSqft: 280, typicalTurnkeyMin: 45000, typicalTurnkeyMax: 90000, typicalEquityLiftPct: 0.08 },
  kitchen_remodel_minor: { lowPerSqft: 80, highPerSqft: 150, typicalTurnkeyMin: 18000, typicalTurnkeyMax: 35000, typicalEquityLiftPct: 0.05 },
  bathroom_addition: { lowPerSqft: 250, highPerSqft: 450, typicalTurnkeyMin: 22000, typicalTurnkeyMax: 45000, typicalEquityLiftPct: 0.07 },
  rooftop_solar_battery: { lowPerSqft: 0, highPerSqft: 0, typicalTurnkeyMin: 18000, typicalTurnkeyMax: 32000, typicalEquityLiftPct: 0.04 },
  heat_pump_electrification: { lowPerSqft: 0, highPerSqft: 0, typicalTurnkeyMin: 12000, typicalTurnkeyMax: 24000, typicalEquityLiftPct: 0.03 },
  roof_replacement: { lowPerSqft: 6, highPerSqft: 12, typicalTurnkeyMin: 11000, typicalTurnkeyMax: 22000, typicalEquityLiftPct: 0.03 }
};

function checkStatutoryPreemption(stateCode, improvementType) {
  const isAdu = String(improvementType).includes("adu");

  if (isAdu) {
    if (stateCode === "CA") {
      return {
        isByRight: true,
        governingStatute: "California Gov. Code § 65852.2 & AB 2097 (Ministerial approval ≤60 days; zero parking requirement)",
        parkingMandateEliminated: true,
        discretionaryReviewRequired: false
      };
    }
    if (stateCode === "AZ") {
      return {
        isByRight: true,
        governingStatute: "Arizona HB 2720 / A.R.S. § 9-467.04 (Casitas by-right in municipalities >75k pop; max 1 parking space)",
        parkingMandateEliminated: true,
        discretionaryReviewRequired: false
      };
    }
    if (stateCode === "TX") {
      return {
        isByRight: true,
        governingStatute: "Texas Local Gov't Code § 214.909 / Austin HOME Phase 1 (3 units by-right, 0 parking minimums)",
        parkingMandateEliminated: true,
        discretionaryReviewRequired: false
      };
    }
    if (stateCode === "WA") {
      return {
        isByRight: true,
        governingStatute: "Washington HB 1337 / RCW 36.70A.696 (2 ADUs per single-family lot by-right)",
        parkingMandateEliminated: true,
        discretionaryReviewRequired: false
      };
    }
    if (stateCode === "CO") {
      return {
        isByRight: true,
        governingStatute: "Colorado HB 24-1152 / C.R.S. § 29-35-102 (By-right ADU authorization in subject jurisdictions)",
        parkingMandateEliminated: true,
        discretionaryReviewRequired: false
      };
    }
    if (stateCode === "FL") {
      return {
        isByRight: true,
        governingStatute: "Florida Live Local Act / Fla. Stat. § 166.04151 (Commercial infill & ADU encouragement)",
        parkingMandateEliminated: false,
        discretionaryReviewRequired: false
      };
    }
  }

  return {
    isByRight: false,
    governingStatute: "Local Municipal Land Use Code (Subject to standard municipal plan check and setback requirements)",
    parkingMandateEliminated: false,
    discretionaryReviewRequired: false
  };
}

export function evaluateHomeownerRenovationQuote(input) {
  const bench = RENOVATION_BENCHMARKS[input.improvementType] || RENOVATION_BENCHMARKS.detached_adu;
  const sqft = input.projectedSqft || 500;

  let marketLow;
  let marketHigh;

  if (bench.lowPerSqft > 0 && input.projectedSqft) {
    marketLow = Math.round(bench.lowPerSqft * input.projectedSqft);
    marketHigh = Math.round(bench.highPerSqft * input.projectedSqft);
  } else {
    marketLow = bench.typicalTurnkeyMin;
    marketHigh = bench.typicalTurnkeyMax;
  }

  const marketMid = (marketLow + marketHigh) / 2;
  const variancePct = Math.round(((input.quotedTotalCost - marketMid) / marketMid) * 100);

  let fairness;
  if (variancePct < -12) fairness = "below_market";
  else if (variancePct <= 12) fairness = "fair_market";
  else if (variancePct <= 30) fairness = "overpriced";
  else fairness = "substantially_overpriced";

  const hedonicLift = Math.round(input.currentPropertyValue * bench.typicalEquityLiftPct);
  const maxFeasibleLift = Math.round(marketHigh * 1.20);
  const estimatedEquityValueAdd = Math.min(hedonicLift, Math.max(marketLow, maxFeasibleLift));

  const netEquityGain = estimatedEquityValueAdd - input.quotedTotalCost;
  const roiPct = Math.round((netEquityGain / input.quotedTotalCost) * 100);

  let everySpaceMonthlyYield = 0;
  if (input.improvementType === "detached_adu" || input.improvementType === "attached_adu") {
    everySpaceMonthlyYield = (input.localHudFmr && input.localHudFmr.one_bed_1br) || 1850;
  } else if (input.improvementType === "garage_conversion_adu" || input.improvementType === "junior_adu") {
    everySpaceMonthlyYield = (input.localHudFmr && input.localHudFmr.zero_bed_eff) || 1450;
  } else if (input.improvementType === "rooftop_solar_battery") {
    everySpaceMonthlyYield = 220;
  }

  const everySpaceHoldingCarry = 450 * 6;

  const paybackYears = everySpaceMonthlyYield > 0
    ? Math.round((input.quotedTotalCost / (everySpaceMonthlyYield * 12)) * 10) / 10
    : null;

  const preemption = checkStatutoryPreemption(input.stateCode, input.improvementType);

  let verdict;
  let summary = "";

  if (fairness === "substantially_overpriced") {
    verdict = "OVERPRICED_RENEGOTIATE";
    summary = `Contractor quote ($${input.quotedTotalCost.toLocaleString()}) is ${variancePct}% above local market benchmarks ($${marketLow.toLocaleString()} – $${marketHigh.toLocaleString()}). Request an itemized cost breakdown for labor, framing, and finishes before signing.`;
  } else if (roiPct >= 15 || (everySpaceMonthlyYield > 0 && (paybackYears || 99) <= 10.0)) {
    verdict = "STRONG_BUY_RECOMMENDED";
    summary = `High-conviction value add. Projects +$${estimatedEquityValueAdd.toLocaleString()} in property equity (+${roiPct}% net ROI) and +$${everySpaceMonthlyYield.toLocaleString()}/mo ongoing EverySpace rental yield (${paybackYears} yr payback). Permitted by-right under ${preemption.governingStatute}.`;
  } else if (fairness === "fair_market" && (roiPct >= -35 || (everySpaceMonthlyYield > 0 && (paybackYears || 99) <= 14.0))) {
    verdict = "FAIR_LIFESTYLE_IMPROVEMENT";
    summary = `Fair market price ($${input.quotedTotalCost.toLocaleString()}). Adds roughly equivalent value to the home ($${estimatedEquityValueAdd.toLocaleString()}). Recommended primarily for lifestyle and living space expansion rather than immediate resale profit.`;
  } else {
    verdict = "NOT_RECOMMENDED_NEGATIVE_ROI";
    summary = `Negative equity return (ROI: ${roiPct}%). The proposed expenditure ($${input.quotedTotalCost.toLocaleString()}) will not be recouped upon resale (projected equity add: $${estimatedEquityValueAdd.toLocaleString()}). Consider higher-yield alternatives.`;
  }

  const negotiationPoints = [];
  if (fairness === "overpriced" || fairness === "substantially_overpriced") {
    negotiationPoints.push(`Counter with competitive bid range: $${marketLow.toLocaleString()} – $${marketHigh.toLocaleString()} ($${bench.lowPerSqft}–$${bench.highPerSqft}/sqft).`);
    negotiationPoints.push("Request owner-procured fixtures and finish allowances to avoid 20–25% general contractor markup on materials.");
    negotiationPoints.push("Separate site utilities and trenching into a dedicated allowance with maximum expenditure cap.");
  }
  if (preemption.isByRight) {
    negotiationPoints.push(`Ensure contractor does not charge for discretionary zoning variance hearings; project is ministerial under ${preemption.governingStatute}.`);
  }

  const alternativeHigherRoiOptions = [];
  if (input.improvementType !== "garage_conversion_adu" && input.improvementType !== "detached_adu") {
    alternativeHigherRoiOptions.push({
      alternativeType: "Garage Conversion ADU (EverySpace Studio)",
      estimatedCost: 65000,
      projectedEquityAdd: 95000,
      projectedRoiPct: 46,
      monthlyEverySpaceYield: (input.localHudFmr && input.localHudFmr.zero_bed_eff) || 1450,
      rationale: "Converts existing foundation and roof envelope for half the cost of ground-up construction, delivering immediate rental cash flow."
    });
  }
  if (input.improvementType !== "rooftop_solar_battery") {
    alternativeHigherRoiOptions.push({
      alternativeType: "Rooftop Solar & Smart Battery Microgrid",
      estimatedCost: 24000,
      projectedEquityAdd: 34000,
      projectedRoiPct: 42,
      monthlyEverySpaceYield: 220,
      rationale: "Eliminates electric utility drag and qualifies for federal clean energy tax credits, increasing net operating income."
    });
  }

  return {
    improvementType: input.improvementType,
    quotedCost: input.quotedTotalCost,
    benchmarkMarketCostLow: marketLow,
    benchmarkMarketCostHigh: marketHigh,
    costFairnessRating: fairness,
    costVariancePct: variancePct,
    estimatedEquityValueAdd,
    netEquityGainUsd: netEquityGain,
    returnOnInvestmentPct: roiPct,
    paybackYears,
    everySpaceMonthlyYieldUsd: everySpaceMonthlyYield,
    everySpaceHoldingCarryOffsetUsd: everySpaceHoldingCarry,
    statutoryEntitlementStatus: preemption,
    verdict,
    verdictSummary: summary,
    suggestedNegotiationPoints: negotiationPoints,
    alternativeHigherRoiOptions
  };
}
