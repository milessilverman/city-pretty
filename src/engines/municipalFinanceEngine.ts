import { StateFinanceProfile } from "../types";

export interface TaxIncrementInput {
  profile: StateFinanceProfile;
  baselineMarketValueUsd: number;
  effectiveMillageRate: number;        // e.g., 0.0115 for 1.15%
  annualMarketAppreciation: number;    // e.g., 0.035
  historicalTurnoverRate: number;      // Block-group deed transfer rate (e.g., 0.035)
  newConstructionAnnualUsd: number;
  affordableExemptUnitsShare: number;  // For FL Live Local § 196.1979 (0.0 to 1.0)
  affordableExemptionPct: number;      // e.g., 0.75 or 1.00
  localPledgeShare: number;            // e.g., 0.75 city + county weighted pledge
  nonPledgeableShare: number;          // share of the levy that can't be pledged (e.g. schools/ERAF in CA), from a sourced
                                       // tax-rate-area split such as LA County's AF49 factors; was an unsourced profile field
  bondTermYears: number;               // Default: 30 (15-20 in NE/SD/WI)
  bondInterestRate: number;            // e.g., 0.0525
  dscr: number;                        // Debt service coverage ratio, e.g., 1.35
}

export interface TaxIncrementOutput {
  computed: boolean;
  missingFields: string[];               // state rules not confirmed; when non-empty nothing is computed
  vehicleName: string;
  initialTaxableValueUsd: number;
  year10AnnualIncrementUsd: number;
  maxBondCapacityUsd: number;
  notes: string[];
}

// The state rules this model reads. It computes only when every one is confirmed in the profile's verification
// record (state_finance_profiles.json); otherwise it returns computed:false and names what is missing.
export const FINANCE_CALC_FIELDS = ["res_assessment_ratio", "annual_assessment_cap", "uncaps_on_sale", "reassessment_cycle_years", "homestead_exemption_rule"] as const;

export function financeProfileGate(profile: StateFinanceProfile): string[] {
  const v = profile.verification;
  if (!v) return [...FINANCE_CALC_FIELDS];
  const uf = (v.unverified_fields || []).map((u) => String(u).split(/[\s(]/)[0]);
  // A confirmed null assessment cap means "no cap"; any other null or a listed field means "not confirmed".
  return FINANCE_CALC_FIELDS.filter((f) => uf.includes(f) || (profile as any)[f] === undefined || ((profile as any)[f] === null && f !== "annual_assessment_cap"));
}

export function calculateTaxIncrementCapacity(input: TaxIncrementInput): TaxIncrementOutput {
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
    nonPledgeableShare,
    bondTermYears,
    bondInterestRate,
    dscr,
  } = input;

  const missingFields = financeProfileGate(profile);
  if (missingFields.length) {
    return { computed: false, missingFields, vehicleName: profile.tif_vehicle_name, initialTaxableValueUsd: null as any, year10AnnualIncrementUsd: null as any, maxBondCapacityUsd: null as any, notes: [`Not computed: tax rules not verified yet (${missingFields.join(", ")})`] };
  }
  const notes: string[] = [];

  // 1. Apply state residential/commercial assessment ratio
  const ratio = profile.res_assessment_ratio as number;
  let initialTaxable = baselineMarketValueUsd * ratio;

  // 2. Apply homestead or primary residence exemptions
  const hs = profile.homestead_exemption_rule;
  if (hs.type === "flat_assessed") {
    initialTaxable = Math.max(0, initialTaxable - hs.amount_or_pct);
    notes.push(`Applied flat assessed exemption of $${hs.amount_or_pct.toLocaleString()}`);
  } else if (hs.type === "flat_market") {
    initialTaxable = Math.max(0, (baselineMarketValueUsd - hs.amount_or_pct) * ratio);
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
    currentTaxable += newConstructionAnnualUsd * ratio;

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
      grossTaxIncrement * (1 - nonPledgeableShare) * localPledgeShare;

    if (year === 10) {
      year10AnnualIncrementUsd = pledgeableIncrement;
    }

    const debtServiceAvailable = pledgeableIncrement / dscr;
    totalPvNetIncrement += debtServiceAvailable / Math.pow(1 + bondInterestRate, year);
  }

  return {
    computed: true,
    missingFields: [],
    vehicleName: profile.tif_vehicle_name,
    initialTaxableValueUsd: Math.round(initialTaxable),
    year10AnnualIncrementUsd: Math.round(year10AnnualIncrementUsd),
    maxBondCapacityUsd: Math.round(totalPvNetIncrement),
    notes,
  };
}
