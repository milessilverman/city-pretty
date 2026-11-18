/**
 * Mirror of verification.status in app/data/statutes.json (hand-checked 2026-11-18 against
 * legislature / code-publisher text; see research/laws_verification.csv). tests/unit/lawsVerification.test.ts
 * asserts this table equals the JSON. A law that is not "verified" is NEVER returned as an applicable
 * (allowed) statute; it is returned in not_determined_statutes instead.
 */
const LAW_VERIFICATION_STATUS = {
  ca_sb79_tier1: "partly",
  ca_sb79_tier2: "partly",
  ca_sb9_lot_split: "verified",
  ca_ab2097: "verified",
  fl_live_local: "partly",
  tx_sb840: "partly",
  wa_hb1110: "verified",
  or_hb2001: "verified",
  az_hb2720_2721: "partly",
  tx_austin_home: "partly",
  tx_adu_statute: "unverified",
  co_hb24_1313: "partly",
  co_hb24_1152: "partly",
  mn_minneapolis_2040: "unverified",
  mt_sb323: "partly",
  me_ld2003: "unverified",
  vt_act47: "verified",
  ma_mbta_communities: "partly",
  nc_raleigh_missing_middle: "unverified",
  ut_sb174: "unverified",
  wa_hb1337: "partly",
  tx_sb15: "verified"
};

