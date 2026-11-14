/**
 * Solar & Microgrid Engine (ES6 / Browser & Node compatible)
 * Models residential and commercial solar PV + battery storage ROI under:
 * - 2026 Federal ITC rules: IRC § 25D expired Dec 31, 2025 (OBBBA P.L. 119-21) -> 0% federal ITC for homeowner cash/loan purchases!
 * - Third-party ownership (TPO) / lease / PPA: 30% § 48E with FEOC & prevailing wage
 * - California NEM 3.0 avoided-cost tariff structure (battery storage required for positive ROI)
 * - State solar tax credits (NY, MA, AZ, SC, etc.)
 */

const STATE_SOLAR_CREDITS = {
  NY: { pct: 0.25, capUsd: 5000 },
  MA: { pct: 0.15, capUsd: 1000 },
  AZ: { pct: 0.25, capUsd: 1000 },
  SC: { pct: 0.25, capUsd: 3500 },
};

function calculateSolarMicrogridRoi(input) {
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

if (typeof module !== "undefined" && module.exports) {
  module.exports = { calculateSolarMicrogridRoi };
}
