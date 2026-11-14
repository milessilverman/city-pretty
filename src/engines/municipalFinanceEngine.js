/**
 * Municipal Finance Engine (ES6 / Browser & Node compatible)
 * Generalized multi-state TIF/EIFD/TIRZ/CRA bonding capacity and tax-increment model.
 */
function calculateTaxIncrementCapacity(input) {
  const {
    profile,
    baselineMarketValueUsd,
    effectiveMillageRate,
    annualMarketAppreciation,
    historicalTurnoverRate,
    newConstructionAnnualUsd,
    affordableExemptUnitsShare,
    affordableExemptionPct,
    localPledgeShare,
    bondTermYears,
    bondInterestRate,
    dscr,
  } = input;

  const notes = [];

  // 1. Apply state residential/commercial assessment ratio
  let initialTaxable = baselineMarketValueUsd * profile.res_assessment_ratio;

  // 2. Apply homestead or primary residence exemptions
  const hs = profile.homestead_exemption_rule;
  if (hs.type === "flat_assessed") {
    initialTaxable = Math.max(0, initialTaxable - hs.amount_or_pct);
    notes.push(`Applied flat assessed exemption of $${hs.amount_or_pct.toLocaleString()}`);
  } else if (hs.type === "flat_market") {
    initialTaxable = Math.max(0, (baselineMarketValueUsd - hs.amount_or_pct) * profile.res_assessment_ratio);
  } else if (hs.type === "percent_market") {
    initialTaxable = initialTaxable * (1 - hs.amount_or_pct);
    notes.push(`Applied ${(hs.amount_or_pct * 100).toFixed(0)}% primary-residence exemption`);
  }

  let currentTaxable = initialTaxable;
  let totalPvNetIncrement = 0;
  let year10AnnualIncrementUsd = 0;

  const effectiveTurnover = profile.uncaps_on_sale ? historicalTurnoverRate : 0;

  for (let year = 1; year <= bondTermYears; year++) {
    const isReassessmentYear = year % profile.reassessment_cycle_years === 0;

    if (profile.annual_assessment_cap === null) {
      // Uncapped states (e.g., TX commercial, CO, WA, NE): steps up on reassessment cycle
      if (isReassessmentYear) {
        const cycleGrowth = Math.pow(1 + annualMarketAppreciation, profile.reassessment_cycle_years) - 1;
        currentTaxable = currentTaxable * (1 + cycleGrowth);
      }
    } else {
      // Capped states (CA Prop 13 2%, FL SOH 3%, OR M50 3%, TX 10% HS, MI Proposal A)
      const cappedGrowth = Math.min(annualMarketAppreciation, profile.annual_assessment_cap);
      const retainedPool = currentTaxable * (1 - effectiveTurnover) * (1 + cappedGrowth);
      const uncappedPool = currentTaxable * effectiveTurnover * (1 + annualMarketAppreciation);
      currentTaxable = retainedPool + uncappedPool;
    }

    // Add new construction assessed value
    currentTaxable += newConstructionAnnualUsd * profile.res_assessment_ratio;

    // Deduct statutory affordable housing tax exemptions (e.g., FL Live Local § 196.1979)
    const statutoryExemptDeduction =
      currentTaxable * affordableExemptUnitsShare * affordableExemptionPct;
    const netTaxable = Math.max(0, currentTaxable - statutoryExemptDeduction);

    const taxableIncrement = Math.max(0, netTaxable - initialTaxable);
    let grossTaxIncrement = taxableIncrement * effectiveMillageRate;

    // Indiana Constitutional Circuit Breaker adjustment
    if (hs.type === "circuit_breaker" && effectiveMillageRate > hs.amount_or_pct) {
      const compressionRatio = hs.amount_or_pct / effectiveMillageRate;
      grossTaxIncrement *= compressionRatio;
      if (year === 1) notes.push("Compressed by statutory property-tax circuit breaker cap");
    }

    const pledgeableIncrement =
      grossTaxIncrement * (1 - profile.non_pledgeable_share) * localPledgeShare;

    if (year === 10) {
      year10AnnualIncrementUsd = pledgeableIncrement;
    }

    const debtServiceAvailable = pledgeableIncrement / dscr;
    totalPvNetIncrement += debtServiceAvailable / Math.pow(1 + bondInterestRate, year);
  }

  return {
    vehicleName: profile.tif_vehicle_name,
    initialTaxableValueUsd: Math.round(initialTaxable),
    year10AnnualIncrementUsd: Math.round(year10AnnualIncrementUsd),
    maxBondCapacityUsd: Math.round(totalPvNetIncrement),
    notes,
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { calculateTaxIncrementCapacity };
}