function evaluateByRightHousing(parcel) {
  const statutes = [];
  const notDetermined = [];
  const ex = Object.assign({}, parcel.exclusions);

  // Adds the statute only if its record is verified; otherwise reports "not determined".
  const consider = (id, citation, payload, reason) => {
    const status = LAW_VERIFICATION_STATUS[id];
    if (status === "verified" && payload) {
      statutes.push(payload);
    } else {
      notDetermined.push({
        id,
        citation,
        reason: reason || `law record is "${status || "unverified"}" in statutes.json; not treated as allowed`,
      });
    }
  };

  // Rule 1 & Item 10: Never infer by-right rights from a missing, unzoned, or unknown zoning code.
  if (!parcel.base_zoning_code || /^(unzoned|unknown|missing|none|n\/a)$/i.test(String(parcel.base_zoning_code).trim())) {
    return {
      parcel_id: parcel.parcel_id,
      state_code: parcel.state_code,
      base_zoning_code: null,
      applicable_statutes: [],
      statutory_exclusions: ex,
      net_by_right_feasible: false,
      not_determined_statutes: [],
    };
  }

  const hasHardPhysicalExclusion =
    ex.fema_100yr_floodway ||
    ex.calfire_or_state_vhfhsz ||
    ex.williamson_or_ag_preserve ||
    ex.public_or_tribal_land ||
    ex.everglades_or_wekiva_or_trpa;

  if (!hasHardPhysicalExclusion) {
    // CALIFORNIA
    if (parcel.state_code === "CA") {
      // SB 79 (Gov. Code 65912.155 et seq., Stats. 2025 ch. 512). Eligibility is "urban transit county"
      // (more than 15 passenger rail stations) + station tier, which this context cannot establish, so the
      // record is "partly" and the result is "not determined". Thresholds are density/height FLOORS
      // (units per acre), not a unit cap: Tier 1 within 1/4 mi = 75 ft / 120 du/ac / FAR 3.5; Tier 1 from
      // 1/4 to 1/2 mi in cities of 35,000+ = 65 ft / 100 du/ac / FAR 3.0.
      if (parcel.dist_to_heavy_rail_mi !== null && parcel.dist_to_heavy_rail_mi <= 0.5 && !ex.historic_district_hpoz) {
        const tier1 = parcel.dist_to_heavy_rail_mi <= 0.25;
        consider(
          tier1 ? "ca_sb79_tier1" : "ca_sb79_tier2",
          tier1 ? "CA SB 79 (Gov. Code 65912.157) - Tier 1 stop within 1/4 mile" : "CA SB 79 (Gov. Code 65912.157) - Tier 1 stop 1/4-1/2 mile",
          null,
          "SB 79 eligibility (urban transit county, stop tier, city size) cannot be determined from parcel context"
        );
      }

      // SB 9 (Gov. Code 65852.21, 66411.7): up to two units per parcel and an urban lot split => 4 units.
      // No state height limit. Parking: up to 1 space per unit, none within 1/2 mi walking distance of
      // a high-quality transit corridor / major transit stop (straight-line distance is only a proxy).
      if (parcel.is_single_family_residential && !ex.historic_district_hpoz) {
        const nearTransit =
          (parcel.dist_to_heavy_rail_mi == null ? 99 : parcel.dist_to_heavy_rail_mi) <= 0.5 || (parcel.dist_to_frequent_bus_or_brt_mi == null ? 99 : parcel.dist_to_frequent_bus_or_brt_mi) <= 0.5;
        consider("ca_sb9_lot_split", "CA SB 9 (Gov. Code 65852.21 + 66411.7 lot split)", {
          citation: "CA SB 9 (Gov. Code 65852.21 + 66411.7 lot split)",
          max_units_by_right: 4,
          max_height_ft: null,
          max_far: null,
          min_parking_spaces_per_unit: nearTransit ? 0 : 1,
          affordability_mandate_pct: 0,
          tax_exemption_pct: 0,
        });
      }
    }

    // TEXAS: SB 840 (Loc. Gov't Code ch. 218) and SB 15 (ch. 211 subch. D), both effective 2025-09-01.
    if (parcel.state_code === "TX") {
      const meetsPopulationGate = (parcel.municipality_pop == null ? 0 : parcel.municipality_pop) > 150000 && (parcel.county_pop == null ? 0 : parcel.county_pop) > 300000;
      if (meetsPopulationGate && parcel.is_commercial_or_mixed_use) {
        consider("tx_sb840", "TX SB 840 (Loc. Gov't Code ch. 218)", null,
          "SB 840 exclusions (heavy industrial within 1,000 ft, airport/military within 3,000 ft) and density floor (36 du/ac) are not computable from parcel context");
      } else if (!meetsPopulationGate) {
        ex.population_threshold_ineligible = true;
      }
    }

    // FLORIDA: Live Local (Fla. Stat. 166.04151(7)); record is "partly".
    if (parcel.state_code === "FL" && parcel.is_commercial_or_mixed_use) {
      consider("fl_live_local", "FL Live Local Act (Fla. Stat. 166.04151(7))", null,
        "Live Local eligibility depends on affordability commitment and local density/height floors not in parcel context");
    }

    // WASHINGTON: HB 1110 (RCW 36.70A.635). Cities under 25,000 only qualify inside the contiguous UGA of the
    // largest city of a county over 275,000, which this context cannot establish.
    if (parcel.state_code === "WA" && parcel.is_single_family_residential) {
      const pop = parcel.municipality_pop;
      const nearTransit =
        (parcel.dist_to_heavy_rail_mi == null ? 99 : parcel.dist_to_heavy_rail_mi) <= 0.25 || (parcel.dist_to_frequent_bus_or_brt_mi == null ? 99 : parcel.dist_to_frequent_bus_or_brt_mi) <= 0.25;
      if (pop == null || pop < 25000) {
        consider("wa_hb1110", "WA HB 1110 (RCW 36.70A.635)", null,
          "City under 25,000 (or unknown population): applies only within the contiguous UGA of the largest city in a county over 275,000");
      } else {
        const units = pop >= 75000 ? (nearTransit ? 6 : 4) : nearTransit ? 4 : 2;
        consider("wa_hb1110", "WA HB 1110 (RCW 36.70A.635)", {
          citation: "WA HB 1110 (RCW 36.70A.635; near-transit = 1/4 mile, straight-line proxy for walking distance)",
          max_units_by_right: units,
          max_height_ft: null,
          max_far: null,
          // No parking required within 1/2 mile walking of a major transit stop; otherwise capped at 1 (lots < 6,000 sq ft) or 2 per unit.
          min_parking_spaces_per_unit: null,
          affordability_mandate_pct: 0,
          tax_exemption_pct: 0,
        });
      }
    }

    // OREGON: HB 2001 as codified at ORS 197A.420 (cities 25,000+ all middle housing; non-Metro cities 2,500-25,000 duplex).
    if (parcel.state_code === "OR" && parcel.is_single_family_residential) {
      const pop = parcel.municipality_pop == null ? 0 : parcel.municipality_pop;
      const units = pop >= 25000 ? 4 : pop >= 2500 ? 2 : 1;
      if (units > 1) {
        consider("or_hb2001", "OR HB 2001 (ORS 197A.420, inside UGB)", {
          citation: "OR HB 2001 (ORS 197A.420, inside UGB)",
          max_units_by_right: units,
          max_height_ft: null,
          max_far: null,
          min_parking_spaces_per_unit: null,
          affordability_mandate_pct: 0,
          tax_exemption_pct: 0,
        });
      }
    }

    // ARIZONA: A.R.S. 9-461.18 (ADUs, municipalities over 75,000); record is "partly".
    if (parcel.state_code === "AZ" && (parcel.municipality_pop == null ? 0 : parcel.municipality_pop) > 75000 && parcel.is_single_family_residential) {
      consider("az_hb2720_2721", "AZ A.R.S. 9-461.18 (ADUs)", null,
        "Enacting bill, effective date and airport-noise exclusions not confirmed");
    }
  }

  return {
    parcel_id: parcel.parcel_id,
    state_code: parcel.state_code,
    base_zoning_code: parcel.base_zoning_code,
    applicable_statutes: statutes,
    statutory_exclusions: ex,
    net_by_right_feasible: statutes.length > 0 && !hasHardPhysicalExclusion,
    not_determined_statutes: notDetermined,
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { evaluateByRightHousing, LAW_VERIFICATION_STATUS };
}
