import { StatutoryZoningResult } from "../types";

export interface ParcelContext {
  parcel_id: string;
  state_code: string;
  county_fips: string;
  municipality_pop: number;
  county_pop: number;
  base_zoning_code: string;
  is_commercial_or_mixed_use: boolean;
  is_single_family_residential: boolean;
  dist_to_heavy_rail_mi: number | null;
  dist_to_frequent_bus_or_brt_mi: number | null;
  exclusions: StatutoryZoningResult["statutory_exclusions"];
}

const CA_SB79_ELIGIBLE_COUNTIES = new Set([
  "06037", // Los Angeles
  "06059", // Orange
  "06073", // San Diego
  "06075", // San Francisco
  "06001", // Alameda
  "06013", // Contra Costa
  "06081", // San Mateo
  "06085", // Santa Clara
  "06067", // Sacramento
]);

export function evaluateByRightHousing(parcel: ParcelContext): StatutoryZoningResult {
  const statutes: StatutoryZoningResult["applicable_statutes"] = [];
  const ex = parcel.exclusions;

  const hasHardPhysicalExclusion =
    ex.fema_100yr_floodway ||
    ex.calfire_or_state_vhfhsz ||
    ex.williamson_or_ag_preserve ||
    ex.public_or_tribal_land ||
    ex.everglades_or_wekiva_or_trpa;

  if (!hasHardPhysicalExclusion) {
    // CALIFORNIA (SB 79 [2026], AB 2097, SB 9, Gov. Code § 66314)
    if (parcel.state_code === "CA") {
      if (
        CA_SB79_ELIGIBLE_COUNTIES.has(parcel.county_fips) &&
        parcel.dist_to_heavy_rail_mi !== null &&
        parcel.dist_to_heavy_rail_mi <= 0.25 &&
        !ex.historic_district_hpoz &&
        !ex.coastal_commission_or_sma
      ) {
        statutes.push({
          citation: "CA SB 79 (Effective July 1, 2026) — Tier 1 Heavy Rail",
          max_units_by_right: 120,
          max_height_ft: 75,
          max_far: 3.5,
          min_parking_spaces_per_unit: 0,
          affordability_mandate_pct: 0.1,
          tax_exemption_pct: 0,
        });
      } else if (
        CA_SB79_ELIGIBLE_COUNTIES.has(parcel.county_fips) &&
        parcel.dist_to_heavy_rail_mi !== null &&
        parcel.dist_to_heavy_rail_mi <= 0.5 &&
        !ex.historic_district_hpoz &&
        !ex.coastal_commission_or_sma
      ) {
        statutes.push({
          citation: "CA SB 79 (Effective July 1, 2026) — Tier 2 Heavy Rail",
          max_units_by_right: 100,
          max_height_ft: 65,
          max_far: 3.0,
          min_parking_spaces_per_unit: 0,
          affordability_mandate_pct: 0.1,
          tax_exemption_pct: 0,
        });
      }

      if (parcel.is_single_family_residential && !ex.historic_district_hpoz) {
        statutes.push({
          citation: "CA SB 9 + Gov. Code § 66314 (Lot Split + ADU/JADU)",
          max_units_by_right: 4,
          max_height_ft: 25,
          max_far: null,
          min_parking_spaces_per_unit:
            (parcel.dist_to_heavy_rail_mi ?? 99) <= 0.5 ||
            (parcel.dist_to_frequent_bus_or_brt_mi ?? 99) <= 0.5
              ? 0
              : 1,
          affordability_mandate_pct: 0,
          tax_exemption_pct: 0,
        });
      }
    }

    // TEXAS (SB 840 Commercial-to-Residential + SB 15 Small-Lot Gating)
    if (parcel.state_code === "TX") {
      const meetsPopulationGate = parcel.municipality_pop > 150000 && parcel.county_pop > 300000;
      if (meetsPopulationGate && parcel.is_commercial_or_mixed_use && !ex.airport_noise_or_runway_zone) {
        statutes.push({
          citation: "TX SB 840 (By-Right Commercial/Office-to-Multifamily)",
          max_units_by_right: 999,
          max_height_ft: null,
          max_far: null,
          min_parking_spaces_per_unit: 1.0,
          affordability_mandate_pct: 0,
          tax_exemption_pct: 0,
        });
      } else if (!meetsPopulationGate) {
        ex.population_threshold_ineligible = true;
      }
    }

    // FLORIDA (Live Local Act 4.0 — July 2026 Statutory Exclusions + § 196.1979)
    if (parcel.state_code === "FL") {
      if (
        parcel.is_commercial_or_mixed_use &&
        !ex.airport_noise_or_runway_zone &&
        !ex.everglades_or_wekiva_or_trpa
      ) {
        statutes.push({
          citation: "FL Live Local Act 4.0 (Fla. Stat. § 166.04151 + § 196.1979)",
          max_units_by_right: 999,
          max_height_ft: null,
          max_far: null,
          min_parking_spaces_per_unit:
            (parcel.dist_to_heavy_rail_mi ?? 99) <= 0.5 ? 0.5 : 1.0,
          affordability_mandate_pct: 0.4,
          tax_exemption_pct: 0.75,
        });
      }
    }

    // WASHINGTON (HB 1110 Middle Housing + HB 1337 ADUs + SB 5184 Parking Cap)
    if (parcel.state_code === "WA" && parcel.is_single_family_residential) {
      const nearTransit =
        (parcel.dist_to_heavy_rail_mi ?? 99) <= 0.25 ||
        (parcel.dist_to_frequent_bus_or_brt_mi ?? 99) <= 0.25;
      const units =
        parcel.municipality_pop > 75000 ? (nearTransit ? 6 : 4) :
        parcel.municipality_pop >= 25000 ? (nearTransit ? 4 : 2) : 2;
      statutes.push({
        citation: "WA HB 1110 + HB 1337 + SB 5184 (2025 Parking Reform)",
        max_units_by_right: units,
        max_height_ft: 35,
        max_far: null,
        min_parking_spaces_per_unit: nearTransit ? 0 : 0.5,
        affordability_mandate_pct: nearTransit && units === 6 ? 0.17 : 0,
        tax_exemption_pct: 0,
      });
    }

    // OREGON (HB 2001 Middle Housing inside Urban Growth Boundary)
    if (parcel.state_code === "OR" && parcel.is_single_family_residential) {
      const units = parcel.municipality_pop > 25000 ? 4 : parcel.municipality_pop > 10000 ? 2 : 1;
      if (units > 1) {
        statutes.push({
          citation: "OR HB 2001 (Middle Housing inside UGB)",
          max_units_by_right: units,
          max_height_ft: 35,
          max_far: null,
          min_parking_spaces_per_unit: 0,
          affordability_mandate_pct: 0,
          tax_exemption_pct: 0,
        });
      }
    }

    // ARIZONA (HB 2720 ADUs + HB 2721 Middle Housing in cities > 75k)
    if (parcel.state_code === "AZ" && parcel.municipality_pop > 75000 && parcel.is_single_family_residential) {
      statutes.push({
        citation: "AZ HB 2720 + HB 2721 (By-Right ADUs & 2-4 Unit Middle Housing)",
        max_units_by_right: 4,
        max_height_ft: 30,
        max_far: null,
        min_parking_spaces_per_unit: 1.0,
        affordability_mandate_pct: 0,
        tax_exemption_pct: 0,
      });
    }
  }

  return {
    parcel_id: parcel.parcel_id,
    state_code: parcel.state_code,
    base_zoning_code: parcel.base_zoning_code,
    applicable_statutes: statutes,
    statutory_exclusions: ex,
    net_by_right_feasible: statutes.length > 0 && !hasHardPhysicalExclusion,
  };
}
