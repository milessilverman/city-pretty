/**
 * Residual Land Value & Developer Profit Engine (ES6 / Browser & Node compatible)
 * Computes whether an upzoned multi-unit development generates positive residual land value:
 * Gross Development Value (GDV) - Total Hard/Soft Construction Costs - Required Developer Margin (15%) = Residual Land Value
 */

function calculateResidualLandValue(input) {
  const {
    lotSqft,
    unitsAllowed,
    avgUnitSqft,
    achievableMarketRentPerSqftMonthly,
    exitCapRate,
    hardCostPerSqftUsd,
    softCostFraction,
    requiredDeveloperMarginPct,
    currentLandAssessedValueUsd,
  } = input;

  const totalBuildingSqft = unitsAllowed * avgUnitSqft;
  const annualGrossRent = totalBuildingSqft * achievableMarketRentPerSqftMonthly * 12;
  const stabilizedNoy = annualGrossRent * 0.70; // 30% operating expenses / vacancy
  const grossDevelopmentValue = stabilizedNoy / exitCapRate;

  const totalHardCosts = totalBuildingSqft * hardCostPerSqftUsd;
  const totalSoftCosts = totalHardCosts * softCostFraction;
  const totalConstructionCost = totalHardCosts + totalSoftCosts;

  const developerMarginTargetUsd = grossDevelopmentValue * requiredDeveloperMarginPct;
  const residualLandValue = grossDevelopmentValue - totalConstructionCost - developerMarginTargetUsd;

  const profitOverBaselineLand = residualLandValue - currentLandAssessedValueUsd;
  const isDevelopmentFeasible = residualLandValue > currentLandAssessedValueUsd;

  return {
    unitsAllowed,
    totalBuildingSqft,
    grossDevelopmentValue: Math.round(grossDevelopmentValue),
    totalConstructionCost: Math.round(totalConstructionCost),
    developerMarginTargetUsd: Math.round(developerMarginTargetUsd),
    residualLandValue: Math.round(residualLandValue),
    profitOverBaselineLand: Math.round(profitOverBaselineLand),
    isDevelopmentFeasible,
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { calculateResidualLandValue };
}
