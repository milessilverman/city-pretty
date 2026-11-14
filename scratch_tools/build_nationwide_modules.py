import json
import os
import csv

BASE_DIR = "/Users/milessilverman/.gemini/antigravity/scratch/city-pretty-pipeline"

# -------------------------------------------------------------
# 1. src/types/index.ts
# -------------------------------------------------------------
TYPES_TS = """export type JurisdictionType =
  | "county"
  | "parish"             // Louisiana (64)
  | "borough"            // Alaska (19 organized + 11 census areas)
  | "independent_city"   // Virginia (38), Baltimore MD, St. Louis MO, Carson City NV
  | "municipality"       // MA, ME, NH, VT, RI, NJ, NY towns/villages
  | "cog"                // Connecticut (9 Councils of Governments)
  | "federal_district"   // District of Columbia
  | "municipio";         // Puerto Rico (78)

export interface CountyDataCompleteness {
  fips: string;
  name: string;
  state: string;
  jurisdiction_type: JurisdictionType;
  assessor_roll_vintage: string | null;       // e.g., "2026-09-17" or null if unverified
  sales_comps_window: [string, string] | null; // e.g., ["2024-01-01", "2026-10-31"]
  zoning_source: "live_municipal_gis" | "statewide_parcel" | "regional_cog" | "fallback_2019";
  gtfs_agencies_count: number;
  crime_feed_status: "rolling_12m" | "partial_stale" | "missing";
  canopy_dataset: "tree_equity_2025" | "nlcd_proxy" | "none";
  readiness_tier: "audited_A" | "verified_B" | "preliminary_C" | "cadastral_only_D";
}

export interface StateFinanceProfile {
  state_code: string;
  res_assessment_ratio: number;         // e.g., 1.00 (CA/TX), 0.10 (AL/LA), 0.35 (NV/OH), 0.40 (GA)
  comm_assessment_ratio: number;
  annual_assessment_cap: number | null; // e.g., 0.02 (CA Prop 13), 0.03 (FL SOH / OR M50), 0.10 (TX), null (annual market)
  uncaps_on_sale: boolean;              // true in CA/MI/FL/NM; false in OR (Measure 50)
  reassessment_cycle_years: number;     // 1 = annual, 2 = biennial (CO/MO/MT), 3 = triennial (MD/Cook IL), etc.
  homestead_exemption_rule: {
    type: "none" | "flat_assessed" | "flat_market" | "percent_market" | "circuit_breaker";
    amount_or_pct: number;              // e.g., 7500 (LA assessed = $75k market), 0.45 (UT), 0.01 (IN circuit breaker)
  };
  tif_vehicle_name: string;             // e.g., "CA EIFD", "TX TIRZ", "FL CRA", "IL TIF", "OH TIF (HB 920)"
  non_pledgeable_share: number;         // e.g., 0.47 (CA schools/ERAF), 0.40 (MN Fiscal Disparities C/I), 0.0
  rsmeans_cost_multiplier: number;      // Relative to national 1.00 baseline (LA = 1.24, SF = 1.62, TX = 0.91)
  tree_capital_cost_usd: number;        // Regional procurement + planting + 3-yr establishment
  climate_energy_regime: "cooling_dominant" | "heating_dominant" | "mixed_temperate" | "arid_irrigation_limited";
}

export interface StatutoryZoningResult {
  parcel_id: string;
  state_code: string;
  base_zoning_code: string;
  applicable_statutes: Array<{
    citation: string;                   // e.g., "CA SB 79 (2026)", "TX SB 840", "FL Live Local 4.0", "WA HB 1110"
    max_units_by_right: number;
    max_height_ft: number | null;
    max_far: number | null;
    min_parking_spaces_per_unit: number;
    affordability_mandate_pct: number;
    tax_exemption_pct: number;          // e.g., FL § 196.1979 (0.75 or 1.00)
  }>;
  statutory_exclusions: {
    historic_district_hpoz: boolean;
    coastal_commission_or_sma: boolean;
    fema_100yr_floodway: boolean;
    calfire_or_state_vhfhsz: boolean;
    airport_noise_or_runway_zone: boolean;
    williamson_or_ag_preserve: boolean;
    public_or_tribal_land: boolean;
    everglades_or_wekiva_or_trpa: boolean;
    population_threshold_ineligible: boolean; // e.g., TX SB 840 / SB 15 outside cities >150k in counties >300k
  };
  net_by_right_feasible: boolean;
}

export interface SolarMicrogridCalculation {
  tax_year: number;                     // Must default to current year (2026+)
  ownership_model: "cash_or_loan" | "third_party_lease_or_ppa";
  usable_roof_sqft_lidar: number;       // Derived from USGS 3DEP DSM after pitch/azimuth/tree-shade mask
  system_size_dc_kw: number;
  federal_itc_pct: number;              // 0.00 for cash_or_loan in 2026+ (IRC § 25D expired 2025-12-31); 0.06–0.30 for § 48E PPA
  state_tax_credit_usd: number;         // e.g., NY 25% capped at $5,000; MA 15% capped at $1,000; CA $0
  net_metering_tariff: "retail_1_to_1" | "ca_nem_3_avoided_cost" | "net_billing_partial";
  battery_storage_required_for_roi: boolean;
  net_25yr_npv_usd: number;
}
"""

with open(os.path.join(BASE_DIR, "src/types/index.ts"), "w", encoding="utf-8") as f:
    f.write(TYPES_TS)

print("Wrote src/types/index.ts")
