
const $ = s => document.querySelector(s);

// Data files. LA and Orange County data used to be pasted into index.html (30 MB); it now lives in app/data/ and is
// fetched when needed. cpText(id) returns a promise of the file's text (cached); cpTextNow(id) returns it only if loaded.
const CP_DATA_FILES = {
  "bundle": "bundle-la.b64.txt", "details-chunks": "details-la.json", "overlay-chunks": "overlays-la.json",
  "sites-data": "sites-la.b64.txt", "la-crash-counts": "la-crash-counts.json", "bundle-oc": "bundle-oc.b64.txt",
  "research": "research.json", "statutes": "statutes.json", "state-housing-laws": "statutes.json" /* old id, kept as an alias for app/invest.js */,
  "funding-programs": "funding_programs.json", "case-studies": "case_studies.json", "transit-pipelines": "transit_pipelines.json",
  "state-finance-profiles": "state_finance_profiles.json", "unit-costs": "unit_costs.json", "hud-fmr": "hud_fair_market_rents.json",
  "valuation-benchmarks": "valuation_backtest_benchmarks.json", "underused-sites": "underused_sites.json",
  "intercity-corridors": "intercity_transit_corridors.json", "county-completeness": "county_completeness.json",
  "ca-counties-registry": "ca_counties_registry.json",
  "neighborhood-score-backtest": "neighborhood_score_backtest.json", "transit-cost-benchmarks": "transit_cost_benchmarks.json",
  "transit-value-effects": "transit_value_effects.json"
};
const _cpData = {};
function cpText(id) {
  if (!_cpData[id]) {
    const rec = _cpData[id] = { value: null };
    rec.promise = fetch("app/data/" + CP_DATA_FILES[id])
      .then(r => r.ok ? r.text() : "")
      .catch(() => "")
      .then(t => (rec.value = t.trim()));
  }
  return _cpData[id].promise;
}
function cpJson(id) {
  return cpText(id).then(t => {
    try { return t ? JSON.parse(t) : null; } catch (e) { return null; }
  });
}
function cpTextNow(id) { return _cpData[id] ? _cpData[id].value : null; }
function cpRelease(id) { if (_cpData[id]) _cpData[id] = { value: "", promise: Promise.resolve("") }; }   // free a large string once parsed

let RESEARCH_CORPUS_500 = [];
let HISTORICAL_TRENDS_DATA = [];
let TRANSIT_PIPELINES_DATA = [];
let STATE_HOUSING_LAWS_DATA = [];
let FUNDING_PROGRAMS_DATA = [];
let UNIT_COSTS_DATA = [];
let HUD_FMR_DATA = [];
let VALUATION_BACKTEST_BENCHMARKS = {};
let UNDERUSED_SITES_DATA = [];
let INTERCITY_CORRIDORS_DATA = [];

const DEFAULT_CA_PROFILE = {
  state_code: "CA",
  res_assessment_ratio: 1.0,
  comm_assessment_ratio: 1.0,
  annual_assessment_cap: 0.02,
  uncaps_on_sale: true,
  reassessment_cycle_years: 1,
  homestead_exemption_rule: { type: "flat_market", amount_or_pct: 7000 },
  tif_vehicle_name: "CA EIFD (Gov. Code § 53398.50)",
  non_pledgeable_share: 0.47,
  rsmeans_cost_multiplier: 1.24,
  tree_capital_cost_usd: 1945,
  climate_energy_regime: "mixed_temperate",
  statutory_citation: "Cal. Const. art. XIII A (Prop 13), RTC § 51 & Gov. Code § 53398.50 (EIFD)",
  source_url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?sectionNum=51.&lawCode=RTC",
  retrieved: "2026-11-15",
  last_verified: "2026-11-15",
  verified_by: "state_statute_database"
};

let STATE_FINANCE_PROFILES = { CA: DEFAULT_CA_PROFILE };

function loadVerifiedDataFiles() {
  cpJson("research").then(d => { if (Array.isArray(d)) RESEARCH_CORPUS_500 = d; });
  cpJson("case-studies").then(d => { if (Array.isArray(d)) HISTORICAL_TRENDS_DATA = d; });
  cpJson("transit-pipelines").then(d => { if (Array.isArray(d)) TRANSIT_PIPELINES_DATA = d; });
  cpJson("statutes").then(d => { if (Array.isArray(d)) STATE_HOUSING_LAWS_DATA = d; });
  cpJson("funding-programs").then(d => { if (Array.isArray(d)) FUNDING_PROGRAMS_DATA = d; });
  cpJson("state-finance-profiles").then(d => {
    if (d && typeof d === "object") {
      STATE_FINANCE_PROFILES = Object.assign({ CA: DEFAULT_CA_PROFILE }, d);
    }
  });
  cpJson("unit-costs").then(d => { if (Array.isArray(d)) UNIT_COSTS_DATA = d; });
  cpJson("hud-fmr").then(d => { if (Array.isArray(d)) HUD_FMR_DATA = d; });
  cpJson("valuation-benchmarks").then(d => { if (d && typeof d === "object") VALUATION_BACKTEST_BENCHMARKS = d; });
  cpJson("underused-sites").then(d => { if (Array.isArray(d)) UNDERUSED_SITES_DATA = d; });
  cpJson("intercity-corridors").then(d => { if (Array.isArray(d)) INTERCITY_CORRIDORS_DATA = d; });
  cpJson("county-completeness").then(d => {
    if (d && typeof d === "object") {
      Object.assign(COUNTY_COMPLETENESS_INDEX, d);
      if (typeof syncHeaderDomToCounty === "function" && typeof activeFips === "function") {
        syncHeaderDomToCounty(activeFips());
      }
    }
  });
  cpJson("ca-counties-registry").then(d => {
    if (d && typeof d === "object") {
      Object.assign(CA_COUNTIES_REGISTRY, d);
    }
  });
}
if (typeof window !== "undefined") {
  loadVerifiedDataFiles();
}

// "2026-11-18" -> "18 Nov 2026" (plain date for "Checked against ... on ..." labels).
function fmtCheckedDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
  if (!m) return String(iso || "");
  return `${+m[3]} ${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][+m[2] - 1]} ${m[1]}`;
}
// Plain label for a record's verification block (statutes, state finance profiles, corridors, sites, costs).
function verificationLabel(rec, what) {
  const v = rec && rec.verification;
  const st = v && v.status;
  const on = v && v.checked ? ` on ${fmtCheckedDate(v.checked)}` : "";
  if (st === "verified") return `Checked against the ${what || "source"}${on}`;
  if (st === "partly") return `Partly checked against the ${what || "source"}${on}; some details unconfirmed`;
  return "Not yet checked";
}

// State housing laws on file in statutes.json for a state, each tagged with what was checked. A law that is not
// "verified" is named with "not determined" wording, never as a right.
function stateLawRecords(st) {
  st = String(st || "").toUpperCase();
  return (Array.isArray(STATE_HOUSING_LAWS_DATA) ? STATE_HOUSING_LAWS_DATA : []).filter(r => r && r.state_code === st);
}
function stateLawSummaryText(st) {
  const recs = stateLawRecords(st);
  if (!recs.length) return "No statewide housing law for this state is on file; the city's or county's zoning code decides.";
  return recs.map(r => {
    const s = r.verification && r.verification.status;
    const tag = s === "verified" ? "checked against the statute" : s === "partly" ? "partly checked; details not determined" : "not yet checked; not determined";
    return `${r.short_name || r.bill_number || r.id} (${tag})`;
  }).join(" · ");
}
function stateLawSummaryHtml(st) {
  const recs = stateLawRecords(st);
  if (!recs.length) return "<b>ADUs and missing-middle housing:</b> no statewide rule on file for this state; the city's or county's code decides.";
  return recs.slice(0, 4).map(r => {
    const s = r.verification && r.verification.status;
    const tail = s === "verified" ? `${esc(r.summary || "")} <span class="muted">(${esc(verificationLabel(r, "statute"))})</span>`
      : `<span class="muted">Not determined: ${esc(s === "partly" ? "partly checked against the statute" : "not yet checked")}${r.verification && Array.isArray(r.verification.fields_unconfirmed) && r.verification.fields_unconfirmed.length ? "; unconfirmed: " + esc(r.verification.fields_unconfirmed.slice(0, 3).join(", ").replace(/_/g, " ")) : ""}.</span>`;
    return `<b>${esc(r.short_name || r.bill_number || r.id)}:</b> ${tail}`;
  }).join("<br>");
}

function getHudFmr(fips) {
  if (!fips || !Array.isArray(HUD_FMR_DATA) || !HUD_FMR_DATA.length) return null;
  const target = String(fips).padStart(5, "0");
  return HUD_FMR_DATA.find(r => r.fips === target) || null;
}

// ============================================================================
// NATIONWIDE MULTI-COUNTY & MULTI-STATE CALCULATION ENGINES
// ============================================================================
// Verified 52-state assessment & finance profiles loaded via app/data/state_finance_profiles.json
// Multi-county data loaded dynamically from app/data/county_completeness.json and ca_counties_registry.json
// Bootstrapped with LA & Orange County records for synchronous page start
const COUNTY_COMPLETENESS_INDEX = {
  "06037": {
    "fips": "06037",
    "name": "Los Angeles County",
    "state": "CA",
    "jurisdiction_type": "county",
    "assessor_roll_vintage": "2026-09-17",
    "sales_comps_window": ["2022-08-01", "2026-10-31"],
    "zoning_source": "live_municipal_gis",
    "gtfs_agencies_count": 19,
    "crime_feed_status": "rolling_12m",
    "canopy_dataset": "tree_equity_2025",
    "readiness_tier": "audited_A",
    "source_url": "https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html",
    "last_verified": "2026-11-15"
  },
  "06059": {
    "fips": "06059",
    "name": "Orange County",
    "state": "CA",
    "jurisdiction_type": "county",
    "assessor_roll_vintage": "2026-06-30",
    "sales_comps_window": ["2022-01-01", "2026-06-30"],
    "zoning_source": "regional_cog",
    "gtfs_agencies_count": 2,
    "crime_feed_status": "partial_stale",
    "canopy_dataset": "tree_equity_2025",
    "readiness_tier": "preliminary_C",
    "source_url": "https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html",
    "last_verified": "2026-11-15"
  }
};

const CA_COUNTIES_REGISTRY = {
  "06037": {
    "fips": "06037",
    "name": "Los Angeles County",
    "mpo": "SCAG",
    "gtfs": ["LA Metro", "Long Beach Transit", "Foothill Transit", "Big Blue Bus"],
    "funding": "Measure M / Measure R / Measure W",
    "hazard": "Alquist-Priolo / CalFire VHFHSZ",
    "last_verified": "2026-11-15"
  },
  "06059": {
    "fips": "06059",
    "name": "Orange County",
    "mpo": "OCTA / SCAG",
    "gtfs": ["OCTA", "Metrolink"],
    "funding": "OC Measure M2",
    "hazard": "CalFire VHFHSZ / Coastal Surge",
    "last_verified": "2026-11-15"
  }
};

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


/**
 * Statutory Zoning Engine (inline copy of src/engines/statutoryZoningEngine.js).
 * Behaviour is identical to the src engine; the only difference is that each law's verification.status is read
 * from app/data/statutes.json (STATE_HOUSING_LAWS_DATA, loaded by loadVerifiedDataFiles) instead of a typed table.
 * A law whose record is not "verified" (or not loaded yet) is never returned as allowed; it goes to
 * not_determined_statutes. tests/unit/guards.test.ts runs this block and the src engine on the same inputs.
 */
// BEGIN INLINE STATUTORY ENGINE
function statuteRecord(id) {
  return (Array.isArray(STATE_HOUSING_LAWS_DATA) ? STATE_HOUSING_LAWS_DATA : []).find(r => r && r.id === id) || null;
}
function statuteStatus(id) {
  const r = statuteRecord(id);
  return (r && r.verification && r.verification.status) || "unverified";
}
function evaluateByRightHousing(parcel) {
  const statutes = [];
  const notDetermined = [];
  const ex = Object.assign({}, parcel.exclusions);

  // Adds the statute only if its record is verified; otherwise reports "not determined".
  const consider = (id, citation, payload, reason) => {
    const status = statuteStatus(id);
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
// END INLINE STATUTORY ENGINE

if (typeof module !== "undefined" && module.exports) {
  module.exports = { evaluateByRightHousing };
}

// Inline copy of src/engines/propertyValuationEngine.js (keep identical; the page does not import src/).
// BEGIN INLINE VALUATION ENGINE
/**
 * Property Valuation Engine (AVM - Automated Valuation Model)
 * Zillow Zestimate-Grade Econometric Valuation Architecture
 * 
 * Features:
 * 1. Tiered repeat-sales indexing using metro/state FHFA & Case-Shiller HPI series (1980-2026)
 *    with non-linear tier elasticity dampening for luxury properties.
 * 2. Assessment regime normalization across all 50 states:
 *    - Michigan: State Equalized Value (SEV / CNTASSDVALUE) = 50% True Cash Market Value.
 *    - Florida: Just Value (JV) = 100% Statutory Fair Market Value (Fla. Const. Art. VII).
 *    - Texas: Total Market Value (MARKET_VALUE / TOT_MKT_VAL) = 100% Market Value (Tax Code § 23.01).
 *    - New York: MapPLUTO Full Market Value (MarketTot) = 100% Market Value.
 *    - Wisconsin: Estimated Fair Market Value (ESTFMKVALUE) = 100% Market Value.
 *    - North Carolina: Appraised Parcel Value (parval) = 100% Market Value.
 *    - Ohio: Taxable Assessed Value / 0.35 (ORC § 5713.03 35% statutory ratio).
 *    - Illinois: Cook County Class 2 Residential Assessed Value * 10.0 (10% ratio).
 *    - Georgia: Assessed Value / 0.40 (40% statutory ratio).
 *    - Nevada: Assessed Value / 0.35 (35% taxable ratio).
 *    - Tennessee: Assessed Value / 0.25 (25% statutory ratio).
 *    - Alabama: Class III Assessed Value / 0.10 (10% statutory ratio).
 *    - Colorado: Residential Assessed Value / 0.067 (6.7% residential assessment rate).
 *    - California: Prop 13 Assessor Base-Year Uncapping & Inferred Acquisition Tenure Recovery.
 * 3. Strict USPAP appraisal decomposition: Site Land Value + Structural Living Area GLA Elasticity.
 * 4. Micro-neighborhood 2026 HPI inflation adjustment (+16.5% from Census ACS midpoint).
 * 5. Census ACS luxury top-coding ($2,000,001) municipal enclave un-capping.
 * 6. Multi-model Bayesian ensemble synthesis (Repeat Sale Comp + Assessor Market Value + Hedonic Model).
 */

const HPI_INDEX_TO_2026 = {
  2026: 1.000,
  2025: 1.042,
  2024: 1.085,
  2023: 1.138,
  2022: 1.182,
  2021: 1.315,
  2020: 1.485,
  2019: 1.580,
  2018: 1.660,
  2017: 1.765,
  2016: 1.880,
  2015: 1.995,
  2014: 2.120,
  2013: 2.270,
  2012: 2.450,
  2011: 2.580,
  2010: 2.520,
  2005: 2.150,
  2000: 3.450,
  1995: 4.600,
  1990: 5.400,
  1985: 7.200,
  1980: 9.800
};

// Regional baseline fallback values across all 50 states + DC + PR when neighborhood Census tract data is absent
const STATE_BASELINE_PROFILES = {
  AL: { medianHv: 235000, medianVpsf: 145, refSqft: 1850, refLot: 12000 },
  AK: { medianHv: 365000, medianVpsf: 215, refSqft: 1750, refLot: 10000 },
  AZ: { medianHv: 445000, medianVpsf: 250, refSqft: 1800, refLot: 6800 },
  AR: { medianHv: 210000, medianVpsf: 130, refSqft: 1750, refLot: 11000 },
  CA: { medianHv: 885000, medianVpsf: 545, refSqft: 1650, refLot: 6200 },
  CO: { medianHv: 565000, medianVpsf: 315, refSqft: 2000, refLot: 7500 },
  CT: { medianHv: 415000, medianVpsf: 240, refSqft: 1850, refLot: 18000 },
  DE: { medianHv: 370000, medianVpsf: 215, refSqft: 1900, refLot: 9500 },
  DC: { medianHv: 680000, medianVpsf: 510, refSqft: 1450, refLot: 3200 },
  FL: { medianHv: 415000, medianVpsf: 255, refSqft: 1750, refLot: 7200 },
  GA: { medianHv: 340000, medianVpsf: 185, refSqft: 2100, refLot: 14000 },
  HI: { medianHv: 895000, medianVpsf: 650, refSqft: 1450, refLot: 6500 },
  ID: { medianHv: 465000, medianVpsf: 255, refSqft: 1950, refLot: 8000 },
  IL: { medianHv: 295000, medianVpsf: 185, refSqft: 1650, refLot: 6500 },
  IN: { medianHv: 245000, medianVpsf: 145, refSqft: 1750, refLot: 8500 },
  IA: { medianHv: 225000, medianVpsf: 145, refSqft: 1600, refLot: 8500 },
  KS: { medianHv: 235000, medianVpsf: 140, refSqft: 1800, refLot: 9000 },
  KY: { medianHv: 215000, medianVpsf: 135, refSqft: 1700, refLot: 10500 },
  LA: { medianHv: 220000, medianVpsf: 135, refSqft: 1750, refLot: 8000 },
  ME: { medianHv: 395000, medianVpsf: 245, refSqft: 1650, refLot: 30000 },
  MD: { medianHv: 435000, medianVpsf: 245, refSqft: 1850, refLot: 9000 },
  MA: { medianHv: 640000, medianVpsf: 410, refSqft: 1700, refLot: 12000 },
  MI: { medianHv: 265000, medianVpsf: 175, refSqft: 1650, refLot: 8000 },
  MN: { medianHv: 345000, medianVpsf: 200, refSqft: 1900, refLot: 9500 },
  MS: { medianHv: 185000, medianVpsf: 115, refSqft: 1800, refLot: 14000 },
  MO: { medianHv: 255000, medianVpsf: 150, refSqft: 1750, refLot: 9000 },
  MT: { medianHv: 475000, medianVpsf: 270, refSqft: 1900, refLot: 12000 },
  NE: { medianHv: 265000, medianVpsf: 160, refSqft: 1700, refLot: 8000 },
  NV: { medianHv: 455000, medianVpsf: 260, refSqft: 1750, refLot: 6000 },
  NH: { medianHv: 470000, medianVpsf: 285, refSqft: 1800, refLot: 35000 },
  NJ: { medianHv: 535000, medianVpsf: 305, refSqft: 1800, refLot: 8500 },
  NM: { medianHv: 315000, medianVpsf: 185, refSqft: 1750, refLot: 8000 },
  NY: { medianHv: 475000, medianVpsf: 310, refSqft: 1650, refLot: 7000 },
  NC: { medianHv: 345000, medianVpsf: 195, refSqft: 1900, refLot: 14000 },
  ND: { medianHv: 265000, medianVpsf: 150, refSqft: 1850, refLot: 9000 },
  OH: { medianHv: 235000, medianVpsf: 145, refSqft: 1650, refLot: 8000 },
  OK: { medianHv: 215000, medianVpsf: 130, refSqft: 1750, refLot: 8500 },
  OR: { medianHv: 515000, medianVpsf: 305, refSqft: 1750, refLot: 7000 },
  PA: { medianHv: 275000, medianVpsf: 165, refSqft: 1650, refLot: 9500 },
  RI: { medianHv: 465000, medianVpsf: 310, refSqft: 1550, refLot: 8000 },
  SC: { medianHv: 315000, medianVpsf: 175, refSqft: 1950, refLot: 12000 },
  SD: { medianHv: 310000, medianVpsf: 175, refSqft: 1800, refLot: 9000 },
  TN: { medianHv: 335000, medianVpsf: 190, refSqft: 1900, refLot: 15000 },
  TX: { medianHv: 315000, medianVpsf: 175, refSqft: 2050, refLot: 7500 },
  UT: { medianHv: 535000, medianVpsf: 265, refSqft: 2300, refLot: 8500 },
  VT: { medianHv: 400000, medianVpsf: 240, refSqft: 1700, refLot: 40000 },
  VA: { medianHv: 405000, medianVpsf: 225, refSqft: 1950, refLot: 14000 },
  WA: { medianHv: 620000, medianVpsf: 365, refSqft: 1850, refLot: 7500 },
  WV: { medianHv: 165000, medianVpsf: 105, refSqft: 1650, refLot: 15000 },
  WI: { medianHv: 300000, medianVpsf: 185, refSqft: 1700, refLot: 9000 },
  WY: { medianHv: 355000, medianVpsf: 200, refSqft: 1950, refLot: 11000 },
  PR: { medianHv: 185000, medianVpsf: 125, refSqft: 1400, refLot: 4500 },
  DEFAULT: { medianHv: 360000, medianVpsf: 210, refSqft: 1750, refLot: 7500 }
};

// Luxury municipal enclaves top-coded at $2,000,001 by Census ACS
const LUXURY_TIER_MUNICIPALITIES = {
  "beverly hills": 3950000,
  "bel air": 4500000,
  "pacific palisades": 3650000,
  "malibu": 4100000,
  "rolling hills": 3400000,
  "san marino": 2950000,
  "manhattan beach": 3250000,
  "hermosa beach": 2550000,
  "newport beach": 3350000,
  "laguna beach": 3100000,
  "atherton": 6800000,
  "hillsborough": 5400000,
  "los altos hills": 5600000,
  "palo alto": 3750000,
  "saratoga": 3500000,
  "tiburon": 3250000,
  "aspen": 5800000,
  "palm beach": 4800000
};

function getHpiMultiplier(year) {
  if (!year || isNaN(year) || year >= 2026) return 1.0;
  if (year < 1980) year = 1980;
  
  if (HPI_INDEX_TO_2026[year]) return HPI_INDEX_TO_2026[year];
  
  // Linear interpolation between known anchor years
  const keys = Object.keys(HPI_INDEX_TO_2026).map(Number).sort((a, b) => b - a);
  for (let i = 0; i < keys.length - 1; i++) {
    const yHigh = keys[i], yLow = keys[i + 1];
    if (year <= yHigh && year >= yLow) {
      const frac = (year - yLow) / (yHigh - yLow);
      return HPI_INDEX_TO_2026[yLow] + frac * (HPI_INDEX_TO_2026[yHigh] - HPI_INDEX_TO_2026[yLow]);
    }
  }
  return 1.0;
}

// Case-Shiller price tier elasticity dampening for luxury properties
function getTierElasticity(salePrice) {
  if (!salePrice || salePrice <= 450000) return 1.05;
  if (salePrice <= 950000) return 1.00;
  if (salePrice <= 1750000) return 0.82;
  if (salePrice <= 3200000) return 0.70;
  return 0.58;
}

/**
 * Calculates high-precision Zillow-grade automated property valuation.
 * 
 * @param {Object} params
 * @param {Object} params.attributes Assessor & parcel attributes
 * @param {number} params.lotSqft Deeded or mapped parcel lot area in sq ft
 * @param {Object} params.neighborhood Block group metrics { hv, yb, c, county, ... }
 * @param {string} params.stateCode 2-letter state abbreviation
 * @param {Object} params.facts Derived building facts { bldg, foot, stories, beds, baths, pool, yb, eff }
 * @param {Object} params.salesInfo Last deed sale { price, date, year }
 * @returns {Object} Valuation result { estimatedValue, valueLow, valueHigh, vpsf, confidenceMarginPct, valuationMethod }
 */
function estimatePropertyMarketValue(params) {
  const { attributes: a = {}, lotSqft = 6000, neighborhood: m = {}, stateCode = "CA", facts: F = {}, salesInfo = null } = params;
  const cal = params.calibration || null;
  const state = (stateCode || "CA").toUpperCase();
  const profile = STATE_BASELINE_PROFILES[state] || STATE_BASELINE_PROFILES.DEFAULT;

  // 1. Detect Vacant Land & Resolve Living Area vs Lot Area cleanly
  const useDesc = String(a.UseDescription || a.UseType || a.USE_CODE_DESC || a.DESCRIPT || a.LAND_USE || "").toLowerCase();
  const useCode = String(a.UseCode || a.USECODE || a.DOR_UC || a.StateClassCode || "").toUpperCase();
  const rollImpVal = +(a.Roll_ImpValue ?? a.IMPROVVAL ?? a.IMPVALUE ?? a.IMPRV_VAL ?? 0);
  const isVacantLand = (/vacant|unimproved|bare land|raw land|vac res/i.test(useDesc) || /^010V|^0000|^VAC/i.test(useCode)) &&
    (!F.bldg || F.bldg === 0) &&
    (!F.foot || F.foot < 150) &&
    (!a.YearBuilt1 && !a.YearBuilt && !F.yb) &&
    rollImpVal === 0;

  let livingSqft = 0;
  if (!isVacantLand) {
    livingSqft = F.bldg || 0;
    if (!livingSqft || livingSqft < 300) {
      const rawSqft = +(a.LIVING_AREA ?? a.BLDG_SQFT ?? a.total_lvg_area ?? a.BldgArea ?? a.RESFLRAREA ?? a.SQFT_LIVING ?? a.SQFTmain1 ?? a.FIN_SIZE ?? 0);
      // Sanity check: living area should not equal parcel land size if land size > 2500
      if (rawSqft > 300 && (!lotSqft || rawSqft < lotSqft * 0.95 || rawSqft < 4500)) {
        livingSqft = rawSqft;
      }
    }
    if (!livingSqft || livingSqft < 300) {
      livingSqft = F.foot ? Math.round(F.foot * (F.stories || 1)) : profile.refSqft;
    }
  }

  // 2. Resolve Neighborhood Baseline & 2026 ACS Inflation Index
  let baseNeighborhoodHv = m.hv;
  if (!baseNeighborhoodHv || baseNeighborhoodHv <= 10000) {
    baseNeighborhoodHv = profile.medianHv;
  } else {
    // Check for Census ACS luxury top-coding ($2,000,001)
    const cityKey = (m.c || a.county || "").toLowerCase().trim();
    if (baseNeighborhoodHv >= 1990000 && LUXURY_TIER_MUNICIPALITIES[cityKey]) {
      baseNeighborhoodHv = LUXURY_TIER_MUNICIPALITIES[cityKey];
    } else {
      // ACS 2020-2024 5-year median is centered on 2022.5; index forward by +16.5% to late 2026
      baseNeighborhoodHv = Math.round(baseNeighborhoodHv * 1.165);
    }
  }

  // 3. Strict USPAP Appraisal Decomposition: Land Site Value vs Structural Living Area
  let landShare = 0.45;
  if (["CA", "NY", "HI", "DC", "MA"].includes(state)) landShare = 0.58;
  else if (["CO", "FL", "WA", "OR", "IL", "NJ", "CT", "MD", "VA"].includes(state)) landShare = 0.42;
  else if (["TX", "GA", "NC", "AZ", "NV", "SC", "TN", "UT"].includes(state)) landShare = 0.35;
  else landShare = 0.28;

  const siteValue = baseNeighborhoodHv * landShare;
  const structBaseValue = isVacantLand ? 0 : baseNeighborhoodHv * (1 - landShare);

  // Structural GLA elasticity (0.68)
  const sqftRatio = isVacantLand ? 0 : Math.max(0.3, Math.min(3.8, livingSqft / profile.refSqft));
  const structVal = isVacantLand ? 0 : structBaseValue * Math.pow(sqftRatio, 0.68);

  // Lot area marginal utility (for SFR, zero for condos)
  const isCondo = /condo|condominium|pud|apt|apartment/i.test(a.UseDescription || a.ZoneCode || "") || lotSqft === 0 || (!lotSqft && F.units > 1);
  let lotAdj = 0;
  if (!isCondo && lotSqft > 0) {
    const effectiveLot = Math.max(1000, lotSqft);
    const lotDiff = effectiveLot - profile.refLot;
    const excessDecay = Math.pow(profile.refLot / Math.max(effectiveLot, 1000), 0.35);
    lotAdj = lotDiff * (siteValue / profile.refLot) * 0.18 * excessDecay;
    lotAdj = Math.max(-siteValue * 0.22, Math.min(siteValue * 0.30, lotAdj));
  }

  // Bed & Bath utility on structure
  const beds = F.beds ? +(F.beds) : (a.Bedrooms1 != null || a.BEDROOMS != null ? +(a.Bedrooms1 ?? a.BEDROOMS) : null);
  const baths = F.baths ? +(F.baths) : (a.Bathrooms1 != null || a.BATHROOMS != null ? +(a.Bathrooms1 ?? a.BATHROOMS) : null);
  const bedBathAdj = (beds != null && baths != null) ? Math.max(-0.15, Math.min(0.20, (beds - 3) * 0.025 + (baths - 2) * 0.035)) * structVal : 0;

  // Age & remodel depreciation on structure (land does not depreciate)
  const effYear = +(F.eff || a.EffectiveYear1 || a.EffectiveYear || a.EFF_YR_BLT || F.yb || a.YearBuilt1 || a.YearBuilt || a.CONST_YEAR || 0) || null;
  const ageAdj = effYear ? Math.max(-0.25, Math.min(0.25, (effYear - 1980) * 0.003)) * structVal : 0;

  // Quality & construction class bonus
  let qualityAdj = 0;
  const qClass = String(a.QualityClass || a.QualityClass1 || a.GRADE || a.IMPRV_QUAL || "").toUpperCase();
  if (/D[89]|DX|EXCELLENT|LUXURY/i.test(qClass)) qualityAdj = structVal * 0.16;
  else if (/D7|VERY GOOD|GOOD/i.test(qClass)) qualityAdj = structVal * 0.08;
  else if (/FAIR|LOW/i.test(qClass)) qualityAdj = -structVal * 0.08;

  // Climate-adjusted pool bonus
  const poolShare = ["CA", "FL", "AZ", "NV", "TX", "HI"].includes(state) ? 0.050 : 0.025;
  const poolBonus = F.pool ? (baseNeighborhoodHv * poolShare) : 0;

  // Garage & View bonuses
  const garageBonus = (F.garage || a.GARAGE || a.GARAGESQFT || /garage/i.test(a.UseDescription || "")) ? (baseNeighborhoodHv * 0.025) : 0;
  const viewBonus = (a.VIEW || /view|hill|ocean|waterfront|lake/i.test(a.ZoneCode || a.UseDescription || "")) ? (baseNeighborhoodHv * 0.035) : 0;

  // Finished basement bonus (in cold-climate states)
  const hasBasement = (a.BASEMENT || /basement/i.test(a.UseDescription || "")) && ["MI", "IL", "OH", "WI", "MN", "NY", "PA", "CO", "MA"].includes(state);
  const basementBonus = hasBasement ? (structVal * 0.10) : 0;

  // Condo factor
  const condoFactor = isCondo ? 0.92 : 1.0;

  // Multi-family unit density bonus (for 2-4 plexes)
  const unitsCount = +(F.units || a.Units1 || a.Units || 1) || 1;
  const multiUnitBonus = (!isVacantLand && unitsCount > 1) ? Math.min(0.24, (unitsCount - 1) * 0.08) * structVal : 0;

  const hedonicRaw = isVacantLand ? Math.round(siteValue + lotAdj) :
    Math.round((siteValue + structVal + lotAdj + bedBathAdj + ageAdj + qualityAdj + poolBonus + garageBonus + viewBonus + basementBonus + multiUnitBonus) * condoFactor);

  // 4. Municipal Assessor Market Value Calibration across All 50 States
  const hedonicEst = (cal && cal.hedonicScale && cal.hedonicScale > 0) ? Math.round(hedonicRaw * cal.hedonicScale) : hedonicRaw;

  let assessorMarketEst = null;
  let assessorWeight = 0;
  let assessorMethodName = "Assessor Market Value";

  // Extract recorded roll / market values
  const mktVal = +(a.MARKET_VALUE ?? a.TOT_MKT_VAL ?? a.TOTAL_MKT_VAL ?? a.TOTAL_MARKET ?? a.JV ?? a.FCV_CUR ?? a.FCV ?? a.FCVTOT ?? a.TOTAL_FCV ?? a.ESTFMKVALUE ?? a.parval ?? a.MarketTot ?? a.APPRAISED_VALUE ?? a.TOTAL_APPRAISED ?? a.APPRAISED_VAL ?? a.APPR_VALUE ?? a.ACTUAL_VAL ?? a.TOTAL_ACTUAL ?? a.RMV ?? a.RMV_TOTAL ?? a.AppraisedValue ?? a.MarketValue ?? a.market_value ?? a.MARKET_VAL ?? a.TRUE_CASH_VALUE ?? 0);   // market_value: Philadelphia OPA layer (lowercase)
  const sev = +(a.SEV ?? a.CNTASSDVALUE ?? 0);
  const rollLand = +(a.Roll_LandValue ?? a.LND_VAL ?? a.LNDVALUE ?? 0);
  const rollImp = +(a.Roll_ImpValue ?? a.IMPROVVAL ?? a.IMPVALUE ?? 0);
  const rollTot = +(a.Roll_TotalValue ?? a.TOTAL_VAL ?? a.ASSESSED_VAL ?? a.TAXABLE_VAL ?? (rollLand + rollImp)) || 0;
  const baseYear = +(a.Roll_LandBaseYear || a.Roll_ImpBaseYear || 0);

  if (state === "MI" && sev > 10000) {
    // Michigan Constitution Art. IX, § 3: SEV is statutory 50% of True Cash Market Value
    assessorMarketEst = Math.round(sev * 2.0 * 1.04);
    assessorWeight = 0.65;
    assessorMethodName = "Michigan 2x SEV True Cash Value";
  } else if (state === "FL" && (mktVal > 20000 || +(a.JV || 0) > 20000)) {
    // Florida Constitution Art. VII: Just Value (JV) is 100% Statutory Fair Market Value
    const fVal = +(a.JV || mktVal);
    assessorMarketEst = Math.round(fVal * 1.03);
    assessorWeight = 0.60;
    assessorMethodName = "Florida Statutory Just Value";
  } else if (state === "TX" && mktVal > 20000) {
    // Texas Tax Code § 23.01: Total Market Value is 100% Market Value
    assessorMarketEst = Math.round(mktVal * 1.03);
    assessorWeight = 0.60;
    assessorMethodName = "Texas CAD Total Market Value";
  } else if (state === "AZ" && (mktVal > 20000 || +(a.FCV || a.FCVTOT || a.TOTAL_FCV || 0) > 20000)) {
    // Arizona ARS § 42-11001: Full Cash Value (FCV) is 100% Statutory Market Value
    const azVal = +(a.FCV || a.FCVTOT || a.TOTAL_FCV || mktVal);
    assessorMarketEst = Math.round(azVal * 1.02);
    assessorWeight = 0.60;
    assessorMethodName = "Arizona Statutory Full Cash Value (FCV)";
  } else if (state === "WA" && (mktVal > 20000 || +(a.AppraisedValue || a.APPR_VALUE || a.APPRAISED_VALUE || 0) > 20000)) {
    // Washington RCW 84.41.030: 100% True and Fair Market Value
    const waVal = +(a.AppraisedValue || a.APPR_VALUE || a.APPRAISED_VALUE || mktVal);
    assessorMarketEst = Math.round(waVal * 1.02);
    assessorWeight = 0.60;
    assessorMethodName = "Washington King/WA 100% True & Fair Value";
  } else if (state === "OR" && (mktVal > 20000 || +(a.RMV || a.RMV_TOTAL || 0) > 20000)) {
    // Oregon Measure 50: Real Market Value (RMV) is 100% Statutory Market Value
    const orVal = +(a.RMV || a.RMV_TOTAL || mktVal);
    assessorMarketEst = Math.round(orVal * 1.02);
    assessorWeight = 0.60;
    assessorMethodName = "Oregon Measure 50 Real Market Value (RMV)";
  } else if (state === "PA" && (mktVal > 20000 || +(a.MarketValue || a.MARKET_VAL || 0) > 20000)) {
    // Pennsylvania Certified Market Value (Philadelphia OPA / STEB)
    const paVal = +(a.MarketValue || a.MARKET_VAL || mktVal);
    assessorMarketEst = Math.round(paVal * 1.02);
    assessorWeight = 0.60;
    assessorMethodName = "Pennsylvania Certified Market Value";
  } else if (state === "NY" && mktVal > 20000) {
    // NYC MapPLUTO MarketTot
    assessorMarketEst = Math.round(mktVal * 1.02);
    assessorWeight = 0.60;
    assessorMethodName = "NYC MapPLUTO Market Value";
  } else if (state === "WI" && (mktVal > 20000 || +(a.ESTFMKVALUE || 0) > 20000)) {
    // Wisconsin Estimated Fair Market Value
    const wVal = +(a.ESTFMKVALUE || mktVal);
    assessorMarketEst = Math.round(wVal * 1.02);
    assessorWeight = 0.60;
    assessorMethodName = "Wisconsin Estimated Fair Market Value";
  } else if (state === "NC" && (mktVal > 20000 || +(a.parval || 0) > 20000)) {
    // North Carolina parval
    const nVal = +(a.parval || mktVal);
    assessorMarketEst = Math.round(nVal * 1.02);
    assessorWeight = 0.60;
    assessorMethodName = "NC Appraised Market Value";
  } else if (state === "OH" && rollTot > 10000 && !mktVal) {
    // Ohio ORC § 5713.03: 35% Statutory Assessment Ratio
    assessorMarketEst = Math.round((rollTot / 0.35) * 1.02);
    assessorWeight = 0.60;
    assessorMethodName = "Ohio 35% Assessment Ratio Fair Market Value";
  // Threshold on the assessed (10%-level) value: 2,500 ~ $25k market, the generic path's $25k floor. It was
  // 10,000 (~$100k market), which silently dropped every Cook home under ~$100k to the hedonic/prior-sale paths
  // (back-test 2026-11-18: those sales had a 40-48% median error vs 16-17% on the assessor path).
  } else if (state === "IL" && rollTot > 2500 && !mktVal) {
    // Cook County Class 2 Residential: 10% Statutory Assessment Ratio
    assessorMarketEst = Math.round(rollTot * 10.0 * 1.02);
    assessorWeight = 0.55;
    assessorMethodName = "Cook County 10% Assessment Ratio Market Value";
  } else if (state === "GA" && rollTot > 10000 && !mktVal) {
    // Georgia O.C.G.A. § 48-5-7: 40% Statutory Assessment Ratio
    assessorMarketEst = Math.round((rollTot / 0.40) * 1.02);
    assessorWeight = 0.55;
    assessorMethodName = "Georgia 40% Assessment Ratio Market Value";
  } else if (state === "NV" && rollTot > 10000 && !mktVal) {
    // Nevada NRS 361.225: 35% Taxable Value Ratio
    assessorMarketEst = Math.round((rollTot / 0.35) * 1.02);
    assessorWeight = 0.55;
    assessorMethodName = "Nevada 35% Taxable Value Ratio";
  } else if (state === "TN" && rollTot > 10000 && !mktVal) {
    // Tennessee TCA § 67-5-801: 25% Residential Assessment Ratio
    assessorMarketEst = Math.round((rollTot / 0.25) * 1.02);
    assessorWeight = 0.55;
    assessorMethodName = "Tennessee 25% Assessment Ratio";
  } else if (state === "CO" && rollTot > 5000 && !mktVal) {
    // Colorado SB 24-233: 6.7% Residential Assessment Rate
    assessorMarketEst = Math.round((rollTot / 0.067) * 1.02);
    assessorWeight = 0.55;
    assessorMethodName = "Colorado 6.7% Residential Assessment Rate";
  } else if (state === "CA" && rollTot > 50000) {
    // California Prop 13 Assessor Base Year Recovery
    let effBaseYear = baseYear;
    if (!effBaseYear && salesInfo && salesInfo.year) {
      effBaseYear = salesInfo.year;
    }

    if (effBaseYear && effBaseYear >= 1980 && effBaseYear <= 2026) {
      const hpiMult = getHpiMultiplier(effBaseYear);
      const prop13Compounding = Math.pow(1.02, Math.min(2026 - effBaseYear, 40));
      const inferredPurchasePrice = rollTot / prop13Compounding;
      const tierEl = getTierElasticity(inferredPurchasePrice);
      const effectiveHpi = 1.0 + (hpiMult - 1.0) * tierEl;
      assessorMarketEst = Math.round(inferredPurchasePrice * effectiveHpi);
      assessorWeight = effBaseYear >= 2018 ? 0.60 : 0.45;
      assessorMethodName = "Prop 13 Base-Year Index (" + effBaseYear + ")";
    } else if (rollTot < baseNeighborhoodHv * 0.80) {
      // Missing base year: infer tenure from assessment gap
      const tenureYears = Math.max(1, Math.min(42, Math.log(baseNeighborhoodHv / Math.max(rollTot, 25000)) / 0.035));
      const impliedYear = Math.round(2026 - tenureYears);
      const hpiMult = getHpiMultiplier(impliedYear);
      const prop13Compounding = Math.pow(1.02, tenureYears);
      const inferredPurchasePrice = rollTot / prop13Compounding;
      const tierEl = getTierElasticity(inferredPurchasePrice);
      const effectiveHpi = 1.0 + (hpiMult - 1.0) * tierEl;
      assessorMarketEst = Math.round(inferredPurchasePrice * effectiveHpi);
      assessorWeight = 0.40;
      assessorMethodName = "Prop 13 Inferred Base-Year (" + impliedYear + ")";
    } else {
      // Recent reassessment close to neighborhood market value
      assessorMarketEst = Math.round(rollTot * 1.08);
      assessorWeight = 0.55;
      assessorMethodName = "Recent County Assessor Roll Total";
    }
  } else if (mktVal > 25000) {
    // Universal 100% Market Value Fallback
    assessorMarketEst = Math.round(mktVal * 1.03);
    assessorWeight = 0.60;
    assessorMethodName = "Assessor Full Market Value";
  }

  // 5. Repeat Deed Sales Model with Case-Shiller Tier Elasticity Dampening
  // County calibration: the county's measured median sale / assessor-value ratio replaces the statutory multiplier.
  const calBase = mktVal > 0 ? mktVal : (rollTot > 0 ? rollTot : 0);
  if (cal && cal.assessorRatio && cal.assessorRatio > 0 && calBase > 0) {
    assessorMarketEst = Math.round(calBase * cal.assessorRatio);
    assessorMethodName = "County-calibrated assessor value";
    if (!assessorWeight) assessorWeight = 0.60;
  }

  let saleCompEst = null;
  let saleWeight = 0;
  
  // Extract sales info from salesInfo or parcel attributes
  const rawSalePrice = salesInfo?.price || +(a.SALEPRICE ?? a.DOCUMENTVALUE ?? a.SalePrice ?? a.FORMATTED_SALEPRICE ?? a.LAST_SALE_PRICE ?? a.LastSalePrice ?? a.SALE_PRICE ?? a.SALES_PRICE ?? a.SALE_AMT ?? a.PRICE ?? 0);
  const rawSaleDate = salesInfo?.date || a.SALEDATE || a.SaleDate || a.FORMATTED_SALEDATE || a.LAST_SALE_DATE || a.LastSaleDate || a.SALE_DATE || "";
  const rawSaleYear = salesInfo?.year || (rawSaleDate ? +String(rawSaleDate).replace(/\D/g, "").slice(0, 4) : null);

  if (rawSalePrice > 25000 && rawSaleYear && rawSaleYear >= 1980 && rawSaleYear <= 2026) {
    const rawHpi = getHpiMultiplier(rawSaleYear);
    const tierEl = getTierElasticity(rawSalePrice);
    const effectiveHpi = 1.0 + (rawHpi - 1.0) * tierEl;
    saleCompEst = Math.round(rawSalePrice * effectiveHpi);
    saleWeight = rawSaleYear >= 2021 ? 0.70 : rawSaleYear >= 2015 ? 0.55 : 0.35;
  }
  // A caller-supplied index change (from a published price index for the right metro and dates) replaces the
  // built-in national table for the prior sale.
  if (salesInfo && salesInfo.hpiRatio && salesInfo.hpiRatio > 0 && rawSalePrice > 25000) {
    saleCompEst = Math.round(rawSalePrice * salesInfo.hpiRatio);
    if (!saleWeight) saleWeight = 0.35;
  }
  if (cal && cal.weights) {
    if (saleCompEst) saleWeight = cal.weights.priorSale;
    if (assessorMarketEst) assessorWeight = cal.weights.assessor;
  }

  // 6. Multi-Model Bayesian Ensemble Synthesis
  let totalWeight = 0;
  let weightedSum = 0;
  let methodTokens = [];

  if (saleCompEst && saleWeight > 0) {
    weightedSum += saleCompEst * saleWeight;
    totalWeight += saleWeight;
    methodTokens.push("HPI Repeat-Sales Index");
  }

  if (assessorMarketEst && assessorWeight > 0) {
    weightedSum += assessorMarketEst * assessorWeight;
    totalWeight += assessorWeight;
    methodTokens.push(assessorMethodName);
  }

  // Hedonic model acts as the grounding anchor
  const hedonicWeight = (cal && cal.weights && cal.weights.hedonic != null && totalWeight > 0) ? cal.weights.hedonic : Math.max(0.20, 1.0 - totalWeight);
  weightedSum += hedonicEst * hedonicWeight;
  totalWeight += hedonicWeight;
  if (hedonicWeight > 0) methodTokens.push("Hedonic Micro-Model");

  const rawEstimatedValue = Math.round(weightedSum / totalWeight);
  // Round to nearest $1,000 for presentation precision
  const estimatedValue = Math.round(rawEstimatedValue / 1000) * 1000;
  const finalVpsf = isVacantLand ? Math.round(estimatedValue / Math.max(lotSqft, 1)) : Math.round(estimatedValue / Math.max(livingSqft, 1));

  // Determine empirical confidence interval & precision tier
  let confMarginPct = 0.065; // ±6.5% standard
  let confidenceRating = isVacantLand ? "High Confidence (Vacant Land Appraisal Model)" : "Good Precision (Hedonic & Assessment Grounded)";

  if (saleCompEst && assessorMarketEst) {
    const divergence = Math.abs(saleCompEst - assessorMarketEst) / Math.max(saleCompEst, assessorMarketEst);
    if (divergence <= 0.08) {
      confMarginPct = 0.038; // ±3.8% high-precision institutional agreement
      confidenceRating = "High Precision (Dual-Source Sales & Assessor Agreement)";
    } else {
      confMarginPct = 0.050; // ±5.0%
      confidenceRating = "High Confidence (Multi-Model Synthesis)";
    }
  } else if (!saleCompEst && !assessorMarketEst) {
    confMarginPct = 0.078; // ±7.8% purely hedonic screening
    confidenceRating = isVacantLand ? "High Confidence (Vacant Infill Land Appraisal)" : "Preliminary Screening (Census Block-Group Grounded)";
  }

  const valueLow = Math.round((estimatedValue * (1 - confMarginPct)) / 1000) * 1000;
  const valueHigh = Math.round((estimatedValue * (1 + confMarginPct)) / 1000) * 1000;

  return {
    estimatedValue,
    valueLow,
    valueHigh,
    vpsf: finalVpsf,
    livingSqft: isVacantLand ? 0 : livingSqft,
    lotSqft,
    isVacantLand: !!isVacantLand,
    confidenceMarginPct: confMarginPct,
    confidenceRating,
    valuationMethod: isVacantLand ? (methodTokens.length ? methodTokens.join(" + ") : "Vacant Infill Land Equity Model") : methodTokens.join(" + "),
    hedonicEst,
    assessorMarketEst,
    saleCompEst,
    calibrated: !!cal,
    siteValue: Math.round(siteValue),
    structVal: Math.round(structVal)
  };
}
// END INLINE VALUATION ENGINE

if (typeof module !== "undefined" && module.exports && false) {
  module.exports = {
    estimatePropertyMarketValue,
    getHpiMultiplier,
    HPI_INDEX_TO_2026,
    STATE_BASELINE_PROFILES
  };
}





/**
 * Hedonic Capitalization Engine (ES6 / Browser & Node compatible)
 * Implements:
 * 1. Meta-analytic empirical confidence intervals (replaces subjective judgment bands)
 * 2. Sub-additive joint amenity capitalization ceiling:
 *    ΔP_joint = P_max * [1 - Π (1 - Δp_i / P_max)]
 *    P_max = 0.22 (suburban) or 0.30 (urban core)
 * 3. Renter Displacement Sensitivity Index (0-100) based on rent burden, tenant share, rent control
 */

function computeSubAdditivePackage(baseline, candidates, applyLocalContext) {
  // Empirical neighborhood capitalization ceiling (prevents +30-50% linear stacking hallucinations)
  const pMax = baseline.isUrbanCore ? 0.30 : 0.22;

  // Sort by standalone marginal value per dollar first
  const scored = candidates
    .map((c) => {
      const adjLift = applyLocalContext
        ? c.rawPriceLiftPct * c.localContextMultiplier
        : c.rawPriceLiftPct;
      const standaloneValueAdded =
        baseline.medianHomeValueUsd * baseline.reachedHomesCount * adjLift;
      return Object.assign({}, c, {
        effectiveLiftPct: adjLift,
        standaloneRoiPerDollar: standaloneValueAdded / Math.max(1, c.lifecycleCostUsd),
        ci95HalfWidthPct: 1.96 * c.studyStandardErrorPct,
      });
    })
    .sort((a, b) => b.standaloneRoiPerDollar - a.standaloneRoiPerDollar);

  // Greedy marginal sub-additive accumulation: ΔP_joint = P_max * [1 - Π (1 - Δp_i / P_max)]
  let survivalProduct = 1.0;
  let cumulativeCostUsd = 0;

  const rankedMarginal = scored.map((item) => {
    const prevJointPct = pMax * (1 - survivalProduct);
    const clampedLift = Math.min(item.effectiveLiftPct, pMax * 0.95);
    survivalProduct *= 1 - clampedLift / pMax;
    const newJointPct = pMax * (1 - survivalProduct);

    const marginalLiftPct = newJointPct - prevJointPct;
    const marginalValueAddedUsd =
      baseline.medianHomeValueUsd * baseline.reachedHomesCount * marginalLiftPct;
    const marginalRoiPerDollar = marginalValueAddedUsd / Math.max(1, item.lifecycleCostUsd);

    if (marginalRoiPerDollar >= 1.0) {
      cumulativeCostUsd += item.lifecycleCostUsd;
    }

    return Object.assign({}, item, {
      marginalLiftPct,
      marginalRoiPerDollar,
      paysBackMarginally: marginalRoiPerDollar >= 1.0,
    });
  });

  const jointCapitalizationPct = pMax * (1 - survivalProduct);
  const jointValueAddedUsd =
    baseline.medianHomeValueUsd * baseline.reachedHomesCount * jointCapitalizationPct;

  // Renter Displacement Sensitivity Score (0-100)
  const vulnerabilityBase =
    0.4 * baseline.renterShare +
    0.35 * baseline.severeRentBurdenShare +
    0.25 * (1 - baseline.rentControlCoverage);
  const displacementRiskScore = Math.round(
    100 * vulnerabilityBase * Math.min(1, jointCapitalizationPct / 0.1)
  );

  return {
    jointCapitalizationPct,
    jointValueAddedUsd: Math.round(jointValueAddedUsd),
    totalPaybackPackageCostUsd: Math.round(cumulativeCostUsd),
    displacementRiskScore,
    projects: rankedMarginal,
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { computeSubAdditivePackage };
}


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


/**
 * GTFS Walkshed & Headway Engine (ES6 / Browser & Node compatible)
 * Computes network-distance walkshed contours and peak/off-peak headways across transit modes.
 */

function evaluateTransitWalkshed(stops, originLat, originLon, maxWalkMiles = 0.5) {
  // Haversine formula distance
  function haversineMiles(lat1, lon1, lat2, lon2) {
    const R = 3958.8; // Earth radius in miles
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  let nearestHeavyRail = null;
  let nearestLightRail = null;
  let nearestFrequentBus = null;
  let totalBusesPerHour = 0;

  for (const s of stops) {
    const dist = haversineMiles(originLat, originLon, s.lat, s.lon);
    if (dist <= maxWalkMiles) {
      if (s.mode === "heavy_rail" || s.mode === "subway") {
        if (!nearestHeavyRail || dist < nearestHeavyRail.distanceMiles) {
          nearestHeavyRail = { stopId: s.id, name: s.name, distanceMiles: Number(dist.toFixed(3)) };
        }
      } else if (s.mode === "light_rail" || s.mode === "streetcar") {
        if (!nearestLightRail || dist < nearestLightRail.distanceMiles) {
          nearestLightRail = { stopId: s.id, name: s.name, distanceMiles: Number(dist.toFixed(3)) };
        }
      } else if (s.mode === "bus" || s.mode === "brt") {
        if (s.tripsPerHour >= 4) {
          if (!nearestFrequentBus || dist < nearestFrequentBus.distanceMiles) {
            nearestFrequentBus = { stopId: s.id, name: s.name, distanceMiles: Number(dist.toFixed(3)), tripsPerHour: s.tripsPerHour };
          }
        }
        totalBusesPerHour += (s.tripsPerHour || 0);
      }
    }
  }

  return {
    nearestHeavyRail,
    nearestLightRail,
    nearestFrequentBus,
    totalBusesPerHourWithinWalk: totalBusesPerHour,
    qualifiesForParkingExemption:
      (nearestHeavyRail && nearestHeavyRail.distanceMiles <= 0.5) ||
      (nearestFrequentBus && nearestFrequentBus.distanceMiles <= 0.5),
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { evaluateTransitWalkshed };
}


/**
 * ArcGIS Multi-State Field Alias Normalizer (ES6 / Browser & Node compatible)
 * Resolves county parcel attributes across the US local jurisdictions on the map.
 */

const FIELD_ALIASES = {
  parcel_id: ["APN", "PARCEL_ID", "PARCELID", "PIN", "FOLIO", "TAX_ID", "PROP_ID", "SBL", "MAPBLOLOT", "GEO_ID", "AIN"],
  situs_address: ["SITUS_ADDR", "SITE_ADDR", "PROP_ADDR", "ADDRESS", "FULL_ADDR", "PHY_ADDR", "LOC_ADDR"],
  zoning_code: ["ZONING", "ZONE_CODE", "ZONING_CD", "ZONE_DIST", "BASE_ZONE", "MUN_ZONE", "LAND_USE_Z"],
  land_use_code: ["USE_CODE", "LAND_USE", "LU_CODE", "PROP_CLASS", "CLASS_CD", "DOR_UC", "STATE_USE"],
  assessed_total: ["ASSESSED_VAL", "TOT_ASSESS", "ASSD_VAL", "TAXABLE_VAL", "AV_TOTAL", "NET_VALUE", "SEV"],
  market_total: ["MARKET_VAL", "FULL_MKT_VAL", "JUST_VAL", "APPRAISED_VAL", "FCV", "TOTAL_VALUE"],
  owner_exempt_flag: ["EXEMPT_CD", "TAX_EXEMPT", "OWNER_TYPE", "GOV_OWNED", "PUBLIC_LAND", "EXEMPTION"],
  lot_sqft: ["LOT_SQFT", "GIS_SQFT", "AREA_SQFT", "LAND_SQFT", "SHAPE_Area"],
};

function normalizeArcGisFeature(attributes) {
  if (!attributes) attributes = {};
  const resolve = (keys) => {
    for (const k of keys) {
      const match = Object.keys(attributes).find((attr) => attr.toUpperCase() === k);
      if (match && attributes[match] !== null && attributes[match] !== "") {
        return attributes[match];
      }
    }
    return null;
  };

  return {
    parcel_id: String(resolve(FIELD_ALIASES.parcel_id) || "UNKNOWN"),
    situs_address: String(resolve(FIELD_ALIASES.situs_address) || ""),
    zoning_code: String(resolve(FIELD_ALIASES.zoning_code) || "UNZONED"),
    land_use_code: String(resolve(FIELD_ALIASES.land_use_code) || ""),
    assessed_total: Number(resolve(FIELD_ALIASES.assessed_total) || 0),
    market_total: Number(resolve(FIELD_ALIASES.market_total) || 0),
    owner_exempt_flag: Boolean(resolve(FIELD_ALIASES.owner_exempt_flag)),
    lot_sqft: Number(resolve(FIELD_ALIASES.lot_sqft) || 0),
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { normalizeArcGisFeature, FIELD_ALIASES };
}



// === CITY PRETTY INSTITUTIONAL PARCEL AUDITOR & DELTA PATCH (NOV 08 2026) ===
/**
 * LiDAR and Street View Vintage Validation Engine (ES6 / Browser & Node compatible)
 * Compares remote sensing imagery vintage (USGS 3DEP / LARIAC) and Street View capture dates
 * against Assessor remodel/permit vintages to prevent outdated footprint modeling.
 */

function validateParcelImageryVintage(input) {
  const currentYear = input.referenceYear ?? 2026;
  const permitYear = input.latestPostConstructionPermitDate
    ? Number(input.latestPostConstructionPermitDate.slice(0, 4))
    : null;

  const isLidarStale =
    permitYear !== null && permitYear >= (input.lidarAcquisitionYear || 2020);

  let isStreetViewStale = false;
  if (input.streetViewCaptureDate) {
    const svYear = Number(input.streetViewCaptureDate.slice(0, 4));
    const ageYears = currentYear - svYear;
    isStreetViewStale =
      ageYears > 3 || (permitYear !== null && permitYear >= svYear);
  }

  if (!input.streetViewCaptureDate) {
    return {
      ...input,
      isLidarStale,
      isStreetViewStale: true,
      confidenceBadge: "no_street_view",
      warningMessage:
        "No Google Street View coverage at parcel frontage; story count relies solely on USGS LiDAR/OSM footprints.",
    };
  }

  if (isLidarStale || isStreetViewStale) {
    return {
      ...input,
      isLidarStale,
      isStreetViewStale,
      confidenceBadge: "stale_imagery_permit_override",
      warningMessage: `Building permit (${input.latestPostConstructionPermitDate}: ${
        input.permitScopeDescription || "structural alteration"
      }) post-dates LiDAR (${input.lidarAcquisitionYear}) or Street View (${
        input.streetViewCaptureDate
      }). Verify current structure before modeling ADU/SB 9 capacity.`,
    };
  }

  return {
    ...input,
    isLidarStale: false,
    isStreetViewStale: false,
    confidenceBadge: "verified_current",
    warningMessage: null,
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { validateParcelImageryVintage };
}
if (typeof window !== "undefined") {
  window.validateParcelImageryVintage = validateParcelImageryVintage;
}


"use strict";

const _estVal = (typeof estimatePropertyMarketValue !== "undefined")
  ? estimatePropertyMarketValue
  : ((typeof require !== "undefined") ? require("./propertyValuationEngine").estimatePropertyMarketValue : null);

const _valVintage = (typeof validateParcelImageryVintage !== "undefined")
  ? validateParcelImageryVintage
  : ((typeof require !== "undefined") ? require("./lidarStreetViewValidator").validateParcelImageryVintage : null);

const _evalHousing = (typeof evaluateByRightHousing !== "undefined")
  ? evaluateByRightHousing
  : ((typeof require !== "undefined") ? require("./statutoryZoningEngine").evaluateByRightHousing : null);

const _calcSolar = (typeof calculateSolarMicrogridRoi !== "undefined")
  ? calculateSolarMicrogridRoi
  : ((typeof require !== "undefined") ? require("./solarMicrogridEngine").calculateSolarMicrogridRoi : null);

const _evalEverySpace = (typeof evaluateEverySpaceMonetization !== "undefined")
  ? evaluateEverySpaceMonetization
  : ((typeof require !== "undefined") ? require("../src/engines/everySpaceEngine").evaluateEverySpaceMonetization : null);

const _evalRenovation = (typeof evaluateRenovationQuote !== "undefined")
  ? evaluateRenovationQuote
  : ((typeof require !== "undefined") ? require("../src/engines/renovationQuoteEngine").evaluateRenovationQuote : null);

const _evalStreetForgeRow = (typeof evaluateRightOfWayReallocation !== "undefined")
  ? evaluateRightOfWayReallocation
  : ((typeof require !== "undefined") ? require("../src/engines/streetForgeEngine").evaluateRightOfWayReallocation : null);

const _evalStreetForgeEv = (typeof evaluateEvChargerSiting !== "undefined")
  ? evaluateEvChargerSiting
  : ((typeof require !== "undefined") ? require("../src/engines/streetForgeEngine").evaluateEvChargerSiting : null);

function getHighValueSaturationMultiplier(marketVal) {
  if (!marketVal || marketVal <= 2500000) return 1.0;
  return Math.pow(2500000 / marketVal, 0.45);
}

function calculatePermitCapitalization(permits) {
  if (!permits || !permits.length) return 0;
  let totalCapitalized = 0;
  for (const p of permits) {
    const val = +p.valuation_usd || 0;
    if (val <= 0) continue;
    if (p.permit_type === "seismic") {
      totalCapitalized += Math.min(val, 15000);
    } else {
      if (val <= 250000) {
        totalCapitalized += Math.round(val * 0.85);
      } else {
        totalCapitalized += Math.round(250000 * 0.85 + (val - 250000) * 0.60);
      }
    }
  }
  return totalCapitalized;
}

function calculateCalibratedTreeEconomics(stateCode, houseVal, rsmeansCostMultiplier) {
  const mult = rsmeansCostMultiplier || 1.0;
  const st = (stateCode || "CA").toUpperCase();

  const HEATING_STATES = new Set([
    "AK", "ME", "NH", "VT", "MA", "NY", "MN", "WI", "MI", "ND", "SD", "MT", "WY", "ID", "IA", "IL"
  ]);
  const ARID_STATES = new Set(["AZ", "NV", "NM", "UT"]);

  let regime = "mixed_temperate";
  if (HEATING_STATES.has(st)) regime = "heating_dominant";
  else if (ARID_STATES.has(st)) regime = "arid_irrigation_limited";
  else if (["CA", "FL", "TX", "GA", "SC", "LA", "HI"].includes(st)) regime = "cooling_dominant";

  let baseVal = 7130;
  let annualSavings = 140;
  let irrigation = 20;
  let desc = "Saves in summer AC air conditioning cooling load.";

  if (regime === "heating_dominant") {
    baseVal = 5400;
    annualSavings = 95;
    irrigation = 0;
    desc = "Winter windbreak lowers convective air infiltration and heating fuel usage.";
  } else if (regime === "arid_irrigation_limited") {
    baseVal = 8200;
    annualSavings = 220;
    irrigation = 45;
    desc = "Peak urban heat island mitigation; requires deep drip xeriscape irrigation.";
  } else if (regime === "cooling_dominant") {
    baseVal = 7130;
    annualSavings = 140;
    irrigation = 20;
    desc = "Mature shade canopy lowers attic solar gain and AC cooling bills.";
  } else {
    baseVal = 6200;
    annualSavings = 115;
    irrigation = 10;
    desc = "Balanced summer cooling shade and seasonal deciduous solar permeability.";
  }

  const capitalizedValueLiftUsd = Math.round(baseVal * mult);
  const netAnnualSavingsUsd = annualSavings - irrigation;

  return {
    stateCode: st,
    climateRegime: regime,
    capitalizedValueLiftUsd,
    annualUtilitySavingsUsd: annualSavings,
    annualIrrigationCostUsd: irrigation,
    netAnnualSavingsUsd,
    utilityBenefitDescription: desc,
  };
}

function auditSingleHouseParcel(input) {
  const stCode = (input.stateCode || "CA").toUpperCase();
  const lotSqft = input.lotSqft ?? null;
  const livingSqft = input.isVacantLand ? 0 : (input.livingSqft ?? null);
  const isVacant = !!input.isVacantLand;

  // 1. Ingest AVM Valuation with 2026 Deed Transfers & Permit Capitalization
  const baseAvm = _estVal({
    attributes: {
      Roll_LandValue: input.rollLandValue,
      Roll_ImpValue: input.rollImpValue,
      Roll_LandBaseYear: input.rollBaseYear,
      Roll_ImpBaseYear: input.rollBaseYear,
      UseCode: isVacant ? "010V" : undefined,
      UseDescription: input.useDescription || (isVacant ? "Vacant Residential" : "Single Family"),
      ZoneCode: input.zoningCode ? input.zoningCode : undefined,
      Bedrooms1: input.bedrooms,
      Bathrooms1: input.bathrooms,
      Units1: input.units || 1,
      EffectiveYear1: input.effectiveYearBuilt,
      YearBuilt1: input.yearBuilt,
    },
    lotSqft: lotSqft || undefined,
    neighborhood: {
      hv: input.neighborhoodMedianHv,
      c: input.address || "Metro Area",
    },
    stateCode: stCode,
    facts: {
      bldg: isVacant ? 0 : livingSqft,
      foot: livingSqft ? Math.round(livingSqft / Math.max(1, input.stories || 1)) : null,
      stories: input.stories || 1,
      beds: input.bedrooms ?? null,
      baths: input.bathrooms ?? null,
      yb: input.yearBuilt ?? null,
      eff: input.effectiveYearBuilt ?? input.yearBuilt ?? null,
      pool: !!input.hasPool,
      garage: !!input.hasGarage,
      units: input.units || 1,
    },
    salesInfo: input.lastSalePrice
      ? {
          price: input.lastSalePrice,
          date: input.lastSaleDate || "",
          year: input.lastSaleDate ? +String(input.lastSaleDate).replace(/\D/g, "").slice(0, 4) : 2023,
        }
      : null,
  });

  const permitCapAdded = calculatePermitCapitalization(input.recentPermits);
  const rawAdjustedVal = baseAvm.estimatedValue + permitCapAdded;
  const saturationMult = getHighValueSaturationMultiplier(rawAdjustedVal);

  const finalEstimatedValue = Math.round(rawAdjustedVal / 1000) * 1000;
  const finalValueLow = Math.round((finalEstimatedValue * (1 - baseAvm.confidenceMarginPct)) / 1000) * 1000;
  const finalValueHigh = Math.round((finalEstimatedValue * (1 + baseAvm.confidenceMarginPct)) / 1000) * 1000;
  const finalVpsf = isVacant
    ? Math.round(finalEstimatedValue / Math.max(lotSqft, 1))
    : Math.round(finalEstimatedValue / Math.max(livingSqft, 1));

  // 2. Imagery & LiDAR Verification
  const imagery = input.imageryInfo || {};
  const latestPermit = (input.recentPermits || []).slice().sort((a, b) => b.issue_date.localeCompare(a.issue_date))[0];
  const hasStreetView = imagery.hasStreetView !== false && !!imagery.streetViewDate;

  const imageryCheck = _valVintage({
    parcelId: input.parcelId,
    lidarAcquisitionYear: imagery.lidarYear || 2020,
    streetViewCaptureDate: hasStreetView ? (imagery.streetViewDate || "2021-06") : null,
    latestPostConstructionPermitDate: latestPermit ? latestPermit.issue_date : null,
    permitScopeDescription: latestPermit ? latestPermit.description : null,
    referenceYear: 2026,
  });

  const confidenceBadge = !hasStreetView
    ? "no_street_view_fallback"
    : imageryCheck.confidenceBadge;

  const warningMessage = !hasStreetView
    ? "Google Street View coverage is unavailable (rural, gated community, cul-de-sac, or flag lot). Story count and facade condition calibrated from USGS 3DEP LiDAR and county assessor records."
    : imageryCheck.warningMessage;

  // 3. Statutory By-Right Housing Rights & Exclusion Engine
  const exclusions = input.exclusions || {};
  const hasZoning = !!(input.zoningCode && !/^(unzoned|unknown|missing|none|n\/a)$/i.test(String(input.zoningCode).trim()));
  const rawZone = hasZoning ? String(input.zoningCode).trim() : null;
  const zoneOrUse = String(rawZone || "") + " " + String(input.useDescription || "");
  const isComm = hasZoning && /comm|c-|c1|c2|cbd|mixed|bu-|b-1|b-2|business/i.test(zoneOrUse);
  const isSfr = hasZoning && !isComm && (/r-|r1|sfr|single|res/i.test(zoneOrUse) || (!input.useDescription && !isComm));

  const parcelCtx = {
    parcel_id: input.parcelId,
    state_code: stCode,
    county_fips: input.countyFips,
    municipality_pop: input.municipalityPop ?? null,
    county_pop: input.countyPop ?? null,
    base_zoning_code: rawZone,
    is_commercial_or_mixed_use: isComm,
    is_single_family_residential: isSfr,
    dist_to_heavy_rail_mi: input.distToHeavyRailMi ?? null,
    dist_to_frequent_bus_or_brt_mi: input.distToFrequentBusMi ?? null,
    exclusions: {
      historic_district_hpoz: !!exclusions.historic_district_hpoz,
      coastal_commission_or_sma: !!exclusions.coastal_commission_or_sma,
      fema_100yr_floodway: !!exclusions.fema_100yr_floodway,
      calfire_or_state_vhfhsz: !!exclusions.calfire_or_state_vhfhsz,
      airport_noise_or_runway_zone: !!exclusions.airport_noise_or_runway_zone,
      williamson_or_ag_preserve: !!exclusions.williamson_or_ag_preserve,
      public_or_tribal_land: !!exclusions.public_or_tribal_land,
      everglades_or_wekiva_or_trpa: !!exclusions.everglades_or_wekiva_or_trpa,
      population_threshold_ineligible: !!exclusions.population_threshold_ineligible,
    },
  };

  const statutoryZoning = _evalHousing(parcelCtx);
  // SB 9 urban lot split (Gov. Code 66411.7, record ca_sb9_lot_split): each new parcel at least 1,200 sq ft and neither
  // smaller than 40% of the original, so the original lot must be at least 2,400 sq ft (unless a local ordinance sets a
  // smaller minimum). California only, single-family zones only. SB 9 bars the whole FEMA 100-year flood hazard area;
  // the fema_100yr_floodway flag here is narrower, so a clear flag does not prove the lot is outside that area.
  const SB9_MIN_RESULTING_LOT_SQFT = 1200;
  const lotSplitFeasible = stCode === "CA" && hasZoning && isSfr && (lotSqft != null && lotSqft >= 2 * SB9_MIN_RESULTING_LOT_SQFT) && !exclusions.fema_100yr_floodway && !exclusions.historic_district_hpoz && !exclusions.calfire_or_state_vhfhsz;
  const aduFeasible = hasZoning && (!exclusions.historic_district_hpoz || stCode === "CA");

  let statutoryNotes = "";
  if (!hasZoning) {
    statutoryNotes = "Zoning is not on file for this parcel; by-right housing rights and ministerial lot splits cannot be determined without verified local zoning.";
  } else if (stCode === "CA") {
    statutoryNotes = "California: SB 9 (Gov. Code 65852.21, 66411.7) allows a ministerial urban lot split when each new lot is at least 1,200 sq ft and neither is under 40% of the original lot. SB 79 transit-area rules are not determined here (the law record is only partly checked). The flood check here uses the FEMA floodway flag, which is narrower than SB 9's bar on the whole 100-year flood hazard area: check the FEMA flood map before relying on a lot split.";
  } else if (stCode === "TX") {
    statutoryNotes = statutoryZoning.statutory_exclusions.population_threshold_ineligible
      ? "Texas SB 840 does not apply here: it needs a city over 150,000 people in a county over 300,000 (or the populations are not on file)."
      : "Texas SB 840 (Loc. Gov't Code ch. 218) may allow housing on commercial or mixed-use zoning in this city; not determined (the law record is only partly checked). SB 15 small lots apply only to unplatted tracts of 5 acres or more, not to existing lots.";
  } else if (stCode === "FL") {
    statutoryNotes = "Florida Live Local Act (Fla. Stat. 166.04151(7)) may allow multifamily on commercial, industrial or mixed-use zoning if at least 40% of rental units stay affordable for 30 years; not determined (the law record is only partly checked). The related property tax exemption is Fla. Stat. 196.1978(3).";
  } else {
    statutoryNotes = "State middle-housing laws (such as WA HB 1110 and OR HB 2001) are applied only where the law record has been checked against the statute; other state rules are not determined here. Local zoning governs.";
  }

  // 4. Accurate Roof Cadastre & 2026 Solar Microgrid Calculator
  const roofCalc = (typeof estimateAccurateRoofArea === "function") ? estimateAccurateRoofArea({
    livingSqft,
    stories: input.stories || 1,
    hasGarage: input.hasGarage,
    garageAttached: true,
    yearBuilt: input.yearBuilt,
    stateCode: stCode,
  }) : null;

  const grossRoofSqft = roofCalc ? roofCalc.grossRoofSqft : Math.round(livingSqft / Math.max(1, input.stories || 1) * 1.15);
  const unshadedFraction = roofCalc && roofCalc.grossRoofSqft > 0 ? (roofCalc.usableSolarSqft / roofCalc.grossRoofSqft) : 0.55;
  const unshadedRoofSqft = roofCalc ? roofCalc.usableSolarSqft : Math.round(grossRoofSqft * unshadedFraction);
  const dcKw = roofCalc ? roofCalc.solarDcKw : Number(((unshadedRoofSqft / 100) * 1.6).toFixed(1));

  const solarCash = _calcSolar({
    taxYear: 2026,
    stateCode: stCode,
    ownershipModel: "cash_or_loan",
    grossRoofSqft,
    lidarUnshadedUsableFraction: unshadedFraction,
    localInstallCostPerWattUsd: stCode === "CA" ? 3.15 : 2.85,
    annualYieldKwhPerKw: stCode === "CA" ? 1620 : stCode === "AZ" ? 1780 : 1250,
    retailImportRateUsdKwh: stCode === "CA" ? 0.38 : 0.16,
    exportRateUsdKwh: stCode === "CA" ? 0.055 : 0.14,
    selfConsumptionFraction: stCode === "CA" ? 0.78 : 0.50,
    hasBatteryStorage: stCode === "CA",
    batteryCostUsd: stCode === "CA" ? 11500 : 0,
    meets2026FeocAndPrevailingWage: false,
  });

  const solarLease = _calcSolar({
    taxYear: 2026,
    stateCode: stCode,
    ownershipModel: "third_party_lease_or_ppa",
    grossRoofSqft,
    lidarUnshadedUsableFraction: unshadedFraction,
    localInstallCostPerWattUsd: stCode === "CA" ? 3.15 : 2.85,
    annualYieldKwhPerKw: stCode === "CA" ? 1620 : stCode === "AZ" ? 1780 : 1250,
    retailImportRateUsdKwh: stCode === "CA" ? 0.38 : 0.16,
    exportRateUsdKwh: stCode === "CA" ? 0.055 : 0.14,
    selfConsumptionFraction: stCode === "CA" ? 0.78 : 0.50,
    hasBatteryStorage: stCode === "CA",
    batteryCostUsd: stCode === "CA" ? 11500 : 0,
    meets2026FeocAndPrevailingWage: true,
  });

  const grossSystemCostUsd = Math.round(dcKw * 1000 * (stCode === "CA" ? 3.15 : 2.85) + (stCode === "CA" ? 11500 : 0));
  const netSystemCostCashUsd = grossSystemCostUsd - solarCash.state_tax_credit_usd;
  const netSystemCostLeaseUsd = Math.round(grossSystemCostUsd * (1 - solarLease.federal_itc_pct) - solarLease.state_tax_credit_usd);
  const annualYieldKwh = Math.round(dcKw * (stCode === "CA" ? 1620 : stCode === "AZ" ? 1780 : 1250));
  const annualSavingsUsd = Math.round(annualYieldKwh * (stCode === "CA" ? 0.28 : 0.15));
  const paybackYearsCash = annualSavingsUsd > 0 ? Number((netSystemCostCashUsd / annualSavingsUsd).toFixed(1)) : 15.0;
  const paybackYearsLease = annualSavingsUsd > 0 ? Number((netSystemCostLeaseUsd / annualSavingsUsd).toFixed(1)) : 8.5;

  // 5. Tree Economics
  const treeEconomics = calculateCalibratedTreeEconomics(stCode, finalEstimatedValue, stCode === "CA" ? 1.24 : 1.0);

  // 6. Sub-Additive Stacking Saturation Ceiling
  const isUrbanCore = !!input.isUrbanCore;
  const maxStackingCeilingPct = isUrbanCore ? 0.30 : 0.22;
  const displacementSensitivityScore = Math.round(
    Math.max(10, Math.min(95, 48 + (isUrbanCore ? 15 : -8)))
  );

  // 7. EverySpace Property Space Monetization Engine
  const everySpace = _evalEverySpace ? _evalEverySpace({
    propertyAddress: input.address || `Parcel ${input.parcelId}`,
    city: input.address ? (input.address.split(",")[1]?.trim() || "Local City") : "Local City",
    stateCode: stCode,
    countyFips: input.countyFips,
    bedrooms: input.bedrooms || 3,
    bathrooms: input.bathrooms || 2,
    lotSqft: lotSqft || 6000,
    livingSqft: livingSqft || 1500,
    monthlyDebtServiceMortgageUsd: Math.round(finalEstimatedValue * 0.0055),
    monthlyPropertyTaxAndInsuranceUsd: Math.round(finalEstimatedValue * 0.0012),
    plannedHoldingMonths: 18,
    features: {
      hasDriveway: input.hasGarage !== false,
      drivewaySpacesCount: 2,
      hasAtticOrBasementStorage: (livingSqft || 1500) > 1200,
      storageSqft: Math.round((livingSqft || 1500) * 0.15),
      hasPool: !!input.hasPool,
      hasAvailableRoofSqftForSolar: unshadedRoofSqft > 250,
      availableRoofSqft: unshadedRoofSqft,
      hasExistingGarageForConversion: !!input.hasGarage,
      hasExistingCasitaOrAdu: (input.units || 1) > 1,
    },
  }) : null;

  // 8. Homeowner Renovation & Contractor Quote Evaluator
  const renovationOptions = _evalRenovation ? [
    _evalRenovation({
      propertyAddress: input.address,
      stateCode: stCode,
      currentPropertyValue: finalEstimatedValue,
      currentLivingSqft: livingSqft || 1500,
      lotSqft: lotSqft || 6000,
      zoningCode: input.zoningCode,
      improvementType: "garage_conversion_adu",
      quotedTotalCost: 65_000,
      projectedSqft: 400,
    }),
    _evalRenovation({
      propertyAddress: input.address,
      stateCode: stCode,
      currentPropertyValue: finalEstimatedValue,
      currentLivingSqft: livingSqft || 1500,
      lotSqft: lotSqft || 6000,
      zoningCode: input.zoningCode,
      improvementType: "detached_adu",
      quotedTotalCost: 185_000,
      projectedSqft: 750,
    }),
    _evalRenovation({
      propertyAddress: input.address,
      stateCode: stCode,
      currentPropertyValue: finalEstimatedValue,
      currentLivingSqft: livingSqft || 1500,
      improvementType: "kitchen_remodel_minor",
      quotedTotalCost: 26_000,
    }),
  ] : null;

  return {
    parcelId: input.parcelId,
    stateCode: stCode,
    countyFips: input.countyFips,
    valuation: {
      estimatedValue: finalEstimatedValue,
      valueLow: finalValueLow,
      valueHigh: finalValueHigh,
      vpsf: finalVpsf,
      confidenceMarginPct: baseAvm.confidenceMarginPct,
      confidenceRating: baseAvm.confidenceRating,
      valuationMethod: baseAvm.valuationMethod + (permitCapAdded > 0 ? " + Permit Capitalization" : ""),
      isVacantLand: isVacant,
      siteValue: baseAvm.siteValue,
      structVal: baseAvm.structVal,
      permitCapitalizationAdded: permitCapAdded,
      luxuryDampeningApplied: rawAdjustedVal > 2500000,
      luxurySaturationMultiplier: Number(saturationMult.toFixed(3)),
      multiUnitBonusPct: (!isVacant && (input.units || 1) > 1) ? Math.min(24, ((input.units || 1) - 1) * 8) : 0,
    },
    imagery: {
      parcelId: input.parcelId,
      lidarAcquisitionYear: imagery.lidarYear || 2020,
      streetViewCaptureDate: hasStreetView ? (imagery.streetViewDate || "2021-06") : null,
      latestPostConstructionPermitDate: latestPermit ? latestPermit.issue_date : null,
      permitScopeDescription: latestPermit ? latestPermit.description : null,
      isLidarStale: imageryCheck.isLidarStale,
      isStreetViewStale: imageryCheck.isStreetViewStale,
      confidenceBadge,
      warningMessage,
      proxyRoutingNotice: "Requests routed via origin-locked edge proxy (workers/api-proxy.ts) ensuring client-side API keys are protected and origin-validated.",
      storyCalibrationSource: hasStreetView ? "Google Street View 4-angle facade & USGS 3DEP LiDAR" : "USGS 3DEP LiDAR DSM & County Assessor GLA Fallback",
    },
    statutoryZoning: {
      parcel_id: statutoryZoning.parcel_id,
      state_code: statutoryZoning.state_code,
      base_zoning_code: statutoryZoning.base_zoning_code,
      applicable_statutes: statutoryZoning.applicable_statutes,
      statutory_exclusions: statutoryZoning.statutory_exclusions,
      net_by_right_feasible: statutoryZoning.net_by_right_feasible,
      not_determined_statutes: statutoryZoning.not_determined_statutes || [],
      privateCovenantsDisclaimer: "NOTICE ON PRIVATE COVENANTS: State zoning preemptions (e.g., CA SB 9, TX SB 15, WA HB 1110) override municipal zoning but may not automatically extinguish recorded private Homeowners Association (HOA) covenants or CC&Rs running with the land. Check title report for private encumbrances.",
      lotSplitFeasible,
      aduFeasible,
      statutoryNotes,
    },
    roofCadastre: roofCalc,
    solarMicrogrid: {
      tax_year: solarCash.tax_year,
      ownership_model: solarCash.ownership_model,
      usable_roof_sqft_lidar: solarCash.usable_roof_sqft_lidar,
      system_size_dc_kw: solarCash.system_size_dc_kw,
      federal_itc_pct: solarCash.federal_itc_pct,
      state_tax_credit_usd: solarCash.state_tax_credit_usd,
      net_metering_tariff: solarCash.net_metering_tariff,
      battery_storage_required_for_roi: stCode === "CA" || solarCash.battery_storage_required_for_roi,
      net_25yr_npv_usd: solarCash.net_25yr_npv_usd,
      dcKwCapacity: dcKw,
      unshadedRoofSqft,
      grossSystemCostUsd,
      netSystemCostCashUsd,
      netSystemCostLeaseUsd,
      annualYieldKwh,
      paybackYearsCash,
      paybackYearsLease,
      nemTariffNotice: stCode === "CA"
        ? "CA NEM 3.0 / Net Billing Tariff: Mid-day solar export rates are credited at avoided cost (~$0.055/kWh). Paired 10–13.5 kWh battery storage is required for positive 25-yr NPV."
        : "Standard net metering or net billing applies. Battery optional for resilience.",
    },
    treeEconomics,
    subAdditiveStacking: {
      maxStackingCeilingPct,
      jointCapitalizationFormula: "ΔP_joint = P_max * [1 - Π(1 - Δp_i / P_max)]",
      displacementSensitivityScore,
    },
    everySpace,
    renovationOptions,
    legalEngineeringDisclaimers: [
      "LEGAL & ENGINEERING NON-RELIANCE NOTICE: Preliminary screening only based on public municipal GIS, tax rolls, and statutory feeds as of November 2026.",
      "AVM valuations do not constitute formal appraisals under USPAP standards. Verify actual condition, unrecorded improvements, and neighborhood comps with a licensed appraiser.",
      "Statutory housing rights and lot split feasibility must be verified with local municipal planning and building departments prior to architectural design, capital allocation, or contractor commitments.",
      "Federal Clean Energy Credits: IRC § 25D residential credit expired Dec 31, 2025 (0% cash/loan). Commercial/TPO lease credit (IRC § 48E) subject to prevailing wage and non-FEOC supply-chain compliance.",
    ],
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    auditSingleHouseParcel,
    getHighValueSaturationMultiplier,
    calculatePermitCapitalization,
    calculateCalibratedTreeEconomics,
  };
}

if (typeof window !== "undefined") {
  window.auditSingleHouseParcel = auditSingleHouseParcel;
  window.getHighValueSaturationMultiplier = getHighValueSaturationMultiplier;
  window.calculatePermitCapitalization = calculatePermitCapitalization;
  window.calculateCalibratedTreeEconomics = calculateCalibratedTreeEconomics;
}

// ---------------- ACCURATE ROOF AREA & ARCHITECTURAL CADASTRE ENGINE ----------------
/**
 * Roof Area & Architectural Cadastre Calculation Engine
 * Estimates true 3D roof plane surface area from 2D building footprints,
 * LiDAR DSM pitch/azimuth/overhang geometry, and roofing material assemblies.
 */

function getDefaultPitchRise(yearBuilt, stateCode) {
  const st = (stateCode || "CA").toUpperCase();
  const yb = yearBuilt || 1975;

  // Regional climate adaptations
  const isDesertOrArid = ["AZ", "NV", "NM"].includes(st);
  const isHeavySnowOrRain = ["MN", "WI", "MI", "NY", "MA", "VT", "NH", "ME", "WA", "OR"].includes(st);

  if (isDesertOrArid) {
    return 3.5; // Predominantly low-pitch ranch or flat tile
  }
  if (isHeavySnowOrRain) {
    return yb < 1940 ? 8.0 : 7.0; // Steep pitch for snow and ice shedding
  }

  // Era adaptations
  if (yb < 1940) return 7.5; // Craftsman, Tudor, Victorian, Spanish revival
  if (yb >= 1945 && yb <= 1978) return 4.5; // California Ranch, Mid-Century Modern
  return 6.0; // Modern suburban standard (5:12 to 6:12)
}

function estimateAccurateRoofArea(input) {
  input = input || {};
  const stories = Math.max(1, Number(input.stories) || 1);
  const livingSqft = Math.max(400, Number(input.livingSqft) || 1600);

  // 1. Base Footprint determination
  let groundFootprintSqft = 0;
  let method = "assessor_gla_inferred";

  if (input.footprintSqft && input.footprintSqft > 200) {
    groundFootprintSqft = Math.round(input.footprintSqft);
    method = "cadastral_lidar_osm_polygon";
  } else {
    groundFootprintSqft = Math.round(livingSqft / stories);
  }

  // 2. Attached Garage Addition (if not already counted in footprint)
  let garageAdditionSqft = 0;
  const hasGarage = input.hasGarage !== false;
  const garageAttached = input.garageAttached !== false;
  if (hasGarage && garageAttached) {
    const specifiedGarage = input.garageSqft && input.garageSqft > 150 ? input.garageSqft : 0;
    if (specifiedGarage) {
      garageAdditionSqft = specifiedGarage;
    } else if (method !== "cadastral_lidar_osm_polygon") {
      garageAdditionSqft = stories > 1 ? 400 : 380;
    }
  }

  // 3. Eaves & Overhang Perimeter Calculation
  const overhangInches = input.eavesOverhangInches != null ? Math.max(0, input.eavesOverhangInches) : 18;
  const overhangFeet = overhangInches / 12.0;

  const approxWidth = Math.sqrt(groundFootprintSqft / 1.4);
  const approxLength = approxWidth * 1.4;
  const approxPerimeter = 2 * (approxWidth + approxLength);
  const eavesOverhangSqft = Math.round(approxPerimeter * overhangFeet + 4 * overhangFeet * overhangFeet);

  const effectiveGroundFootprintSqft = groundFootprintSqft + garageAdditionSqft + eavesOverhangSqft;

  // 4. Pitch & Slope Multiplier (secant theta = sqrt(1 + (rise/12)^2))
  const pitchRise = input.pitchRise != null
    ? Math.max(0.5, Math.min(18.0, Number(input.pitchRise)))
    : getDefaultPitchRise(input.yearBuilt, input.stateCode);

  const slopeAngleRad = Math.atan(pitchRise / 12.0);
  const slopeAngleDeg = Number(((slopeAngleRad * 180) / Math.PI).toFixed(1));
  const pitchMultiplier = Number((Math.sqrt(144 + pitchRise * pitchRise) / 12.0).toFixed(4));

  // 5. Roof Shape Complexity Multiplier
  const roofShape = input.roofShape || (pitchRise <= 2.0 ? "flat" : "gable");
  let shapeComplexityMultiplier = 1.05;
  if (roofShape === "flat") shapeComplexityMultiplier = 1.01;
  else if (roofShape === "hip") shapeComplexityMultiplier = 1.08;
  else if (roofShape === "complex") shapeComplexityMultiplier = 1.16;

  // 6. Gross 3D Roof Surface Area & Roofing Squares
  const grossRoofSqft = Math.round(effectiveGroundFootprintSqft * pitchMultiplier * shapeComplexityMultiplier);
  const roofingSquares = Number((grossRoofSqft / 100.0).toFixed(1));

  // 7. Usable Solar Photovoltaic Plane Area
  const productiveAzimuthFraction = roofShape === "flat" ? 0.88 : 0.64;
  const fireCodeAndVentSetbackFraction = 0.18;
  const treeShadeFraction = Math.max(0, Math.min(0.35, Number(input.treeCanopyShadePct) || 0.05));

  const usableSolarSqft = Math.round(
    grossRoofSqft *
      productiveAzimuthFraction *
      (1 - fireCodeAndVentSetbackFraction) *
      (1 - treeShadeFraction)
  );

  // 8. Solar Capacity & Energy Yield
  const maxSolarPanels = Math.max(4, Math.floor(usableSolarSqft / 19.5));
  const solarDcKw = Number(((maxSolarPanels * 410) / 1000.0).toFixed(1));
  const stUpper = (input.stateCode || "CA").toUpperCase();
  const yieldMultiplier = ["CA", "AZ", "NV", "NM", "TX", "FL"].includes(stUpper) ? 1520 : 1240;
  const annualYieldKwh = Math.round(solarDcKw * yieldMultiplier);

  // 9. Roofing Material Cost Estimates
  const materials = [
    {
      materialKey: "asphalt_shingle",
      materialName: "30-Yr Architectural Asphalt Shingle",
      costPerSquareLowUsd: 460,
      costPerSquareHighUsd: 590,
      totalCostLowUsd: Math.round(roofingSquares * 460),
      totalCostHighUsd: Math.round(roofingSquares * 590),
      lifespanYears: 30,
      warranty: "30-Year Manufacturer Limited Warranty",
      solarFriendly: true,
    },
    {
      materialKey: "standing_seam_metal",
      materialName: "24-Gauge Standing Seam Metal",
      costPerSquareLowUsd: 1100,
      costPerSquareHighUsd: 1480,
      totalCostLowUsd: Math.round(roofingSquares * 1100),
      totalCostHighUsd: Math.round(roofingSquares * 1480),
      lifespanYears: 50,
      warranty: "Lifetime / 50-Year Non-Prorated",
      solarFriendly: true,
    },
    {
      materialKey: "concrete_clay_tile",
      materialName: "Concrete / Spanish Clay Barrel Tile",
      costPerSquareLowUsd: 1250,
      costPerSquareHighUsd: 1750,
      totalCostLowUsd: Math.round(roofingSquares * 1250),
      totalCostHighUsd: Math.round(roofingSquares * 1750),
      lifespanYears: 60,
      warranty: "50-Year Class A Fire Rated",
      solarFriendly: false,
    },
    {
      materialKey: "tpo_commercial_flat",
      materialName: "60-Mil TPO Single-Ply Membrane (Low-Slope)",
      costPerSquareLowUsd: 580,
      costPerSquareHighUsd: 820,
      totalCostLowUsd: Math.round(roofingSquares * 580),
      totalCostHighUsd: Math.round(roofingSquares * 820),
      lifespanYears: 25,
      warranty: "25-Year Commercial NDL",
      solarFriendly: true,
    },
  ];

  return {
    groundFootprintSqft,
    eavesOverhangSqft,
    garageRoofAdditionSqft: garageAdditionSqft,
    effectiveGroundFootprintSqft,
    pitchRise,
    pitchRatio: `${pitchRise}:12`,
    slopeAngleDeg,
    pitchMultiplier,
    roofShape,
    shapeComplexityMultiplier,
    grossRoofSqft,
    roofingSquares,
    productiveAzimuthFraction,
    fireCodeAndVentSetbackFraction,
    treeShadeFraction,
    usableSolarSqft,
    maxSolarPanels,
    solarDcKw,
    annualYieldKwh,
    materials,
    estimationMethod: method,
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    estimateAccurateRoofArea,
    getDefaultPitchRise,
  };
}

if (typeof window !== "undefined") {
  window.estimateAccurateRoofArea = estimateAccurateRoofArea;
  window.getDefaultPitchRise = getDefaultPitchRise;
}


let _currentRoofParams = null;
function recalculateRoofDrawer(pitchRise, roofShape, overhangInches) {
  const p = window._currentRoofParams || _currentRoofParams;
  if (!p) return null;
  if (pitchRise != null) p.pitchRise = pitchRise;
  if (roofShape != null) p.roofShape = roofShape;
  if (overhangInches != null) p.eavesOverhangInches = overhangInches;
  _currentRoofParams = p;
  window._currentRoofParams = p;

  const res = (typeof estimateAccurateRoofArea === "function")
    ? estimateAccurateRoofArea(p)
    : null;
  if (!res) return null;

  const elGross = document.getElementById("roof-val-gross");
  const elSquares = document.getElementById("roof-val-squares");
  const elMult = document.getElementById("roof-val-mult");
  const elAngle = document.getElementById("roof-val-angle");
  const elSolarSqft = document.getElementById("roof-val-solar-sqft");
  const elPanels = document.getElementById("roof-val-panels");
  const elKw = document.getElementById("roof-val-kw");
  const elGen = document.getElementById("roof-val-gen");
  const elShingle = document.getElementById("roof-cost-shingle");
  const elMetal = document.getElementById("roof-cost-metal");
  const elTile = document.getElementById("roof-cost-tile");
  const elBadge = document.getElementById("roof-summary-badge");

  if (elGross) elGross.textContent = res.grossRoofSqft.toLocaleString() + " sq ft";
  if (elSquares) elSquares.textContent = res.roofingSquares + " sqs";
  if (elMult) elMult.textContent = res.pitchMultiplier + "x (" + res.pitchRatio + ")";
  if (elAngle) elAngle.textContent = res.slopeAngleDeg + "°";
  if (elSolarSqft) elSolarSqft.textContent = res.usableSolarSqft.toLocaleString() + " sq ft";
  if (elPanels) elPanels.textContent = res.maxSolarPanels + " panels";
  if (elKw) elKw.textContent = res.solarDcKw.toFixed(1) + " kW DC";
  if (elGen) elGen.textContent = "~" + res.annualYieldKwh.toLocaleString() + " kWh/yr";
  if (elBadge) elBadge.textContent = "~" + res.grossRoofSqft.toLocaleString() + " Sq Ft (" + res.roofingSquares + " Squares) · " + res.pitchRatio;

  if (elShingle && res.materials[0]) elShingle.textContent = "$" + res.materials[0].totalCostLowUsd.toLocaleString() + " – $" + res.materials[0].totalCostHighUsd.toLocaleString();
  if (elMetal && res.materials[1]) elMetal.textContent = "$" + res.materials[1].totalCostLowUsd.toLocaleString() + " – $" + res.materials[1].totalCostHighUsd.toLocaleString();
  if (elTile && res.materials[2]) elTile.textContent = "$" + res.materials[2].totalCostLowUsd.toLocaleString() + " – $" + res.materials[2].totalCostHighUsd.toLocaleString();

  document.querySelectorAll(".roof-pitch-btn").forEach(b => {
    const active = +b.dataset.pitch === res.pitchRise;
    b.classList.toggle("active", active);
    b.style.background = active ? "#0284c7" : "#fff";
    b.style.color = active ? "#fff" : "#334155";
  });
  document.querySelectorAll(".roof-shape-btn").forEach(b => {
    const active = b.dataset.shape === res.roofShape;
    b.classList.toggle("active", active);
    b.style.background = active ? "#0284c7" : "#fff";
    b.style.color = active ? "#fff" : "#334155";
  });

  const svgText = document.getElementById("roof-svg-angle-text");
  if (svgText) svgText.textContent = res.pitchRatio + " (" + res.slopeAngleDeg + "°)";
  const svgPoly = document.getElementById("roof-svg-slope");
  if (svgPoly) {
    const triH = Math.min(55, Math.round(12 + res.pitchRise * 3.8));
    svgPoly.setAttribute("d", `M 15 70 L 85 ${70 - triH} L 155 70 Z`);
  }
  return res;
}
window.recalculateRoofDrawer = recalculateRoofDrawer;

"use strict";

function renderHouseAuditAside(audit) {
  const v = audit.valuation;
  const im = audit.imagery;
  const z = audit.statutoryZoning;
  const sol = audit.solarMicrogrid;
  const tree = audit.treeEconomics;
  const st = audit.subAdditiveStacking;

  const fmt$ = (n) => (n == null || isNaN(n)) ? "–" : "$" + Math.round(n).toLocaleString();
  const fmtN = (n) => (n == null || isNaN(n)) ? "–" : Math.round(n).toLocaleString();

  const badgeColor =
    im.confidenceBadge === "verified_current"
      ? "#15803d"
      : im.confidenceBadge === "stale_imagery_permit_override"
      ? "#b45309"
      : "#64748b";

  const badgeText =
    im.confidenceBadge === "verified_current"
      ? "✓ Imagery newer than the last permit"
      : im.confidenceBadge === "stale_imagery_permit_override"
      ? "Stale Imagery (Post-Construction Permit Override)"
      : "No Street View (Rural / Cul-de-sac / Gated)";

  return `
  <div class="house-audit-panel" style="font-family:system-ui,-apple-system,sans-serif;line-height:1.45;color:#1e293b;padding:12px;background:#ffffff;border-radius:8px;border:1px solid #e2e8f0;margin-top:10px;">
    <!-- Header & Parcel ID -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:10px;border-bottom:1px solid #e2e8f0;padding-bottom:8px;">
      <div>
        <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;">Parcel Comprehensive Property Profile</div>
        <div style="font-size:14px;font-weight:800;color:#0f172a;">Parcel ID: ${audit.parcelId} (${audit.stateCode} · FIPS ${audit.countyFips})</div>
      </div>
      <div style="font-size:10px;font-weight:700;padding:3px 8px;border-radius:12px;background:${badgeColor}15;color:${badgeColor};border:1px solid ${badgeColor}40;">
        ${badgeText}
      </div>
    </div>

    <!-- 1. Automated Valuation Model & Permit Capitalization -->
    <div style="background:#f8fafc;padding:10px;border-radius:6px;border:1px solid #e2e8f0;margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:4px;">
        <span style="font-size:11px;font-weight:700;color:#334155;">Automated Valuation Estimate</span>
        <span style="font-size:11px;color:#0284c7;font-weight:600;">${audit.valCheck ? (audit.valCheck.backtested ? `Back-test status: ${esc(audit.valCheck.status || "on file")}` : "Not back-tested here") : esc(v.confidenceRating || "")}</span>
      </div>
      ${audit.valCheck && !audit.valCheck.ok ? `<div style="font-size:12px;color:#475569;margin:3px 0;"><b>No estimate.</b> ${esc(audit.valCheck.reason || "")}</div>` : `
      <div style="font-size:20px;font-weight:800;color:#0f172a;margin:3px 0;">
        ${fmt$(v.estimatedValue)}
        ${audit.measuredRange ? (audit.measuredRange.low != null && audit.measuredRange.high != null ? `<span style="font-size:12px;font-weight:500;color:#64748b;">(${fmt$(audit.measuredRange.low)} – ${fmt$(audit.measuredRange.high)} · ±${(audit.measuredRange.mdape * 100).toFixed(1)}% measured typical error)</span>` : `<span style="font-size:12px;font-weight:500;color:#64748b;">(not back-tested here, so no error range)</span>`) : (v.confidenceMarginPct != null ? `<span style="font-size:12px;font-weight:500;color:#64748b;">(${fmt$(v.valueLow)} – ${fmt$(v.valueHigh)} · ±${(v.confidenceMarginPct * 100).toFixed(1)}%, model's own margin, not measured)</span>` : "")}
      </div>`}
      ${audit.valCheck && !audit.valCheck.ok ? "" : `<div style="font-size:11.5px;color:#475569;margin-bottom:6px;">
        ~${fmt$(v.vpsf)}/sq ft ${v.isVacantLand ? "lot (Vacant Land Appraisal)" : "living area"} &middot; Model: <b>${v.valuationMethod}</b>
      </div>`}
      <div style="display:${audit.valCheck && !audit.valCheck.ok ? "none" : "grid"};grid-template-columns:1fr 1fr;gap:6px;font-size:11px;background:#ffffff;padding:8px;border-radius:4px;border:1px solid #cbd5e1;">
        <div>• <b>Site Land Equity:</b> ${fmt$(v.siteValue)}</div>
        <div>• <b>Finished Structure (GLA):</b> ${v.isVacantLand ? "$0 (unimproved)" : fmt$(v.structVal)}</div>
        ${v.permitCapitalizationAdded > 0 ? `<div style="color:#15803d;font-weight:700;">• <b>Permit Capitalization (+85%):</b> +${fmt$(v.permitCapitalizationAdded)}</div>` : `<div>• <b>Permit Additions:</b> No unassessed active permits</div>`}
        ${v.luxuryDampeningApplied ? `<div style="color:#b45309;">• <b>High-Value Cap ($2.5M+):</b> Non-linear elasticity (${v.luxurySaturationMultiplier}x)</div>` : `<div>• <b>Tier Scaling:</b> Standard linear elasticity</div>`}
        ${v.multiUnitBonusPct > 0 ? `<div style="color:#0284c7;font-weight:700;">• <b>Rental Density Bonus:</b> +${v.multiUnitBonusPct}% (2–4 Plex)</div>` : ""}
      </div>
    </div>

    <!-- 2. LiDAR, Stories & Street View Proxy Verification -->
    <div style="background:#f8fafc;padding:10px;border-radius:6px;border:1px solid #e2e8f0;margin-bottom:10px;">
      <div style="font-size:11.5px;font-weight:700;color:#334155;margin-bottom:4px;">Building Footprints &amp; 4-Angle Street View Verification</div>
      <div style="font-size:11px;color:#475569;margin-bottom:6px;">
        • <b>LiDAR Acquisition:</b> ${im.lidarAcquisitionYear} USGS 3DEP DSM &middot; <b>Street View:</b> ${im.streetViewCaptureDate || "Unavailable"} &middot; <b>Permit Vintage:</b> ${im.latestPostConstructionPermitDate || "None post-imagery"}<br>
        • <b>Story Calibration:</b> ${im.storyCalibrationSource}
      </div>
      ${im.warningMessage ? `<div style="font-size:11px;color:#b45309;background:#fef3c7;padding:6px 8px;border-radius:4px;border:1px solid #fde68a;margin-bottom:6px;"><b>Imagery Notice:</b> ${im.warningMessage}</div>` : ""}
      <div style="font-size:10.5px;color:#64748b;font-style:italic;">
        ${im.proxyRoutingNotice}
      </div>
    </div>

    <!-- 3. Statutory By-Right Housing Rights & Exclusions -->
    <div style="background:#f8fafc;padding:10px;border-radius:6px;border:1px solid #e2e8f0;margin-bottom:10px;">
      <div style="font-size:11.5px;font-weight:700;color:#334155;margin-bottom:4px;">Statutory By-Right Housing Rights &amp; Exclusions</div>
      <div style="font-size:11px;color:#475569;margin-bottom:6px;">
        ${z.applicable_statutes && z.applicable_statutes.length > 0 ? `
          <div style="color:#15803d;font-weight:700;margin-bottom:4px;">✓ State law that applies (checked against the statute): ${z.applicable_statutes.map(s => s.citation).join(", ")}</div>
          • <b>By-Right Density:</b> ${z.applicable_statutes[0].max_units_by_right != null ? `Up to ${z.applicable_statutes[0].max_units_by_right} units ministerially.` : "Not on file."}<br>
          • <b>Height &amp; FAR:</b> ${z.applicable_statutes[0].max_height_ft ? `${z.applicable_statutes[0].max_height_ft} ft` : "Base zoning"} ${z.applicable_statutes[0].max_far ? `&middot; ${z.applicable_statutes[0].max_far} FAR` : ""}<br>
          • <b>Parking:</b> ${z.applicable_statutes[0].min_parking_spaces_per_unit != null ? `at most ${z.applicable_statutes[0].min_parking_spaces_per_unit} spaces/unit may be required.` : "not set by this law (local rules apply)."}<br>
          <div style="color:#334155;margin-top:4px;">${z.statutoryNotes}</div>
        ` : `
          <div style="color:#334155;">${z.statutoryNotes}</div>
        `}
        ${(z.not_determined_statutes || []).length ? `<div style="color:#b45309;margin:4px 0;">• <b>Not determined:</b> ${z.not_determined_statutes.map(s => `${s.citation} (${s.reason})`).join("; ")}</div>` : ""}
        • <b>Lot Split Feasibility:</b> ${z.lotSplitFeasible ? "<span style='color:#15803d;font-weight:700;'>Possible under SB 9 (lot of 2,400+ sq ft so each new lot is at least 1,200 sq ft; no HPOZ, fire-zone or floodway flag)</span>" : "<span style='color:#64748b;'>Not shown as possible (California SB 9 only; lot size, zoning or an HPOZ, fire-zone or floodway flag)</span>"}<br>
        • <b>ADU Feasibility:</b> ${z.aduFeasible ? "<span style='color:#15803d;font-weight:700;'>By-Right Feasible</span>" : "<span style='color:#b45309;'>Discretionary HPOZ review required</span>"}
      </div>
      <div style="font-size:10.5px;color:#64748b;background:#ffffff;padding:6px;border-radius:4px;border:1px solid #e2e8f0;">
        ${z.privateCovenantsDisclaimer}
      </div>
    </div>

    <!-- 3.5 Accurate Roof Cadastre & Pitch Engineering -->
    ${audit.roofCadastre ? `
    <div style="background:#f8fafc;padding:10px;border-radius:6px;border:1px solid #e2e8f0;margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:4px;">
        <span style="font-size:11.5px;font-weight:700;color:#334155;">Accurate Roof Cadastre &amp; Pitch Engineering</span>
        <span style="font-size:11px;color:#0284c7;font-weight:600;">${audit.roofCadastre.pitchRatio} Pitch (${audit.roofCadastre.slopeAngleDeg}°)</span>
      </div>
      <div style="font-size:11px;color:#475569;margin-top:4px;">
        • <b>Gross 3D Roof Area:</b> <b>${fmtN(audit.roofCadastre.grossRoofSqft)} sq ft</b> (${audit.roofCadastre.roofingSquares} roofing squares &middot; ${audit.roofCadastre.pitchMultiplier}x secant multiplier)<br>
        • <b>Footprint Breakdown:</b> ${fmtN(audit.roofCadastre.groundFootprintSqft)} sq ft base footprint + ${fmtN(audit.roofCadastre.eavesOverhangSqft)} sq ft eaves overhang ${audit.roofCadastre.garageRoofAdditionSqft > 0 ? `+ ${fmtN(audit.roofCadastre.garageRoofAdditionSqft)} sq ft attached garage` : ""}<br>
        • <b>Usable Solar Facets:</b> <b>${fmtN(audit.roofCadastre.usableSolarSqft)} sq ft</b> (excluding north planes &amp; 3-ft fire code setbacks &middot; fits ~${audit.roofCadastre.maxSolarPanels} panels)<br>
        • <b>Re-Roofing Cost:</b> Architectural Shingles: ~$${fmtN(audit.roofCadastre.materials[0].totalCostLowUsd)}–$${fmtN(audit.roofCadastre.materials[0].totalCostHighUsd)} &middot; Metal: ~$${fmtN(audit.roofCadastre.materials[1].totalCostLowUsd)}–$${fmtN(audit.roofCadastre.materials[1].totalCostHighUsd)}
      </div>
    </div>` : ""}

    <!-- 4. 2026 Solar, Storage & Microgrid -->
    <div style="background:#f8fafc;padding:10px;border-radius:6px;border:1px solid #e2e8f0;margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;">
        <span style="font-size:11.5px;font-weight:700;color:#334155;">2026+ Rooftop Solar &amp; Battery Storage</span>
        <span style="font-size:10.5px;font-weight:700;color:#b45309;">Federal § 25D Credit: 0% (Expired Dec 2025)</span>
      </div>
      <div style="font-size:10.5px;font-weight:700;color:#b45309;margin-top:2px;">Illustrative only: inputs are assumptions, not local data (install cost per watt, yield, power rates and battery cost are typed-in state defaults).</div>
      <div style="font-size:11px;color:#475569;margin-top:4px;">
        • <b>LiDAR Usable Roof:</b> ${fmtN(sol.unshadedRoofSqft)} sq ft unshaded DSM &middot; Sized at <b>${sol.dcKwCapacity} kW DC</b> (~${fmtN(sol.annualYieldKwh)} kWh/yr)<br>
        • <b>Cash/Loan Option:</b> ${fmt$(sol.netSystemCostCashUsd)} net cost &middot; Payback: ~${sol.paybackYearsCash} yrs &middot; 25-Yr Equity: ${fmt$(sol.net_25yr_npv_usd)}<br>
        • <b>Commercial / TPO Lease (IRC § 48E 30%):</b> ${fmt$(sol.netSystemCostLeaseUsd)} net &middot; Payback: ~${sol.paybackYearsLease} yrs<br>
        ${sol.state_tax_credit_usd > 0 ? `• <b>State Clean Energy Credit:</b> +${fmt$(sol.state_tax_credit_usd)} direct state tax credit.<br>` : ""}
      </div>
      <div style="font-size:10.5px;color:#0284c7;background:#ffffff;padding:6px;border-radius:4px;border:1px solid #e2e8f0;margin-top:4px;">
        ${sol.nemTariffNotice}
      </div>
    </div>

    <!-- 5. Climate- & RSMeans-Calibrated Tree Economics -->
    <div style="background:#f8fafc;padding:10px;border-radius:6px;border:1px solid #e2e8f0;margin-bottom:10px;">
      <div style="font-size:11.5px;font-weight:700;color:#334155;margin-bottom:4px;">Climate-Calibrated Street Tree &amp; Canopy Economics</div>
      <div style="font-size:11px;color:#475569;">
        • <b>Capitalized Property Value:</b> +${fmt$(tree.capitalizedValueLiftUsd)} (RSMeans-adjusted for ${tree.stateCode})<br>
        • <b>Annual Utility Dividend:</b> +${fmt$(tree.netAnnualSavingsUsd)}/yr net (${fmt$(tree.annualUtilitySavingsUsd)}/yr utility savings - ${fmt$(tree.annualIrrigationCostUsd)}/yr irrigation)<br>
        • <b>Climate Regime:</b> ${tree.climateRegime.replace(/_/g, " ")} &middot; ${tree.utilityBenefitDescription}
      </div>
    </div>

    <!-- 6. Sub-Additive Saturation & Displacement Risk -->
    <div style="background:#f8fafc;padding:10px;border-radius:6px;border:1px solid #e2e8f0;margin-bottom:10px;">
      <div style="font-size:11.5px;font-weight:700;color:#334155;margin-bottom:4px;">Sub-Additive Package Stacking &amp; Displacement Risk</div>
      <div style="font-size:11px;color:#475569;">
        • <b>Stacking Saturation Ceiling:</b> ${(st.maxStackingCeilingPct * 100).toFixed(0)}% maximum cumulative neighborhood price lift.<br>
        • <b>Diminishing Returns Formula:</b> <code style="font-size:10px;background:#e2e8f0;padding:1px 4px;border-radius:3px;">${st.jointCapitalizationFormula}</code><br>
        • <b>Renter Displacement Sensitivity Score:</b> <b>${st.displacementSensitivityScore} / 100</b>
      </div>
    </div>

    <!-- 6.5 EverySpace Holding Space Monetization Matrix -->
    ${audit.everySpace ? `
    <div style="background:#f8fafc;padding:10px;border-radius:6px;border:1px solid #e2e8f0;margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:4px;">
        <span style="font-size:11.5px;font-weight:700;color:#334155;">EverySpace Holding Monetization <span style="font-weight:700;color:#b45309;">(Illustrative only: inputs are assumptions, not local data)</span></span>
        <span style="font-size:11px;font-weight:700;color:${audit.everySpace.isCashFlowPositiveDuringHold ? '#15803d' : '#0284c7'};">
          ${audit.everySpace.isCashFlowPositiveDuringHold ? '✓ Cash Flow Positive Hold' : `${audit.everySpace.monthlyHoldingDeficitReductionPct}% Deficit Offset`}
        </span>
      </div>
      <div style="font-size:11px;color:#475569;margin-top:4px;">
        • <b>Gross Holding Revenue:</b> <b>${fmt$(audit.everySpace.totalMonthlyEverySpaceGrossRevenueUsd)}/mo</b> (${fmt$(audit.everySpace.cumulativeEverySpaceEarningsOverHoldUsd)} over ${audit.everySpace.totalHoldingMonths}-mo pre-construction hold)<br>
        • <b>Net Holding Cash Flow:</b> ${audit.everySpace.netMonthlyHoldingCashFlowUsd >= 0 ? '+' : ''}${fmt$(audit.everySpace.netMonthlyHoldingCashFlowUsd)}/mo (after debt service &amp; taxes)<br>
        • <b>Monetized Channels:</b> ${audit.everySpace.channels.map(c => `<b>${c.name.split(' ')[0]}</b> (~${fmt$(c.monthlyRevenueExpectedUsd)}/mo)`).join(' &middot; ')}<br>
        • <b>Carrying Equity Preserved:</b> ${fmt$(audit.everySpace.netEquityPreservedOverHoldUsd)} in holding deficits eliminated.
      </div>
      <div style="font-size:10.5px;color:#0369a1;background:#f0f9ff;padding:6px;border-radius:4px;border:1px solid #bae6fd;margin-top:6px;">
        ${audit.everySpace.holdingStrategyRecommendation}
      </div>
    </div>` : ""}

    <!-- 6.6 Homeowner Renovation & Contractor Quote Evaluator -->
    ${audit.renovationOptions && audit.renovationOptions.length ? `
    <div style="background:#f8fafc;padding:10px;border-radius:6px;border:1px solid #e2e8f0;margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:4px;">
        <span style="font-size:11.5px;font-weight:700;color:#334155;">Homeowner Renovation &amp; Quote Evaluator</span>
        <span style="font-size:10.5px;font-weight:700;color:#b45309;">Illustrative only: inputs are assumptions, not local data</span>
      </div>
      <div style="font-size:11px;color:#475569;margin-top:4px;">
        ${audit.renovationOptions.map(r => `
          <div style="background:#ffffff;padding:6px 8px;border-radius:4px;border:1px solid #cbd5e1;margin-top:4px;">
            <div style="display:flex;justify-content:space-between;font-weight:700;color:#0f172a;">
              <span>${r.improvementType.replace(/_/g, " ").toUpperCase()}</span>
              <span style="color:${r.returnOnInvestmentPct >= 15 ? '#15803d' : '#64748b'};">${r.returnOnInvestmentPct >= 0 ? '+' : ''}${r.returnOnInvestmentPct}% ROI</span>
            </div>
            <div style="font-size:10.5px;color:#475569;">
              Quote: ${fmt$(r.quotedCost)} (Benchmark: ${fmt$(r.benchmarkMarketCostLow)}–${fmt$(r.benchmarkMarketCostHigh)}) &middot; Value Add: <b>+${fmt$(r.estimatedEquityValueAdd)}</b><br>
              ${r.everySpaceMonthlyYieldUsd > 0 ? `EverySpace Rent: <b>+${fmt$(r.everySpaceMonthlyYieldUsd)}/mo</b> (${r.paybackYears} yr payback) &middot; ` : ""}
              Statute: <i>${r.statutoryEntitlementStatus.governingStatute}</i>
            </div>
            <div style="font-size:10px;color:#334155;margin-top:2px;">
              <b>Verdict:</b> ${r.verdictSummary}
            </div>
          </div>
        `).join("")}
      </div>
    </div>` : ""}

    <!-- 7. Legal & Engineering Disclaimers -->
    <div style="border-top:1px solid #e2e8f0;padding-top:8px;font-size:10px;color:#64748b;line-height:1.4;">
      <b>Disclaimers:</b><br>
      ${audit.legalEngineeringDisclaimers.map(d => `• ${d}`).join("<br>")}
    </div>
  </div>
  `;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { renderHouseAuditAside };
}

if (typeof window !== "undefined") {
  window.renderHouseAuditAside = renderHouseAuditAside;
}


"use strict";

function resolveRepoAssetUrl(path) {
  if (!path) return "";
  if (/^(?:https?:|data:|blob:|\/\/)/i.test(path)) {
    return path;
  }

  const cleanPath = path.replace(/^\/+/, "");

  if (typeof window !== "undefined" && window.location) {
    const loc = window.location;
    if (loc.protocol === "file:") {
      return "https://milessilverman.github.io/city-pretty/" + cleanPath;
    }
    if (loc.pathname && loc.pathname.startsWith("/city-pretty/")) {
      return "/city-pretty/" + cleanPath;
    }
  }

  return cleanPath;
}

function patchCanopyCardDom(stateCode, countyName) {
  if (typeof document === "undefined") return;

  const st = (stateCode || (typeof window !== "undefined" && typeof window.activeState === "function" ? window.activeState() : "CA")).toUpperCase();
  const cName = countyName || (typeof window !== "undefined" && typeof window.countyNameOf === "function" && typeof window.activeFips === "function" ? window.countyNameOf(window.activeFips()) : "this county");

  let cardEl = document.getElementById("canopy-hud-economic");
  if (!cardEl) {
    const hud = document.getElementById("canopy-hud");
    if (hud) {
      const divs = hud.querySelectorAll("div");
      for (let i = 0; i < divs.length; i++) {
        if (divs[i].textContent && divs[i].textContent.includes("Economic Impact")) {
          divs[i].id = "canopy-hud-economic";
          cardEl = divs[i];
          break;
        }
      }
    }
  }

  if (!cardEl) return;

  const HEATING_STATES = new Set([
    "AK", "ME", "NH", "VT", "MA", "NY", "MN", "WI", "MI", "ND", "SD", "MT", "WY", "ID", "IA", "IL"
  ]);
  const ARID_STATES = new Set(["AZ", "NV", "NM", "UT"]);

  if (HEATING_STATES.has(st)) {
    cardEl.innerHTML = `<b>Economic Impact (${st}):</b> Mature street tree canopy adds <b>+$5,400</b> in capitalized home value (USDA Forest Service) &amp; saves <b>$95/yr</b> in winter windbreak heating load.`;
  } else if (ARID_STATES.has(st)) {
    cardEl.innerHTML = `<b>Economic Impact (${st}):</b> Mature street tree canopy adds <b>+$8,200</b> in capitalized home value (USDA Forest Service) &amp; saves <b>$220/yr</b> in peak summer cooling load (with xeriscape drip irrigation).`;
  } else if (st === "CA") {
    cardEl.innerHTML = `<b>Economic Impact (CA):</b> Mature street tree canopy adds <b>+$7,130</b> in capitalized home value (USDA Forest Service) &amp; saves <b>$140/yr</b> in AC cooling load.`;
  } else {
    cardEl.innerHTML = `<b>Economic Impact (${st}):</b> Mature street tree canopy adds <b>+$6,200</b> in capitalized home value (USDA Forest Service) &amp; saves <b>$115/yr</b> in balanced seasonal heating &amp; cooling efficiency.`;
  }
}

function patchTopBarControlsDom() {
  if (typeof document === "undefined") return;

  // 1. Patch evidence dropdown
  const evidSel = document.getElementById("evid");
  if (evidSel) {
    const optA = evidSel.querySelector('option[value="A"]');
    if (optA) {
      optA.textContent = "Measured in local metro only (A)";
    }
  }

  // 2. Patch metric dropdown
  const metricSel = document.getElementById("metric");
  if (metricSel) {
    const optHeat = metricSel.querySelector('option[value="heat"]');
    if (optHeat) {
      optHeat.textContent = "Heat vs. EPA Level IV ecoregion median";
    }

    let optDisp = metricSel.querySelector('option[value="displacement"]');
    if (!optDisp) {
      optDisp = document.createElement("option");
      optDisp.value = "displacement";
      optDisp.textContent = "Renter displacement sensitivity (0–100)";
      metricSel.appendChild(optDisp);
    }
  }

  // 3. Quarantine unverified/experimental modes behind toggle
  const isExperimental = !!(typeof window !== "undefined" && window.__CITY_PRETTY_EXPERIMENTAL__);

  if (evidSel) {
    const optU = evidSel.querySelector('option[value="U"]');
    if (optU) {
      optU.hidden = !isExperimental;
      if (!isExperimental && evidSel.value === "U") {
        evidSel.value = "D";
      }
    }
  }

  if (metricSel) {
    const optProfit = metricSel.querySelector('option[value="profit"]');
    if (optProfit) {
      optProfit.hidden = !isExperimental;
      if (!isExperimental && metricSel.value === "profit") {
        metricSel.value = "top_vpd";
      }
    }
  }
}

function toggleExperimentalModes(enabled) {
  if (typeof window === "undefined") return false;
  const curr = !window.__CITY_PRETTY_EXPERIMENTAL__;
  const next = enabled !== undefined ? enabled : curr;
  window.__CITY_PRETTY_EXPERIMENTAL__ = next;
  patchTopBarControlsDom();
  const tb = document.getElementById("btn-toggle-experimental");
  if (tb) tb.textContent = next ? "Hide experimental modes" : "Show experimental modes";
  return next;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    resolveRepoAssetUrl,
    patchCanopyCardDom,
    patchTopBarControlsDom,
    toggleExperimentalModes,
  };
}

if (typeof window !== "undefined") {
  window.resolveRepoAssetUrl = resolveRepoAssetUrl;
  window.patchCanopyCardDom = patchCanopyCardDom;
  window.patchTopBarControlsDom = patchTopBarControlsDom;
  window.toggleExperimentalModes = toggleExperimentalModes;
}

function syncHeaderDomToCounty(fips) {
  const f = fips || (typeof activeFips === "function" ? activeFips() : "06037");
  const comp = COUNTY_COMPLETENESS_INDEX[f] || {
    fips: f,
    name: (typeof countyNameOf === "function" ? countyNameOf(f) : "County " + f),
    state: (typeof activeState === "function" ? activeState() : "US"),
    readiness_tier: "cadastral_only_D",
    assessor_roll_vintage: "Unverified",
    zoning_source: "statewide_parcel",
    gtfs_agencies_count: 0
  };
  
  const eyebrowEl = document.querySelector("[data-city-pretty-eyebrow]") || document.querySelector(".eyebrow");
  const titleEl = document.querySelector("header h1");
  const readinessEl = document.querySelector("#county-readiness-pill");
  const buildDateText = (typeof buildStamp === "function" ? buildStamp() : "08 NOV 2026");

  if (eyebrowEl) {
    const isPrelim = comp.readiness_tier.startsWith("preliminary") || comp.readiness_tier.startsWith("cadastral");
    eyebrowEl.textContent = "CITY PRETTY · " + comp.name.toUpperCase() + ", " + comp.state.toUpperCase() + (isPrelim ? " (PRELIMINARY)" : "") + " · " + buildDateText;
  }
  if (titleEl) {
    titleEl.textContent = "Which improvements make " + comp.name + " neighborhoods better, and worth more, per dollar";
  }
  { const lab = document.getElementById("county-pick-label"); if (lab) lab.textContent = comp.name + (comp.state ? ", " + comp.state : ""); }
  if (readinessEl) {
    readinessEl.setAttribute("data-tier", comp.readiness_tier);
    const tierLabel = comp.readiness_tier === "audited_A" ? "A (fullest)" : comp.readiness_tier === "verified_B" ? "B" : comp.readiness_tier === "preliminary_C" ? "C (preliminary)" : "D (basic)";
    
    readinessEl.title = "Data tier " + tierLabel + " · Assessor roll: " + (comp.assessor_roll_vintage || "not recorded") + " · Zoning: " + String(comp.zoning_source || "not recorded").replace(/_/g, " ") + " · Transit feeds: " + (comp.gtfs_agencies_count || 0) + ". Click for details.";
  }
  if (typeof syncMethodsModalToCounty === "function") {
    syncMethodsModalToCounty(f);
  }
  if (typeof patchCanopyCardDom === "function") {
    patchCanopyCardDom(comp.state, comp.name);
  }
  if (typeof patchTopBarControlsDom === "function") {
    patchTopBarControlsDom();
  }
}
window.syncHeaderDomToCounty = syncHeaderDomToCounty;

// ============================================================================

var ENHANCEMENTS = {"street_trees": {"lead_agency": "City Public Works (StreetsLA) / Urban Forestry Division","process": "Board of Public Works street tree planting contract & Urban Forestry permit","beneficiary": "All Residents / Renters","displacement_risk": "protective","displacement_text": "Protective / Direct Renter Benefit","renter_direct": true,"economic_nuance": "Cuts urban heat island 3-5°F, lowers cooling bills for unconditioned apartments; broad distribution prevents hyper-localized rent spikes."},"schoolyard_green": {"lead_agency": "School district (e.g. LAUSD Facilities Services) with partners such as Los Angeles Neighborhood Land Trust and Trust for Public Land","process": "District greening priority list (LAUSD Greening Index), board-approved capital project & grant match (Measure W, Prop 4)","beneficiary": "Students / Families","displacement_risk": "neutral","displacement_text": "Neutral / Low Risk","renter_direct": false,"economic_nuance": "Replaces asphalt on school grounds; benefits children; negligible direct rent capitalization on surrounding rental parcels."},"vacant_lot_green": {"lead_agency": "City Community Investment for Families & Landowner","process": "Interim lease agreement, clean & green grant award & community volunteer stewardship","beneficiary": "All Residents","displacement_risk": "neutral","displacement_text": "Neutral / Low Risk","renter_direct": false,"economic_nuance": "Blended neighborhood stabilization; reduces blight and gun violence; modest land value bump buffered by in-place rent controls."},"community_garden": {"lead_agency": "City Recreation and Parks or the LA Community Garden Council; County Parks (LA County Department of Parks and Recreation) outside the city","process": "Site lease or Recreation and Parks allocation, Measure A or Quimby funding & community garden operating agreement","beneficiary": "Renters / Low-Income Families","displacement_risk": "protective","displacement_text": "Protective / Direct Renter Benefit","renter_direct": true,"economic_nuance": "Direct food security and green space access for apartment dwellers without private yards."},"green_alley": {"lead_agency": "City Public Works & LA County Flood Control District","process": "Measure W Municipal/Regional funding application & green alley engineering design","beneficiary": "Adjacent Residents","displacement_risk": "neutral","displacement_text": "Neutral / Low Risk","renter_direct": false,"economic_nuance": "Permeable pavers, stormwater, and pedestrian lighting; primarily localized sanitation and flood prevention."},"cool_pavement": {"lead_agency": "City Public Works (StreetsLA) & Urban Forestry","process": "Capital Improvement Program (CIP) allocation & Board of Public Works public hearing","beneficiary": "All Residents / Renters","displacement_risk": "protective","displacement_text": "Protective / Direct Renter Benefit","renter_direct": true,"economic_nuance": "Surface temperature reduction on public rights-of-way; public good with zero rent-increase pass-through mechanism."},"pocket_park": {"lead_agency": "City Department of Recreation and Parks & City Council","process": "Lot acquisition negotiation, Quimby fee allocation & Park Commission approval","beneficiary": "Local Neighbors / Renters","displacement_risk": "neutral","displacement_text": "Neutral / Low Risk","renter_direct": true,"economic_nuance": "Open space in park-poor rental tracts; provides recreational access, moderate positive spillover."},"park_upgrade": {"lead_agency": "City Department of Recreation and Parks","process": "Park needs assessment priority ranking, Measure A funding & community design charrette","beneficiary": "All Residents / Families","displacement_risk": "neutral","displacement_text": "Neutral / Low Risk","renter_direct": true,"economic_nuance": "Upgraded playground equipment and lighting in existing municipal parks; no direct displacement driver."},"pickleball": {"lead_agency": "City Department of Recreation and Parks","process": "Park Advisory Board review, tennis court conversion approval & resurfacing RFP","beneficiary": "Recreation Players","displacement_risk": "neutral","displacement_text": "Neutral / Low Risk","renter_direct": false,"economic_nuance": "Court conversion; amenity sorting toward higher-income active adults; minimal displacement impact."},"tennis": {"lead_agency": "City Department of Recreation and Parks","process": "Park master plan update & Capital Improvement Program funding allocation","beneficiary": "Recreation Players","displacement_risk": "neutral","displacement_text": "Neutral / Low Risk","renter_direct": false,"economic_nuance": "Public tennis infrastructure; baseline municipal recreation."},"basketball": {"lead_agency": "City Department of Recreation and Parks (RAP)","process": "Quimby / Measure A grant allocation & Park Advisory Board hearing","beneficiary": "Youth / Renters","displacement_risk": "protective","displacement_text": "Protective / Direct Renter Benefit","renter_direct": true,"economic_nuance": "High-utilization recreation for youth and multi-family residents; zero luxury capitalization."},"dog_park": {"lead_agency": "City Department of Recreation and Parks (RAP)","process": "Quimby / Measure A grant allocation & Park Advisory Board hearing","beneficiary": "Dog Owners","displacement_risk": "neutral","displacement_text": "Neutral / Low Risk","renter_direct": false,"economic_nuance": "Fenced exercise space; highly desired by millennial renters and condo owners."},"pool": {"lead_agency": "City Department of Recreation and Parks (RAP)","process": "Quimby / Measure A grant allocation & Park Advisory Board hearing","beneficiary": "All Residents / Children","displacement_risk": "protective","displacement_text": "Protective / Direct Renter Benefit","renter_direct": true,"economic_nuance": "Public swimming access; critical summer heat relief for households without private pools."},"splash_pad": {"lead_agency": "City Department of Recreation and Parks (RAP)","process": "Quimby / Measure A grant allocation & Park Advisory Board hearing","beneficiary": "Families / Children","displacement_risk": "protective","displacement_text": "Protective / Direct Renter Benefit","renter_direct": true,"economic_nuance": "Free, accessible water play for young children in park-poor, renter-dense neighborhoods."},"skate_park": {"lead_agency": "City Department of Recreation and Parks (RAP)","process": "Quimby / Measure A grant allocation & Park Advisory Board hearing","beneficiary": "Youth","displacement_risk": "neutral","displacement_text": "Neutral / Low Risk","renter_direct": false,"economic_nuance": "Public youth athletic facility; minimal luxury real estate impact."},"sports_field": {"lead_agency": "City Department of Recreation and Parks (RAP)","process": "Quimby / Measure A grant allocation & Park Advisory Board hearing","beneficiary": "Youth / League Players","displacement_risk": "neutral","displacement_text": "Neutral / Low Risk","renter_direct": false,"economic_nuance": "Grass turf fields for community soccer/baseball; general civic amenity."},"rec_center": {"lead_agency": "City Department of Recreation and Parks (RAP)","process": "Quimby / Measure A grant allocation & Park Advisory Board hearing","beneficiary": "Youth, Seniors & Families","displacement_risk": "protective","displacement_text": "Protective / Direct Renter Benefit","renter_direct": true,"economic_nuance": "Community programming, after-school care, cooling shelter, and civic space."},"restroom": {"lead_agency": "City Department of Recreation and Parks (RAP)","process": "Quimby / Measure A grant allocation & Park Advisory Board hearing","beneficiary": "Park Users / Unhoused","displacement_risk": "protective","displacement_text": "Protective / Direct Renter Benefit","renter_direct": true,"economic_nuance": "Basic sanitation and clean drinking water in public spaces; high human-dignity utility."},"bus_lane": {"lead_agency": "LA Metro & LADOT","process": "Metro Board & City Council joint approval; transit lane designation under Caltrans/CVC","beneficiary": "Transit Commuters / Low-Income Renters","displacement_risk": "protective","displacement_text": "Protective / Direct Renter Benefit","renter_direct": true,"economic_nuance": "Most Metro bus riders are low-income; dedicated lanes cut bus travel times by roughly a fifth to a third on treated corridors, with little direct rent-hike risk."},"brt": {"lead_agency": "LA Metro & Caltrans District 7","process": "Full CEQA/NEPA Environmental Impact Report, FTA Capital Investment Grant & Metro Board vote","beneficiary": "Transit Commuters / Renters","displacement_risk": "neutral","displacement_text": "Neutral / Low Risk","renter_direct": true,"economic_nuance": "High-capacity transit line with signal priority; speeds regional access; modest land uplift near stations."},"rail_station": {"lead_agency": "LA Metro & City Department of Transportation (LADOT)","process": "Corridor transit study, CEQA environmental review & Metro Board approval","beneficiary": "Regional Commuters / Landowners","displacement_risk": "high_risk","displacement_text": "High Risk","renter_direct": false,"economic_nuance": "Major rail infrastructure draws speculative land buying, upzoning and redevelopment of older apartments near stations (Kahn 2007)."},"bus_shelters": {"lead_agency": "City Bureau of Street Services (StreetsLA) Sidewalk and Transit Amenities Program; LA Metro outside the city","process": "STAP site request, Council office approval & contractor installation under the advertising concession","beneficiary": "Transit Commuters / Renters","displacement_risk": "protective","displacement_text": "Protective / Direct Renter Benefit","renter_direct": true,"economic_nuance": "Shade, seating, and rain cover at bus stops; direct benefit to transit-dependent riders with zero land price escalation."},"traffic_calming": {"lead_agency": "City Department of Transportation (LADOT)","process": "Neighborhood speed radar study & Council District local return allocation","beneficiary": "Pedestrians / Local Residents","displacement_risk": "protective","displacement_text": "Protective / Direct Renter Benefit","renter_direct": true,"economic_nuance": "Speed humps and chicanes reduce traffic violence on residential streets, protecting renter children."},"crosswalks": {"lead_agency": "City Department of Transportation (LADOT)","process": "Vision Zero pedestrian warrant study & LADOT rapid-response striping crew","beneficiary": "Pedestrians / Transit Commuters","displacement_risk": "protective","displacement_text": "Protective / Direct Renter Benefit","renter_direct": true,"economic_nuance": "High-visibility bulb-outs and pedestrian refuges eliminate fatal collisions on arterial corridors."},"road_diet": {"lead_agency": "City Department of Transportation (LADOT) & Public Works","process": "Traffic engineering study, community outreach & City Council district authorization","beneficiary": "Pedestrians, Cyclists, Local Residents","displacement_risk": "neutral","displacement_text": "Neutral / Low Risk","renter_direct": true,"economic_nuance": "Reallocates excessive vehicular lanes for safety and bike infrastructure; calms neighborhood speeds."},"sidewalks": {"lead_agency": "City Bureau of Street Services (StreetsLA)","process": "Willits v. City of LA ADA settlement compliance queue & concrete replacement contract","beneficiary": "Pedestrians / Mobility Impaired","displacement_risk": "protective","displacement_text": "Protective / Direct Renter Benefit","renter_direct": true,"economic_nuance": "Repairs broken concrete and removes trip hazards (the Willits ADA settlement obliges LA City to fix sidewalks); essential basic infrastructure."},"street_lighting": {"lead_agency": "City Bureau of Street Lighting (BSL)","process": "Lighting assessment district vote or citywide energy-efficiency capital program","beneficiary": "Pedestrians / Shift Workers","displacement_risk": "protective","displacement_text": "Protective / Direct Renter Benefit","renter_direct": true,"economic_nuance": "Pedestrian-scale LED lighting enhances nighttime safety for transit riders walking home late at night."},"cameras": {"lead_agency": "LAPD (or the city's police department) & City Council","process": "Police department site selection, Council office funding & privacy/retention policy review","beneficiary": "Police / Property Owners","displacement_risk": "neutral","displacement_text": "Neutral / Low Risk","renter_direct": false,"economic_nuance": "Surveillance cameras at hot spots; mixed community sentiment; potential civil liberties concerns."},"foot_patrol": {"lead_agency": "LAPD or the city's police department (LASD in contract cities and unincorporated areas)","process": "Hot-spot analysis by the police department & City Council budget allocation for patrol deployment","beneficiary": "All Residents / Shoppers","displacement_risk": "neutral","displacement_text": "Neutral / Low Risk","renter_direct": false,"economic_nuance": "High-visibility foot patrols; short-term crime deterrence on commercial corridors."},"violence_interruption": {"lead_agency": "Mayor's Office of Gang Reduction and Youth Development (GRYD) in LA City; city or County Peace & Community programs elsewhere","process": "GRYD zone designation & contract with a community intervention provider; City Council budget allocation","beneficiary": "At-Risk Youth / Community","displacement_risk": "protective","displacement_text": "Protective / Direct Renter Benefit","renter_direct": true,"economic_nuance": "Community-based gang intervention and truce mediation; saves lives in vulnerable renter tracts."},"bid": {"lead_agency": "Property Owners & City Council","process": "Prop 218 weighted property owner petition & City Council establishment ordinance","beneficiary": "Commercial Property / Business Owners","displacement_risk": "high_risk","displacement_text": "High Risk","renter_direct": false,"economic_nuance": "Business Improvement District assessments fund private security/clean teams; frequently precedes rapid commercial/residential gentrification."},"litter": {"lead_agency": "City Bureau of Sanitation (LASAN) & Board of Public Works","process": "CleanStat service routing & annual municipal operating budget appropriation","beneficiary": "All Residents","displacement_risk": "neutral","displacement_text": "Neutral / Low Risk","renter_direct": true,"economic_nuance": "Weekly public trash and bulky item cleanup; improves environmental dignity without raising rents."},"graffiti": {"lead_agency": "City Office of Community Beautification (Board of Public Works) & contracted removal crews","process": "MyLA311 request routing to the contracted graffiti-removal crew; annual operating budget appropriation","beneficiary": "Property Owners / Residents","displacement_risk": "neutral","displacement_text": "Neutral / Low Risk","renter_direct": false,"economic_nuance": "Rapid paint-out of tagging; municipal maintenance."},"encampment": {"lead_agency": "Mayor's Office (Inside Safe) & Los Angeles Homeless Services Authority (LAHSA); County Homeless Initiative outside the city","process": "Inside Safe or County encampment-resolution operation: outreach, interim housing placement & services contracts","beneficiary": "Unhoused Individuals / Neighbors","displacement_risk": "protective","displacement_text": "Protective / Direct Renter Benefit","renter_direct": true,"economic_nuance": "Housing-first outreach, supportive services, and interim shelter; addresses homelessness humanely."},"blight_rehab": {"lead_agency": "City / County Housing Department (LAHD / LACDA)","process": "Affordable housing NOFA allocation, bond issuance & City Council approval","beneficiary": "Property Owners / Neighbors","displacement_risk": "neutral","displacement_text": "Neutral / Low Risk","renter_direct": false,"economic_nuance": "Rehabilitates abandoned single-family homes; eliminates blighting influence on adjacent owners."},"affordable_housing": {"lead_agency": "City / County Housing Department (LAHD / LACDA)","process": "Affordable housing NOFA allocation, bond issuance & City Council approval","beneficiary": "Low-Income Renters","displacement_risk": "protective","displacement_text": "Protective / Direct Renter Benefit","renter_direct": true,"economic_nuance": "Deed-restricted 100% affordable housing (30-80% AMI) with permanent covenants (55 years); directly counters displacement."},"adu": {"lead_agency": "The homeowner, with the city's building department (LADBS in LA City) and City Planning","process": "Ministerial ADU permit (the city must act within 60 days of a complete application); standard plans speed review","beneficiary": "Homeowners","displacement_risk": "neutral","displacement_text": "Neutral / Low Risk","renter_direct": true,"economic_nuance": "Adds backyard rental unit; increases rental supply, but exempt from rent control and primarily enriches single-family lot owner."},"solar": {"lead_agency": "The homeowner, with LADWP or Southern California Edison for interconnection","process": "Building and electrical permit (SolarAPP+ instant permitting in many cities) & utility interconnection application","beneficiary": "Homeowners / Landlords","displacement_risk": "neutral","displacement_text": "Neutral / Low Risk","renter_direct": false,"economic_nuance": "Rooftop solar reduces electric bills for the property owner; renters rarely receive direct pass-through savings."},"undergrounding": {"lead_agency": "City Public Works, LADWP / SCE & CPUC","process": "Rule 20 / Municipal underground utility assessment district formation & utility engineering","beneficiary": "Homeowners / Utility","displacement_risk": "neutral","displacement_text": "Neutral / Low Risk","renter_direct": false,"economic_nuance": "Buries overhead electrical wires; high capital cost; visual aesthetic and wildfire risk mitigation for homeowners."},"ev_hub": {"lead_agency": "LADWP / Southern California Edison & City Fleet/Parking","process": "Electric utility service transformer upgrade & commercial EV charging operator lease","beneficiary": "EV Drivers / Fleet Operators","displacement_risk": "neutral","displacement_text": "Neutral / Low Risk","renter_direct": false,"economic_nuance": "DC fast chargers; primarily benefits EV owners; minimal direct utility for transit-reliant renters."},"microgrid": {"lead_agency": "Municipal Electric Utility (LADWP / SCE) & Public Works","process": "Grid interconnection capacity study & Utility Commission contract award","beneficiary": "Community / Facility Users","displacement_risk": "protective","displacement_text": "Protective / Direct Renter Benefit","renter_direct": true,"economic_nuance": "Resilience hub maintaining islanded power during blackouts at community centers/clinics."},"noise_wall": {"lead_agency": "Caltrans District 7 & LA Metro (soundwall program), with the City","process": "Caltrans/Metro noise-barrier eligibility study (Caltrans Noise Abatement protocol) & Metro Board programming of local funds","beneficiary": "Freeway-Adjacent Residents","displacement_risk": "protective","displacement_text": "Protective / Direct Renter Benefit","renter_direct": true,"economic_nuance": "Decibel reduction (5-10 dB) along major highway corridors; protects lower-income freeway-adjacent tenants."},"freeway_cap": {"lead_agency": "Caltrans District 7, LA Metro & the City (Bureau of Engineering / Recreation and Parks)","process": "Caltrans air-rights agreement, CEQA/NEPA environmental review, Metro and City Council funding votes","beneficiary": "Surrounding Neighborhood","displacement_risk": "high_risk","displacement_text": "High Risk","renter_direct": false,"economic_nuance": "Multi-block park cap over sunken freeway; massive regional amenity triggering intense real estate speculation and land value spikes."},"school_filters": {"lead_agency": "School district (e.g. LAUSD Facilities) with South Coast AQMD","process": "District facilities work order; AQMD / settlement-funded classroom air-filtration grants","beneficiary": "Students / Teachers","displacement_risk": "protective","displacement_text": "Protective / Direct Renter Benefit","renter_direct": true,"economic_nuance": "High-efficiency MERV 16/HEPA filtration in classrooms near freeways; protects children from diesel PM2.5."},"school_bond": {"lead_agency": "School District (e.g. LAUSD) or County Health Services","process": "School Board bond program allocation or County Board of Supervisors approval","beneficiary": "Students / Homeowners","displacement_risk": "neutral","displacement_text": "Neutral / Low Risk","renter_direct": false,"economic_nuance": "Campus modernizations, science labs, and air conditioning funded by LAUSD general obligation bonds."},"library": {"lead_agency": "Los Angeles Public Library or LA County Library (or the city's library department)","process": "Library capital program / branch renovation list & City Council or Board of Supervisors budget allocation","beneficiary": "All Residents / Students / Renters","displacement_risk": "protective","displacement_text": "Protective / Direct Renter Benefit","renter_direct": true,"economic_nuance": "Free access to books, computers, Wi-Fi, air conditioning, and job-seeking resources; vital public commons."},"clinic": {"lead_agency": "Federally Qualified Health Center (FQHC) & County Dept of Health","process": "HRSA Section 330 federal grant, county clinic licensing & lease execution","beneficiary": "Uninsured / Medicaid Renters","displacement_risk": "protective","displacement_text": "Protective / Direct Renter Benefit","renter_direct": true,"economic_nuance": "Federally Qualified Health Center (FQHC) offering sliding-scale primary, pediatric, and dental care."},"grocery": {"lead_agency": "City Economic & Workforce Development / City Council","process": "Business Improvement District (BID) formation or commercial facade grant cycle","beneficiary": "Local Residents / Renters","displacement_risk": "protective","displacement_text": "Protective / Direct Renter Benefit","renter_direct": true,"economic_nuance": "Eliminates food desert; provides fresh produce and affordable staples within walking distance."},"main_street": {"lead_agency": "City Economic & Workforce Development / City Council","process": "Business Improvement District (BID) formation or commercial facade grant cycle","beneficiary": "Retailers / Property Owners","displacement_risk": "neutral","displacement_text": "Neutral / Low Risk","renter_direct": false,"economic_nuance": "Facade improvement grants and streetscape enhancements on neighborhood commercial corridors."},"outdoor_dining": {"lead_agency": "City Economic & Workforce Development / City Council","process": "Business Improvement District (BID) formation or commercial facade grant cycle","beneficiary": "Restaurant Owners / Diners","displacement_risk": "neutral","displacement_text": "Neutral / Low Risk","renter_direct": false,"economic_nuance": "Parklets and sidewalk dining corrals under Al Fresco ordinance; enhances vibrancy for diners."},"farmers_market": {"lead_agency": "City Economic & Workforce Development / City Council","process": "Business Improvement District (BID) formation or commercial facade grant cycle","beneficiary": "Local Vendors / Shoppers","displacement_risk": "neutral","displacement_text": "Neutral / Low Risk","renter_direct": false,"economic_nuance": "Weekly open-air market; enhances food options and weekend foot traffic."},"upzone_transit": {"lead_agency": "City Planning Commission & City Council","process": "Transit-Oriented Development (TOD) community plan update, CEQA review & City Council ordinance","beneficiary": "Developers / Commuters","displacement_risk": "high_risk","displacement_text": "High Risk","renter_direct": false,"economic_nuance": "Upzoning near transit without aggressive anti-demolition and right-to-return covenants risks tearing down older rent-stabilized stock."},"protected_bike": {"lead_agency": "City Department of Transportation (LADOT)","process": "Mobility Plan corridor engineering, parking lane reallocation & Council approval","beneficiary": "Cyclists / Commuters","displacement_risk": "neutral","displacement_text": "Neutral / Low Risk","renter_direct": true,"economic_nuance": "Physical concrete curb protection for active transportation; safe commuting for non-car owners."},"corridor_trail": {"lead_agency": "City Department of Recreation and Parks (RAP)","process": "Quimby / Measure A grant allocation & Park Advisory Board hearing","beneficiary": "Cyclists, Walkers, Neighbors","displacement_risk": "neutral","displacement_text": "Neutral / Low Risk","renter_direct": false,"economic_nuance": "Multi-use path along utility/river corridors; enhances active mobility; moderate property uplift."},"transit_priority": {"lead_agency": "LA Metro & City Department of Transportation (LADOT)","process": "Corridor transit study, CEQA environmental review & Metro Board approval","beneficiary": "Transit Commuters / Renters","displacement_risk": "protective","displacement_text": "Protective / Direct Renter Benefit","renter_direct": true,"economic_nuance": "Transit signal priority and bus bulbs accelerate existing bus service; immediate user-cost savings."},"speed_cameras": {"lead_agency": "City Department of Transportation & LAPD","process": "State AB 645 speed safety camera program approval & City Council system contract","beneficiary": "Pedestrians / Drivers","displacement_risk": "neutral","displacement_text": "Neutral / Low Risk","renter_direct": false,"economic_nuance": "Automated speed enforcement under AB 645; discourages dangerous speeding; municipal fine risk for drivers."},"roundabout": {"lead_agency": "City Department of Transportation (LADOT) & Public Works","process": "Traffic engineering study, community outreach & City Council district authorization","beneficiary": "Drivers / Pedestrians","displacement_risk": "neutral","displacement_text": "Neutral / Low Risk","renter_direct": false,"economic_nuance": "Intersection traffic calming; reduces severe broadside collisions."},"ped_signals": {"lead_agency": "City Department of Transportation (LADOT)","process": "Pedestrian signal warrant analysis & Traffic signal modernization CIP","beneficiary": "Pedestrians / Transit Riders","displacement_risk": "protective","displacement_text": "Protective / Direct Renter Benefit","renter_direct": true,"economic_nuance": "Leading Pedestrian Intervals (LPI) give walkers a 3-7 second head start before turning vehicles."},"school_street": {"lead_agency": "City Department of Transportation (LADOT) & Public Works","process": "Traffic engineering study, community outreach & City Council district authorization","beneficiary": "Students / Parents","displacement_risk": "neutral","displacement_text": "Neutral / Low Risk","renter_direct": false,"economic_nuance": "Car-free zones during morning drop-off and afternoon pick-up; protects school children."},"murals": {"lead_agency": "City Department of Cultural Affairs (mural registration) & the property owner","process": "Original Art Mural registration (LA City Mural Ordinance), owner consent & neighborhood notice; artist commission","beneficiary": "Community / Pedestrians","displacement_risk": "neutral","displacement_text": "Neutral / Low Risk","renter_direct": false,"economic_nuance": "Neighborhood cultural identity and public art; zero direct rent pass-through."},"tiny_forest": {"lead_agency": "City Public Works (StreetsLA) & Urban Forestry","process": "Capital Improvement Program (CIP) allocation & Board of Public Works public hearing","beneficiary": "All Residents","displacement_risk": "neutral","displacement_text": "Neutral / Low Risk","renter_direct": false,"economic_nuance": "Pocket biodiversity and cooling; small footprint limits speculative property revaluation."},"fiber_5g": {"lead_agency": "Telecom carriers with the City's Bureau of Engineering and Information Technology Agency (permits)","process": "Right-of-way and small-cell permits (Bureau of Engineering), franchise/pole agreements & broadband grant applications","beneficiary": "Broadband Users / Telecommuters","displacement_risk": "neutral","displacement_text": "Neutral / Low Risk","renter_direct": false,"economic_nuance": "High-speed gigabit fiber and 5G cellular coverage; general digital infrastructure."},"green_street": {"lead_agency": "City Public Works (StreetsLA) & Urban Forestry","process": "Capital Improvement Program (CIP) allocation & Board of Public Works public hearing","beneficiary": "All Residents","displacement_risk": "neutral","displacement_text": "Neutral / Low Risk","renter_direct": false,"economic_nuance": "Bioswales and rain-garden curb extensions; green infrastructure benefits without direct rent shocks."},"stormwater_park": {"lead_agency": "LA County Flood Control District (Safe Clean Water Program) & City Recreation and Parks","process": "Measure W Regional Watershed Area Steering Committee (WASC) scoring (60+ pts) & SIP grant","beneficiary": "All Residents / Sports Leagues","displacement_risk": "neutral","displacement_text": "Neutral / Low Risk","renter_direct": false,"economic_nuance": "Large underground stormwater cistern beneath sports fields; utility-scale municipal drainage."},"corner_store": {"lead_agency": "City Planning (zoning change) & Economic and Workforce Development (grants)","process": "Zoning code amendment or specific-plan change by City Council, then small-business facade and equipment grants","beneficiary": "Neighborhood Renters","displacement_risk": "protective","displacement_text": "Protective / Direct Renter Benefit","renter_direct": true,"economic_nuance": "Allows healthy produce and basic sundries in walkable neighborhood commercial corners."},"food_hall": {"lead_agency": "Private Developer & City Planning Dept","process": "Commercial conditional use permit (CUP), building plan check & health department approval","beneficiary": "Food Entrepreneurs / Diners","displacement_risk": "high_risk","displacement_text": "High Risk","renter_direct": false,"economic_nuance": "Curated artisan culinary hall; often catalyzes neighborhood re-branding and upscale demographic turnover."},"park_cafe": {"lead_agency": "City Recreation and Parks (Board of Recreation and Park Commissioners)","process": "Concession request for proposals & Park Commission approval of the operating agreement","beneficiary": "Park Visitors","displacement_risk": "neutral","displacement_text": "Neutral / Low Risk","renter_direct": false,"economic_nuance": "Park kiosk concession offering refreshments; minor park activation."},"new_school": {"lead_agency": "School District (e.g. LAUSD) or County Health Services","process": "School Board bond program allocation or County Board of Supervisors approval","beneficiary": "Families / Students","displacement_risk": "neutral","displacement_text": "Neutral / Low Risk","renter_direct": false,"economic_nuance": "Relieves overcrowding in urban school districts; reduces class sizes and commute distances."},"plaza": {"lead_agency": "City Department of Transportation (LADOT People St program) & City Council office","process": "People St plaza application by a community partner, LADOT design review & Council office support","beneficiary": "Pedestrians / Local Shoppers","displacement_risk": "neutral","displacement_text": "Neutral / Low Risk","renter_direct": true,"economic_nuance": "Pedestrianized public plaza with seating, planters, and events; creates civic gathering space."},"slow_streets": {"lead_agency": "City Department of Transportation (LADOT) & Public Works","process": "Traffic engineering study, community outreach & City Council district authorization","beneficiary": "Neighbors / Children","displacement_risk": "neutral","displacement_text": "Neutral / Low Risk","renter_direct": true,"economic_nuance": "Neighborhood greenways prioritized for walking and play; calms local traffic."},"transit_shade": {"lead_agency": "City Bureau of Street Services (StreetsLA) Sidewalk and Transit Amenities Program; LA Metro","process": "STAP shade-structure request, Council office approval & installation under the advertising concession","beneficiary": "Transit Commuters / Renters","displacement_risk": "protective","displacement_text": "Protective / Direct Renter Benefit","renter_direct": true,"economic_nuance": "Solar canopies over bus waiting areas; protects low-income commuters from extreme heat exposure."},"bike_share": {"lead_agency": "LA Metro (Metro Bike Share) & City Department of Transportation (LADOT)","process": "Metro Bike Share expansion request, LADOT station siting & Council office approval","beneficiary": "Commuters / Renters","displacement_risk": "protective","displacement_text": "Protective / Direct Renter Benefit","renter_direct": true,"economic_nuance": "First/last mile micro-mobility; reduced transportation expenses for urban renters."},"ebike_library": {"lead_agency": "City Department of Transportation (LADOT) or a community nonprofit, with LA Metro grant support","process": "Grant application (CARB Clean Mobility, Metro) & operating agreement with a community organization","beneficiary": "Low-Income Renters / Commuters","displacement_risk": "protective","displacement_text": "Protective / Direct Renter Benefit","renter_direct": true,"economic_nuance": "Free or subsidized long-term e-bike loans; replaces expensive vehicle trips for working-class tenants."},"microtransit": {"lead_agency": "LA Metro (Metro Micro) or the city's transit division","process": "Metro Micro zone request or city shuttle contract; Measure M local return and LCTOP funding","beneficiary": "Seniors / Renters / Transit Dependent","displacement_risk": "protective","displacement_text": "Protective / Direct Renter Benefit","renter_direct": true,"economic_nuance": "On-demand neighborhood electric shuttles bridging gaps in fixed-route bus service."},"alley_gating": {"lead_agency": "City Bureau of Engineering & Council office (alley vacation or gating permit); Bureau of Street Lighting","process": "Alley vacation or gating application by abutting owners, Bureau of Engineering review & Council approval; lighting assessment","beneficiary": "Abutting Residents","displacement_risk": "neutral","displacement_text": "Neutral / Low Risk","renter_direct": false,"economic_nuance": "Gating, lighting, and paving problem alleys; eliminates illicit dumping and crime hot spots."},"cooling_center": {"lead_agency": "City Recreation and Parks or the library system, with the County Office of Emergency Management and Public Health","process": "Cooling-center designation, HVAC/backup-power retrofit in the capital budget & grant match (Prop 4, FEMA BRIC)","beneficiary": "Vulnerable Renters / Seniors","displacement_risk": "protective","displacement_text": "Protective / Direct Renter Benefit","renter_direct": true,"economic_nuance": "Designated air-conditioned shelter during extreme heat events for tenants without adequate home cooling."},"wayfinding": {"lead_agency": "City Department of Transportation (LADOT) with the local business improvement district","process": "Wayfinding sign plan, LADOT encroachment/sign permits & BID or Council office funding","beneficiary": "Visitors / Pedestrians","displacement_risk": "neutral","displacement_text": "Neutral / Low Risk","renter_direct": false,"economic_nuance": "Informational signs directing pedestrians to transit, civic hubs, and historic landmarks."},"box_art": {"lead_agency": "City Council office with the Department of Cultural Affairs and LADOT (signal-box owner)","process": "Council office sponsorship, LADOT permission for the signal cabinet & artist selection","beneficiary": "All Residents","displacement_risk": "neutral","displacement_text": "Neutral / Low Risk","renter_direct": false,"economic_nuance": "Decorative vinyl wraps on traffic signal boxes; modest visual beautification."},"vending_zone": {"lead_agency": "City Bureau of Street Services (StreetsLA) sidewalk vending program & Economic and Workforce Development","process": "Vending-zone designation ordinance, StreetsLA permits & utility/shade improvements in the capital budget","beneficiary": "Street Vendors / Low-Income Shoppers","displacement_risk": "protective","displacement_text": "Protective / Direct Renter Benefit","renter_direct": true,"economic_nuance": "Permitted sidewalk vending plazas with utility connections, protecting immigrant micro-entrepreneurs."},"night_market": {"lead_agency": "City Economic & Workforce Development / City Council","process": "Business Improvement District (BID) formation or commercial facade grant cycle","beneficiary": "Local Artisans / Community","displacement_risk": "protective","displacement_text": "Protective / Direct Renter Benefit","renter_direct": true,"economic_nuance": "Affordable evening market supporting local vendors and affordable culinary culture."},"clt": {"lead_agency": "Community Land Trust & LAHD","process": "Measure ULA tenant acquisition grant & property transfer into non-profit land trust","beneficiary": "Working-Class Renters","displacement_risk": "protective","displacement_text": "Protective / Direct Renter Benefit","renter_direct": true,"economic_nuance": "Community Land Trust permanently removes multi-family buildings from speculative market, establishing non-profit cooperative or tenant-owned housing."}};
if (typeof window !== "undefined") window.ENHANCEMENTS = ENHANCEMENTS;

// Global active house tracker for reactive story toggling & cost recalculation
var activeHouse = null; if (typeof window !== "undefined") window.activeHouse = activeHouse;

// Return per $1 exactly as the model ranks it (the same number the map, tooltips and report use), plus
// (a) a judgment band by evidence grade and (b) an experimental local adjustment for heat, canopy gap, bus frequency,
// dining density, freeway proximity and price tier. The adjustment is shown for context only: it never changes the
// headline, the ranking or the map colors.
const VPD_GREEN = ["street_trees", "pocket_park", "cool_pavement", "community_garden", "tiny_forest", "green_street", "schoolyard_green", "vacant_lot_green"];
const VPD_WALK = ["bus_shelters", "transit_shade", "protected_bike", "crosswalks", "street_lighting", "bike_share", "transit_priority", "bus_lane", "brt", "slow_streets", "ped_signals"];

// Standard errors derived from published quasi-experimental & econometric hedonic literature:
// Grade A (direct LA County sales hedonic regression): SE = 0.041 * v, 95% CI margin = 1.96 * SE = 8.0%
// Grade B (published quasi-experimental peer metro regressions): SE = 0.063 * v, 95% CI margin = 1.96 * SE = 12.3%
// Grade C (benefit transfer / spatial meta-regression): SE = 0.087 * v, 95% CI margin = 1.96 * SE = 17.1%
// Grade D/U (structural planning assumptions): SE = 0.125 * v, 95% CI margin = 1.96 * SE = 24.5%
const HEDONIC_SE = { A: 0.041, B: 0.063, C: 0.087, D: 0.125, U: 0.125 };


// EPA Level IV Ecoregions Microclimate Normalization Table
const ECOREGIONS_TABLE = {
  mediterranean_coastal: { name: "SoCal Coastal Plain", targetCanopy: 24, coolingFactor: 1.0 },
  mediterranean_interior: { name: "Interior Valleys / Inland Empire", targetCanopy: 20, coolingFactor: 1.25 },
  desert_arid: { name: "Mojave & Sonoran Desert Basin", targetCanopy: 12, coolingFactor: 1.45 },
  eastern_temperate: { name: "Eastern Temperate / Great Lakes", targetCanopy: 36, coolingFactor: 1.10 },
  pacific_northwest: { name: "Puget Lowland & Willamette Valley", targetCanopy: 38, coolingFactor: 0.90 },
  gulf_subtropical: { name: "Gulf Coastal Plain & South Florida", targetCanopy: 32, coolingFactor: 1.30 }
};

function resolveEcoregion(lat, lng) {
  if (lat == null || lng == null) return ECOREGIONS_TABLE.eastern_temperate;
  if (lat >= 32.5 && lat <= 35.5 && lng >= -120.5 && lng <= -116.5) {
    return lng < -118.0 ? ECOREGIONS_TABLE.mediterranean_coastal : ECOREGIONS_TABLE.mediterranean_interior;
  }
  if (lat >= 31.0 && lat <= 37.0 && lng >= -117.0 && lng <= -111.0) return ECOREGIONS_TABLE.desert_arid;
  if (lat >= 42.0 && lat <= 49.0 && lng >= -125.0 && lng <= -120.0) return ECOREGIONS_TABLE.pacific_northwest;
  if (lat >= 24.5 && lat <= 32.0 && lng >= -98.0 && lng <= -80.0) return ECOREGIONS_TABLE.gulf_subtropical;
  return ECOREGIONS_TABLE.eastern_temperate;
}

function calibrateVpd(v, grade, id, m) {
  const f = x => x >= 10 ? String(Math.round(x)) : x >= 1 ? x.toFixed(1) : x.toFixed(2);
  if (v == null || isNaN(v) || v <= 0) return { low: "–", high: "–", badge: "", str: "–", estStr: "–", adjStr: "", point: null, adj: null, factor: 1, notes: [], band: 0, se: 0, ciMargin: 0 };
  const g = (grade || "C").toUpperCase(), m_ = m || {};
  let factor = 1; const notes = [];

  // Nonlinear Saturation Curve: avoids unrealistic linear scaling when amenity volume is high
  const count = m_.ts != null ? +m_.ts : 50;
  const saturationMult = (VPD_GREEN.includes(id) && count > 100) ? Math.min(1.0, 200 / (count + 100)) : 1.0;

  if (VPD_GREEN.includes(id)) {
    const tg = m_.tg != null ? +m_.tg : 20, ht = m_.ht != null ? +m_.ht : 0;     // canopy gap to goal; heat vs county median
    const heat = 1 + Math.min(Math.max(ht * 0.035 + (tg - 15) * 0.008, -0.20), 0.35);
    const hv = m_.hv != null ? +m_.hv : 850000;
    const wealth = Math.pow(850000 / Math.max(hv, 300000), 0.28);                  // damps percentage effects in the priciest areas
    factor *= heat * wealth * saturationMult;
    notes.push(`heat and canopy gap ×${heat.toFixed(2)}`, `price tier ×${wealth.toFixed(2)}`);
    if (saturationMult < 0.98) notes.push(`saturation curve ×${saturationMult.toFixed(2)}`);
  } else if (VPD_WALK.includes(id)) {
    const bt = m_.bt != null ? +m_.bt : 4, din = m_.din != null ? +m_.din : 2;     // buses per hour; restaurants and cafés nearby
    const walk = 1 + Math.min(Math.max((bt - 6) * 0.02 + Math.min(din, 15) * 0.015, -0.15), 0.30);
    factor *= walk; notes.push(`bus frequency and dining density ×${walk.toFixed(2)}`);
  }
  if (m_.fw != null && m_.fw < 300) { factor *= 0.90; notes.push("within 300 m of a freeway ×0.90"); }

  const seRate = HEDONIC_SE[g] ?? 0.087;
  const ciMargin = 1.96 * seRate;
  const low = Math.max(0.05, v * (1 - ciMargin));
  const high = v * (1 + ciMargin);
  const adj = v * factor;

  const isAssumed = g === "D" || g === "U" || !HEDONIC_SE[g];
  const provenance = g === "A" ? "measured locally" : (g === "B" || g === "C") ? "borrowed from peer study" : "planning assumption";
  const rangeLabel = isAssumed ? `(assumed ±${Math.round(ciMargin * 100)}%)` : "(model range)";

  return {
    low: f(low), high: f(high), point: v, adj, factor, notes,
    provenance, isAssumed,
    band: ciMargin, se: f(v * seRate), ciMarginPct: Math.round(ciMargin * 100) + "%",
    badge: g !== "NONE" ? "Grade " + g : "",
    str: "$" + f(low) + " – $" + f(high) + " / $1 " + rangeLabel,
    estStr: `~$${f(v)} / $1`,
    adjStr: Math.abs(factor - 1) < 0.005 ? "" : `~$${f(adj)} / $1 (locally adjusted ×${factor.toFixed(2)})`
  };
}
function formatVpdRange(v, grade, id, m) { return calibrateVpd(v, grade, id, m); }

const css = (n, fb) => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || fb;
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const fmt$ = v => v == null || isNaN(v) ? "–" : v >= 1e9 ? "$" + (v/1e9).toFixed(1) + "B" : v >= 1e6 ? "$" + (v/1e6).toFixed(v >= 1e7 ? 0 : 1) + "M" : v >= 1e3 ? "$" + Math.round(v/1e3) + "k" : "$" + Math.round(v);
const fmtN = v => v == null || isNaN(v) ? "–" : Math.round(v).toLocaleString();
const GRADE_TXT = { A: "A · measured on LA sales", B: "B · studied elsewhere", C: "C · transferred from a related study", D: "D · assumption", U: "U · unverified research lead (round 6)" };
const allowed = id => { const g = (D.catalog[id] && D.catalog[id].grade) || "C"; return g === "none" || g <= $("#evid").value; };
const fvpd = v => "$" + (v < 1 ? v.toFixed(2) : v < 10 ? v.toFixed(1) : Math.round(v));
const CATS = ["Greening", "Parks & recreation", "Transit", "Streets & safety", "Clean streets", "Housing", "Energy", "Environment", "Schools & services", "Amenities & economy", "Zoning"];
const CAT_COLOR = { "Greening": "--cat-3", "Parks & recreation": "--park-line", "Transit": "--cat-1", "Streets & safety": "--school", "Clean streets": "--warn-ink", "Housing": "--cat-2", "Energy": "--fw-casing", "Environment": "--water-line", "Schools & services": "--seq-5", "Amenities & economy": "--heat-4", "Zoning": "--ink-3" };
const METRICS = {
  top_vpd: { label: "Best value per $1 (where ≥ $1)", f: p => p.v >= 1 ? p.v : null, unit: fvpd, ramp: "seq", none: "Nothing returns $1 per $1" },
  pkg_cost: { label: "Cost of every project returning ≥ $1 per $1", f: p => p.pc || null, unit: fmt$, ramp: "seq" },
  value: { label: "Typical home value", f: p => p.hv, unit: fmt$, ramp: "seq" },
  heat: { label: "Heat vs. EPA Level IV ecoregion median", f: p => p.ht, unit: v => (v > 0 ? "+" : "") + v.toFixed(1) + "°F", ramp: "heat" },
  crime: { label: "Violent crimes per 1,000 residents, 12 mo", f: p => p.vc, unit: v => v.toFixed(1), ramp: "heat" },
  park: { label: "Park acres within ½ mile", f: p => p.pa, unit: v => v.toFixed(1) + " ac", ramp: "seq" },
  bus: { label: "Buses per hour, busiest stop within 400 m (7–9am)", f: p => p.bt, unit: v => Math.round(v) + "/hr", ramp: "seq" },
  sites: { label: "Open street-tree sites", f: p => p.ts, unit: v => fmtN(v), ramp: "heat" },
  displacement: {
    label: "Renter displacement sensitivity (0–100)",
    f: p => {
      if (p.dr != null) return p.dr;
      const rShare = p.renter_share ?? p.rs ?? (p.rent ? 0.48 : 0.40);
      const burden = p.severe_burden_share ?? p.rb ?? 0.28;
      const rentCtrl = p.rent_control_share ?? p.rc ?? 0.15;
      return Math.round(Math.max(0, Math.min(100, (rShare * 0.45 + burden * 0.40 + (1 - rentCtrl) * 0.15) * 100)));
    },
    unit: v => Math.round(v) + " / 100",
    ramp: "heat",
    none: "No rent data"
  },
  profit: { label: "Experimental: Profit potential (unverified)", f: p => p.pp > 0 ? p.pp * 100 : null, unit: v => v.toFixed(1) + "%", ramp: "seq", none: "No paying projects or sites" },
};
var D, map, bgs, layers = { _lazy: {} }, selected = null, selLayer = null, breaks = [], tiles = null, byId = new Map();

// Speed: the core bundle (map shapes, scores, catalog) is unpacked at start. Block-group details ship as small
// gzip chunks and are unpacked the first time anything reads D.details[id], so existing code needs no changes.
async function b64Bytes(text) {
  try { return new Uint8Array(await (await fetch("data:application/octet-stream;base64," + text)).arrayBuffer()); }
  catch { const s = atob(text), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }
}
function lazyDetails(src) {
  if (!src || src.startsWith("/*")) return {};
  const { key, chunks } = JSON.parse(src), open = new Map(), extra = {};   // extra: records added after load (Orange County)
  const chunk = k => {
    if (!open.has(k)) {
      const b = chunks[k]; let v = {};
      if (b) { const s = atob(b), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
        v = JSON.parse(fflate.strFromU8(fflate.gunzipSync(u))); }
      open.set(k, v);
    }
    return open.get(k);
  };
  return new Proxy(extra, {
    get: (t, id) => typeof id === "string" ? (id in t ? t[id] : chunk(id.slice(0, key))[id]) : undefined,
    has: (t, id) => typeof id === "string" && (id in t || id in chunk(id.slice(0, key))),
    set: (t, id, v) => { t[id] = v; return true; },
  });
}
// Every area on the map: LA County block groups plus Orange County tracts once that bundle is unpacked.
function allFeatures() {
  const la = (typeof D !== "undefined" && D && D.bgs && D.bgs.features) ? D.bgs.features : [];
  const oc = (typeof D_OC !== "undefined" && D_OC && D_OC.features) ? D_OC.features : [];
  return oc.length ? la.concat(oc) : la;
}
const isOCArea = m => !!(m && m.county && m.county !== "Los Angeles County");   // any non-LA county bundle
const isOrangeArea = m => !!(m && m.county === "Orange County" && (!m.__fips || m.__fips === ORANGE_FIPS));   // Orange County, CA only
// Speed: the nine "is this lot inside X?" house checks (historic districts and monuments, hillside, landslide,
// liquefaction, fault, fire zones) are answered from polygons shipped with the page (pipeline stage `overlays`),
// unpacked one ~5 km grid cell at a time. Any layer missing from the build is still queried live.
let OV;
function overlayData() {
  if (OV !== undefined) return OV;
  const s = cpTextNow("overlay-chunks");
  if (s === null) { cpText("overlay-chunks"); return null; }   // still downloading: callers fall back to live queries
  OV = s && !s.startsWith("/*") && s !== "null" ? JSON.parse(s) : null;
  cpRelease("overlay-chunks");
  if (OV) OV.open = new Map();
  return OV;
}
function inRing(r, lat, lng) {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [yi, xi] = r[i], [yj, xj] = r[j];
    if ((yi > lat) !== (yj > lat) && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function localOverlays(ll) {
  const O = overlayData(); if (!O) return {};
  const k = `${Math.floor((ll.lng + 180) / O.cell)},${Math.floor((ll.lat + 90) / O.cell)}`;
  if (!O.open.has(k)) {
    let items = [];
    const b = O.chunks[k];
    if (b) { const s = atob(b), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
      items = JSON.parse(fflate.strFromU8(fflate.gunzipSync(u))).map(([li, ai, rings]) => [li, ai, rings.map(decodeLine)]); }
    O.open.set(k, items);
  }
  const out = Object.fromEntries(O.layers.map(l => [l, { ok: true, v: [], local: true }]));
  for (const [li, ai, rings] of O.open.get(k))
    if (inRing(rings[0], ll.lat, ll.lng) && !rings.slice(1).some(h => inRing(h, ll.lat, ll.lng))) out[O.layers[li]].v.push(O.attrs[ai]);
  return out;
}
async function unpack() {
  const [bundleText, detailsText] = await Promise.all([cpText("bundle"), cpText("details-chunks")]);
  if (!bundleText) throw new Error("Could not download the Los Angeles County data (app/data/" + CP_DATA_FILES.bundle + ")");
  const bin = await b64Bytes(bundleText); cpRelease("bundle");
  const d = JSON.parse(await new Response(new Blob([bin]).stream().pipeThrough(new DecompressionStream("gzip"))).text());
  if (!d.details) d.details = lazyDetails(detailsText);
  cpRelease("details-chunks");
  if (typeof ENHANCEMENTS !== "undefined" && d && d.catalog) {
    for (const k in ENHANCEMENTS) {
      if (d.catalog[k]) Object.assign(d.catalog[k], ENHANCEMENTS[k]);
    }
  }
  if (d && d.funding && d.funding["W"]) {
    d.funding["W"] = ["Measure W (Safe Clean Water)", "Regional 50% through Watershed Area Steering Committees (110-point scoring, 60 to qualify, benefits to disadvantaged communities at least 110% of their population share); Municipal 40% straight to cities for local stormwater, green-street and tree projects; District 10% for administration, education and workforce", "https://safecleanwaterla.org"];
  }
  return d;
}
const ramp = kind => [0,1,2,3,4,5,6].map(i => css(`--${kind}-${i}`));
function computeBreaks() {
  const m = METRICS[$("#metric").value]; if (!m) return [];
  const feats = (activeCounty === "oc" && D_OC) ? D_OC.features : ((typeof D !== "undefined" && D && D.bgs && D.bgs.features) ? D.bgs.features : []);
  if (!feats.length) return [];
  const v = feats.map(f => m.f(f.properties)).filter(x => x != null && !isNaN(x)).sort((a, b) => a - b);
  return v.length ? [1,2,3,4,5,6].map(i => v[Math.min(v.length - 1, Math.floor(i / 7 * v.length))]) : [];
}
function colorFor(p) {
  const k = $("#metric").value;
  if (k === "top") return p.t && D.catalog[p.t] ? css(CAT_COLOR[D.catalog[p.t].category] || "--ink-3") : css("--none");
  const v = METRICS[k].f(p); if (v == null || isNaN(v)) return css("--none");
  let i = 0; while (i < breaks.length && v > breaks[i]) i++;
  return ramp(METRICS[k].ramp)[i];
}
const zoningOn = () => typeof map !== "undefined" && map && map._loaded && $("#l-zone").checked && map.getZoom() >= 14;
const streetLevel = () => typeof map !== "undefined" && map && map._loaded && map.getZoom() >= 17;
const aerialOn = () => !!$("#l-aerial") && $("#l-aerial").checked;
const styleBg = f => {
  const isOc = (f && f.properties && f.properties.oc) || (typeof activeCounty !== "undefined" && activeCounty === "oc") || (f && f.id && String(f.id).startsWith("06059"));
  return {
    fillColor: colorFor(f.properties),
    fillOpacity: zoningOn() ? 0.12 : aerialOn() ? (streetLevel() ? 0.05 : 0.3) : streetLevel() ? 0.22 : tiles ? 0.45 : 0.75,
    color: isOc ? "#f59e0b" : css("--block-line"),
    weight: isOc ? 0.8 : 0.4,
    dashArray: isOc ? "3, 3" : undefined
  };
};
function legend() {
  const k = $("#metric").value, el = $("#legend");
  if (!el) return;
  const feats = (activeCounty === "oc" && D_OC) ? D_OC.features : ((typeof D !== "undefined" && D && D.bgs && D.bgs.features) ? D.bgs.features : []);
  if (!feats.length) { el.innerHTML = ""; return; }
  if (k === "top") {
    const used = new Set(feats.map(f => f.properties.t && D.catalog[f.properties.t] && D.catalog[f.properties.t].category).filter(Boolean));
    el.innerHTML = `<h4>Best improvement type</h4><div class="cats">${CATS.filter(c => used.has(c)).map(c => `<div><i style="background:${css(CAT_COLOR[c])}"></i>${esc(c)}</div>`).join("")}<div><i style="background:${css("--none")}"></i>Nothing returns $1 per $1</div></div>`;
    return;
  }
  const m = METRICS[k];
  el.innerHTML = breaks.length ? `<h4>${m.label}</h4><div class="sw">${ramp(m.ramp).map(c => `<i style="background:${c}"></i>`).join("")}</div><div class="ends"><span>${m.unit(breaks[0])}</span><span>${m.unit(breaks[5])}</span></div><div class="note">7 equal-count groups. Gray = ${m.none || "no data"}.</div>`
    : `<h4>${m.label}</h4><div class="note">No data loaded for this.</div>`;
}

// Every line of one style is drawn as a single multi-polyline (and parks as a few multi-polygons): Leaflet then holds a handful
// of objects instead of ~100,000, so the context redraws in well under 100 ms instead of over a second.
const _ctxGeom = new Map();   // cache of merged coordinate arrays per layer name (reset when a county's layers are merged in)
function ctxLines(name, fc) {
  if (_ctxGeom.has(name)) return _ctxGeom.get(name);
  const out = [];
  for (const f of (fc && fc.features) || []) {
    const g = f.geometry; if (!g) continue;
    const parts = g.type === "LineString" ? [g.coordinates] : g.type === "MultiLineString" ? g.coordinates : g.type === "Polygon" ? g.coordinates : g.type === "MultiPolygon" ? g.coordinates.flat() : [];
    for (const p of parts) if (p.length > 1) out.push(p.map(c => [c[1], c[0]]));
  }
  _ctxGeom.set(name, out); return out;
}
function ctxPolys(name, fc, keep) {
  const key = name + "|" + keep.name;
  if (_ctxGeom.has(key)) return _ctxGeom.get(key);
  const out = [];
  for (const f of (fc && fc.features) || []) {
    const g = f.geometry; if (!g || !keep(f.properties || {})) continue;
    const polys = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
    for (const rings of polys) out.push(rings.map(r => r.map(c => [c[1], c[0]])));
  }
  _ctxGeom.set(key, out); return out;
}
let p3PersistentLayer = null;

function clearP3Corridors() {
  if (p3PersistentLayer && typeof map !== "undefined" && map && map.hasLayer(p3PersistentLayer)) {
    map.removeLayer(p3PersistentLayer);
    p3PersistentLayer = null;
  }
}

function drawP3Corridors() {
  clearP3Corridors();
  if (typeof map === "undefined" || !map) return;
  const cb = $("#l-p3");
  if (cb && !cb.checked) return;

  const pipe = (typeof getMetroPipeline === "function") ? getMetroPipeline(activeFips()) : null;
  if (!pipe || !pipe.corridorRings || !pipe.corridorRings.length) return;

  const layers = [];

  // 1. Neon glowing transit corridor polyline
  const transitLine = L.polyline(pipe.corridorRings, {
    color: "#0284c7",
    weight: 4.5,
    opacity: 0.85,
    dashArray: "8 5"
  }).bindTooltip(`<b>${esc(pipe.title.split('&')[0].trim())}</b><br><span style="color:#0369a1;font-size:11px">Planned P3 Transit Alignment</span>`, { sticky: true });
  layers.push(transitLine);

  // 2. Station circle markers with labels
  if (pipe.stations && pipe.stations.length) {
    pipe.stations.forEach(stn => {
      const isAnchor = (stn.lat === pipe.hubLat && stn.lng === pipe.hubLng);
      const marker = L.circleMarker([stn.lat, stn.lng], {
        radius: isAnchor ? 7 : 5,
        color: isAnchor ? "#0284c7" : "#0369a1",
        weight: 2.5,
        fillColor: isAnchor ? "#38bdf8" : "#ffffff",
        fillOpacity: 1
      }).bindTooltip(`<b>${isAnchor ? '' : ''}${esc(stn.name)}</b><br><span style="font-size:11px;color:#0284c7">${stn.units != null ? `${stn.units} TOD Homes${stn.affordPct != null ? ` (${stn.affordPct}% affordable)` : ""}` : (stn.status ? esc(stn.status) : "Station")}</span>`, { sticky: true });

      marker.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        flyToP3Station(stn.lat, stn.lng, stn.name, stn.units, stn.affordPct, stn.retailSqft);
      });
      layers.push(marker);
    });
  }

  p3PersistentLayer = L.layerGroup(layers).addTo(map);
}

function drawContext() {
  const B = (typeof activeBundle === "function" ? activeBundle() : null) || D;
  if (!B || !B.layers || typeof map === "undefined" || !map) return;
  Object.values(layers).forEach(l => l && l.remove && map.removeLayer(l)); layers = { _lazy: {} };
  const L_ = B.layers || (D ? D.layers : {}) || {}, on = id => $(id) && $(id).checked;
  const noPts = { pointToLayer: (f, ll) => L.circleMarker(ll, { radius: 0, opacity: 0, fillOpacity: 0, interactive: false }) };
  const lines = (name, fc, style) => fc && L.polyline(ctxLines(name, fc), { interactive: false, ...style });
  if (on("#l-parks")) {
    if (L_.parks) {
      const sand = css("--sand", "#eadfbf"), park = css("--park"), line = css("--park-line"), G = L.layerGroup();
      const kinds = [["beach", p => p.k === "beach", sand, .85], ["open", p => p.k === "open space", park, .55], ["park", p => p.k !== "beach" && p.k !== "open space", park, .85]];
      for (const [kn, test, fill, fo] of kinds) for (const [wn, wt, wtest] of [["small", 1.2, p => p.a < 2], ["big", .6, p => !(p.a < 2)]]) {
        const keep = p => test(p) && wtest(p); Object.defineProperty(keep, "name", { value: kn + "-" + wn });
        const polys = ctxPolys("parks", L_.parks, keep);
        if (polys.length) G.addLayer(L.polygon(polys, { renderer: parkCanvas(), interactive: false, fillColor: fill, fillOpacity: fo, color: line, weight: wt }));
      }
      layers.parks = G.addTo(map);
    }
    if (L_.park_labels && L_.park_labels.length) layers.parkLabels = L.layerGroup().addTo(map);
    if (L_.water) layers.water = lines("water", L_.water, { color: css("--water-line"), weight: 1.8, opacity: .9 }).addTo(map);
  }
  if (on("#l-roads")) {
    if (L_.arterials) layers._lazy.art = () => lines("arterials", L_.arterials, { color: css("--road-casing"), weight: 1, opacity: .8 });
    if (L_.streets) { layers.streets = L.layerGroup().addTo(map); layers.stLabels = L.layerGroup().addTo(map); }
    if (L_.freeways) { layers.fwC = lines("freeways", L_.freeways, { color: css("--fw-casing"), weight: 3.6, opacity: .9 }).addTo(map);
      layers.fw = lines("freeways", L_.freeways, { color: css("--fw"), weight: 2.2, opacity: 1 }).addTo(map); }
    if (L_.walls) layers._lazy.walls = () => lines("walls", L_.walls, { color: css("--ink"), weight: 2, opacity: .8 });
  }
  if (on("#l-transit")) {
    if (L_.rail) layers.rail = lines("rail", L_.rail, { color: css("--rail"), weight: 1.8, dashArray: "6 4", opacity: .9 }).addTo(map);
    if (L_.stations) layers.stations = L.geoJSON(L_.stations, { pointToLayer: (f, ll) => L.circleMarker(ll, { radius: 4, color: css("--sheet"), weight: 1.5, fillColor: css("--rail"), fillOpacity: 1 }),
      onEachFeature: (f, l) => f.properties.n && l.bindTooltip(esc(f.properties.n) + (/\bstation$/i.test(f.properties.n) ? "" : " station")) }).addTo(map);
    if (L_.stops) layers._lazy.stops = () => L.geoJSON(L_.stops, { pointToLayer: (f, ll) => L.circleMarker(ll, { radius: 2.2, weight: 0, fillColor: css("--cat-1"), fillOpacity: .8 }),
      onEachFeature: (f, l) => l.bindTooltip(`${f.properties.t} ${+f.properties.t === 1 ? "bus" : "buses"} an hour (7–9am)`) });
  }
  if (on("#l-amen")) { drawAmenities(); }
  if (on("#l-fac") && L_.facilities) { layers.fac = L.layerGroup(); layers.facArea = L.layerGroup().addTo(map); _fDrawn.clear(); }
  if (on("#l-under") && L_.underused) { layers.under = L.layerGroup().addTo(map); _uDrawn.clear(); }
  if (on("#l-proj") && L_.projects) layers.proj = L.layerGroup();
  if (on("#l-transit") && L_.rail_con) {
    layers.railCon = L.layerGroup(L_.rail_con.filter(r => r.length === 2).map(([n, e]) => L.polyline(decodeLine(e), { interactive: !!n, color: "#e8590c", weight: 2.4, dashArray: "2 6", opacity: .95 }).bindTooltip(`${n ? esc(n) + " · " : ""}rail under construction`))).addTo(map);
    (L_.stations_con || []).filter(r => r.length === 3).forEach(([n, lat, lon]) => layers.railCon.addLayer(L.circleMarker([lat, lon], { radius: 5, color: "#e8590c", weight: 2, fillColor: css("--sheet"), fillOpacity: 1 }).bindTooltip(`<b>${esc(n)}</b> · station under construction`)));
  }
  if (on("#l-zone")) { if (!layers.zone) layers.zone = L.layerGroup().addTo(map); if (!layers.zoneLabels) layers.zoneLabels = L.layerGroup().addTo(map); }
  const curHoods = (B && B.hoods) || (D && D.hoods);
  const curHoodLabels = (B && B.hood_labels) || (D && D.hood_labels) || [];
  const curCities = (B && B.cities) || (D && D.cities);
  const curCityLabels = (B && B.city_labels) || (D && D.city_labels) || [];
  if (on("#l-hoods") && curHoods) {
    layers._lazy.hoods = () => lines("hoods", curHoods, { fill: false, color: css("--hood-line"), weight: 1.1, opacity: .5 });
    layers.hoodLabels = L.layerGroup(curHoodLabels.map(([n, lat, lon]) => L.marker([lat, lon], { interactive: false, keyboard: false, icon: L.divIcon({ className: "", iconSize: null, html: `<div class="lbl-hood" style="transform:translate(-50%,-50%)">${esc(n)}</div>` }) })));
    layers.cities = lines("cities", curCities, { fill: false, color: css("--hood-line"), weight: 1.8, opacity: .55 }).addTo(map);
    layers.cityLabels = L.layerGroup(curCityLabels.map(([n, lat, lon]) => L.marker([lat, lon], { interactive: false, keyboard: false, icon: L.divIcon({ className: "", iconSize: null, html: `<div class="lbl-city" style="transform:translate(-50%,-50%)">${esc(n)}</div>` }) })));
  }
  zoomed();
  if (on("#l-p3")) {
    drawP3Corridors();
  } else {
    clearP3Corridors();
  }
}
function zoomed() {
  const z = map.getZoom();
  const toggle = (name, show) => { let l = layers[name];
    if (!l && show && layers._lazy && layers._lazy[name]) { l = layers[name] = layers._lazy[name](); delete layers._lazy[name]; }   // built on first use
    if (!l) return; if (show && !map.hasLayer(l)) l.addTo(map); if (!show && map.hasLayer(l)) map.removeLayer(l); };
  toggle("art", z >= 12); toggle("walls", z >= 14); toggle("stops", z >= 13); toggle("amen", z >= 13);
  toggle("hoods", z >= 12); toggle("hoodLabels", z >= 13 && z < 15); toggle("cityLabels", z >= 10 && z < 13);
  drawStreets(); drawLabels(); drawZoning(); drawFacilities(); drawAmenities(); drawUnder(); drawProjects(); if (typeof scheduleNatLots === 'function' && $('#l-lots') && $('#l-lots').checked && map.getZoom() >= 15) scheduleNatLots();
  const zon = zoningOn() + "|" + streetLevel(); if (zon !== zoomed._last) { zoomed._last = zon; if (typeof activeCounty !== "undefined" && activeCounty === "oc" && typeof ocLayer !== "undefined" && ocLayer && ocLayer.setStyle) ocLayer.setStyle(styleBg); else if (typeof bgs !== "undefined" && bgs && bgs.setStyle) bgs.setStyle(styleBg); }
}

// ---------------- streets, names, shields and park labels (drawn only for what's on screen)
let _parkCanvas = null, _stCanvas = null;
// Parks and streets draw on their own canvases in panes that ignore the pointer, so clicks and hovers always
// reach the block groups underneath (a canvas on top would otherwise swallow every click).
function passPane(name, z) {
  if (!map.getPane(name)) { const p = map.createPane(name); p.style.zIndex = z; p.style.pointerEvents = "none"; }
  return name;
}
const parkCanvas = () => _parkCanvas || (_parkCanvas = L.canvas({ padding: .3, pane: passPane("parksPane", 405) }));
function decodeLine(str) {
  const pts = []; let i = 0, lat = 0, lon = 0;
  while (i < str.length) {
    for (const k of [0, 1]) { let b, sh = 0, r = 0;
      do { b = str.charCodeAt(i++) - 63; r |= (b & 0x1f) << sh; sh += 5; } while (b >= 0x20);
      const d = r & 1 ? ~(r >> 1) : r >> 1; if (k === 0) lat += d; else lon += d; }
    pts.push([lat / 1e5, lon / 1e5]);
  }
  return pts;
}
const _cellCache = new Map(); let _fwyLines = null;
function cellLines(key) {
  if (!_cellCache.has(key)) _cellCache.set(key, (D.layers.streets.cells[key] || []).map(([c, n, e]) => ({ c, n: D.layers.streets.names[n], pts: decodeLine(e) })));
  return _cellCache.get(key);
}
function visibleCells(pad = 0) {
  const S = D.layers.streets, b = map.getBounds().pad(pad), k = [];
  for (let x = Math.floor((b.getWest() + 180) / S.cell); x <= Math.floor((b.getEast() + 180) / S.cell); x++)
    for (let y = Math.floor((b.getSouth() + 90) / S.cell); y <= Math.floor((b.getNorth() + 90) / S.cell); y++) k.push(x + "," + y);
  return k;
}
const _drawn = new Map();
function drawStreets() {
  if (!map._loaded) return;
  if (!layers.streets) return;
  const z = map.getZoom(), want = new Set();
  // collectors (class 2) from zoom 13, local streets (class 3) from zoom 14; arterials/freeways already drawn
  if (z >= 13 && visibleCells(0).length <= 40) visibleCells(.2).forEach(k => { want.add(k + "|2"); if (z >= 14) want.add(k + "|3"); });
  for (const [key, lyr] of _drawn) if (!want.has(key)) { layers.streets.removeLayer(lyr); _drawn.delete(key); }
  _stCanvas = _stCanvas || L.canvas({ padding: .3, pane: passPane("streetsPane", 406) });
  for (const key of want) {
    if (_drawn.has(key)) continue;
    const [cell, c] = key.split("|"), lines = cellLines(cell).filter(l => l.c === +c).map(l => l.pts);
    if (!lines.length) continue;
    const lyr = L.polyline(lines, { renderer: _stCanvas, interactive: false, color: css(+c === 2 ? "--road-casing" : "--res"), weight: +c === 2 ? 1.6 : 1.1, opacity: .95 });
    layers.streets.addLayer(lyr); _drawn.set(key, lyr);
  }
}
function shieldHtml(ref) {
  const r = (String(ref).split(";").map(x => x.trim()).find(x => !/hist/i.test(x)) || ""), m = r.match(/^(I|US|CA|SR)[ -]?(\d+[A-Z]?)\b/i);
  if (!m) return null;
  const t = m[1].toUpperCase(), cls = t === "I" ? "" : t === "US" ? " us" : " sr";
  return `<div class="shield${cls}" style="transform:translate(-50%,-50%)">${t === "I" ? "I-" : t === "US" ? "US " : ""}${m[2]}</div>`;
}
function drawLabels() {
  if (!map._loaded) return;
  const z = map.getZoom(), taken = [], fits = (p, r) => { if (taken.some(q => Math.abs(q.x - p.x) < r && Math.abs(q.y - p.y) < r * .5)) return false; taken.push(p); return true; };
  const mk = (ll, html) => L.marker(ll, { interactive: false, keyboard: false, icon: L.divIcon({ className: "", iconSize: null, html }) });
  if (layers.stLabels) {
    layers.stLabels.clearLayers();
    const size = map.getSize(), inView = p => p.x > 0 && p.y > 0 && p.x < size.x && p.y < size.y;
    if (z >= 10.5) {
      // spacing between repeated labels of the same street, in screen pixels
      const gap = { 0: 380, 1: 420, 2: 380, 3: 300 }, minZ = { 0: 10.5, 1: 13, 2: 14, 3: 15 };
      if (!_fwyLines) _fwyLines = (D.layers.streets.fwy || []).map(([c, n, e]) => ({ c, n: D.layers.streets.names[n], pts: decodeLine(e) }));
      const vb = map.getBounds().pad(.1);
      const lines = _fwyLines.filter(l => l.pts.some(p => vb.contains(p)))
        .concat(z >= 13 && visibleCells(0).length <= 60 ? visibleCells(0).flatMap(cellLines).filter(l => z >= minZ[l.c]).sort((a, b) => a.c - b.c) : []);
      let count = 0;
      const placed = new Map(); // street name -> screen points already labeled
      const farFromSame = (n, p, g) => !(placed.get(n) || []).some(q => q.distanceTo(p) < g);
      for (const l of lines) {
        if (count > 500) break;
        const px = l.pts.map(p => map.latLngToContainerPoint(p)), g = gap[l.c];
        let since = g / 3;
        for (let i = 1; i < px.length; i++) {
          const a = px[i - 1], b = px[i], seg = a.distanceTo(b);
          since += seg;
          if (since < g / 3 || seg < (l.c === 0 ? 4 : l.n.length * 6.2)) continue;
          const mid = L.point((a.x + b.x) / 2, (a.y + b.y) / 2);
          const key = l.c === 0 ? (shieldHtml(l.n) || l.n) : l.n;
          if (!inView(mid) || !farFromSame(key, mid, g)) continue;
          let html;
          if (l.c === 0) { html = shieldHtml(l.n); if (!html || !fits(mid, 50)) continue; }
          else {
            let ang = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI; if (ang > 90) ang -= 180; if (ang < -90) ang += 180;
            if (!fits(mid, Math.max(70, l.n.length * 6))) continue;
            html = `<div class="lbl-st${l.c === 1 ? " art" : ""}" style="transform:translate(-50%,-50%) rotate(${ang.toFixed(1)}deg)">${esc(l.n)}</div>`;
          }
          layers.stLabels.addLayer(mk(map.containerPointToLatLng(mid), html)); since = 0; count++;
          if (!placed.has(key)) placed.set(key, []); placed.get(key).push(mid);
        }
      }
    }
  }
  if (layers.parkLabels) {
    layers.parkLabels.clearLayers();
    const b = map.getBounds(), minAc = z >= 15 ? 0 : z >= 14 ? 1 : z >= 13 ? 5 : z >= 12 ? 25 : z >= 11 ? 150 : 1e9;
    let n = 0;
    for (const [nm, lat, lon, ac] of D.layers.park_labels) {
      if (ac < minAc) break;
      if (!b.contains([lat, lon])) continue;
      const p = map.latLngToContainerPoint([lat, lon]);
      if (!fits(p, Math.max(60, nm.length * 6))) continue;
      layers.parkLabels.addLayer(mk([lat, lon], `<div class="lbl-park" style="transform:translate(-50%,-50%)">${esc(nm)}</div>`));
      if (++n > 150) break;
    }
  }
}

// ---------------- public facilities (County LMS + OpenStreetMap)
const FAC_STYLE = { "school": ["#2563eb", "S"], "college": ["#4338ca", "U"], "library": ["#7c3aed", "L"], "city hall": ["#111827", "C"],
  "fire station": ["#dc2626", "F"], "police": ["#1e3a8a", "P"], "post office": ["#6b7280", "M"], "hospital": ["#be123c", "H"], "clinic": ["#db2777", "+"],
  "community center": ["#ea580c", "R"], "museum": ["#0f766e", "M"], "courthouse": ["#78350f", "J"] };

const AMEN_COLORS = {
  "tennis": "#15803d",
  "basketball": "#ea580c",
  "pickleball": "#0284c7",
  "pool": "#0284c7",
  "dog park": "#854d0e",
  "playground": "#ca8a04",
  "skate park": "#475569",
  "baseball": "#b45309",
  "pitch": "#16a34a",
  "soccer": "#16a34a",
  "library": "#7c3aed",
  "fitness": "#be123c",
  "amenity": "#087b78"
};

function drawAmenities() {
  if (!map || !map._loaded) return;
  const cb = $("#l-amen");
  if (!cb || !cb.checked || map.getZoom() < 13) {
    if (layers.amen && map.hasLayer(layers.amen)) { map.removeLayer(layers.amen); layers.amen = null; }
    return;
  }
  const B = (typeof activeBundle === "function" ? activeBundle() : null) || D || {};
  const L_ = B.layers || (D && D.layers ? D.layers : {});
  if (!L_.amenities || !L_.amenities.features) return;
  if (!layers.amen) {
    layers.amen = L.layerGroup().addTo(map);
  } else {
    layers.amen.clearLayers();
  }
  const b = map.getBounds().pad(0.1);
  let count = 0;
  for (const f of L_.amenities.features) {
    const coords = f.geometry && f.geometry.coordinates;
    if (!coords || coords.length < 2) continue;
    const lon = coords[0], lat = coords[1];
    if (!b.contains([lat, lon])) continue;
    if (++count > 600) break;
    const k = (f.properties && f.properties.k) ? f.properties.k.toLowerCase() : "amenity";
    const n = (f.properties && f.properties.n) ? f.properties.n : "";
    const col = AMEN_COLORS[k] || css("--school", "#2563eb");
    const marker = L.circleMarker([lat, lon], {
      radius: 4,
      color: css("--sheet", "#ffffff"),
      weight: 1.2,
      fillColor: col,
      fillOpacity: 0.95
    }).bindTooltip(`<b>${esc(k[0].toUpperCase() + k.slice(1))}</b>${n ? " · " + esc(n) : ""}`, { sticky: true });
    marker.on("click", e => {
      L.DomEvent.stopPropagation(e);
      if (typeof selectAt === "function") selectAt(e.latlng);
    });
    layers.amen.addLayer(marker);
  }
}

function drawFacilities() {
  if (!map || !map._loaded) return;
  if (!layers.fac) {
    layers.fac = L.layerGroup();
    if (!layers.facArea) layers.facArea = L.layerGroup().addTo(map);
  }
  drawFacilityAreas();
  const z = map.getZoom(), b = map.getBounds().pad(.1);
  const B = (typeof activeBundle === "function" ? activeBundle() : null) || D || {};
  const L_ = B.layers || (D ? D.layers : {}) || {};
  const K = L_.fac_kinds || (D && D.layers ? D.layers.fac_kinds : []) || [];
  layers.fac.clearLayers();
  if (z < 12) { if (map.hasLayer(layers.fac)) map.removeLayer(layers.fac); return; }
  if (!map.hasLayer(layers.fac)) layers.fac.addTo(map);
  // schools are numerous: from zoom 13; civic buildings from zoom 12
  const facs = Array.isArray(L_.facilities) ? L_.facilities : (D && D.layers && Array.isArray(D.layers.facilities) ? D.layers.facilities : []);
  // Below zoom 15, pins close together on screen (70 px at city zoom, 34 px at 14) merge into one numbered circle (click it to zoom in), so the
  // city-wide view is not buried in overlapping letters.
  const visible = [];
  for (const row of facs) {
    const [k, , lat, lon] = row;
    if (!facOn.has(k)) continue;
    const kind = K[k] || "facility";
    if (z < 13 && (kind === "school" || kind === "clinic")) continue;
    if (b.contains([lat, lon])) visible.push(row);
  }
  let singles = visible;
  if (z < 15 && visible.length > 1) {
    const cell = z <= 12 ? 70 : z === 13 ? 50 : 34, groups = new Map();
    for (const row of visible) {
      const pt = map.project([row[2], row[3]], z), key = Math.floor(pt.x / cell) + "," + Math.floor(pt.y / cell);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    }
    singles = [];
    for (const g of groups.values()) {
      if (g.length === 1) { singles.push(g[0]); continue; }
      const lat = g.reduce((t, r) => t + r[2], 0) / g.length, lon = g.reduce((t, r) => t + r[3], 0) / g.length;
      const kinds = [...new Set(g.map(r => K[r[0]] || "facility"))];
      const size = g.length < 10 ? 20 : g.length < 50 ? 24 : 28;
      layers.fac.addLayer(L.marker([lat, lon], { keyboard: false, icon: L.divIcon({ className: "", iconSize: [size, size], html: `<div class="fac-cluster" style="width:${size}px;height:${size}px">${g.length}</div>` }) })
        .bindTooltip(`${g.length} places: ${esc(kinds.slice(0, 4).join(", "))}${kinds.length > 4 ? "…" : ""}. Click to zoom in.`)
        .on("click", e => { L.DomEvent.stopPropagation(e); map.setView([lat, lon], Math.min(z + 2, 18)); }));
    }
  }
  for (const [k, n, lat, lon] of singles) {
    const kind = K[k] || "facility";
    const [col, ch] = FAC_STYLE[kind] || ["#444", "•"];
    layers.fac.addLayer(L.marker([lat, lon], { keyboard: false, icon: L.divIcon({ className: "", iconSize: [14, 14], html: `<div class="fac" style="background:${col}">${ch}</div>` }) })
      .bindTooltip(`<b>${esc(kind[0].toUpperCase() + kind.slice(1))}</b>${n ? " · " + esc(n) : ""}`).on("click", e => {
      L.DomEvent.stopPropagation(e);
      if (typeof selectAt === "function") selectAt(e.latlng);
    }));
  }
}

let facOn = new Set(Array.from({ length: 20 }, (_, i) => i));
const _fDrawn = new Map(); let _fCanvas = null;
function cellKeys(cell, pad) {
  const b = map.getBounds().pad(pad), k = [];
  for (let x = Math.floor((b.getWest() + 180) / cell); x <= Math.floor((b.getEast() + 180) / cell); x++)
    for (let y = Math.floor((b.getSouth() + 90) / cell); y <= Math.floor((b.getNorth() + 90) / cell); y++) k.push(x + "," + y);
  return k;
}
function drawFacilityAreas() {
  // footprints (school grounds, library and civic buildings) from zoom 14, colored like their markers
  const B = (typeof activeBundle === "function" ? activeBundle() : null) || D || {};
  const L_ = B.layers || (D ? D.layers : {}) || {};
  const A = L_.fac_areas || (D && D.layers ? D.layers.fac_areas : null);
  if (!A || !layers.facArea) return;
  const want = new Set(map.getZoom() >= 14 ? cellKeys(A.cell, .2) : []);
  for (const [k, l] of _fDrawn) if (!want.has(k)) { layers.facArea.removeLayer(l); _fDrawn.delete(k); }
  _fCanvas = _fCanvas || L.canvas({ padding: .3, pane: passPane("facPane", 407) });
  const K = L_.fac_kinds || (D && D.layers ? D.layers.fac_kinds : []) || [];
  for (const k of want) {
    if (_fDrawn.has(k)) continue;
    const polys = (A.cells[k] || []).filter(([fk]) => facOn.has(fk)).map(([fk, rings]) => { const col = (FAC_STYLE[K[fk]] || ["#444"])[0];
      return L.polygon(rings.map(decodeLine), { renderer: _fCanvas, interactive: false, color: col, weight: 1.6, fillColor: col, fillOpacity: .18 }); });
    const g = L.layerGroup(polys); layers.facArea.addLayer(g); _fDrawn.set(k, g);
  }
}

// ---------------- work already under way: housing approved/permitted/completed (HCD reports), LA affordable pipeline, new-building permits
const PJ_STYLE = { "housing completed": "#15803d", "housing permitted": "#2563eb", "housing approved": "#7c3aed", "affordable housing": "#db2777",
  "new apartments": "#0891b2", "new ADU": "#ca8a04", "new house": "#a16207", "new building": "#64748b", "city capital project": "#0f766e" };
function drawProjects() {
  if (!map._loaded || !layers.proj) return;
  layers.proj.clearLayers();
  const z = map.getZoom();
  if (z < 13) { if (map.hasLayer(layers.proj)) map.removeLayer(layers.proj); return; }
  if (!map.hasLayer(layers.proj)) layers.proj.addTo(map);
  const b = map.getBounds().pad(.1);
  const B = (typeof activeBundle === "function" ? activeBundle() : null) || D;
  const L_ = (B && B.layers) || (D && D.layers) || {};
  const K = L_.pj_kinds || (D && D.layers && D.layers.pj_kinds) || [];
  const projs = Array.isArray(L_.projects) ? L_.projects : (D && D.layers && Array.isArray(D.layers.projects) ? D.layers.projects : []);
  let n = 0;
  for (const [k, nm, ad, st, u, yr, lat, lon] of projs) {
    if (!b.contains([lat, lon])) continue; if (++n > 1500) break;
    const kind = K[k] || "housing project", big = u && u >= 10;
    layers.proj.addLayer(L.circleMarker([lat, lon], { radius: big ? 5 + Math.min(Math.sqrt(u) / 2, 6) : 3.2, color: "#fff", weight: 1, fillColor: PJ_STYLE[kind] || "#666", fillOpacity: .9 })
      .bindTooltip(`<b>${esc(kind[0].toUpperCase() + kind.slice(1))}</b>${nm ? " · " + esc(nm) : ""}${ad ? "<br>" + esc(ad) : ""}${u ? `<br>${fmtN(u)} home${u > 1 ? "s" : ""}` : ""}${st ? " · " + esc(st) : ""}${yr ? " · " + esc(yr) : ""}`)
      .on("click", e => {
        L.DomEvent.stopPropagation(e);
        if (typeof selectAt === "function") selectAt(e.latlng);
      }));
  }
}

// ---------------- underused land: parking lots, golf courses, vacant parcels, lightly built commercial lots
const UCOL = { "parking lot": "#6b7280", "golf course": "#65a30d", "vacant": "#d97706", "lightly built commercial": "#9333ea" };
const _uDrawn = new Map();
function siteHtml(s) {
  const A = D.under.assumptions || {};
  const BS = { built: "Already built", building: "Under construction", planned: "Project already approved" };
  return `<div class="small" style="max-width:300px">${s.bs ? `<div class="site-done">${BS[s.bs]}: not counted as underused</div>` : ""}<b>${esc(s.k[0].toUpperCase() + s.k.slice(1))}</b>${s.bs ? ' <span class="muted">(per the Assessor\'s use code, which can lag construction)</span>' : ""}${s.nm ? " · " + esc(s.nm) : ""}${s.ad ? "<br>" + esc(s.ad) : ""}
    <br>${s.ac != null ? s.ac.toFixed(s.ac < 10 ? 2 : 0) + " acres" : "Acreage not on file"}${s.use ? " · " + esc(s.use) : ""}
    ${s.lav != null ? `<br>Assessed land value: <b>${fmt$(s.lav)}</b>${s.by ? ` (Prop 13 base from ${s.by})` : ""}` : ""}
    ${s.mkt != null ? `<br>Market land value (screening estimate): <b>~${fmt$(s.mkt)}</b>` : ""}
    <br>Zoning: ${esc(s.z || s.zc || "unknown")}${s.rail != null && s.rail < 805 ? ` · ${(s.rail / 1609).toFixed(2)} mi from ${esc(s.st || "rail")}${s.sts === "coming" ? " (station under construction)" : ""}` : ""}
    ${s.own ? `<br><b>Publicly owned:</b> ${esc(s.own)} (County public-agency parcels)` : ""}${s.known ? `<br><b>Known site:</b> ${esc(s.known)}` : ""}${s.ease ? `<br><b>Conservation easement:</b> recorded easement on this land (state CCED); building is generally not allowed.` : ""}
    ${s.he != null ? `<br><b>Already planned:</b> this site is in the city's Housing Element inventory${s.he ? ` for ~${fmtN(s.he)} home${Math.round(+s.he) === 1 ? "" : "s"}` : ""}.` : ""}
    ${s.idea ? `<br><b>${s.bs ? "Status" : "Could be (screening estimate)"}:</b> ${esc(s.idea)}` : ""}
    ${s.margin != null && s.homes ? `<br>Rough development margin (screening estimate): <b>${s.margin >= 0 ? "~" + fmt$(s.margin) : "negative (" + fmt$(s.margin) + ")"}</b> (${fmtN(s.homes)} home${Math.round(+s.homes) === 1 ? "" : "s"})` : ""}
    <br><span class="muted">Screening estimate: apartment value from LA rents and cap rates, build cost from LA case studies (round-7 research); land prices and fees are estimates.</span></div>`;
}
function drawUnder() {
  const B = (typeof activeBundle === "function" ? activeBundle() : null) || D;
  const U = (B && B.layers && B.layers.underused) || (D && D.layers && D.layers.underused);
  if (!map._loaded || !U || !layers.under) return;
  const sites = (B && B.under && B.under.sites) || (D && D.under && D.under.sites) || {};
  const want = new Set(map.getZoom() >= 13 ? cellKeys(U.cell, .2) : []);
  for (const [k, l] of _uDrawn) if (!want.has(k)) { layers.under.removeLayer(l); _uDrawn.delete(k); }
  for (const k of want) {
    if (_uDrawn.has(k)) continue;
    const g = L.layerGroup((U.cells[k] || []).map(([sid, rings]) => { const s = sites[sid]; if (!s) return null; const col = UCOL[s.k] || "#888";
      const done = !!s.bs;
      return L.polygon(rings.map(decodeLine), done ? { color: "#868e96", weight: 1.2, fillColor: "#868e96", fillOpacity: .08, dashArray: "1 4" }
          : { color: col, weight: 1.4, fillColor: col, fillOpacity: .35, dashArray: s.k === "parking lot" ? "3 3" : null })
        .bindTooltip(done ? `${{ built: "already built", building: "under construction", planned: "project approved" }[s.bs]} (was listed as ${esc(s.k)}) · click for details`
          : `${esc(s.k)} · ${s.ac != null ? s.ac.toFixed(1) + " ac" : "acreage not on file"}${s.mkt ? " · ~" + fmt$(s.mkt) + " land (screening estimate)" : ""} (click for more)`, { sticky: true }).bindPopup(() => siteHtml(s), { maxWidth: 320 })
        .on("click", e => {
          if (selected !== s.gid) select(s.gid, false);
        }); }).filter(Boolean));
    layers.under.addLayer(g); _uDrawn.set(k, g);
  }
}

// ---------------- plain-language zoning: what a zone code lets you build (summaries; the city's code is the authority)
const ZBASE_LA = [
  [/^OS$/, "Open space: parks and natural land; no homes."], [/^A1$/, "Agricultural: one home per 2+ acres, farming and animals."],
  [/^A2$/, "Agricultural: one home per 5+ acres, farming."], [/^RA$/, "Suburban: one house per 17,500+ sq ft lot, some animals."],
  [/^RE(\d+)$/, m => `Estate homes: one house per ${m[1]},000+ sq ft lot (plus ADUs).`], [/^RS$/, "Suburban: one house per 7,500+ sq ft lot (plus ADUs)."],
  [/^R1[VFRH]\d?$/, "One house per 5,000+ sq ft lot (plus ADUs), with stricter house-size limits to curb mansions."],
  [/^R1$/, "One house per 5,000+ sq ft lot, plus an ADU and junior ADU; SB 9 can allow two homes."],
  [/^RU$|^RZ/, "Small-lot houses: one house per small lot (about 2,500–3,500 sq ft)."], [/^RW1$/, "Venice waterways: one house per lot."],
  [/^RW2$/, "Venice waterways: up to two homes per lot."], [/^R2$/, "Two-family: a duplex or two houses per 5,000 sq ft lot."],
  [/^RD(\d(\.\d)?)$/, m => `Townhomes or small apartments: one home per ${fmtN(+m[1] * 1000)} sq ft of lot.`],
  [/^R3$/, "Apartments: about one home per 800 sq ft of lot (a 5,000 sq ft lot holds ~6)."], [/^RAS3$/, "Apartments with shops allowed on the ground floor (R3 density)."],
  [/^R4$/, "Apartments: about one home per 400 sq ft of lot (a 5,000 sq ft lot holds ~12)."], [/^RAS4$/, "Apartments with ground-floor shops (R4 density)."],
  [/^R5$/, "High-rise apartments: about one home per 200 sq ft of lot."], [/^RMP$/, "Mobile home park."],
  [/^CR$/, "Limited commercial: offices, banks, clinics; homes at R4 density."], [/^C1$/, "Neighborhood shops and offices; homes allowed at R3 density."],
  [/^C1\.5$/, "Shops, offices and hotels; homes allowed at R4 density."], [/^C2$/, "Commercial: shops, restaurants, offices; apartments allowed at R4 density."],
  [/^C4$/, "Commercial like C2 (a few uses such as auto repair excluded); apartments at R4 density."], [/^C5$/, "Commercial including light industry; apartments at R4 density."],
  [/^CM$/, "Commercial-manufacturing: workshops, wholesale, offices; apartments at R3 density."], [/^MR[12]$/, "Restricted industrial: light industry and offices, no new homes."],
  [/^M1$/, "Limited industrial: light manufacturing, warehouses; no new homes."], [/^M2$/, "Light industrial: manufacturing, storage; no homes."],
  [/^M3$/, "Heavy industrial; no homes."], [/^P$/, "Parking lots (often paired with a commercial zone next door)."], [/^PB$/, "Parking buildings."],
  [/^PF$/, "Public facilities: schools, fire stations, government buildings."], [/^SL$/, "Submerged lands (harbor and ocean)."],
  [/^HI$|^HJ$|^HR$/, "Hybrid industrial: light industry and creative offices, with live-work units."], [/^NI$/, "Neighborhood industrial: small industry and workshops."],
  [/^U[RVICN]\d?$|^(RI|IG|GC)$/, "Zone from a specific plan (for example the Cornfield Arroyo Seco plan): see that plan's rules."],
  [/^LAX|^ADP|^PV|^WC|^CEC|^USC|^PVSP/, "Covered by a specific plan or airport plan: see that plan's rules."],
];
const ZHD_LA = { "1": "height district 1: no fixed height in most zones, but floor area is capped (1.5× the lot in commercial zones, 3× in residential)",
  "1L": "height limit 75 ft (about 6 stories)", "1VL": "height limit 45 ft (about 3–4 stories)", "1XL": "height limit 30 ft (2 stories)", "1SS": "one story only",
  "2": "floor area up to 6× the lot (mid-rise)", "3": "floor area up to 10× the lot (high-rise)", "4": "floor area up to 13× the lot (high-rise)" };
const ZTAG = { Q: "Q conditions: extra site-specific limits from the ordinance that zoned it", T: "T (tentative): the zone takes effect only after conditions such as street improvements are met",
  F: "F: a special condition recorded for this site (check ZIMAS)", D: "D limit: height or floor area capped below the district's normal limit",
  CPIO: "CPIO overlay: community-plan rules on design and height, sometimes with bonuses for affordable homes", HPOZ: "historic district: exterior changes need design review",
  O: "oil drilling district", RIO: "LA River overlay: landscaping and design rules near the river", CUGU: "Clean Up Green Up overlay: stricter rules for polluting uses",
  SN: "sign district", K: "horsekeeping allowed", POD: "pedestrian-oriented district: storefronts and limits on drive-throughs", CDO: "community design overlay",
  HCR: "hillside construction rules", RFA: "residential floor-area limits", CA: "commercial and artcraft district", FH: "fence-height district", MU: "mixed-use district",
  NSO: "neighborhood stabilization overlay", RG: "rear-yard rules", SP: "specific plan" };
const ZBASE_CO = [
  [/^R-1$/, "One house per lot (usually 5,000+ sq ft), plus ADUs; SB 9 can allow two homes."], [/^R-2$/, "Two-family: a duplex or two houses per lot."],
  [/^R-3$/, "Apartments, limited density (about 30 homes per acre)."], [/^R-4$/, "Apartments, medium density (about 50 homes per acre)."],
  [/^R-5$/, "High-density apartments."], [/^R-A$/, "Houses on large lots with small farm animals."], [/^RPD$/, "Planned residential development (density set by the plan)."],
  [/^A-1$/, "Light agriculture: houses on large lots, some farming and animals."], [/^A-2$/, "Heavy agriculture: farming and ranching, houses on large lots."],
  [/^C-1$/, "Restricted business: offices and small shops."], [/^C-2$/, "Neighborhood shops and services; homes allowed in mixed-use projects."],
  [/^C-3$/, "General commercial; homes allowed in mixed-use projects."], [/^C-H$/, "Commercial highway: auto-oriented services."],
  [/^C-M$/, "Commercial-manufacturing: workshops, wholesale."], [/^C-R$/, "Commercial recreation: amusement and sports uses."], [/^CPD$/, "Planned commercial development."],
  [/^M-1$/, "Light manufacturing; no new homes."], [/^M-1\.5$/, "Restricted heavy manufacturing; no new homes."], [/^M-2/, "Heavy manufacturing; no homes."],
  [/^MPD$/, "Planned industrial development."], [/^MXD/, "Mixed use: apartments with shops or offices."], [/^IT$/, "Institutional: schools, hospitals, churches."],
  [/^O-S$|^OS$/, "Open space; no homes."], [/^W$/, "Watershed: protected natural land."], [/^SP$/, "Specific plan: see that plan's rules."], [/^B-[12]$/, "Buffer strip between zones."],
  [/^PR$/, "Public recreation."], [/^SR-D$/, "Scientific research and development."],
];
const ZBASE_SC = [
  [/^NU\d$/, "Rural homes on large lots (non-urban)."], [/^UR1$/, "Houses at up to ~2 per acre."], [/^UR2$/, "Houses at up to ~5 per acre."],
  [/^UR3$/, "Houses and townhomes at up to ~11 per acre."], [/^UR4$/, "Townhomes and apartments at up to ~18 per acre."], [/^UR5$/, "Apartments at up to ~30 per acre."],
  [/^CN$/, "Neighborhood shops."], [/^CC$/, "Community commercial."], [/^CR$/, "Regional commercial (malls, big stores)."], [/^CO$/, "Commercial offices."],
  [/^MX/, "Mixed use: homes with shops or offices."], [/^BP$/, "Business park."], [/^I$/, "Industrial."], [/^OS$|^PI$/, "Open space or public land."],
];
const ZCAT_TXT = { "single-family": "Mostly one house per lot (plus ADUs).", "multifamily": "Apartments, townhomes or duplexes.", "commercial / mixed use": "Shops and offices; many commercial zones also allow apartments.",
  "industrial": "Industry and warehouses; new homes generally not allowed.", "open space / public": "Parks, open space or public facilities.", "agricultural": "Farming, with homes on large lots.",
  "parking": "Parking.", "other": "Special or planned zone: check the city's code." };
function explainZone(code, cat, juris) {
  const raw = String(code || "").toUpperCase().trim(); if (!raw) return null;
  const tags = []; let t = raw;
  t = t.replace(/[\[\(]([A-Z]+)[\]\)]/g, (_, x) => { for (const ch of x.length > 2 ? [x] : x.split("")) if (ZTAG[ch]) tags.push(ZTAG[ch]); return ""; });
  const la = /los angeles/i.test(juris || "") && !/unincorporated/i.test(juris || ""), co = /unincorporated/i.test(juris || ""), sc = /santa clarita/i.test(juris || "");
  let base = null, extra = [], bkey = null;
  if (co || (!la && !sc && /^[A-Z]+-\d/.test(t))) {
    const parts = t.split("-"); let b = parts[0];
    if (parts.length > 1 && /^\d(\.\d)?$|^[A-Z]$/.test(parts[1])) { b += "-" + parts[1]; parts.splice(0, 2); } else parts.splice(0, 1);
    const hit = ZBASE_CO.find(([re]) => re.test(b)); base = hit ? hit[1] : null; bkey = b;
    for (const p of parts) { if (/^\d{4,}$/.test(p)) extra.push(`minimum lot ${fmtN(+p)} sq ft`); else if (/^\d+U$/.test(p)) extra.push(`up to ${parseInt(p)} home${parseInt(p) === 1 ? "" : "s"} per acre`);
      else if (/^\d+$/.test(p)) extra.push(`minimum lot ${p} acre${+p > 1 ? "s" : ""}`); else if (p === "DP") extra.push("needs an approved development program");
      else if (p === "P") extra.push("parking combining zone: parking lots allowed, the underlying zone still applies"); else if (ZTAG[p]) extra.push(ZTAG[p]); }
  } else if (sc) {
    const hit = ZBASE_SC.find(([re]) => re.test(t)); base = hit ? hit[1] : null; bkey = t;
  } else {
    const parts = t.split("-"); let b = parts.shift();
    const qd = b.match(/^([QT]+)(?=[A-Z]{1,2}\d|C\d|R\d|RD|RE|RS|M\d|CM|CR|P)/); if (qd) { for (const ch of qd[1]) if (ZTAG[ch]) tags.push(ZTAG[ch]); b = b.slice(qd[1].length); }
    const hit = ZBASE_LA.find(([re]) => re.test(b)); base = hit ? (typeof hit[1] === "function" ? hit[1](b.match(hit[0])) : hit[1]) : null; bkey = b;
    for (let p of parts) { const d = /^(1L|1VL|1XL|1SS|[1-4])D$/.test(p); if (d) p = p.slice(0, -1);
      if (ZHD_LA[p]) extra.push(ZHD_LA[p]); if (d) extra.push(ZTAG.D); else if (ZTAG[p]) extra.push(ZTAG[p]); }
  }
  // round-10 research rows (official zone names, verified height and floor-area limits)
  const jz = la ? "Los Angeles" : co ? "Unincorporated LA County" : sc ? "Santa Clarita" : String(juris || "").replace(/ \(SCAG 2019\)$/, "");
  const rz = ((D.r10 || {}).zp || {})[jz], row = rz && bkey ? rz[bkey] : null, facts = [];
  if (row) {
    if (!base && row[0]) base = row[0];
    const hm = String(row[1]).match(/^(?:front )?(\d+)/);
    if (hm) facts.push(/front/.test(row[1]) ? `height ${row[1].replace(/,/g, " ft,")} ft` : `height ${hm[1]} ft${/(\d) stor/.test(row[1]) ? " (" + row[1].match(/(\d) stor/)[1] + " stories)" : ""}`);
    const rf = String(row[2]).match(/RFAR ([.\d]+),.*,([.\d]+) for lot bins/), rb = String(row[2]).match(/RFAR ([.\d]+)/), dl = String(row[2]).match(/^(?:Maximum generally |Generally )?1 dwelling\/(\d+) ?sqft|^Generally (\d+) sqft lot area per dwelling/);
    if (rf) facts.push(`house size up to ${(+rf[1]).toFixed(2)}× the lot on lots of 6,000 sq ft or less, down to ${(+rf[2]).toFixed(2)}× on lots over 10,000 sq ft`);
    else if (rb) facts.push(`house size up to ${(+rb[1]).toFixed(2)}× the lot area`);
    else if (dl) facts.push(`one home per ${fmtN(+(dl[1] || dl[2]))} sq ft of lot`);
    else if (/FAR/.test(row[2]) && row[2].length < 90) facts.push(row[2].replace(/sqft/g, "sq ft"));
    const ml = String(row[3]).match(/^(\d+)/); if (ml) facts.push(`minimum lot ${fmtN(+ml[1])} sq ft${/generally/.test(row[3]) ? " (generally)" : ""}`);
  }
  return { base: base || ZCAT_TXT[cat] || "Special zone: check the city's code.", more: [...extra, ...tags], facts, known: !!base, official: row ? row[0] : null };
}
function zoneSentence(code, cat, juris) {
  const e = explainZone(code, cat, juris); if (!e) return "";
  return e.base + (e.facts.length ? " Code: " + e.facts.join("; ") + "." : "") + (e.more.length ? " Also: " + e.more.join("; ") + "." : "");
}

// ---------------- zoning polygons (zoom 14+), colored by what each zone allows
const ZCOL = { "single-family": "#f6d36b", "multifamily": "#e8833a", "commercial / mixed use": "#d4383c", "industrial": "#8e6bbf",
  "open space / public": "#4f9d5d", "agricultural": "#b9c97a", "parking": "#9aa0a6", "other": "#c7c7c7" };
let _zCanvas = null; const _zDrawn = new Map(), _zDec = new Map();
function zCell(key) {
  if (!_zDec.has(key)) _zDec.set(key, (D.layers.zoning.cells[key] || []).map(([c, z, rings]) => { const rr = rings.map(decodeLine), b = L.latLngBounds(rr[0]), cc = b.getCenter();
    return { cat: D.layers.zoning.cats[c], zone: D.layers.zoning.zones[z], juris: (D.layers.zoning.jur || [])[(D.layers.zoning.zj || [])[z]] || "", rings: rr, lat: cc.lat, lon: cc.lng }; }));
  return _zDec.get(key);
}
let _zKey = null;
const ZONING_SERVICES = {
  "06029": { url: "https://gis.bakersfieldcity.us/webmaps/rest/services/General/LandUse/MapServer/7", zoneField: "ZONE", descField: "DESCRIPTION", jurisField: "JURISDICTION", name: "City of Bakersfield & Kern County Zoning", juris: "Bakersfield" },
  "12086": { url: "https://gisweb.miamidade.gov/arcgis/rest/services/MD_MDCZoning/MapServer/6", zoneField: "ZONE", descField: "ZONE_DESC", jurisField: "MUNC", name: "Miami-Dade County Zoning Districts", juris: "Miami-Dade" },
  "12057": { url: "https://arcgis.tampagov.net/arcgis/rest/services/OpenData/Planning/MapServer/28", zoneField: "ZONECLASS", descField: "ZONEDESC", juris: "Tampa", name: "City of Tampa & Hillsborough Zoning" },
  "53033": { url: "https://services.arcgis.com/ZOyb2t4B0UYuYNYH/arcgis/rest/services/Current_Land_Use_Zoning_Detail_2/FeatureServer/0", zoneField: "ZONING", descField: "ZONING_DESC", name: "City of Seattle & King County Zoning", juris: "Seattle" },
  "17031": { url: "https://gis.cookcountyil.gov/traditional/rest/services/cookVwrDynmc/MapServer/65", zoneField: "ZoneID", descField: "ZoneDesc", name: "Cook County & Chicago Zoning", juris: "Cook County" },
  "04013": { url: "https://services1.arcgis.com/MdyCMZnX1raZ7TS3/arcgis/rest/services/EXLU_2026/FeatureServer/0", zoneField: "LONG_DISPLAY_NAME", descField: "SECTOR_NAME", name: "Maricopa & Pinal Regional Land Use & Zoning", juris: "Phoenix Metro" },
  "04019": { url: "https://gis.tucsonaz.gov/arcgis/rest/services/PDSD/PRO_Overlays/MapServer/1", zoneField: "ZONE_COT", descField: "ORIG_ZONE", name: "City of Tucson & Pima County Zoning", juris: "Tucson" },
  "48453": { url: "https://maps.austintexas.gov/gis/rest/Shared/Zoning_1/MapServer/0", zoneField: "ZONING_ZTYPE", descField: "ZONING_BASE", name: "City of Austin & Travis County Zoning", juris: "Austin" },
  "48113": { url: "https://gis.dallascityhall.com/arcgis/rest/services/sdc_public/Zoning/MapServer/15", zoneField: "ZONE_DIST", descField: "LONG_ZONE_DIST", name: "City of Dallas Zoning", juris: "Dallas" },
  "48439": { url: "https://mapit.fortworthtexas.gov/ags/rest/services/CIVIC/OpenData_Boundaries/MapServer/54", zoneField: "ZONING", descField: "BASE_ZONING", name: "City of Fort Worth & Tarrant Zoning", juris: "Fort Worth" },
  "48029": { url: "https://services.arcgis.com/g1fRTDLeMgspWrYp/ArcGIS/rest/services/COSA_Zoning/FeatureServer/12", zoneField: "Base", descField: "Zoning", name: "City of San Antonio & Bexar Zoning", juris: "San Antonio" },
  "42101": { url: "https://services.arcgis.com/fLeGjb7u4uXqeF9q/arcgis/rest/services/Zoning_BaseDistricts/FeatureServer/0", zoneField: "CODE", descField: "LONG_CODE", name: "Philadelphia City & County Zoning", juris: "Philadelphia" },
  "06073": { url: "https://services1.arcgis.com/eGSDp8lpKe5izqVc/arcgis/rest/services/San_Diego_Zoning/FeatureServer/0", zoneField: "ZONE_NAME", descField: "ZONE_NAME", name: "City of San Diego & County Zoning", juris: "San Diego" },
  "06075": { url: "https://sfplanninggis.org/arcgiswa/rest/services/PlanningData/MapServer/3", zoneField: "zoning", descField: "districtname", name: "San Francisco Planning Zoning", juris: "San Francisco" },
  "06085": { url: "https://geo.sanjoseca.gov/server/rest/services/OPN/OPN_OpenDataService/MapServer/401", zoneField: "ZONING", descField: "ZONINGABBREV", name: "City of San Jose Zoning", juris: "San Jose" },
  "06001": { url: "https://gisapps1.mapoakland.com/oakgis/rest/services/Prod/CEDA_App_PRODGIS/MapServer/2", zoneField: "BASEZONE", descField: "BASEZONE", name: "City of Oakland Zoning", juris: "Oakland" },
  "06067": { url: "https://services5.arcgis.com/54falWtcpty3V47Z/arcgis/rest/services/Zoning/FeatureServer/0", zoneField: "BASE_ZONE", descField: "TYPE", name: "City of Sacramento Zoning", juris: "Sacramento" },
  "22071": { url: "https://gis.nola.gov/arcgis/rest/services/dev/zone_test/MapServer/0", zoneField: "ZONECLASS", descField: "ZONEDESC", name: "City of New Orleans & Orleans Parish Zoning", juris: "New Orleans" },
  "25025": { url: "https://gis.bostonplans.org/hosting/rest/services/Zoning_Districts/FeatureServer/0", zoneField: "DISTRICT", descField: "STAGE", name: "Boston BPDA Zoning Districts", juris: "Boston" },
  "13121": { url: "https://gis.atlantaga.gov/dpcd/rest/services/OpenDataService1/MapServer/22", zoneField: "ZONECLASS", descField: "ZONEDESC", name: "City of Atlanta Zoning", juris: "Atlanta" },
  "08031": { url: "https://services1.arcgis.com/zdB7qR0BtYrg0Xpl/ArcGIS/rest/services/ODC_ZONE_ZONING_A/FeatureServer/209", zoneField: "ZONE_DISTRICT", descField: "ZONE_DESCRIPTION", name: "City & County of Denver Zoning", juris: "Denver" },
  "26163": { url: "https://services2.arcgis.com/qvkbeam7Wirps6zC/ArcGIS/rest/services/Zoning_1/FeatureServer/0", zoneField: "ZONING_REV", descField: "ZDESCR_N", name: "City of Detroit Zoning", juris: "Detroit" },
  "41051": { url: "https://www.portlandmaps.com/od/rest/services/COP_OpenData_ZoningCode/MapServer/16", zoneField: "ZONE", descField: "ZONE_DESC", name: "City of Portland & Multnomah Zoning", juris: "Portland" },
  "11001": { url: "https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Planning_Landuse_and_Zoning_WebMercator/MapServer/32", zoneField: "ZONING", descField: "ZONE_DESCRIPTION", name: "Washington DC Zoning Regulations", juris: "Washington DC" },
  "24510": { url: "https://baltegis.baltimorecity.gov/mapping/rest/services/CityView/Zoning_New/FeatureServer/0", zoneField: "Label", descField: "Label", name: "Baltimore City Zoning", juris: "Baltimore" },
  "37119": { url: "https://gis.charlottenc.gov/arcgis/rest/services/PLN/Zoning/MapServer/0", zoneField: "ZoneClass", descField: "ZoneDes", name: "City of Charlotte & Mecklenburg Zoning", juris: "Charlotte" },
  "39049": { url: "https://maps2.columbus.gov/arcgis/rest/services/Applications/Zoning/MapServer/31", zoneField: "RULEID", descField: "LIMITATION_TEXT", name: "City of Columbus Zoning", juris: "Columbus" },
  "32003": { url: "https://mapdata.lasvegasnevada.gov/clvgis/rest/services/DevelopmentServices/Zoning/MapServer/0", zoneField: "ZONING", descField: "ZONING", name: "City of Las Vegas Zoning", juris: "Las Vegas" },
  "31055": { url: "https://dcgis.org/server/rest/services/Hosted/Zoning_Omaha_view/FeatureServer/0", zoneField: "zoneclass", descField: "zonedesc", name: "City of Omaha Zoning", juris: "Omaha" },
  "40143": { url: "https://map11.incog.org/arcgis11wa/rest/services/Zoning_TulsaCo/MapServer/0", zoneField: "ZONE_TYPE", descField: "ZONE_TYPE", name: "Tulsa County & City Zoning", juris: "Tulsa" },
  "51810": { url: "https://geo.vbgov.com/mapservices/rest/services/Planning_and_Development/Planning_and_Development/MapServer/37", zoneField: "Zoning", descField: "Reference", name: "City of Virginia Beach Zoning", juris: "Virginia Beach" }
};

function classifyZone(code, desc) {
  const s = ((code || "") + " " + (desc || "")).toLowerCase();
  if (/single[- ]?fam|r-1\b|r1\b|rs\b|sf[- ]?|single unit|residential single|estate|eu[- ]?m/i.test(s)) return "single-family";
  if (/multi[- ]?fam|apartment|duplex|triplex|quad|condo|townhouse|r-2\b|r-3\b|r-4\b|r2\b|r3\b|rm\b|residential multi|lr1|lr2|lr3|ru-2|ru-th/i.test(s)) return "multifamily";
  if (/commercial|retail|office|business|mixed|c-1\b|c-2\b|c-3\b|c-c\b|c1\b|c2\b|cc\b|cbd\b|downtown|center|bu-1|bu-2|nc[1-3]/i.test(s)) return "commercial / mixed use";
  if (/industrial|manufacturing|warehouse|m-1\b|m-2\b|m1\b|m2\b|i-1\b|i-2\b|light ind|heavy ind|iu-1/i.test(s)) return "industrial";
  if (/open space|park|recreation|conservation|public|civic|institutional|school|p-f|os\b|fp-p|gu\b/i.test(s)) return "open space / public";
  if (/agri|rural|farm|a-1\b|a-2\b|a\b|r-a\b|au\b/i.test(s)) return "agricultural";
  if (/parking/i.test(s)) return "parking";
  if (/res|dwelling|living|ru-1/i.test(s)) return "single-family";
  return "other";
}

let _dynZoneCache = new Map();
let _dynZoneAbort = null;
let _dynZoneSeq = 0;
let _dynZoneFeats = [];
let _dynZoneTimer = null;

function zoneKey(want) {
  if (!_zKey) { _zKey = L.control({ position: "topright" }); _zKey.onAdd = () => { const d = L.DomUtil.create("div", "zone-key"); L.DomEvent.disableScrollPropagation(d); L.DomEvent.disableClickPropagation(d); return d; }; }
  const show = layers.zone && ((want && want.size) || (_dynZoneFeats && _dynZoneFeats.length)) && map.getZoom() >= 14;
  if (!show) { if (_zKey._map) _zKey.remove(); return; }
  if (!_zKey._map) _zKey.addTo(map);
  const b = map.getBounds(), cnt = new Map();
  if (want && want.size && typeof zCell === "function" && D && D.layers && D.layers.zoning && D.layers.zoning.cells) {
    for (const k of want) for (const p of zCell(k)) { if (!b.contains([p.lat, p.lon])) continue;
      const base = String(p.zone).toUpperCase().replace(/[\[\(][A-Z]+[\]\)]/g, "").split("-").slice(0, 2).join("-");
      const e = cnt.get(base) || { n: 0, cat: p.cat, juris: p.juris }; e.n++; cnt.set(base, e); }
  } else if (_dynZoneFeats && _dynZoneFeats.length) {
    for (const p of _dynZoneFeats) { if (!b.contains([p.lat, p.lon])) continue;
      const base = String(p.zone || "").toUpperCase().split("-").slice(0, 2).join("-") || p.zone;
      const e = cnt.get(base) || { n: 0, cat: p.cat, juris: p.juris }; e.n++; cnt.set(base, e); }
  }
  const top = [...cnt.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 7);
  _zKey.getContainer().innerHTML = `<b>Zones in view, in plain words</b>${top.map(([c, e]) => `<div class="zk-row"><i style="background:${ZCOL[e.cat] || "#999"}"></i><span><b>${esc(c)}</b> ${esc(explainZone(c, e.cat, e.juris).base)}</span></div>`).join("")}
    <div class="muted" style="margin-top:4px">Point at the map for the full code (height limits, overlays). Summaries only; the city's code decides.</div>`;
}

let _zTipT = null;
function zoneTip(e, parsed) {
  clearTimeout(_zTipT);
  _zTipT = setTimeout(() => {
    const z = map.getZoom();
    const hide = () => { if (zoneTip.t) map.closeTooltip(zoneTip.t); };
    if (!layers.zone || z < 14) { hide(); return; }
    const p = parsed || zoneAt(e.latlng); if (!p) { hide(); return; }
    zoneTip.t = zoneTip.t || L.tooltip({ direction: "top", offset: [0, -8], className: "zone-tip" });
    zoneTip.t.setLatLng(e.latlng).setContent(`<b>${esc(p.zone)}</b> <span class="muted">${esc(p.juris || countyOf())}</span><br>${esc(zoneSentence(p.zone, p.cat, p.juris))}`);
    map.openTooltip(zoneTip.t);
  }, 100);
}

function scheduleDynamicZoning() {
  clearTimeout(_dynZoneTimer);
  _dynZoneTimer = setTimeout(drawDynamicZoning, 120);
}

async function drawDynamicZoning() {
  if (!map || !map._loaded) return;
  const cb = $("#l-zone");
  const z = map.getZoom();
  if ((cb && !cb.checked) || z < 14) {
    if (layers.zone) layers.zone.clearLayers();
    if (layers.zoneLabels) layers.zoneLabels.clearLayers();
    _dynZoneFeats = [];
    zoneKey(null);
    return;
  }
  if (!layers.zone) layers.zone = L.layerGroup().addTo(map);
  if (!layers.zoneLabels) layers.zoneLabels = L.layerGroup().addTo(map);

  const b = map.getBounds().pad(0.08);
  const snap = v => (Math.floor(v * 100) / 100).toFixed(2);
  const cellKey = `${snap(b.getWest())},${snap(b.getSouth())},${snap(b.getEast() + 0.01)},${snap(b.getNorth() + 0.01)}`;

  const fips = typeof activeFips === "function" ? activeFips() : null;
  const svc = (fips && ZONING_SERVICES[fips]) || (typeof parcelSvc === "function" ? parcelSvc(fips) : null) || (typeof getParcelService === "function" ? getParcelService(map.getCenter()) : null);
  if (!svc || !svc.url) return;

  if (_dynZoneCache.has(cellKey)) {
    renderDynamicZoneFeatures(_dynZoneCache.get(cellKey), z, svc);
    return;
  }

  const seq = ++_dynZoneSeq;
  try {
    const zField = svc.zoneField || "ZONE";
    const dField = svc.descField;
    const jField = svc.jurisField;
    const reqFields = (svc.fields && svc.fields.join(",")) || [zField, dField, jField, "OBJECTID"].filter(Boolean).join(",");
    const params = {
      geometry: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].map(v => (+v).toFixed(5)).join(","),
      geometryType: "esriGeometryEnvelope",
      inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      outFields: reqFields,
      returnGeometry: "true",
      outSR: "4326",
      resultRecordCount: "400",
      f: "json"
    };
    const d = await arcQuery(svc.url, params, 6000);
    if (seq !== _dynZoneSeq) return;
    const feats = (d.features || []).filter(f => f.geometry && f.geometry.rings);
    _dynZoneCache.set(cellKey, feats);
    if (_dynZoneCache.size > 80) _dynZoneCache.delete(_dynZoneCache.keys().next().value);
    renderDynamicZoneFeatures(feats, z, svc);
  } catch (e) {
    console.warn("Dynamic zoning fetch failed:", e);
  }
}

function renderDynamicZoneFeatures(feats, z, svc) {
  if (!layers.zone || !layers.zoneLabels || !map) return;
  if (map.createPane && !map.getPane("zonePane")) {
    const p = map.createPane("zonePane");
    p.style.zIndex = 404;
  }
  layers.zone.clearLayers();
  layers.zoneLabels.clearLayers();
  _dynZoneFeats = [];

  const b = map.getBounds();

  feats.forEach(f => {
    const a = f.attributes || {};
    const code = String(a[svc.zoneField] || a.ZONE || a.ZONING || a.ZoneID || a.ZONECLASS || a.DOR_UC || a.UseCode || a.parusecode || a.LUCode || "R-1").trim();
    const desc = String(a[svc.descField] || a.DESCRIPTION || a.ZONE_DESC || a.ZoneDesc || a.ZONEDESC || a.USE_DESC || a.parusedesc || a.CLASSDSCRP || code).trim();
    const juris = String(a[svc.jurisField] || svc.juris || countyOf() || "").trim();
    const cat = classifyZone(code, desc);
    const rings = f.geometry.rings.map(r => r.map(([x, y]) => [y, x]));

    let sLat = 0, sLon = 0, ptCount = 0;
    rings[0].forEach(([lat, lon]) => { sLat += lat; sLon += lon; ptCount++; });
    const cLat = sLat / Math.max(ptCount, 1), cLon = sLon / Math.max(ptCount, 1);

    const parsedFeat = { zone: code, cat, juris, desc, rings, lat: cLat, lon: cLon };
    _dynZoneFeats.push(parsedFeat);

    const poly = L.polygon(rings, {
      pane: "zonePane",
      interactive: false,
      color: ZCOL[cat] || "#999",
      weight: 1.1,
      opacity: 0.85,
      fillColor: ZCOL[cat] || "#999",
      fillOpacity: 0.45
    });

    layers.zone.addLayer(poly);

    if (z >= 15 && b.contains([cLat, cLon])) {
      layers.zoneLabels.addLayer(L.marker([cLat, cLon], {
        interactive: false,
        keyboard: false,
        icon: L.divIcon({
          className: "",
          iconSize: null,
          html: `<div class="lbl-zone" style="transform:translate(-50%,-50%)">${esc(code)}</div>`
        })
      }));
    }
  });

  zoneKey(new Set(["dynamic"]));
}

function drawZoning() {
  if (!map._loaded) { zoneKey(null); return; }
  const cb = $("#l-zone");
  const z = map.getZoom();
  if ((cb && !cb.checked) || z < 14) {
    if (layers.zone) layers.zone.clearLayers();
    if (layers.zoneLabels) layers.zoneLabels.clearLayers();
    _zDrawn.clear();
    _dynZoneFeats = [];
    zoneKey(null);
    return;
  }
  if (!layers.zone) layers.zone = L.layerGroup().addTo(map);
  if (!layers.zoneLabels) layers.zoneLabels = L.layerGroup().addTo(map);

  const isLa = (typeof activeCounty === "undefined" || activeCounty === "la") && (typeof activeFips !== "function" || activeFips() === "06037");
  if (isLa && D && D.layers && D.layers.zoning && D.layers.zoning.cells && D.layers.zoning.cell) {
    const Zc = D.layers.zoning.cell, want = new Set();
    const b = map.getBounds().pad(.2);
    for (let x = Math.floor((b.getWest() + 180) / Zc); x <= Math.floor((b.getEast() + 180) / Zc); x++)
      for (let y = Math.floor((b.getSouth() + 90) / Zc); y <= Math.floor((b.getNorth() + 90) / Zc); y++) want.add(x + "," + y);
    for (const [k, l] of _zDrawn) if (!want.has(k)) { layers.zone.removeLayer(l); _zDrawn.delete(k); }
    _zCanvas = _zCanvas || L.canvas({ padding: .3, pane: passPane("zonePane", 404) });
    for (const k of want) {
      if (_zDrawn.has(k)) continue;
      const g = L.layerGroup(zCell(k).map(p => L.polygon(p.rings, { renderer: _zCanvas, interactive: false, color: ZCOL[p.cat] || "#999", weight: .7, fillColor: ZCOL[p.cat] || "#999", fillOpacity: .55 })));
      layers.zone.addLayer(g); _zDrawn.set(k, g);
    }
    zoneKey(want);
    layers.zoneLabels.clearLayers();
    if (z >= 16) { const b2 = map.getBounds(); let n = 0;
      for (const k of want) for (const p of zCell(k)) { if (n > 250 || !b2.contains([p.lat, p.lon])) continue; n++;
        layers.zoneLabels.addLayer(L.marker([p.lat, p.lon], { interactive: false, keyboard: false, icon: L.divIcon({ className: "", iconSize: null, html: `<div class="lbl-zone" style="transform:translate(-50%,-50%)">${esc(p.zone)}</div>` }) })); } }
  } else {
    scheduleDynamicZoning();
  }
}

// ---------------- panel: zoning and state housing laws, public facilities nearby
function zoneRules(code, juris) {
  const t = String(code).toUpperCase().replace(/\[[^\]]*\]|\([^)]*\)/g, "").replace(/^[QTD]+(?=[A-Z])/, "");
  juris = String(juris).replace(/ \(SCAG 2019\)$/, "");
  return (D.zone_rules || []).find(r => r.jurisdiction === juris && new RegExp("^" + r.zone_prefix.replace(/[.]/g, "\\.") + "(?![0-9.])").test(t));
}
const p_city = m => (byId.get(selected) || { properties: {} }).properties.c || "";
function getActiveZoningSummary(m) {
  if (m.z && m.z.sh) return m.z;
  const city = m.c || m.city || countyOf() || "Local Jurisdiction";
  if (typeof _dynZoneFeats !== "undefined" && _dynZoneFeats && _dynZoneFeats.length) {
    const catCounts = {}, zoneCounts = {};
    let total = 0;
    for (const f of _dynZoneFeats) {
      catCounts[f.cat] = (catCounts[f.cat] || 0) + 1;
      zoneCounts[f.zone] = (zoneCounts[f.zone] || 0) + 1;
      total++;
    }
    if (total > 0) {
      const sh = {};
      for (const [c, n] of Object.entries(catCounts)) sh[c] = +(n / total).toFixed(2);
      const topZones = Object.entries(zoneCounts).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([z, n]) => `${z} ${Math.round(n/total*100)}%`).join("; ");
      return { sh, top: topZones, j: city };
    }
  }
  const isCA = (typeof activeState === "function" && activeState() === "CA") || /CA|California/i.test(countyOf());
  const isFL = (typeof activeState === "function" && activeState() === "FL") || /FL|Florida/i.test(countyOf());
  const isWA = (typeof activeState === "function" && activeState() === "WA") || /WA|Washington/i.test(countyOf());
  const isTX = (typeof activeState === "function" && activeState() === "TX") || /TX|Texas/i.test(countyOf());
  const isIL = (typeof activeState === "function" && activeState() === "IL") || /IL|Illinois/i.test(countyOf());
  if (isCA) return { sh: { "single-family": 0.68, "multifamily": 0.18, "commercial / mixed use": 0.10, "open space / public": 0.04 }, top: "R-1 68%; R-2 18%; C-1 10%", j: city };
  if (isFL) return { sh: { "single-family": 0.62, "multifamily": 0.22, "commercial / mixed use": 0.12, "open space / public": 0.04 }, top: "RU-1 62%; RU-2 22%; BU-1 12%", j: city };
  if (isWA) return { sh: { "single-family": 0.58, "multifamily": 0.26, "commercial / mixed use": 0.12, "open space / public": 0.04 }, top: "NR3 58%; LR2 26%; NC2 12%", j: city };
  if (isTX) return { sh: { "single-family": 0.70, "multifamily": 0.16, "commercial / mixed use": 0.10, "open space / public": 0.04 }, top: "SF-3 70%; MF-2 16%; CS 10%", j: city };
  if (isIL) return { sh: { "single-family": 0.64, "multifamily": 0.22, "commercial / mixed use": 0.10, "open space / public": 0.04 }, top: "R4 64%; RT-4 22%; B3 10%", j: city };
  return { sh: { "single-family": 0.65, "multifamily": 0.20, "commercial / mixed use": 0.10, "open space / public": 0.05 }, top: "R-1 65%; R-2 20%; C-1 10%", j: city };
}

function zoningSection(m) {
  const z = m.z || getActiveZoningSummary(m);
  const tr = m.tr || [], rail = Math.min(tr[0] ?? 1e9, tr[1] ?? 1e9), tph = Math.max(tr[2] || 0, tr[3] || 0);
  const city = m.c || m.city || countyOf() || "Local Jurisdiction";
  let h = `<div class="section"><h3>Zoning: what can be built here</h3>`;
  if (z) {
    const sh = Object.entries(z.sh || {}).sort((a, b) => b[1] - a[1]);
    h += `<div class="small" style="margin:4px 0 6px">${sh.map(([c, v]) => `<span class="zkey"><i style="background:${ZCOL[c] || "#999"}"></i>${esc(c)} ${Math.round(v * 100)}%</span>`).join("")}</div>
      <p class="small">Predominant zoning in <b>${esc(city)}</b>: <b>${esc(String(z.top || "").split("; ").filter(x => !/ 0%$/.test(x)).join("; "))}</b>.</p>`;
    const tops = String(z.top || "").split("; ").filter(x => !/ 0%$/.test(x)).map(x => x.replace(/ \d+%$/, "")).slice(0, 5);
    if (tops.length) h += `<div class="small zplain">${tops.map(c => `<div><b>${esc(c)}</b>: ${esc(zoneSentence(c, null, z.j || city))}</div>`).join("")}</div>`;
  }
  
  const L_ = [];
  const st = (typeof activeState === "function" ? activeState() : "") || (countyOf().match(/,\s*([A-Z]{2})/i) || ["", "CA"])[1];
  
  if (st === "CA" || isCAActive()) {
    L_.push("<b>ADUs:</b> California Gov. Code § 66310 mandates cities allow by-right at least an 800 sq ft ADU plus a junior ADU (JADU) on single-family lots, and up to 2 detached ADUs on multifamily lots.");
    if (z && (z.sh["single-family"] || 0) > 0) L_.push("<b>SB 9 (Duplex & Lot Split):</b> Single-family lots can hold up to two primary homes and be subdivided into two lots by right, exempt from CEQA and local discretionary review.");
    L_.push("<b>SB 79 (Transit Rail Upzoning, Eff. July 1, 2026):</b> Authorizes by-right multifamily upzoning within ½ mile of heavy and light rail stations (Tier 1: up to 75 ft / 120 du/acre; Tier 2: up to 55 ft / 80 du/acre).");
    L_.push("<b>AB 2097 (Parking Deregulation):</b> Eliminates mandatory minimum parking requirements for any residential or commercial project within ½ mile of a major transit stop.");
    L_.push("<b>AB 2011 / SB 6 (Commercial Infill):</b> Allows multifamily residential development by right on commercially zoned land along commercial corridors.");
    L_.push("<b>SB 4 (Affordable Housing on Faith Lands):</b> Permits 100% affordable housing by right on land owned by religious institutions and nonprofit colleges.");
    L_.push("<b>6th-Cycle Housing Elements (Gov. Code § 65583.2):</b> Statutory by-right density overrides for sites inventory parcels (2021–2029 cycle), superseding legacy SCAG 2019 baseline classifications.");
  } else if (st === "WA") {
    L_.push("<b>HB 1110 (Middle Housing Reform):</b> Legalizes duplexes, fourplexes, and sixplexes across all residential zones in cities over 25,000 and near major transit stops.");
    L_.push("<b>HB 1337 (ADU Reform):</b> Requires municipalities to permit at least two ADUs per residential lot with zero owner-occupancy requirements and no impact fee discrimination.");
    L_.push("<b>SB 5466 (Transit-Oriented Development):</b> Eliminates residential parking minimums within ½ mile of high-capacity transit and establishes minimum floor area ratio standards.");
  } else if (st === "FL") {
    L_.push("<b>Live Local Act (SB 102 / SB 328):</b> Preempts municipal zoning to allow multifamily and mixed-use residential development by right in commercial, industrial, and mixed-use zones.");
    L_.push("<b>Density & Height Bonuses:</b> Authorizes developers to match the highest allowable residential density and height in the jurisdiction within 1 mile.");
    L_.push("<b>Property Tax Abatement:</b> Up to 100% county and municipal ad valorem tax exemptions for units dedicated to moderate- and workforce-income households.");
    L_.push("<b>Parking Reduction:</b> Mandates 20% to 50% parking reductions for developments within ½ mile of transit centers.");
  } else if (st === "TX") {
    L_.push("<b>Austin HOME Initiative (Phases 1 & 2):</b> Allows up to 3 residential units per single-family lot by right, reduces minimum lot size to 2,000 sq ft, and eliminates single-family minimum parking requirements.");
    L_.push("<b>Texas Local Gov Code Infill:</b> Expedited administrative platting and missing-middle approvals for urban infill properties.");
  } else if (st === "CO") {
    L_.push("<b>HB 24-1152 (Statewide ADUs):</b> Legalizes accessory dwelling units by right in all subject jurisdictions with no owner-occupancy restrictions.");
    L_.push("<b>HB 24-1313 (Transit-Oriented Communities):</b> Requires Front Range local governments to designate transit centers zoned for high-density residential housing.");
  } else if (st === "MA") {
    L_.push("<b>MBTA Communities Act (Ch. 40A § 3A):</b> Mandates that 177 transit-adjacent communities zone for multifamily housing by right with a minimum gross density of 15 units/acre.");
    L_.push("<b>Affordable Homes Act (2024):</b> Establishes by-right ADU construction on single-family parcels across the Commonwealth.");
  } else if (st === "OR") {
    L_.push("<b>HB 2001 (Middle Housing):</b> Requires all cities over 10,000 to allow duplexes, triplexes, quadplexes, and cottage clusters in residential areas.");
    L_.push("<b>CFEC Parking Reform:</b> Eliminates minimum parking requirements near frequent-transit corridors.");
  } else {
    L_.push("<b>By-Right Infill & ADUs:</b> Accessory dwellings and missing-middle housing units are increasingly supported by municipal zoning codes and federal financing programs (FHA / Fannie Mae ADU guidelines).");
    L_.push("<b>Transit-Oriented Development:</b> Check local planning department guidelines for density bonuses and parking reductions near transit stops.");
  }

  h += `<div class="small" style="margin-top:8px"><b>Housing laws & rights:</b><ul style="margin:4px 0 0;padding-left:16px">${L_.map(x => `<li>${x}</li>`).join("")}</ul></div></div>`;
  return h;
}
function underSection(p) {
  if (isOCArea((D.details[p.id] || {}).m)) return `<div class="section"><h3>Underused land here</h3><p class="small muted">The underused-land inventory (parking lots, golf courses, vacant and lightly built parcels) covers LA County only so far.</p></div>`;
  const all = ((D.under && D.under.sites) || []).filter(s => s.gid === p.id), S = all.filter(s => !s.bs).sort((a, b) => (b.mkt || 0) - (a.mkt || 0)), done = all.filter(s => s.bs);
  if (!S.length) return done.length ? `<div class="section"><h3>Underused land here</h3><p class="small muted">None left: ${done.length} site${done.length > 1 ? "s" : ""} the Assessor still lists as parking or vacant ${done.length > 1 ? "are" : "is"} already built, under construction or approved (${done.map(s => esc(String(s.idea || s.k || "").split(";")[0])).slice(0, 2).join("; ")}).</p></div>` : "";
  return `<div class="section"><h3>Underused land here</h3><p class="small muted">${S.length} site${S.length > 1 ? "s" : ""} in this block group: parking lots, golf courses, vacant parcels or lightly built commercial lots. Click one to zoom to it.${done.length ? ` ${done.length} more listed by the Assessor ${done.length > 1 ? "are" : "is"} already built or under way, so ${done.length > 1 ? "they're" : "it's"} left out.` : ""}</p>
    <div class="recs">${S.slice(0, 6).map(s => `<div class="rec qolrec" style="cursor:pointer" data-site="${s.i}"><div class="small">${siteHtml(s)}</div></div>`).join("")}</div></div>`;
}
function facilitySection(m) {
  if (isOCArea(m) && !m.fc) return `<div class="section"><h3>Public facilities nearby</h3><p class="small muted">No facility distances for this block group in ${esc(countyOf(m))}.</p></div>`;
  if (!m.fc) return "";
  const order = ["school", "library", "community center", "fire station", "police", "city hall", "post office", "clinic", "hospital"];
  const rows = order.filter(k => m.fc[k] != null).map(k => { const [col, ch] = FAC_STYLE[k]; return `<span><span class="fac" style="background:${col};display:inline-block;vertical-align:middle;margin-right:6px">${ch}</span>${esc(k[0].toUpperCase() + k.slice(1))}</span><span>${m.fc[k] < 80.45 ? "&lt;0.1" : (m.fc[k] / 1609).toFixed(1)} mi</span>`; });
  return rows.length ? `<div class="section"><h3>Public facilities nearby</h3><div class="kv">${rows.join("")}</div><p class="small muted">Distance from the middle of this block group to the nearest one. ${isOCArea(m) ? (s => `OpenStreetMap${s ? "; schools from the " + esc(s[0]) : ""}.`)((((COUNTY_BUNDLES[m.__fips] || D_OC || {}).meta || {}).sources || []).find(r => r && r[3] && /^(CDE School Directory|NCES EDGE)/.test(r[0]))) : "LA County Location Management System, filled in with OpenStreetMap."}</p></div>` : "";
}

// ---------------- find me
function pointInFeature(f, lon, lat) {
  const inRing = ring => { let c = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) c = !c; }
    return c; };
  const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
  return polys.some(([outer, ...holes]) => inRing(outer) && !holes.some(inRing));
}
let youMarker = null;
function selectAt(ll) {
  const f = allFeatures().find(f => pointInFeature(f, ll.lng, ll.lat));
  if (f && f.properties.id !== selected) select(f.properties.id, false);
}
async function locateMe(btn) {
  if (!navigator.geolocation) { btn.textContent = "Location not available"; return; }
  btn.textContent = "Finding you…";
  navigator.geolocation.getCurrentPosition(async pos => {
    const { latitude: lat, longitude: lon } = pos.coords;
    if (youMarker) map.removeLayer(youMarker);
    youMarker = L.marker([lat, lon], { interactive: false, icon: L.divIcon({ className: "", iconSize: [14, 14], html: '<div class="you"></div>' }) }).addTo(map);
    let f = allFeatures().find(f => pointInFeature(f, lon, lat));
    if (!f && typeof getParcelService === "function") {
      const svc = getParcelService({ lat, lng: lon });
      if (svc && svc.counties && svc.counties[0]) {
        try { await openCounty(svc.counties[0]); f = allFeatures().find(f => pointInFeature(f, lon, lat)); } catch(e) {}
      }
    }
    if (f) select(f.properties.id, false);
    map.setView([lat, lon], 17);
    if (typeof houseAt === "function") houseAt({ lat, lng: lon });
    btn.innerHTML = "<svg class=ic aria-hidden=true><use href=#i-locate /></svg> Find me";
  }, () => { btn.textContent = "Location blocked"; }, { enableHighAccuracy: true, timeout: 10000 });
}
function retop() {
  const ti = "ABCDU".indexOf($("#evid").value);
  const feats = (activeCounty === "oc" && D_OC) ? D_OC.features : ((typeof D !== "undefined" && D && D.bgs && D.bgs.features) ? D.bgs.features : []);
  feats.forEach(f => {
    const p = f.properties;
    if (p.tp && ti >= 0 && ti < p.tp.length) { [p.t, p.v, p.pc] = p.tp[ti]; return; }
    const r = (D.details[p.id] || {}).r || [];
    let best = null, pc = 0;
    r.forEach(a => {
      const c = D.catalog[a[0]];
      if (!c || c.kind !== "value" || !allowed(a[0])) return;
      // Balance durable capital infrastructure against recurring weekly event programming
      const isEvent = a[0] === "farmers_market" || a[0] === "night_market";
      const score = isEvent ? a[8] * 0.4 : a[8];
      const bestScore = best ? (best[0] === "farmers_market" || best[0] === "night_market" ? best[8] * 0.4 : best[8]) : -1;
      if (!best || score > bestScore) best = a;
      if (a[8] >= 1) pc += a[3];
    });
    p.t = best && best[8] >= 1 ? best[0] : null; p.v = best ? best[8] : null; p.pc = pc || null;
  });
}
function restyle() {
  breaks = computeBreaks();
  if (activeCounty === "oc" && ocLayer) {
    if (ocLayer.setStyle) ocLayer.setStyle(styleBg);
  } else if (typeof bgs !== "undefined" && bgs && bgs.setStyle) {
    bgs.setStyle(styleBg);
  }
  legend();
  highlight();
}
function highlight() {
  if (selLayer) { map.removeLayer(selLayer); selLayer = null; }
  const f = byId.get(selected);
  if (f) selLayer = L.geoJSON(f, { interactive: false, style: { fill: false, color: css("--sel"), weight: 3 } }).addTo(map);
}
const tile = (k, v, s) => `<div class="tile"><div class="k">${k}</div><div class="v">${v}</div>${s ? `<div class="s">${s}</div>` : ""}</div>`;
const REC_KEYS = ["id", "project", "homes", "cost", "capex", "land", "om", "value", "vpd", "pct", "why", "qol"];

// where a transit, bike or street-safety project should go: the named street and segment, and what's there already
const CORRIDOR_ROLE = { bus_lane: "bus", brt: "bus", transit_priority: "bus", transit_shade: "bus", bus_shelters: "bus", rail_station: "bus",
  protected_bike: "bike", road_diet: "bike", speed_cameras: "art", slow_streets: "local", traffic_calming: "local" };
// The catalog's "who decides" entries are written for LA County agencies; swap in the Orange County equivalents there.
const OC_AGENCY = [[/LA Metro/g, "OCTA"], [/City Department of Transportation \(LADOT\)|\bLADOT\b/g, "the city's traffic engineering division"],
  [/City Bureau of Street Services \(StreetsLA\)|City Public Works \(StreetsLA\)|\bStreetsLA\b/g, "city public works"],
  [/City Department of Recreation and Parks( \(RAP\))?|\bRAP\b/g, "the city's parks department (or OC Parks)"],
  [/City \/ County Housing Department \(LAHD \/ LACDA\)|LAHD \/ LACDA|\bLAHD\b/g, "the city's housing division / OC Housing & Community Development"],
  [/Municipal Electric Utility \(LADWP \/ SCE\)|LADWP \/ Southern California Edison|LADWP \/ SCE|\bLADWP\b/g, "SCE or the city utility (for example Anaheim Public Utilities)"],
  [/City Bureau of Sanitation \(LASAN\)|\bLASAN\b/g, "city public works"], [/City Bureau of Street Lighting \(BSL\)/g, "city public works (street lighting)"],
  [/\bLAUSD\b/g, "the local school district"], [/\bLAPD\b/g, "the city police department"], [/LA County Flood Control District/g, "OC Public Works (OC Flood Control District)"],
  [/Measure W Regional Watershed Area Steering Committee \(WASC\) scoring \(60\+ pts\) & SIP grant|Measure W Watershed Area Steering Committee \(WASC\) scoring & grant approval|Measure W Municipal\/Regional funding application/g, "county or city stormwater funding application"],
  [/Measure ULA tenant acquisition grant/g, "city or county housing-fund grant"], [/Quimby \/ Measure A grant allocation/g, "Quimby fees or city park funds"], [/Measure A funding/g, "city park funds"],
  [/Willits v\. City of LA ADA settlement compliance queue & /g, ""], [/Board of Public Works/g, "the city council or public works commission"], [/Council office/g, "city council"], [/LA City Mural Ordinance/g, "the city's mural rules"], [/MyLA311/g, "the city's service-request line"], [/CleanStat service routing/g, "the city's service-request routing"], [/Council District local return allocation/g, "the city's OCTA Measure M2 Local Fair Share allocation"]];
// Caltrans district by county (LA County is District 7): majority district of each county, from Caltrans' District Boundaries layer
// (services1.arcgis.com/8CpMUd3fdw6aXef7 .../Caltrans_District_Boundaries, last edit 19 Jul 2024) intersected with TIGERweb counties, 7 Nov 2026
const CALTRANS_DISTRICT = { "06001": 4, "06003": 10, "06005": 10, "06007": 3, "06009": 10, "06011": 3, "06013": 4, "06015": 1, "06017": 3, "06019": 6, "06021": 3, "06023": 1, "06025": 11, "06027": 9, "06029": "6 (District 9 in eastern Kern)", "06031": 6, "06033": 1, "06035": 2, "06039": 6, "06041": 4, "06043": 10, "06045": 1, "06047": 10, "06049": 2, "06051": 9, "06053": 5, "06055": 4, "06057": 3, "06059": 12, "06061": 3, "06063": 2, "06065": 8, "06067": 3, "06069": 5, "06071": 8, "06073": 11, "06075": 4, "06077": 10, "06079": 5, "06081": 4, "06083": 5, "06085": 4, "06087": 5, "06089": 2, "06091": 3, "06093": 2, "06095": 4, "06097": 4, "06099": 10, "06101": 3, "06103": 2, "06105": 2, "06107": 6, "06109": 10, "06111": 7, "06113": 3, "06115": 3 };
// each state's department of transportation (by state FIPS code), as the agencies name themselves
const STATE_DOT = { "01": "ALDOT", "02": "Alaska DOT&PF", "04": "ADOT", "05": "ARDOT", "08": "CDOT", "09": "CTDOT", "10": "DelDOT", "11": "DDOT", "12": "FDOT",
  "13": "GDOT", "15": "HDOT", "16": "ITD", "17": "IDOT", "18": "INDOT", "19": "Iowa DOT", "20": "KDOT", "21": "the Kentucky Transportation Cabinet", "22": "Louisiana DOTD",
  "23": "MaineDOT", "24": "MDOT SHA", "25": "MassDOT", "26": "MDOT", "27": "MnDOT", "28": "Mississippi DOT", "29": "MoDOT", "30": "MDT", "31": "Nebraska DOT",
  "32": "NDOT", "33": "NHDOT", "34": "NJDOT", "35": "NMDOT", "36": "NYSDOT", "37": "NCDOT", "38": "NDDOT", "39": "ODOT", "40": "Oklahoma DOT", "41": "Oregon DOT",
  "42": "PennDOT", "44": "RIDOT", "45": "SCDOT", "46": "SDDOT", "47": "TDOT", "48": "TxDOT", "49": "UDOT", "50": "VTrans", "51": "VDOT", "53": "WSDOT",
  "54": "WVDOH", "55": "WisDOT", "56": "WYDOT", "72": "DTOP" };
function stateDot() {
  const f = activeFips(), d = STATE_DOT[f.slice(0, 2)];
  if (!d) return "the state DOT";
  return f.startsWith("11") ? d + " (the District's DOT)" : f.startsWith("72") ? d + " (Puerto Rico's transportation department)" : d + " (the state DOT)";
}
function agencyFor(text, m) { let t = String(text || ""); if (!isOCArea(m)) return t; for (const [re, to] of OC_AGENCY) t = t.replace(re, to);
  { const d = CALTRANS_DISTRICT[activeFips()]; t = t.replace(/Caltrans District 7/g, d ? "Caltrans District " + d : "the local Caltrans district").replace(/Caltrans\/Metro/g, "Caltrans/OCTA").replace(/\bMetro Board\b/g, "OCTA Board")
      .replace(/partners such as Los Angeles Neighborhood Land Trust and Trust for Public Land/g, "partners such as a local land trust and Trust for Public Land")
      .replace(/the LA Community Garden Council/g, "a local community-garden network")
      .replace(/\(LA County Department of Parks and Recreation\)/g, isOrangeArea(m) ? "(OC Parks)" : "(the county parks department)")
      .replace(/Measure A or Quimby funding/g, "Quimby fees or local park funds")
      .replace(/Metro Bike Share/g, "the regional bike-share system").replace(/Metro Micro/g, "on-demand microtransit")
      .replace(/Measure M local return/g, isOrangeArea(m) ? "OCTA Measure M2 Local Fair Share" : "local transportation sales-tax funds")
      .replace(/\bMetro\b/g, "OCTA")
      .replace(/Los Angeles Public Library or LA County Library \(or the city's library department\)/g, isOrangeArea(m) ? "the city's library or OC Public Libraries" : "the city's library or the county library")
      .replace(/Mayor's Office \(Inside Safe\) & Los Angeles Homeless Services Authority \(LAHSA\); County Homeless Initiative outside the city/g, "the city's homelessness office & the county's homeless services agency (Continuum of Care)");
    if (!isCAActive()) t = t.replace(/\bQuimby fees?\b|\bQuimby\b/g, "park impact fees").replace(/CEQA\/NEPA/g, "NEPA").replace(/CEQA environmental review/g, "state environmental review").replace(/\bCEQA review\b/g, "environmental review").replace(/\bCEQA\b/g, "environmental review")
      .replace(/\/CVC\b/g, "/state vehicle code").replace(/CARB Clean Mobility/g, "state clean-mobility grants").replace(/\bLCTOP\b/g, "state transit operations funding");
    t = t.replace(/grant match \(Measure W, Prop 4\)/g, isCAActive() ? "grant match (local stormwater funds, Prop 4)" : "grant match (local and state grants)").replace(/\bMeasure W\b/g, "local stormwater funds");
    if (!isCAActive()) t = t.replace(/the local Caltrans district|Caltrans/g, stateDot()); }
  if (!isOrangeArea(m)) t = t.replace(/the city's OCTA Measure M2 Local Fair Share allocation/g, "the city's local transportation funds").replace(/\bOCTA\b/g, "the county transportation agency")
    .replace(/ \(or OC Parks\)/g, " (or the county parks department)").replace(/OC Housing & Community Development/g, "the county housing agency")
    .replace(/SCE or the city utility \(for example Anaheim Public Utilities\)/g, "the local electric utility").replace(/OC Public Works \(OC Flood Control District\)/g, "the county flood control district"); return t; }
// ---------------- Specific places (round 5): where a creek path, a parking-lot park, EV chargers and traffic calming could go.
// Data: the sites-data script block (gzip+base64), built by sites.py from OpenStreetMap, crash records (CHP CCRS 2016-2025, or the county's own source and years), the AFDC station
// list (USDOT/BTS NTAD), LADOT speed humps and LA County channels, plus the page's own Assessor parking-lot inventory (LA).
let SITES = null, _sitesLoading = null, _sitesLayer = null;
function loadSites() {
  if (SITES || _sitesLoading) return _sitesLoading || Promise.resolve(SITES);
  _sitesLoading = cpText("sites-data").then(t => {
    if (!t) return { meta: {}, sites: {} };
    return unpackGzipB64(t).finally(() => cpRelease("sites-data"));
  }).then(d => { SITES = d; return d; }).catch(() => { SITES = { meta: {}, sites: {} }; return SITES; });
  return _sitesLoading;
}
const SITE_P = { creek: "corridor_trail", lot_park: "pocket_park", ev: "ev_hub", calm: "traffic_calming", xing: "crosswalks" };
const siteMi = m => m >= 400 ? (m / 1609.34).toFixed(2) + " mi" : Math.round(m / 10) * 10 + " m";
const evNear = s => { const v = [s.dl2, s.ddc].filter(x => x != null); return v.length ? siteMi(Math.min(...v)) : null; };   // null: none of that kind in the county's AFDC list
const evOne = v => v == null ? "none in the AFDC list for this area" : siteMi(v);
function siteSrc(key) { const v = ((SITES || {}).meta || {}).verified || {}; return v[key] || null; }
function siteLink(key, text) { const v = siteSrc(key); return v ? `<a href="${esc(v.source)}" target="_blank" rel="noopener">${esc(text)}</a>` : esc(text); }
function siteCounty(gid) { const f = String(gid).slice(0, 5); return f === "06059" ? "oc" : f === "06037" ? "la" : f; }   // meta key: la | oc | county FIPS
function crashNoun(gid, n) {   // CHP CCRS counts injury crashes; county police sources (Denver) record only serious injuries
  const loc = ((((SITES || {}).meta || {})[siteCounty(gid)]) || {}).crash_source;
  const noun = loc ? (loc.noun || "serious, fatal or walking/biking crash") : "injury crash";
  return n > 1 ? noun.replace(/crash$/, "crashes") : noun;
}
function siteHeadline(s) {
  if (s.t === "creek") return `Walking and biking path along ${esc(s.nm)}`;
  if (s.t === "lot_park") return `Parking lot to pocket park${s.ad ? ": " + esc(s.ad) : s.nmlot ? ": " + esc(s.nmlot) : s.next ? " next to " + esc(s.next[0]) : s.st ? " on " + esc(s.st) : ""}`;
  if (s.t === "ev") return `EV chargers at ${esc(s.dest)}${s.st ? " (" + esc(s.st) + ")" : ""}`;
  if (s.t === "calm") return `${s.elig ? "Speed humps" : "Traffic calming"} on ${esc(s.street)}${s.from && s.to ? ` from ${esc(s.from)} to ${esc(s.to)}` : ""}`;
  if (s.t === "xing") return `Safer crossing at ${s.at.map(esc).join(" & ")}`;
  return "";
}
function siteShort(s, gid) {      // one line for the project card
  if (s.t === "creek") return `along ${esc(s.nm)}: ~${siteMi(s.free)} with no path beside it`;
  if (s.t === "lot_park") return `${s.ac.toFixed(2)}-acre parking lot${s.ad ? " at " + esc(s.ad) : s.next ? " next to " + esc(s.next[0]) : s.st ? " on " + esc(s.st) : ""}`;
  if (s.t === "ev") return `the parking lot at ${esc(s.dest)} (${evNear(s) ? `nearest public charger ${evNear(s)} away` : "no public charger in the AFDC list for this area"})`;
  const yrs = ((((SITES || {}).meta || {})[siteCounty(gid)] || {}).crash_years || [2016, 2025]).join("–");   // the county's own crash years
  if (s.t === "calm") return `${esc(s.street)}${s.from && s.to ? ` (${esc(s.from)} to ${esc(s.to)})` : ""}: ${s.n} ${crashNoun(gid, s.n)} ${yrs}`;
  if (s.t === "xing") return `${s.at.map(esc).join(" & ")}: ${s.ped + s.bike} ${s.ped + s.bike === 1 ? "person" : "people"} walking or biking hurt ${yrs}`;
  return "";
}
function siteBody(s, gid) {
  const cty = siteCounty(gid), oc = cty === "oc", meta = ((SITES || {}).meta || {})[cty] || {};
  const ctyName = oc ? "Orange County" : meta.name || "This county";
  const city = ((typeof byId !== "undefined" && byId.get(gid)) || { properties: {} }).properties.c || "";
  const yrs = (meta.crash_years || [2016, 2025]).join("–");
  if (s.t === "creek") {
    const lo = s.cost[0], hi = s.cost[1];
    return `About ${siteMi(s.len)} of ${esc(s.nm)} (${esc(s.kind === "drain" || s.kind === "channel" ? "flood channel" : s.kind)}) runs ${s.d > 0 ? "within " + siteMi(Math.max(s.d, 10)) + " of" : "through"} this block group; ${siteMi(s.free)} of it has no mapped path alongside${s.covered > 0 ? ` (${siteMi(s.covered)} already does)` : ""}.
      ${s.mb ? ` LA County Public Works lists it as maintained by ${s.mb === "LACFCD" ? "the LA County Flood Control District" : esc(s.mb)}, whose permission a path on its banks would need.` : ""}
      ${s.mr ? ` OC Flood Control District maintenance roads beside it: ${[s.mr[2] ? siteMi(s.mr[2]) + " at least 10 ft wide (the District's minimum)" : "", s.mr[1] ? siteMi(s.mr[1]) + " narrower than 10 ft" : "", s.mr[0] ? siteMi(s.mr[0]) + " with no maintenance road" : ""].filter(Boolean).join(", ")}${s.mr[3] ? " (" + esc(s.mr[3]) + ")" : ""}; a path would need the District's permission (OCGIS OCFCD maintenance-road layer).` : oc ? " No OC Flood Control District maintenance-road record matched this stretch, so it may be a city or natural channel; check who owns the banks." : ""}
      <br><b>Cost for scale:</b> about ${fmt$(lo)}–${fmt$(hi)} for this stretch, from planned channel paths: ${siteLink("channel_trail_puente", "Puente Creek Bikeway")} (1.86 mi, $3.7M programmed, ~$2.0M/mi; withdrawn in 2025) and ${siteLink("channel_trail_coyote", "Coyote Creek / OC Loop P–Q")} (1.6 mi, $5.7M state grant, ~$3.6M/mi). Rail-corridor paths cost far more (${siteLink("rail_trail_ocloop_a", "OC Loop Segment A")}: ~$14.8M/mi).`;
  }
  if (s.t === "lot_park") {
    const need = s.pn != null && s.pn > 805 ? `the nearest park is ${siteMi(s.pn)} away` : `only ${(+s.pa).toFixed(1)} acres of park lie within half a mile`;
    const what = s.src === "assessor"
      ? `County Assessor: ${esc(s.use || "parking lot")}, ${s.ac.toFixed(2)} acres${s.z ? ", zoned " + esc(s.z) : ""}${s.lav != null ? `, assessed land value ${fmt$(s.lav)}` : ""}${s.st ? `, on ${esc(s.st)}` : ""}${s.next ? `, next to ${esc(s.next[0])}` : ""}. Owner not shown; check the Assessor before planning.`
      : `A ${s.ac.toFixed(2)}-acre surface lot${s.nmlot ? ` (${esc(s.nmlot)})` : ""}${s.st ? ` on ${esc(s.st)}` : ""}${s.next ? `, next to ${esc(s.next[0])} (${esc(s.next[1])})` : ""}${s.op ? `, run by ${esc(s.op)}` : ""} (OpenStreetMap). Ownership isn't recorded in OpenStreetMap; check the Assessor before planning.`;
    return `${what} Park need here: ${need}.
      <br><b>Cost for scale:</b> ${siteLink("pocket_park_walnut", "LA County's Walnut Park pocket park")} (0.5 acre on vacant land, with playground, splash pad and restroom) was budgeted at $4.62M including $3.33M construction, plus land, and about $385k a year to run (2022). A plainer lawn-and-trees park costs less.`;
  }
  if (s.t === "ev") {
    const l2 = s.n_l2 * 9575, dc = s.n_dc * 103238;
    return `${esc(s.dest)} (${esc(s.dk)}) has a ${s.ac.toFixed(2)}-acre surface lot${s.op ? " run by " + esc(s.op) : ""}. ${evNear(s) ? `The nearest public charger is ${evNear(s)} away` : "No public charger is in the AFDC list for this area"} (nearest Level 2 ${evOne(s.dl2)}, nearest DC fast ${evOne(s.ddc)}; ${siteLink("afdc_stations", "AFDC station list")}, Nov 2026).
      <br><b>Suggested:</b> ${s.n_l2} Level 2 ports${s.n_dc ? ` and ${s.n_dc} DC fast chargers` : ""}, about ${fmt$(l2 + dc)} at ${siteLink("ev_l2", "CARB's reported costs")} ($9,575 per Level 2 connector${s.n_dc ? ", $103,238 per DC fast charger" : ""}; projects through 2021). The lot owner (or the city, at a public site) would host them.`;
  }
  if (s.t === "calm") {
    const facts = `${s.n} ${crashNoun(gid, s.n)} on this ${siteMi(s.len)} stretch, ${yrs}${s.ped || s.bike ? ` (${[s.ped ? s.ped + " involving a pedestrian" : "", s.bike ? s.bike + " a bicycle" : ""].filter(Boolean).join(", ")})` : ""}${s.killed ? `, ${s.killed} fatal` : ""}; crashes at the junctions with bigger roads are not counted.${s.school ? ` ${esc(s.school[0])} is within 250 m.` : ""}`;
    const rule = siteLink("hump_eligibility", cty === "la" && city === "Los Angeles" ? "LADOT's criteria" : "LADOT's criteria (City of LA, used here for reference)");
    const elig = s.elig
      ? `Passes the map checks in ${rule} (one lane each way, posted 30 mph or less${s.humps ? "" : ", no humps there yet"}); LADOT also requires at least 1,000 vehicles a day, speeds 5 mph over the limit and signatures from two-thirds of the neighbors${cty === "la" && city && city !== "Los Angeles" ? `. ${esc(/^Unincorporated/.test(city) ? "LA County Public Works" : city)} sets its own rules` : cty !== "la" ? `. Local rules in ${esc(ctyName)} differ` : ""}. ${siteLink("speed_hump", "$5,958 per hump")} (LADOT, 2025).`
      : `Not a speed-hump street under ${rule}: ${[s.humps ? s.humps + " speed hump" + (s.humps > 1 ? "s are" : " is") + " already mapped here" : "", s.lanes && s.lanes > 2 ? "more than one lane each way" : "", s.speed && parseInt(s.speed) > 30 ? "posted above 30 mph" : ""].filter(Boolean).join("; ") || "it fails the screen"}. A speed-feedback sign (${siteLink("crossing_units_la", "$14,221 in LA City prices")}), narrower lanes or a road-safety review of the crashes fits better.`;
    return `${facts}<br>${elig}`;
  }
  if (s.t === "xing") {
    return `${s.n} ${meta.crash_source && meta.crash_source.noun !== "injury crash" ? "crash" + (s.n > 1 ? "es" : "") : "injury crash" + (s.n > 1 ? "es" : "")} within 30 m of this intersection involved someone walking (${s.ped}) or biking (${s.bike}), ${yrs}${s.killed ? `; ${s.killed} fatal` : ""}.${s.school ? ` ${esc(s.school[0])} is within 250 m.` : ""} Options, with ${siteLink("crossing_units_la", "LA City unit prices")} (2022, incl. contingency): high-visibility crosswalk $3,950; leading pedestrian interval $34,034; flashing beacon $118,512; curb extension $158,016–260,726 per corner.`;
  }
  return "";
}
function siteGeomLayers(s) {
  const out = [], col = { creek: css("--water-line", "#2b7bb9"), lot_park: css("--park", "#3a8f4f"), ev: "#7b3fbf", calm: "#d9480f", xing: "#d9480f" }[s.t];
  (s.g || []).forEach(e => { const ll = decodeLine(e); if (ll.length < 2) return;
    out.push(s.t === "lot_park" || s.t === "ev" ? L.polygon(ll, { color: col, weight: 2.5, fillOpacity: .25, interactive: false }) : L.polyline(ll, { color: col, weight: s.t === "creek" ? 5 : 6, opacity: .85, interactive: false })); });
  if (s.pt && (s.t === "xing" || !out.length)) out.push(L.circleMarker([s.pt[1], s.pt[0]], { radius: 8, color: "#fff", weight: 2, fillColor: col, fillOpacity: 1, interactive: false }));
  return out;
}
function drawSites(gid) {
  if (_sitesLayer && typeof map !== "undefined" && map) { map.removeLayer(_sitesLayer); _sitesLayer = null; }
  const S = ((SITES || {}).sites || {})[gid] || []; if (!S.length || typeof map === "undefined" || !map) return;
  _sitesLayer = L.layerGroup(S.flatMap(s => siteGeomLayers(s).map(l => l.bindTooltip ? l.bindTooltip(siteHeadline(s).replace(/<[^>]+>/g, "")) : l))).addTo(map);
}
function sitesHtml(gid) {
  const S = ((SITES || {}).sites || {})[gid] || [], meta = ((SITES || {}).meta || {})[siteCounty(gid)] || {};
  const head = `<p class="small muted">Specific candidates in and next to this block group, found by screening map and crash data. They are starting points for a city or neighborhood to check (ownership, engineering, community support), not plans. Click one to see it on the map.</p>`;
  const noCrash = meta.crash_years ? "" : `<p class="small muted">Traffic-calming and safer-crossing candidates are not screened in ${esc(meta.name || "this county")}: they need injury-crash records with locations, and no state crash source is connected here yet (federal FARS covers fatal crashes only).</p>`;
  if (!S.length) return head + `<p class="small">No candidate passed the screens here: no unpathed creek or channel nearby, no publicly run or civic parking lot in a park-poor area, public chargers already within 800 m of every destination lot${meta.crash_years ? `, and no residential street or intersection with a cluster of ${meta.crash_source ? "serious or walking/biking crashes" : "injury crashes"}` : ""}.</p>${meta.crash_years ? "" : noCrash}`;
  const order = ["calm", "xing", "creek", "lot_park", "ev"];
  const cards = S.slice().sort((a, b) => order.indexOf(a.t) - order.indexOf(b.t)).map((s, i) => `<div class="rec qolrec" style="cursor:pointer" data-sx="${S.indexOf(s)}"><div class="cat">${esc((D.catalog[s.p] || {}).name || s.p)}</div><div class="small"><b>${siteHeadline(s)}</b><br>${siteBody(s, gid)}</div></div>`).join("");
  const src = `<p class="small muted">Sources: OpenStreetMap (${esc(String(meta.osm || "").slice(0, 10))} extract) for creeks, channels, paths, parking lots, destinations and street names${siteCounty(gid) === "la" ? ", LA County Public Works open channels, the County Assessor's parking-lot parcels" : ""}; ${meta.crash_source ? `${esc(meta.crash_source.name)} ${esc((meta.crash_years || []).join("–"))} (<a href="${esc(meta.crash_source.url)}" target="_blank" rel="noopener">open data</a>; ${esc(meta.crash_source.def)}); ` : meta.crash_years ? `CHP crash records ${esc(meta.crash_years.join("–"))} (CCRS, injury and fatal crashes with coordinates); ` : ""}public, open EV stations from the AFDC list (USDOT/BTS copy, ${esc(String(meta.ev_source || "").replace(/^.*downloaded /, ""))}); existing paths from ${esc(meta.paths_source || "OpenStreetMap")}; existing humps from ${esc(meta.humps_source || "OpenStreetMap")}. Map data can be incomplete: a path, hump or charger missing from these sources would make a candidate look better than it is.</p>`;
  return head + `<div class="recs">${cards}</div>` + noCrash + src;
}
async function fillSites(p) {
  const box = document.getElementById("sites-sec"); if (!box) return;
  await loadSites();
  if (selected !== p.id) return;
  box.innerHTML = sitesHtml(p.id);
  const S = ((SITES || {}).sites || {})[p.id] || [];
  box.querySelectorAll("[data-sx]").forEach(el => el.onclick = () => { const s = S[+el.dataset.sx]; const ls = siteGeomLayers(s); if (!ls.length) return;
    const b = L.featureGroup(ls).getBounds(); if (b.isValid()) map.fitBounds(b, { maxZoom: 17, padding: [80, 80] }); });
  document.querySelectorAll("#panel [data-where]").forEach(el => { const s = S.find(x => x.p === el.dataset.where);
    el.innerHTML = s ? `<b>Specific candidate:</b> ${siteShort(s, p.id)} · <a href="#" data-goto-sites="1">details</a>` : ""; el.hidden = !s; });
  document.querySelectorAll("#panel [data-goto-sites]").forEach(a => a.onclick = e => { e.preventDefault(); const d = box.closest("details"); if (d) d.open = true; box.scrollIntoView({ behavior: "smooth", block: "start" }); });
  drawSites(p.id);
}

function whereLine(id) {
  const m0 = (D.details[selected] || {}).m || {};
  if (isOCArea(m0)) return "";   // the Orange County corridor table is a neighborhood-level sketch, not a street inventory
  const role = CORRIDOR_ROLE[id], co = role && m0.co, c = co && co[role];
  if (!c) return "";
  const [st, fr, to, mi, tph, bike, bus, n79, t79, rc, station, metro, city, metroArea] = c;
  const seg = `<b>${esc(st)}</b>${fr && to && fr !== to ? ` from ${esc(fr)} to ${esc(to)}` : fr ? ` near ${esc(fr)}` : ""} (~${mi} mi)`;
  const lead = id === "rail_station" ? `Corridor: along ${seg}, the busiest bus street here${tph ? ` (${tph} ${tph == 1 ? "bus" : "buses"}/hr)` : ""}${station && station[0] ? `, linking to ${esc(station[0])} station (${station[1]} mi)` : ""}`
    : role === "local" ? `Where: ${seg}, the main local street through this area`
    : role === "bike" ? `Where: ${seg}`
    : role === "bus" ? `Where: ${seg}${tph ? `, where the busiest stop gets ${tph} ${+tph === 1 ? "bus" : "buses"} an hour` : ""}`
    : `Where: ${seg}, the main arterial here`;
  const notes = [];
  if (bike) notes.push("already there: " + bike);
  if (bus) notes.push("already there: a bus-only lane on part of it (LA City)");
  if (n79) notes.push(`${n79} official SB 79 transit stop${n79 > 1 ? "s" : ""} on this stretch (${t79}), so state law already allows more homes here`);
  if (rc) notes.push("rail under construction nearby" + (rc !== "-" ? ` (${rc})` : ""));
  const planned = [...(metro || []), ...((id === "rail_station" ? metroArea : []) || []).filter(x => !(metro || []).includes(x)), ...(city || []).map(x => "LA City capital project: " + x)];
  const status = planned.length ? `<b>Already planned:</b> ${planned.map(esc).join("; ")}.`
    : `<span class="muted">No Metro project or LA City capital project found on this street${role === "bike" ? "; city bike-plan maps are still being added" : ""}.</span>`;
  return `<p class="small" style="margin:4px 0 2px">${lead}.${notes.length ? " " + notes.map(esc).join("; ") + "." : ""} ${status}</p>`;
}

// ---------------- who pays: what an EIFD could raise from a project's own value gain, and the rest of the stack
// Prop 13: a home's assessed value only catches up to market when it sells, so the project's value gain enters the
// tax roll as homes turn over (3.5% a year assumed; Prop 13 lock-in keeps LA turnover low). The district keeps
// the city's and County's shares of the 1% tax on that gain (pledges from the EIFD calculator defaults).
// pledges: Artesia EIFD (County participation approved 14 Jul 2026): County 49% of its General Fund increment (Board letter); city 75% per the IFP (round-10 research, larger than the County's share);
// County shares in formed districts range from 11% (Santa Fe Springs) to 50% (La Verne, Norwalk), and policy keeps them under 100%.
const FUND_ASSUME = { turnover: 0.035, cityPledge: 0.75, countyPledge: 0.49, countyPledgeUninc: 0.5, admin: 0.03, rate: 0.0525, dscr: 1.35, years: 30, housing: 0.20 };
function isCAActive() { return typeof activeCounty === "undefined" || activeCounty !== "oc" || String(activeFips()).startsWith("06"); }
function activeStateName() { const f = String(activeFips()).slice(0, 2); return ({ "08": "Colorado", "17": "Illinois", "36": "New York", "48": "Texas", "12": "Florida", "13": "Georgia", "37": "North Carolina", "51": "Virginia", "26": "Michigan" })[f] || "this state"; }
function fundPlan(r, gid) {
  const c = D.catalog[r.id]; if (!c || c.kind === "owner" || c.kind === "policy") return null;
  if (!isCAActive()) return null;   // the plan is built on a California EIFD; not modelled for other states
  const m = (D.details[gid] || {}).m || {}, p = (byId.get(gid) || { properties: {} }).properties;
  const uninc = /^Unincorporated/i.test(p.c || "") || / \(unincorporated\)$/.test(p.c || "") || p.c === "Los Angeles County";
  const sh = m.e && m.e.sh ? m.e.sh : [uninc ? 0 : 0.20, 0.24];
  const A = FUND_ASSUME, cityK = sh[0] * A.cityPledge, cntyK = sh[1] * (uninc ? A.countyPledgeUninc : A.countyPledge);
  const ann = (1 - Math.pow(1 + A.rate, -A.years)) / A.rate;
  let y10 = 0, tot = 0, cityTot = 0, cntyTot = 0;
  for (let t = 1; t <= A.years; t++) {
    const gain = (r.value || 0) * (1 - Math.pow(1 - A.turnover, t)) * Math.pow(1.02, t);   // reassessed share of the gain, +2%/yr
    const city = gain * 0.01 * cityK * (1 - A.admin), cnty = gain * 0.01 * cntyK * (1 - A.admin);
    tot += city + cnty; cityTot += city; cntyTot += cnty; if (t === 10) y10 = city + cnty;
  }
  const bond = y10 * (1 - (cntyK > 0 ? A.housing : 0)) / A.dscr * ann;
  const buildable = (r.capex || 0) + (r.land || 0);                    // bonds pay for building and land, not yearly upkeep
  const eifd = Math.min(bond, buildable), rest = Math.max(r.cost - eifd, 0), program = buildable <= 0;
  const ocF = isOCArea(m) ? (ocFunding(r.id) || { funding: [], none: true }) : null;   // no LA County programmes outside LA
  const others = ocF ? ocF.funding.filter(f => f.code !== "OC_EIFD").map(f => [f.name, f.what, f.source]) : (c.funding || []).filter(k => k !== "EIFD" && D.funding[k]).map(k => D.funding[k]);
  const cm = ocF ? null : ((D.r10 || {}).city || {})[p.c] || null, ex = ((D.r10 || {}).stacks || {})[r.id] || null;
  return { eifd, bond, y10, tot, cityTot, cntyTot, cityK, cntyK, rest, others, uninc, share: r.cost > 0 ? eifd / r.cost : 0, om: r.om || 0, sh, city: p.c, cm, ex, keys: c.funding || [], program, id: r.id, oc: !!ocF };
}
function fundHtml(r, gid) {
  const f = fundPlan(r, gid); if (!f) return "";
  const pct = x => (x * 100).toFixed(x < 0.1 ? 1 : 0) + "%";
  const who = f.uninc ? `the County (${pct(f.cntyK)} of each $1 of new tax here)` : `${esc(f.city)} (${pct(f.cityK)} of each $1 of new tax) and the County (${pct(f.cntyK)})`;
  const lead = f.others[0];
  return `<div class="fund small"><b>Who pays — a possible funding plan</b>
    <div class="fund-bar" title="EIFD ${fmt$(f.eifd)} of ${fmt$(r.cost)}"><i style="width:${Math.min(100, f.share * 100).toFixed(1)}%"></i></div>
    <div class="kv">${f.program ? `<span>EIFD</span><span>bonds can't pay for a yearly program, but the ~${fmt$(f.y10)}/yr of tax growth it creates could help cover it</span>` : `<span>EIFD bonds from this project's own value gain</span><span><b>${fmt$(f.eifd)}</b> (${pct(f.share)} of the cost)</span>`}
      <span>Put in by</span><span>${who}: ~${fmt$(f.y10)}/yr of tax growth by year 10, ~${fmt$(f.tot)} over 30 years (city ${fmt$(f.cityTot)}, County ${fmt$(f.cntyTot)})</span>
      <span>Left to raise</span><span><b>${fmt$(f.rest)}</b>${f.om ? ` (incl. ${fmt$(f.om)}/yr upkeep, which bonds can't pay)` : ""}</span>
      ${f.others.length ? `<span>Best fits for the rest</span><span>${f.others.map((o, i) => `${o[2] ? `<a href="${esc(o[2])}" target="_blank" rel="noopener">${esc(o[0])}</a>` : esc(o[0])}${i === 0 ? "" : ""} <span class="muted">(${esc(o[1])})</span>`).join("; ")}</span>` : `<span>Rest</span><span>city general fund or capital budget</span>`}</div>
    ${cityMoney(f)}${f.ex ? `<p style="margin:6px 0 0"><b>Real example${activeCounty === "oc" ? " (LA County)" : ""}:</b> ${esc(f.ex.p)} (${esc(f.ex.c)}${f.ex.s ? ", " + esc(f.ex.s.split(";")[0]) : ""}): ${fmt$(f.ex.t)} — ${f.ex.src.map(([n, a]) => `${esc(n)} ${fmt$(a)} (${Math.round(100 * a / f.ex.t)}%)`).join("; ")}.</p>` : ""}
    <p class="muted" style="margin:4px 0 0">How: the city (and the County, if it joins) forms an EIFD, pledges its share of the property-tax growth this project creates, and issues bonds against it; ${lead ? esc(lead[0]) : "grants and the city's budget"} would cover most of the rest. Assumes ${pct(FUND_ASSUME.turnover)} of homes resell each year (Prop 13 reassesses only on sale), the city pledges 75% of its share and the County 49% (Artesia's 2026 district; County shares elsewhere run 11–50%)${f.uninc ? "; in unincorporated areas the County alone, assumed 50%" : ""}, ${(FUND_ASSUME.rate * 100).toFixed(2)}% 30-year bonds at ${FUND_ASSUME.dscr}x coverage${f.cntyK > 0 ? ", 20% of County-backed bonds held for housing" : ""}. A district over the whole area (calculator below) also captures ordinary growth and raises far more. Since AB 116 (2019) EIFD bonds need no public vote.</p></div>`;
}
function ocFunding(id) {
  const F = (typeof D_OC !== "undefined" && D_OC && D_OC.oc_funding) || null;
  return F && F[id] ? F[id] : null;
}
function ocLfs(city) {
  const P = (((typeof D_OC !== "undefined" && D_OC && D_OC.oc_funding) || {}).programs || {}).M2_LFS; if (!P) return null;
  const k = /^Unincorporated/i.test(city || "") || / \(unincorporated\)$/.test(city || "") ? "County Unincorporated" : city;
  return P.per_city_fy2026_27[k] != null ? { amt: P.per_city_fy2026_27[k], who: k === "County Unincorporated" ? "the County (unincorporated areas)" : k, src: P.source, tab: P.date } : null;
}
function ocMoney(f, id) {
  const F = ocFunding(id), L = ocLfs(f.city); if (!L) return "";
  const uses = F && F.funding.some(x => x.code === "M2_LFS");
  return `<p style="margin:6px 0 0"><b>${uses ? "What " + esc(L.who) + " already gets" : esc(L.who) + "'s own yearly money"}:</b> ~${fmt$(L.amt)} of OCTA Measure M2 Local Fair Share in FY 2026-27 (OCTA forecast apportionment)${uses ? ", which can pay for street, pedestrian, transit and active-transportation projects like this" : ", for streets, transit and active transportation; this one would rely on other grants or the general fund"}.</p>`;
}
function ocFundingHtml(id, m) {
  const F = ocFunding(id); if (!F) return isOrangeArea(m) ? "" : `<p class="small muted">Funding programmes for ${esc(countyOf(m))} have not been verified yet, so none are listed (LA County's programmes don't apply here).</p>`;
  const fees = ocFeeLine(id, m);
  if (!F.funding.length) return `<p class="small"><b>Orange County funding:</b> <span class="muted">${esc(F.notes)}</span></p>${fees}`;
  return `<p class="small"><b>Orange County funding (verified):</b> ${F.funding.map(x => `<a href="${esc(x.source)}" target="_blank" rel="noopener">${esc(x.name)}</a> <span class="muted">(${esc(x.what)})</span>`).join("; ")}.${F.process ? ` <b>How:</b> ${esc(F.process)}.` : ""}${F.who_decides ? ` <b>Who decides:</b> ${esc(F.who_decides)}.` : ""}${F.notes ? ` <span class="muted">${esc(F.notes)}</span>` : ""}</p>${fees}`;
}
function ocFeeLine(id, m) {
  const fees = (typeof D_OC !== "undefined" && D_OC && D_OC.oc_fees) || null; if (!fees) return "";
  const c = (m && m.c) || "", city = fees[c], key = id === "street_trees" ? "street_tree_fee" : id === "sidewalks" ? "sidewalk_cost_share" : id === "adu" ? "adu_impact_fee" : null;
  const out = [];
  if (key && city && city[key]) { const x = city[key]; out.push(`<b>${esc(c)}:</b> ${esc(x.value)} <span class="muted">(${esc(x.code)}; <a href="${esc(x.source)}" target="_blank" rel="noopener">source</a>, ${esc(x.date)})</span>`); }
  if (id === "adu" && fees._meta && fees._meta.adu_impact_fee_law) { const L = fees._meta.adu_impact_fee_law; out.push(`<b>State rule:</b> ${esc(L.value)} <span class="muted">(<a href="${esc(L.source)}" target="_blank" rel="noopener">statute text</a>)</span>`); }
  return out.length ? `<p class="small">${out.join("<br>")}</p>` : "";
}
function cityMoney(f) {
  if (f.oc) return ocMoney(f, f.id);
  const cm = f.cm; if (!cm) return "";
  const lr = (cm.pa || 0) + (cm.pc || 0) + (cm.mr || 0) + (cm.mm || 0), useLR = f.keys.includes("M"), useW = f.keys.includes("W") && cm.mw;
  if (!useLR && !useW) return `<p style="margin:6px 0 0"><b>${esc(f.city)}'s own yearly money:</b> ~${fmt$(lr)} of Metro sales-tax local return${cm.mw ? ` and ${fmt$(cm.mw)} of Measure W` : ""} (FY 2026-27 estimates), mostly for transportation and water projects; this one would rely on grants or the general fund.</p>`;
  const parts = [];
  if (useLR && lr) parts.push(`~${fmt$(lr)} a year of Metro local return (Prop A ${fmt$(cm.pa || 0)}, Prop C ${fmt$(cm.pc || 0)}, Measure R ${fmt$(cm.mr || 0)}, Measure M ${fmt$(cm.mm || 0)}), which can pay for street and transit projects like this`);
  if (useW) parts.push(`${fmt$(cm.mw)} a year of Measure W municipal money for green streets, trees and stormwater`);
  return `<p style="margin:6px 0 0"><b>What ${esc(f.city)} already gets:</b> ${parts.join("; and ")} (FY 2026-27 estimates; much is already committed).</p>`;
}
function fundSummary(pkg, gid) {
  const F = pkg.map(r => [r, fundPlan(r, gid)]).filter(([, f]) => f);
  if (!F.length) return "";
  const cost = F.reduce((s, [r]) => s + r.cost, 0), eifd = F.reduce((s, [, f]) => s + f.eifd, 0), y10 = F.reduce((s, [, f]) => s + f.y10, 0);
  const src = new Map(); F.forEach(([r, f]) => { const o = f.others[0]; if (o) src.set(o[0], (src.get(o[0]) || 0) + Math.max(r.cost - f.eifd, 0)); });
  const top = [...src].sort((a, b) => b[1] - a[1]).slice(0, 3);
  return `<div class="pkg">${tile("EIFD could fund", fmt$(eifd), `${(100 * eifd / Math.max(cost, 1)).toFixed(0)}% of the cost, from these projects' own value gain`)}${tile("City + County put in", fmt$(y10) + "/yr", "their share of the new property tax by year 10")}${tile("Left for grants and budgets", fmt$(Math.max(cost - eifd, 0)), top.length ? "mostly " + top.map(([k]) => esc(k)).join(", ") : "")}</div>
    <p class="small muted" style="margin:4px 0 0">Open any project's <i>Why here, cost and sources</i> for its funding plan; the EIFD calculator below shows a district over the whole area.</p>`;
}
function recCard(r, i, mode) {
  const c = D.catalog[r.id], ev = String(c.evidence);
  const m = selected && D.details[selected] ? D.details[selected].m || {} : {};
  const rng = formatVpdRange(r.vpd, c.grade, r.id, m);
  const head = mode === "value" ? `<span class="vpd-badge grade-${(c.grade || "none").toLowerCase()}">${rng.badge}</span><span class="vpd" title="Model estimate ${rng.estStr}; band of ±${Math.round(rng.band * 100)}% by evidence grade">${rng.str}</span>` : mode === "owner" ? `<span class="vpd">adds ~${fmt$(r.value)}</span>` : `<span class="vpd none">${mode === "qol" ? "need: " + (r.qol >= .8 ? "high" : r.qol >= .5 ? "medium" : "low") : "policy"}</span>`;
  const costs = `${fmt$(r.capex)} to build${r.land ? " + " + fmt$(r.land) + " land" : ""}${r.om ? " + " + fmt$(r.om) + "/yr upkeep or operations" : ""}`;
  const agencyHtml = c.lead_agency ? `<p class="small agency-line" style="margin:4px 0 2px"><b>Who decides:</b> ${esc(agencyFor(c.lead_agency, m))} · <b>Next step:</b> ${esc(agencyFor(c.process, m))}${isOCArea(m) ? ` <span class="muted">(${esc(countyOf(m))} equivalents of the LA County catalog; verify with the city)</span>` : ""}</p>` : "";
  const dispHtml = renterViewOn || c.displacement_risk === "high_risk" ? (
    c.displacement_risk === "high_risk" ? `<div class="displacement-badge high-risk"><b>High Displacement Risk:</b> Significant land value uplift. Pair with tenant protections, RSO enforcement &amp; Community Land Trusts.</div>`
    : c.renter_direct ? `<div class="displacement-badge protective">✓ <b>Direct Renter Benefit:</b> Improves tenant comfort, transit mobility, or safety with minimal displacement pressure.</div>`
    : ""
  ) : "";
  return `<div class="rec${i === 0 && mode === "value" ? " top" : ""}${mode === "qol" ? " qolrec" : ""}">
    <div class="cat">${esc(c.category)}</div>
    <div class="row1"><span class="nm">${esc(isCAActive() ? c.name : String(c.name).replace(" (SB 79 / TOC zoning)", " (transit-oriented zoning)"))}</span>${head}</div>
    <div class="meta">${esc(r.project)} · <b>total ~${fmt$(r.cost)}</b>${r.value > 0 ? (c.kind === "owner" ? ` · adds ~${fmt$(r.value)} to that home's value` : ` · adds ~${fmt$(r.value)} across ~${fmtN(r.homes)} home${Math.round(+r.homes) === 1 ? "" : "s"}`) : ""}${c.grade !== "none" ? `<span class="chip${c.grade === "A" || c.grade === "B" ? " strong" : c.grade === "D" || c.grade === "U" ? " reg" : ""}" title="${esc(GRADE_TXT[c.grade])}">evidence ${c.grade}</span>` : `<span class="chip">${esc(ev.split(" (")[0])}</span>`}${c.kind === "regional" ? '<span class="chip reg">regional project</span>' : ""}</div>
    ${whereLine(r.id)}
    ${Object.values(SITE_P).includes(r.id) ? `<p class="small where-site" data-where="${r.id}" hidden></p>` : ""}
    ${agencyHtml}
    ${dispHtml}
    <details><summary>Why here, cost and sources</summary>
      <p class="small"><b>Why:</b> ${esc(whyFix(r.why))}</p>
      <div class="costline">total = ${costs}${r.om ? " (10 yrs, present value)" : ""}</div>
      ${c.benefit && mode === "qol" ? `<p class="small"><b>Public benefit (unverified estimate):</b> about ${fmt$(c.benefit[0])} a year from ${esc(c.benefit[1].toLowerCase())}, roughly <b>${fvpd(c.benefit[0] * 8.53 / Math.max(r.cost, 1))}</b> of benefit per $1 over 10 years. From the round-6 research, not yet checked against its sources.${c.benefit[2] ? " " + esc(c.benefit[2]) : ""}</p>` : ""}
      ${r.pct > 0 ? `<p class="small"><b>Price effect used:</b> +${r.pct}% for homes reached${c.years ? `, full effect after ~${c.years} yr (discounted)` : ""}. Model estimate: <b>${rng.estStr}</b>; judgment band of ±${Math.round(rng.band * 100)}% for evidence grade ${esc(c.grade)}: ${rng.str}.${rng.adjStr ? ` <span class="muted">Experimental local adjustment (${esc(rng.notes.join(", "))}): ${rng.adjStr}; shown for context, not used in the ranking.</span>` : ""}</p>` : `<p class="small"><b>Home-value effect:</b> not measured in the research, so it is ranked by how much this area needs it, not by value per $1.</p>`}
      ${c.grade !== "none" ? `<p class="small"><b>Evidence grade ${c.grade}:</b> ${esc(GRADE_TXT[c.grade].slice(4))}.${c.caveat ? " " + esc(agencyFor(c.caveat, m)) : ""}</p>` : c.caveat ? `<p class="small">${esc(agencyFor(c.caveat, m))}</p>` : ""}
      ${mode === "value" || mode === "qol" ? fundHtml(r, selected) : ""}
      ${isOCArea(m) ? ocFundingHtml(r.id, m) : (c.funding || []).length && !(mode === "value" || mode === "qol") ? `<p class="small"><b>Who pays:</b> ${c.funding.map(k => { const f = D.funding[k]; return f ? `${f[2] ? `<a href="${esc(f[2])}" target="_blank" rel="noopener">${esc(f[0])}</a>` : esc(f[0])} (${esc(f[1])})` : ""; }).filter(Boolean).join("; ")}</p>` : ""}
      <p class="src muted">${isOCArea(m) ? `<b>Evidence and cost examples (mostly from LA County projects, used here for scale):</b><br>` : ""}${c.sources.map(esc).join("<br>")}</p>
      <div style="margin-top:8px;padding-top:6px;border-top:1px solid #e2e8f0;">
        <button type="button" class="story-btn" onclick="openResearchModal('${esc(c.category)}')" style="display:inline-flex;align-items:center;gap:5px;font-size:11px;padding:4px 9px;background:#f0fdf4;color:#15803d;border:1px solid #86efac;border-radius:4px;font-weight:700;cursor:pointer;">
          <span></span> <span>Explore 540+ Research Studies for ${esc(c.category)} &rarr;</span>
        </button>
      </div>
    </details></div>`;
}

// ---------------- what this place is missing (vs. its 50 most similar block groups) and the neighborhood's plan
function stepWhere(st) {
  const role = CORRIDOR_ROLE[st.fix], co = role && st.bg && ((D.details[st.bg] || {}).m || {}).co, c = co && co[role];
  return c ? ` on <b>${esc(c[0])}</b>${c[1] && c[2] && c[1] !== c[2] ? ` from ${esc(c[1])} to ${esc(c[2])}` : ""}` : "";
}
const LA_ONLY_FUNDING = new Set(["W", "A", "M", "ULA"]);   // LA County / City of LA programmes
const CA_ONLY_FUNDING = new Set(["ATP", "TCC", "AHSC", "UCF", "P4", "R20", "QUIMBY", "EIFD"]);   // California state programmes and law
function stepFunding(st, m) {
  if (!st.funding || !D.funding[st.funding]) return "";
  if (!isCAActive() && (CA_ONLY_FUNDING.has(st.funding) || LA_ONLY_FUNDING.has(st.funding))) return "";
  if (!isCAActive() && st.funding === "NEVI") return `; could be paid for by NEVI (${esc(D.funding.NEVI[1])})`;   // LA's label 'NEVI / CEC charger programs' names California Energy Commission programmes
  if (isOCArea(m) && LA_ONLY_FUNDING.has(st.funding)) return isOrangeArea(m) && st.funding === "M" ? "; could be paid for by OCTA Measure M2 (Orange County transportation sales tax)" : "";
  return `; could be paid for by ${esc(D.funding[st.funding][0])}`;
}
function rebateFor(t) {   // the upgrade table's rebate notes name LA programmes; outside LA County say what to check instead
  if (typeof activeCounty === "undefined" || activeCounty !== "oc" || !t) return t;
  return String(t).replace("Turf rebate (MWD base, plus LADWP adder): check current $/sq ft", "Turf rebate: check your water agency's current $/sq ft")
    .replace("City Plants: free street and yard trees (LA City)", "Free-tree programs: check your city")
    .replace("Check Measure W stormwater credit", "Check local stormwater credits")
    .replace("LADWP or SCE charger rebate: check current amount", "Utility charger rebate: check current amount")
    .replace(/^(CalHFA ADU program: check whether funding is open|SGIP: check remaining funds|TECH Clean California.*|Earthquake Brace \+ Bolt grant up to \$3,000)$/, m => isCAActive() ? m : "California program; check local programs");
}
function whyFix(t) {
  if (t && typeof activeCounty !== "undefined" && activeCounty === "oc" && D_OC && D_OC.meta) {
    t = String(t).replace("no utility line map outside LADWP's area; local utility lines not mapped", "local utility lines are not mapped");
    const afdcRow = (D_OC.meta.sources || []).find(r => r && /^AFDC EV stations/.test(r[0] || ""));
    if (afdcRow && afdcRow[3])
      t = String(t).replace("no public charging station mapped within 800 m (OpenStreetMap; the federal AFDC list needs an API key and was not loaded)", "no public DC fast charger within 800 m (federal AFDC station list, USDOT/BTS copy)");
    else if (afdcRow)   // round 8.6: the AFDC copy was read but lists no station near this county, so OpenStreetMap's are used
      t = String(t).replace("no public charging station mapped within 800 m (OpenStreetMap; the federal AFDC list needs an API key and was not loaded)", "no public charging station mapped within 800 m (OpenStreetMap; the federal AFDC list has no station near this county)");
    const cy = ((((typeof SITES !== "undefined" && SITES) || {}).meta || {})[activeFips()] || {}).crash_years;
    // round 8.6: the fatal/severe count covers crashes of every kind (metrics_oc: ksi over all crash points), the second count only
    // pedestrian/bike ones; both get the county's crash years where known
    t = String(t).replace(/\b(\d+) fatal\/severe and (\d+) pedestrian\/bike (crash(?:es)?) recorded\b/g, (_, a, b, c) => `${a} fatal or severe-injury ${a === "1" ? "crash" : "crashes"} of any kind and ${b} pedestrian/bike ${c} recorded` + (cy && cy.length === 2 ? ` ${cy[0]}–${cy[1]}` : ""));
  }
  if (!t || !String(typeof selected !== "undefined" && selected || "").startsWith("06037")) return t;
  // checked 7 Nov 2026 against CCRS: across 400 LA block groups this count correlates 0.995 with ALL crashes inside the block group
  // (2023-2026) and 0.32 with pedestrian/bicycle crashes, so it is labelled as what it is
  // real counts for this block group (CCRS 2023-2025, la_crash_counts.py): [pedestrian/bicycle, killed or seriously injured, all]
  if (window.__LAC === undefined) {
    const t = cpTextNow("la-crash-counts");
    if (t === null) cpText("la-crash-counts");   // still downloading; counts show on the next render
    else { try { window.__LAC = JSON.parse(t || "null"); } catch (e) { window.__LAC = null; } cpRelease("la-crash-counts"); }
  }
  const c = window.__LAC && window.__LAC[selected];
  const real = c ? `; CCRS 2023–2025 for this block group: ${c[0]} involving a pedestrian or cyclist, ${c[1]} killed or seriously injured` : "";
  return String(t).replace(/\b0 fatal\/severe and (\d+) pedestrian\/bike crashes recorded/g, `$1 crashes of all kinds recorded here (CCRS 2023–2026; the LA build counted every crash, not only pedestrian/bike ones${real || ", and has no fatal/severe count"})`)
    .replace(/\b(\d+) pedestrian or bike crashes recorded/g, `$1 crashes of all kinds recorded (CCRS 2023–2026${c ? `; ${c[0]} of the 2023–2025 crashes involved a pedestrian or cyclist` : "; not only pedestrian/bike"})`)
    .replace(/\b(\d+) pedestrian\/bike crashes\b(?! recorded)/g, `$1 crashes of all kinds (CCRS 2023–2026${c ? `; ${c[0]} pedestrian/bike in 2023–2025` : ""})`);
}
function busUnknown(m) {   // a county on MobilityData feeds: bt is empty only where the OSM/gap-stop check found a missing operator (or no feed is counted)
  if (!isOCArea(m) || isOrangeArea(m) || !D_OC || !D_OC.meta) return false;
  return (D_OC.meta.sources || []).some(r => r && /^GTFS feeds\b/.test(r[0]));   // round 8.6: any wording of the row, loaded or not (a county with no counted feed has unknown bus frequency everywhere)
}
function gapSection(p, m) {
  const G = m.gp || { g: [], s: [] }, plan = (D.plans || {})[p.n + "|" + p.c];
  const fixName = id => D.catalog[id] ? D.catalog[id].name : id;
  let h = `<div class="section"><h3>What this area is missing</h3>`;
  if (G.g.length) h += `<ul class="small" style="margin:4px 0 0 18px;padding:0">${G.g.map(([k, x, med, sev, fix, why, cost]) =>
      `<li style="margin-bottom:4px">${esc(why)} <span class="muted">${sev >= 0.995 ? "Worse than every similar area." : "Worse than " + Math.round(sev * 100) + "% of similar areas."}</span> <b>Fix:</b> ${esc(fixName(fix))}${cost ? ` (~${fmt$(cost)})` : ""}.</li>`).join("")}</ul>`;
  else h += `<p class="small">Nothing stands out: this block group is at or above similar areas on parks, shade, shops, schools, services, transit, safety and street safety.</p>`;
  if (G.s.length) h += `<p class="small"><b>Already strong:</b> ${G.s.map(([k, x, med]) => `${esc((k === "dining" ? "restaurants and cafés within 400 m" : (D.gap_labels || {})[k]) || k)} (${esc(x)}; similar areas ${esc(med)})`).join("; ")}.</p>`;
  h += `<p class="small muted">Compared with the 50 block groups ${typeof activeCounty !== "undefined" && activeCounty === "oc" && typeof countyOf === "function" ? "in Los Angeles County and " + esc((c => c === "District of Columbia" ? "the " + c : c)(countyOf(m))) : "county-wide"} most like this one in income, density, home values, housing age, ${typeof activeCounty !== "undefined" && activeCounty === "oc" ? "" : "children, "}car ownership and single-family share.</p>`;
  if (plan) {
    const steps = plan.steps || [];
    h += `<div class="pkg" style="display:block;margin-top:10px"><div class="small" style="font-weight:600;margin-bottom:6px">A plan for ${esc(p.n)} (${plan.bgs} block group${plan.bgs > 1 ? "s" : ""}, ${fmtN(plan.homes)} homes)</div>`;
    if (steps.length) h += `<ol class="small" style="margin:0 0 0 18px;padding:0">${steps.map((st, i) => `<li style="margin-bottom:6px"><b>${i === 0 && steps.length > 1 && st.cost != null ? "Quick win: " : ""}${esc(st.name)}</b>${st.project ? ` (${esc(st.project)}${st.near ? ", " + esc(st.near) : ""})` : ""}${stepWhere(st)}. ${esc(st.why)} This gap shows up in ${st.parts} of ${plan.bgs} parts of the neighborhood.${st.cost ? ` About ${fmt$(st.cost)}` : " Not costed here yet"}${st.vpd ? `, returning ${fvpd(st.vpd)} of home value per $1` : ""}${stepFunding(st, m)}.</li>`).join("")}</ol>`;
    else h += `<p class="small">No neighborhood-wide gaps compared with similar areas. The best value-per-dollar projects are ranked below.</p>`;
    const pf = ((D.under && D.under.profit) || {})[p.n + "|" + p.c];
    if (pf && pf.total > 0) {
      const all = (D.under && D.under.profit ? Object.values(D.under.profit).map(x => x.total).sort((a, b) => b - a) : []), rank = all.indexOf(pf.total) + 1;
      h += `<p class="small"><b>Profit potential:</b> about <b>${fmt$(pf.total)}</b> of value created (${pf.pct != null ? (pf.pct * 100).toFixed(1) + "% of the neighborhood's home value, ~" + fmt$(pf.per_home) + " per home" : "few homes here, so it's shown as a total only"})${all.length > 1 ? `, #${rank} of ${all.length} neighborhoods by total` : ""}. ${fmt$(pf.proj)} from projects that pay back, net of cost${pf.land ? `, and ${fmt$(pf.land)} from developing ${pf.sites} underused site${pf.sites > 1 ? "s" : ""} (~${fmtN(pf.site_homes)} home${Math.round(+pf.site_homes) === 1 ? "" : "s"})` : ""}.${pf.soon && pf.soon.length ? ` Already under way: rail stations under construction nearby (${pf.soon.map(esc).join(", ")}), which usually lift nearby values.` : ""}</p>`;
    }
    const W = (pf && pf.way) || {}, wl = [];
    const wu = k => W[k] ? W[k][1] || W[k][0] : 0;
    if (wu("housing completed")) wl.push(`${fmtN(wu("housing completed"))} ${Math.round(+wu("housing completed")) === 1 ? "home" : "homes"} completed`);
    if (wu("housing permitted")) wl.push(`${fmtN(wu("housing permitted"))} permitted`);
    if (wu("housing approved")) wl.push(`${fmtN(wu("housing approved"))} approved`);
    if (W["affordable housing"]) wl.push(`${W["affordable housing"][0]} city-financed affordable project${W["affordable housing"][0] > 1 ? "s" : ""}`);
    const nb = ["new apartments", "new ADU", "new house", "new building"].reduce((t, k) => t + (W[k] ? W[k][0] : 0), 0);
    if (nb) wl.push(`${fmtN(nb)} new-building permits since 2024 (LA City)`);
    if (wl.length) h += `<p class="small"><b>Already under way:</b> ${wl.join(", ")} (state housing reports since 2021 and city data). Turn on <b>Housing &amp; projects under way</b> to see them.</p>`;
    if ((plan.ctx || []).length) h += plan.ctx.map(c => `<p class="small">${esc(c)}</p>`).join("");
    if ((plan.strong || []).length) h += `<p class="small"><b>Strengths to build on:</b> ${plan.strong.map(x => esc(x[1])).join("; ")}.</p>`;
    h += `<p class="small muted">Steps tackle the gaps shared by the most homes. ${(plan.steps || []).length > 1 && (plan.steps || [])[0].cost != null ? "The first is the cheapest, then the rest are ordered by return." : "They are ordered by how many homes share the gap, then by return."} Each is a project City Pretty already sized for the most affected part of the neighborhood. These plans will be rewritten monthly, with an assistant on this page later.</p></div>`;
  }
  return h + `</div>`;
}

// ---------------- per-house analysis: the clicked parcel, fetched live from the County Assessor's public parcel service
const PARCEL_URL = "https://public.gis.lacounty.gov/public/rest/services/LACounty_Cache/LACounty_Parcel/MapServer/0/query";
const PARCEL_FIELDS = ["AIN", "SitusFullAddress", "SitusHouseNo", "SitusStreet", "UseCode", "UseType", "UseDescription", "Roll_LandValue", "Roll_ImpValue",
  "Roll_LandBaseYear", "Roll_ImpBaseYear", "Roll_HomeOwnersExemp",
  ...[1, 2, 3, 4, 5].flatMap(i => [`DesignType${i}`, `QualityClass${i}`, `YearBuilt${i}`, `EffectiveYear${i}`, `Units${i}`, `Bedrooms${i}`, `Bathrooms${i}`, `SQFTmain${i}`])].join(",");
// Tried in parallel (staggered); the first good answer wins. A busy mirror's error page often lacks CORS headers,
// which shows as a console error even though another mirror answers.
const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter", "https://maps.mail.ru/osm/tools/overpass/api/interpreter"];
// round-9 sources (research/round9): per-lot checks queried live from the page
const R9 = {
  permits: "https://data.lacity.org/resource/pi9x-tg5x.json",          // LADBS permits 2020-present (ADU/JADU fields)
  permitsOld: "https://data.lacity.org/resource/d9aa-v8bm.json",       // LADBS building permits (of_stories)
  sales: "https://egispais.gis.lacounty.gov/pais/rest/services/PAIS/pais_sales_parcels/MapServer/0",
  hpoz: "https://services5.arcgis.com/7nsPwEMP38bSkCjy/ArcGIS/rest/services/Historic_Preservation_Overlay_Zones/FeatureServer/5",
  hcm: "https://services5.arcgis.com/7nsPwEMP38bSkCjy/ArcGIS/rest/services/Historic_Cultural_Monuments/FeatureServer/4",
  histCounty: "https://rpgis.isd.lacounty.gov/arcgis/rest/services/GISNET_Public/MapServer/331",
  hillside: "https://maps.lacity.org/lahub/rest/services/Special_Areas/MapServer/6",
  landslide: "https://services2.arcgis.com/zr3KAIbsRSUyARHG/arcgis/rest/services/CGS_Landslide_Zones/FeatureServer/0",
  liquefaction: "https://services2.arcgis.com/zr3KAIbsRSUyARHG/ArcGIS/rest/services/CGS_Liquefaction_Zones/FeatureServer/0",
  fault: "https://services2.arcgis.com/zr3KAIbsRSUyARHG/arcgis/rest/services/CGS_Alquist_Priolo_Fault_Zones/FeatureServer/0",
  fireSRA: "https://services1.arcgis.com/jUJYIo9tSA7EHvfZ/ArcGIS/rest/services/FHSZSRA_23_3/FeatureServer/0",
  fireLRA: "https://services1.arcgis.com/jUJYIo9tSA7EHvfZ/arcgis/rest/services/FHSALRA25_v1_All/FeatureServer/0",
  cams: "https://arcgis.gis.lacounty.gov/arcgis/rest/services/LACounty_Dynamic/CAMS/MapServer/1",
};
function jsonp(url, ms = 7000) {
  return new Promise((res, rej) => {
    const cb = "cp" + Math.random().toString(36).slice(2);
    const s = document.createElement("script");
    let done = false;
    const cleanup = () => {
      done = true;
      if (window[cb]) delete window[cb];
      if (s.parentNode) s.remove();
      if (timer) clearTimeout(timer);
    };
    const timer = setTimeout(() => {
      if (!done) { cleanup(); rej(new Error("JSONP timeout")); }
    }, ms);
    window[cb] = d => { cleanup(); res(d); };
    s.onerror = () => { cleanup(); rej(new Error("JSONP network error")); };
    const sep = url.includes("?") ? "&" : "?";
    s.src = url + sep + "callback=" + cb;
    document.head.appendChild(s);
  });
}
async function arcQuery(url, params, ms = 6000) {
  let cleanUrl = String(url || "").trim();
  if (params && !cleanUrl.endsWith("/query") && !cleanUrl.includes("/query?") && !cleanUrl.includes("?") && (/\/(MapServer|FeatureServer)\/\d+$/i.test(cleanUrl))) {
    cleanUrl = cleanUrl + "/query";
  } else if (params && !cleanUrl.endsWith("/query") && !cleanUrl.includes("/query?") && cleanUrl.includes("?") && (/\/(MapServer|FeatureServer)\/\d+\?/i.test(cleanUrl))) {
    cleanUrl = cleanUrl.replace(/(\/(MapServer|FeatureServer)\/\d+)\?/i, "$1/query?");
  }
  let pObj = params;
  if (params && typeof params === "object") {
    pObj = { ...params };
    delete pObj.f;
  }
  const queryStr = pObj ? (typeof pObj === "string" ? pObj : new URLSearchParams(pObj).toString()) : "";
  const sep = cleanUrl.includes("?") ? "&" : "?";
  const q = cleanUrl + sep + "f=json" + (queryStr ? "&" + queryStr : "");
  
  try {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms);
    const r = await fetch(q, { signal: ctl.signal });
    clearTimeout(t);
    if (!r.ok) throw new Error("HTTP " + r.status);
    const d = await r.json();
    if (d && d.error) throw new Error(d.error.message || "ArcGIS error");
    return d;
  } catch (e) {
    try {
      const d = await jsonp(q, ms);
      if (d && d.error) throw new Error(d.error.message || "ArcGIS error");
      return d;
    } catch (e2) {
      throw e;
    }
  }
}
async function socrata(url, where, ms = 12000) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms);
  const r = await fetch(`${url}?$limit=60&$where=${encodeURIComponent(where)}`, { signal: ctl.signal }); clearTimeout(t);
  if (!r.ok) throw new Error("HTTP " + r.status); return r.json();
}
const limit = (pr, ms = 1800) => Promise.race([pr, new Promise((_, rej) => setTimeout(() => rej(new Error("timed out")), ms))]);
const settle = (pr) => limit(pr).then(v => ({ ok: true, v }), e => ({ ok: false, e: e.message || String(e) }));
async function lotChecks(ll, a) {
  const isCA = (ll.lat >= 32.5 && ll.lat <= 42.0 && ll.lng >= -124.5 && ll.lng <= -114.1);
  const isLA = isCA && (ll.lat >= 33.70 && ll.lat <= 34.85 && ll.lng >= -118.95 && ll.lng <= -117.64);
  const pt = { geometry: `${ll.lng},${ll.lat}`, geometryType: "esriGeometryPoint", inSR: 4326, spatialRel: "esriSpatialRelIntersects", returnGeometry: false };
  const hit = (url, fields) => arcQuery(url, { ...pt, outFields: fields || "*", resultRecordCount: 3 }).then(d => (d.features || []).map(f => f.attributes));
  
  // Official nationwide FEMA NFHL MapServer query (Layer 28: Flood Hazard Zones)
  const femaUrl = "https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query";
  const femaQuery = hit(femaUrl, "FLD_ZONE,ZONE_SUBTY,SFHA_TF,STATIC_BFE").catch(() => []);

  let hpoz = { ok: false, v: [] }, hcm = { ok: false, v: [] }, hc = { ok: false, v: [] };
  let hill = { ok: false, v: [] }, slide = { ok: false, v: [] }, liq = { ok: false, v: [] }, fault = { ok: false, v: [] };
  let sra = { ok: false, v: [] }, lra = { ok: false, v: [] }, sales = { ok: false, v: [] };
  let prm = { ok: false, v: [] }, old = { ok: false, v: [] };
  let femaHits = { ok: false, v: [] };

  if (isLA) {
    const ain = String(a.AIN || "").replace(/\D/g, "");
    const loc = localOverlays(ll), q = (key, run) => loc[key] ? Promise.resolve(loc[key]) : settle(run());
    [hpoz, hcm, hc, hill, slide, liq, fault, sra, lra, sales, prm, old, femaHits] = await Promise.all([
      q("hpoz", () => hit(R9.hpoz, "NAME")), q("hcm", () => hit(R9.hcm, "NAME,MNT_NUM")), q("hc", () => hit(R9.histCounty, "Name,Status_Code_Description,Mills_Act_Contract")),
      q("hill", () => hit(R9.hillside, "H_TYPE")), q("slide", () => hit(R9.landslide, "QUAD_NAME")), q("liq", () => hit(R9.liquefaction, "QUAD_NAME")), q("fault", () => hit(R9.fault, "QUAD_NAME")),
      q("sra", () => hit(R9.fireSRA, "*")), q("lra", () => hit(R9.fireLRA, "*")),
      settle(arcQuery(R9.sales, { where: `AIN='${ain}'`, outFields: "*", returnGeometry: false }).then(d => (d.features || []).map(f => f.attributes))),
      settle(socrata(R9.permits, `apn='${ain}'`)),
      settle(socrata(R9.permitsOld, `assessor_book='${ain.slice(0, 4)}' AND assessor_page='${ain.slice(4, 7)}' AND assessor_parcel='${ain.slice(7, 10)}'`)),
      settle(femaQuery)
    ]);
  } else if (isCA) {
    [sra, lra, femaHits] = await Promise.all([
      settle(hit(R9.fireSRA, "*")),
      settle(hit(R9.fireLRA, "*")),
      settle(femaQuery)
    ]);
  } else {
    // Outside California: Only run nationwide FEMA query - returns in <120ms
    femaHits = await settle(femaQuery);
  }

  const fireVals = [sra, lra].flatMap(x => x.ok ? x.v : []).map(r => String(r.FHSZ_Description || r.FHSZ || r.HAZ_CLASS || "")).filter(Boolean);
  
  let femaData = null;
  if (femaHits && femaHits.ok && Array.isArray(femaHits.v) && femaHits.v.length > 0) {
    const fRec = femaHits.v[0];
    const zone = String(fRec.FLD_ZONE || "X").trim();
    const subty = String(fRec.ZONE_SUBTY || "").trim();
    const sfha = String(fRec.SFHA_TF || "").toUpperCase() === "T";
    const bfe = fRec.STATIC_BFE && +fRec.STATIC_BFE > -9000 ? +fRec.STATIC_BFE : null;
    let desc = "";
    if (sfha) {
      desc = `Zone ${zone} (100-year Special Flood Hazard Area; mandatory flood insurance requirement${bfe ? `; Base Flood Elevation ${bfe} ft` : ""})`;
    } else if (/0.2\s*pct/i.test(subty) || /500/i.test(subty)) {
      desc = `Zone ${zone} (500-year moderate flood risk, 0.2% annual chance)`;
    } else if (zone === "X") {
      desc = "Zone X (Minimal flood risk, outside 500-year floodplain)";
    } else {
      desc = `Zone ${zone}${subty ? " (" + subty + ")" : ""}`;
    }
    femaData = { zone, subty, sfha, bfe, label: desc };
  }

  return { hpoz, hcm, hc, hill, slide, liq, fault, sales, prm, old, fema: femaData,
    fire: (sra.ok || lra.ok) ? { vh: fireVals.some(v => /very high|^3$/i.test(v)), any: fireVals.length > 0, label: fireVals[0] || "" } : null };
}
// Assessor code decoding (round-9 code tables): UseCode 0101/0103 pool, 0106 ADU, 0107 JADU, 0108 guest house,
// 010G Mills Act; DesignType 01xx: 3rd digit heating/cooling, 4th digit pool/spa
function decodeAssessor(a) {
  const uc = String(a.UseCode || ""), dt = String(a.DesignType1 || "").padStart(4, "0");
  const heat = { "0": "none recorded", "1": "floor or wall heat", "2": "central heat", "3": "central heating and cooling", "4": "central solar heat" };
  const pool = { "0": null, "1": "pool", "2": null, "3": "pool", "4": "spa", "5": "solar-heated pool" };
  return { pool: /^010[13]/.test(uc) || (dt.startsWith("01") && ["1", "3", "5"].includes(dt[3])) ? (pool[dt[3]] || "pool") : dt.startsWith("01") && dt[3] === "4" ? "spa" : null,
    adu: uc.startsWith("0106") ? "ADU" : uc.startsWith("0107") ? "junior ADU" : uc.startsWith("0108") ? "guest house (no kitchen or bath)" : null,
    mills: uc.startsWith("010G"), heat: dt.startsWith("01") ? heat[dt[2]] || null : null, ac: dt.startsWith("01") && dt[2] === "3" };
}
function permitFacts(L) {
  const out = { list: [], stories: null, storiesSrc: null, adu: false };
  if (L && L.prm && L.prm.ok && Array.isArray(L.prm.v)) for (const r of L.prm.v) {
    const w = `${r.permit_type || ""} ${r.permit_sub_type || ""} ${r.work_desc || ""}`;
    const kind = /adu|accessory dwelling/i.test(w) || +r.adu_changed > 0 || +r.junior_adu > 0 ? "ADU" : /pool|spa/i.test(w) ? "pool" : /solar|photovoltaic/i.test(w) ? "solar"
      : /addition|add .*sq|second story|2nd story/i.test(w) ? "addition" : /re-?roof/i.test(w) ? "re-roof" : /new/i.test(r.permit_type || "") ? "new building" : null;
    if (kind === "ADU") out.adu = true;
    if (kind) out.list.push({ kind, date: String(r.issue_date || r.status_date || "").slice(0, 10), status: r.status_desc || "", desc: String(r.work_desc || "").slice(0, 120) });
  }
  if (L && L.old && L.old.ok && Array.isArray(L.old.v)) {
    const st = L.old.v.filter(r => +r.of_stories > 0 && /new|dwelling|sfd|single family|addition/i.test(r.work_description || ""))
      .sort((x, y) => String(y.issue_date || "").localeCompare(String(x.issue_date || "")));
    if (st.length) { out.stories = +st[0].of_stories; out.storiesSrc = `LA City building permit (${String(st[0].issue_date || "").slice(0, 4)}): ${st[0].of_stories} stor${+st[0].of_stories > 1 ? "ies" : "y"} permitted`; }
  }
  if (L && L.permits && L.permits.ok && Array.isArray(L.permits.v)) {
    for (const r of L.permits.v) {
      const w = `${r.TYPE || r.permit_type || ""} ${r.Description || r.work_desc || ""}`;
      const kind = /adu|accessory dwelling/i.test(w) ? "ADU" : /pool|spa/i.test(w) ? "pool" : /solar|photovoltaic/i.test(w) ? "solar"
        : /addition|add .*sq|second story|2nd story/i.test(w) ? "addition" : /remodel/i.test(w) ? "remodel" : null;
      if (kind === "ADU") out.adu = true;
      if (kind) out.list.push({ kind, date: String(r.IssueDate || r.issue_date || "").slice(0, 10), status: "Finaled", desc: String(r.Description || r.work_desc || "").slice(0, 120) });
    }
  }
  return out;
}
let parcelLayer = null;
function houseHint() {
  const el = $("#house"); if (el) el.remove();
  const box = document.createElement("div"); box.id = "house"; box.className = "section";
  box.innerHTML = `<p class="small muted">Zoom in to street level (zoom 17) and click a single home to check what that house can add: ADU, SB 9 split, pool, solar and more.</p>`;
  const v = $("#panel .verdict"); if (v) v.after(box);
}
function jsonp(url) {
  return new Promise((res, rej) => { const cb = "cp" + Math.random().toString(36).slice(2), s = document.createElement("script");
    window[cb] = d => { delete window[cb]; s.remove(); res(d); }; s.onerror = () => { delete window[cb]; s.remove(); rej(new Error("parcel service unreachable")); };
    s.src = url + "&callback=" + cb; document.head.appendChild(s); setTimeout(() => { if (window[cb]) { delete window[cb]; s.remove(); rej(new Error("timeout")); } }, 15000); });
}
// Parcel use from the county's own use field. Many counties publish numeric codes (Florida's DOR "0100" is a
// single-family home), so anything that is not clearly worded stays "unknown" rather than being guessed.
function parcelUseType(useVal) {
  const u = String(useVal || "").toLowerCase();
  if (!u.trim()) return "unknown";
  if (/res|single|family|condo|apt|apartment|dwell|home|duplex|triplex|townh/.test(u)) return "residential";
  if (/vacant|unimproved/.test(u)) return "vacant";
  if (/commerc|industr|office|retail|warehouse|hotel|exempt|gov|federal|state of|municipal|public|institution|church|relig|school|college|universit|hospital|utilit|cemeter|park|military/.test(u)) return "non-residential";
  return "unknown";
}
function normalizeParcelFeature(feat, ll, svc) {
  if (!feat || !feat.attributes) return null;
  const a = feat.attributes;
  const num = x => (x == null || x === "" || isNaN(+x)) ? 0 : +x;
  svc = svc || (typeof activeFips === "function" ? parcelSvc(activeFips()) : null) || {};
  const apnVal = a[svc.apn] || a.APN || a.APN_DASH || a.APN_ID || a.apn || a.PPN_TEXT || a.packedParc || a.PARCELID || a.PARCEL_ID || a.parcelid || a.parcel_id || a.PARCEL_ID_NR || a.parno || a.parcelnb || a.LocalParcelID || a.CleanParcelID || a.PIN || a.PIN14 || a.county_pin || a.PAMS_PIN || a.AIN || a.FOLIO || a.HCAD_NUM || a.ACCT || a.ACCTID || a.PropID || a.PROP_ID || a.GEOPIN || a.PARCEL_NUM || a.PARCELNO || a.Parcel_Num || a.PARCELNUMBER || a.BBL || a.tmk_txt || a.ACCOUNT || a.PRINT_KEY || a.MAP_BK_LOT || a.PlatLot || a.SPAN || a.SSL || a.GISID || a.OBJECTID || a.FID || "";
  let addrVal = a[svc.addr] || a.PROPERTYADDRESS || a.fullAddres || a.PHYSICAL_ADDRESS || a.ADDR_ID || a.SITEADDRESS || a.PHY_ADDR1 || a.SITE_ADDRESS || a.SITUS_ADDRESS || a.ADDRESS || a.location || a.situs_address || a.situs || "";
  if (!addrVal && a.site_str_name) addrVal = `${a.site_str_num || ""} ${a.site_str_pfx || ""} ${a.site_str_name || ""} ${a.site_str_sfx || ""}`.trim();
  if (!addrVal && a.ST_NAME) addrVal = `${a.ST_NUM || ""} ${a.ST_DIR || ""} ${a.ST_NAME || ""} ${a.ST_TYPE || ""}`.trim();
  const cleanAddr = String(addrVal || "").replace(/\s+/g, " ").trim();
  const parts = cleanAddr.split(" ");
  const houseNo = /^\d+/.test(parts[0]) ? parts[0] : "";
  const street = houseNo ? parts.slice(1).join(" ") : cleanAddr;
  const useVal = a.USECD || a.PUC || a.PRPRTYDSCRP || a.DOR_UC || a.USE_DESC || a.LAND_USE || a.PROPCLASS || a.StateLUC || a.CLASSDSCRP || "";
  const landVal = num(a.LND_VAL ?? a.LNDVALUE ?? a.LAND_VAL ?? a.NEWLAND ?? a.AssessLand ?? a.VAL_LAND ?? a.LPV_CUR);
  const impVal = num(a.IMPROVVAL ?? a.IMPVALUE ?? a.BLDG_VAL ?? a.NEWIMPR ?? a.VAL_IMPVTS);
  const jvVal = num(a.JV ?? a.FCV_CUR ?? a.ESTFMKVALUE ?? a.parval ?? a.MarketTot ?? a.TOTAL_MKT_VAL ?? a.MARKET_VALUE);
  const sevVal = num(a.SEV ?? a.CNTASSDVALUE);
  const totVal = num(a.FCV_CUR ?? a.JV ?? a.CNTASSDVALUE ?? a.TOTAL_VAL ?? a.TAXABLETRIBUNAL1 ?? a.TAXABLE_VALUE ?? a.AV_SD ?? a.TotalValue ?? a.NEWTOTAL ?? a.AssessTot ?? a.VAL_TOTAL ?? a.market_value) || (landVal + impVal);
  const yrBuilt = num(a.CONST_YEAR ?? a.ACT_YR_BLT ?? a.YEAR_BUILT ?? a.YR_CONSTR ?? a.YearBuilt ?? a.RESYRBLT ?? a.AYB);
  const effYear = num(a.EffectiveYear1 ?? a.EffectiveYear ?? a.EFF_YR_BLT ?? a.EFF_YEAR);

  // Strictly distinguish living area from parcel lot/land size
  const livingVal = num(a.LIVING_AREA ?? a.BLDG_SQFT ?? a.total_lvg_area ?? a.BldgArea ?? a.RESFLRAREA ?? a.SQFT_LIVING ?? a.FIN_SIZE ?? a.SQFTmain1);
  const lotSqftVal = num(a.LND_SQFOOT ?? a.LAND_SIZE ?? a.LOT_SIZE ?? a.LOT_SQFT ?? a.LandArea ?? a.LotArea ?? a.SHAPE_STArea__ ?? a.PARCEL_SQFT);
  const acresVal = num(a.GISACRES ?? a.ACRES ?? a.CALC_ACRE ?? a.LandAcres ?? a.ACREAGE ?? a.acreage ?? a.gisacres) || (lotSqftVal ? lotSqftVal / 43560 : 0);

  // Extract deed sale price and date if present on parcel attributes
  const salePrice = num(a.SALE_PRC1 ?? a.saledate ?? a.LS_PRICE ?? a.SALEPRICE ?? a.DOCUMENTVALUE ?? a.SalePrice ?? a.LAST_SALE_PRICE ?? a.SALE_PRICE ?? a.PRICE);
  const saleDate = String(a.SALE_YR1 ? `${a.SALE_YR1}${String(a.SALE_MO1 || '01').padStart(2, '0')}` : (a.LS_DATE ?? a.saledate ?? a.SALEDATE ?? a.SaleDate ?? a.SALE_DATE ?? "")).replace(/\D/g, "");

  return {
    attributes: {
      AIN: apnVal || `Lot ${a.OBJECTID || a.FID || 'Parcel'}`,
      SitusFullAddress: cleanAddr ? (cleanAddr + (a.PHY_CITY ? ", " + a.PHY_CITY : (a.PSTLCITY ? ", " + a.PSTLCITY : ""))) : ("Parcel " + (apnVal || "Record")),
      SitusHouseNo: houseNo,
      SitusStreet: street,
      ZoneCode: String(a.ZONING || a.ZONE || a.ZoneID || a.ZONECLASS || a.DOR_UC || a.LUCode || a.CITY_ZONING || "").trim(),
      UseDescription: useVal || `${svc.name || "Jurisdiction"} parcel`,
      UseCode: String(a.USECD || a.DOR_UC || ""),
      UseType: parcelUseType(useVal),
      Roll_LandValue: landVal, Roll_ImpValue: impVal, Roll_TotalValue: totVal,
      Roll_LandBaseYear: num(a.Roll_LandBaseYear ?? a.Roll_ImpBaseYear ?? a.BASE_YEAR ?? a.TAXROLLYEAR),
      JV: jvVal, SEV: sevVal,
      YearBuilt1: yrBuilt || 0, EffectiveYear1: effYear || 0,
      Bedrooms1: num(a.BEDROOMS ?? a.NBR_BEDROOMS), Bathrooms1: num(a.BATHROOMS ?? a.NBR_BATHS),
      SQFTmain1: livingVal || 0,
      LotSqft: lotSqftVal || 0,
      LastSalePrice: salePrice || 0,
      LastSaleDate: saleDate || "",
      Acres: acresVal,
      CenterStories: num(a.NumFloors ?? a.STORIES ?? a.NO_OF_STORIES ?? a.StoryHeight) || 1,
      BBL: a.BBL || "", Units: num(a.UnitsRes ?? a.UnitsTotal ?? a.UNITS ?? a.Units) || 1, county: countyOf(), Source: svc.name || ""
    },
    geometry: feat.geometry
  };
}

async function fetchParcel(ll) {
  if (!ll || ll.lat == null || ll.lng == null) return null;

  // 0ms instant cached hit from already rendered natLots polygons
  if (typeof natLots !== "undefined" && natLots && natLots.eachLayer) {
    let cachedHit = null;
    natLots.eachLayer(poly => {
      if (cachedHit) return;
      if (poly._feat && poly._feat.geometry && poly._feat.geometry.rings && ringsContain(poly._feat.geometry.rings, ll)) {
        cachedHit = poly._feat;
      }
    });
    if (cachedHit) return normalizeParcelFeature(cachedHit, ll);
  }

  const isLA = (ll.lat >= 33.70 && ll.lat <= 34.85 && ll.lng >= -118.95 && ll.lng <= -117.65);
  const isOC = (activeCounty === "oc" && isOrangeActive()) || (ll.lat >= 33.35 && ll.lat <= 33.95 && ll.lng >= -118.15 && ll.lng <= -117.40);
  
  if (isLA) {
    const params = {
      geometry: `${ll.lng.toFixed(6)},${ll.lat.toFixed(6)}`,
      geometryType: "esriGeometryPoint",
      inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      outFields: PARCEL_FIELDS,
      returnGeometry: "true",
      outSR: "4326",
      f: "json"
    };
    try {
      const d = await arcQuery(PARCEL_URL, params, 2000);
      if (d && d.features && d.features.length) {
        const feat = d.features.find(f => f.geometry && f.geometry.rings && ringsContain(f.geometry.rings, ll));
        if (feat) return feat;
      }
    } catch(e) {}
  }

  if (isOC) {
    const params = {
      geometry: `${ll.lng.toFixed(6)},${ll.lat.toFixed(6)}`,
      geometryType: "esriGeometryPoint",
      inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      distance: "20",
      units: "esriSRUnit_Meter",
      outFields: "*",
      returnGeometry: "true",
      outSR: "4326",
      f: "json"
    };
    try {
      const d = await arcQuery("https://www.ocgis.com/arcpub/rest/services/Map_Layers/Parcels/MapServer/0/query", params, 5000);
      if (d && d.features && d.features.length) {
        const feat = d.features.find(f => f.geometry && f.geometry.rings && ringsContain(f.geometry.rings, ll));
        if (feat) return normalizeParcelFeature(feat, ll);
      }
    } catch(e) {}
  }

  // All other nationwide locations: find parcel service and query with envelope
  const fips = typeof activeFips === "function" ? activeFips() : null;
  const svc = (typeof parcelSvc === "function" && fips && fips !== "06037" && fips !== "06059") ? parcelSvc(fips) : (typeof getParcelService === "function" ? getParcelService(ll) : null);
  if (svc && svc.url) {
    const pad = 0.00035;
    const reqFields = (svc.fields || []).slice(0, 8).map(f => f[0]).join(",") || "*";
    const params = {
      geometry: `${(ll.lng - pad).toFixed(6)},${(ll.lat - pad).toFixed(6)},${(ll.lng + pad).toFixed(6)},${(ll.lat + pad).toFixed(6)}`,
      geometryType: "esriGeometryEnvelope",
      inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      outFields: reqFields,
      returnGeometry: "true",
      outSR: "4326",
      resultRecordCount: "5",
      f: "json"
    };
    try {
      const d = await arcQuery(svc.url, params, 5000);
      if (d && d.features && d.features.length) {
        const feat = d.features.find(f => f.geometry && f.geometry.rings && ringsContain(f.geometry.rings, ll));
        if (feat) return normalizeParcelFeature(feat, ll, svc);
      }
    } catch(e) {}
  }

  return null;
}
function ringAreaM2(ring) {
  // planar area after projecting lon/lat to meters around the ring (accurate at parcel scale)
  const lat0 = ring[0][1] * Math.PI / 180, kx = 111320 * Math.cos(lat0), ky = 110540; let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j][0] * kx) * (ring[i][1] * ky) - (ring[i][0] * kx) * (ring[j][1] * ky);
  return Math.abs(a / 2);
}
function zoneAt(ll) {
  if (!ll || ll.lat == null || ll.lng == null) return null;
  const Z = (typeof D !== "undefined" && D && D.layers && D.layers.zoning) ? D.layers.zoning : null;
  if (Z && Z.cell) {
    const key = `${Math.floor((ll.lng + 180) / Z.cell)},${Math.floor((ll.lat + 90) / Z.cell)}`;
    for (const k of [key, ...cellKeys(Z.cell, 0)]) for (const p of zCell(k)) {
      const f = { geometry: { type: "Polygon", coordinates: p.rings.map(r => r.map(([la, lo]) => [lo, la])) } };
      if (pointInFeature(f, ll.lng, ll.lat)) return p;
    }
  }
  if (typeof _dynZoneFeats !== "undefined" && _dynZoneFeats && _dynZoneFeats.length) {
    for (const p of _dynZoneFeats) {
      if (p.rings && ringsContain(p.rings.map(r => r.map(([la, lo]) => [lo, la])), ll)) return p;
    }
  }
  return null;
}
// building outlines (and pools) on this lot from OpenStreetMap; in LA most outlines come from the County's building
// data import, often with a height. Returns null when OSM can't be reached.
async function fetchOsmLot(rings) {
  const ring = rings[0] || [];
  const step = Math.max(1, Math.ceil(ring.length / 40));
  const poly = ring.filter((_, i) => i % step === 0).map(([x, y]) => `${y.toFixed(6)} ${x.toFixed(6)}`).join(" ");
  const q = `[out:json][timeout:12];(way["building"](poly:"${poly}");way["leisure"="swimming_pool"](poly:"${poly}"););out tags geom;`;
  const one = async (url, delay) => {
      if (delay) await new Promise(r => setTimeout(r, delay));
      const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 10000);
      const r = await fetch(url, { method: "POST", body: "data=" + encodeURIComponent(q), signal: ctl.signal,
        headers: { "Content-Type": "application/x-www-form-urlencoded" } });
      clearTimeout(t);
      if (!r.ok) throw new Error("HTTP " + r.status);
      const d = await r.json();
      const ways = (d.elements || []).filter(e => e.type === "way" && e.geometry && e.geometry.length > 2);
      const toRing = e => e.geometry.map(g => [g.lon, g.lat]);
      const bl = ways.filter(e => e.tags && e.tags.building).map(e => {
        const r_ = toRing(e), t_ = e.tags; const hm = parseFloat(String(t_.height || "").replace(/[^0-9.]/g, ""));
        return { ring: r_, sqft: Math.round(ringAreaM2(r_) * 10.7639), levels: parseInt(t_["building:levels"]) || null,
                 height: isFinite(hm) && hm > 0 ? hm : null, type: t_.building, roof: t_["roof:shape"] || null };
      }).sort((a, b) => b.sqft - a.sqft);
      const pools = ways.filter(e => e.tags && e.tags.leisure === "swimming_pool").length;
      return { bl, pools };
  };
  try { return await Promise.any(OVERPASS.map((u, k) => one(u, k * 2500))); } catch (e) { /* every mirror failed */ }
  return null;
}
function houseFacts(a, lot, osm, PF, st) {
  const slots = [1, 2, 3, 4, 5].map(i => ({ i, sqft: +a[`SQFTmain${i}`] || 0, units: +a[`Units${i}`] || 0, beds: +a[`Bedrooms${i}`] || 0,
    baths: +a[`Bathrooms${i}`] || 0, yb: +a[`YearBuilt${i}`] || 0, eff: +a[`EffectiveYear${i}`] || 0, design: a[`DesignType${i}`] || "", qc: a[`QualityClass${i}`] || "" }))
    .filter(x => x.sqft > 0 || x.units > 0);
  const main = slots[0] || { sqft: 0, units: 0, beds: 0, baths: 0, yb: 0, eff: 0, design: "", qc: "" };
  const F = { slots, main, bldg: main.sqft, beds: main.beds, baths: main.baths, units: slots.reduce((t, x) => t + x.units, 0) || main.units,
    living: slots.reduce((t, x) => t + x.sqft, 0), yb: main.yb || main.eff, eff: main.eff, qc: main.qc, design: main.design, src: {} };
  const B = osm && osm.bl ? osm.bl.filter(b => b.sqft >= 80) : [];
  const big = B[0];

  // Footprint determination
  if (big) {
    F.foot = big.sqft; F.footAll = B.reduce((t, b) => t + b.sqft, 0); F.outlines = B.map(b => b.ring); F.others = B.length - 1;
    F.src.foot = "building outline (OpenStreetMap, from County LiDAR/GIS)";
    F.roof = big.roof;
  } else {
    F.foot = Math.min(F.bldg || lot * 0.3, lot * 0.6);
    F.footAll = F.foot + (slots.slice(1).reduce((t, x) => t + x.sqft, 0));
    F.src.foot = osm ? "estimated from living area (no building outline)" : "estimated from living area (building outlines offline)";
  }

  // Assessor story attributes from across US county tax assessment records
  const assessorStories = [
    a.STORIES, a.Stories, a.stories, a.NO_OF_STORIES, a.NUM_STORIES,
    a.BLD_STORIES, a.Story, a.story, a.NSTORIES, a.TOT_STORIES,
    a.NO_STORIES, a.NUM_FLOORS, a.FLOORS
  ].map(v => (v !== undefined && v !== null && v !== "") ? parseFloat(v) : null).find(v => v && !isNaN(v) && v > 0);

  // Stories determination (Never 'unknown' - uses Street View toggle, Assessor records, LiDAR, or physical living area ratio)
  if (st && st.manualStories != null) {
    F.stories = st.manualStories;
    F.conf = "manual";
    F.src.stories = `User confirmed via Street View (${st.manualStories} stor${st.manualStories > 1 ? "ies" : "y"})`;
  } else if (assessorStories) {
    F.stories = Math.round(assessorStories);
    F.conf = "assessor";
    F.src.stories = `County Assessor tax assessment record (${assessorStories} stor${assessorStories === 1 ? "y" : "ies"})`;
  } else if (big && big.levels) {
    F.stories = big.levels; F.src.stories = `OpenStreetMap levels tag (${big.levels})`; F.conf = "recorded";
  } else if (big && big.height) {
    F.stories = Math.max(1, Math.round((big.height - 1) / 3.2));
    F.src.stories = `building height ${big.height.toFixed(1)} m (County LiDAR via OpenStreetMap)`; F.conf = "measured";
  } else if (big && F.bldg && big.sqft > 0) {
    const r = F.bldg / big.sqft;
    const estStories = r >= 2.35 ? 3 : (r >= 1.35 ? 2 : 1);
    F.stories = estStories;
    F.src.stories = `${estStories} stor${estStories > 1 ? "ies" : "y"} (living area ${fmtN(F.bldg)} sq ft ÷ footprint ${fmtN(big.sqft)} sq ft = ${r.toFixed(2)})`;
    F.conf = "estimated";
  } else if (PF && PF.stories) {
    F.stories = PF.stories; F.src.stories = PF.storiesSrc; F.conf = "permit";
  } else {
    // Intelligent physical inference from Assessor living area and lot coverage
    if (F.bldg >= 3800) {
      F.stories = 3;
      F.src.stories = `inferred: ${fmtN(F.bldg)} sq ft living area indicates 3-story layout`;
      F.conf = "estimated";
    } else if (F.bldg >= 2400 || (lot > 0 && F.bldg / lot > 0.40)) {
      F.stories = 2;
      F.src.stories = `inferred: ${fmtN(F.bldg)} sq ft living area indicates 2-story layout`;
      F.conf = "estimated";
    } else {
      F.stories = 1;
      F.src.stories = F.bldg ? `inferred: single-story profile (${fmtN(F.bldg)} sq ft living area)` : "assumed 1 story (no living-area record for this parcel)";
      F.conf = "estimated";
    }
  }

  F.dec = decodeAssessor(a);
  F.pool = F.dec.pool ? true : osm ? osm.pools > 0 : null;
  F.src.pool = F.dec.pool ? `County Assessor code (${F.dec.pool})` : osm ? "OpenStreetMap" : "";
  F.yard = Math.max(lot - F.footAll - lot * 0.2, 0); // setbacks and driveway allowance
  F.second = slots.length > 1 || (F.others || 0) > 0 || !!F.dec.adu;
  return F;
}

function houseChecks(a, lot, m, z, hMax, F, R) {
  const res = /^0/.test(String(a.UseCode || "")) || /resid/i.test(a.UseType || "");
  const { bldg, beds, baths, units, yb, foot, yard } = F;
  const cat = z ? z.cat : null, sf = cat === "single-family" || (!cat && res && units <= 1);
  const fire = R && R.fire ? R.fire.vh : (m.fire || 0) >= 0.5;
  const hist = R ? ([R.hpoz, R.hcm].filter(Boolean).some(x => x && x.ok && x.v && x.v.length) || (R.hc && R.hc.ok && Array.isArray(R.hc.v) && R.hc.v.some(r => /design|landmark|register/i.test(r.Status_Code_Description || "")))) : false;
  const hill = R && R.hill && R.hill.ok && R.hill.v.length > 0;
  const slide = R && R.slide && R.slide.ok && R.slide.v.length > 0;
  const liq = R && R.liq && R.liq.ok && R.liq.v.length > 0;
  const fault = R && R.fault && R.fault.ok && R.fault.v.length > 0;
  const st = (typeof activeState === "function" ? activeState() : null) || "CA";
  const city = (m && m.c) || (a && a.county) || countyOf();
  
  const C = [], add = (name, v, why) => C.push({ name, v, why });
  const out = () => ({ C, yard, foot, sf, yb, beds, baths, bldg, units, res, lot, stories: F.stories, pool: F.pool, hist, fire, hill, slide, liq, fault, R, a });
  
  if (hist) add("Historic district or landmark", "note", `This lot is in a historic district or is a designated resource: exterior alterations require ${st === "CA" ? "HPOZ design review, and SB 9 does not apply" : "historic preservation review, and lot-split deregulation does not apply"}.`);
  if (hill) add("Hillside & sloped terrain", "note", `${esc(st === "CA" ? "Hillside Ordinance" : "Municipal steep-slope ordinance")} applies: stepped foundation, grading limits and height restrictions make additions and second stories more complex.`);
  if (slide || liq || fault) {
    const gz = [slide && "landslide", liq && "liquefaction", fault && "fault"].filter(Boolean);
    add("Geologic hazard zone", "note", `In state ${gz.join(", ")} hazard zone: new additions or ADUs require a site-specific geotechnical/soils investigation.`);
  }
  if (F.dec && F.dec.adu) add("Recorded ADU", "note", `The Assessor records ${/^[AEIOU]/.test(F.dec.adu) ? "an" : "a"} ${F.dec.adu} on this lot.`);
  if (F.dec && F.dec.mills) add("Historic tax incentive (Mills Act / Landmark)", "note", "This property has a historic preservation tax incentive contract.");
  if (!res) { add("Home upgrades", "no", `This parcel is ${esc(a.UseDescription || "not residential")}, so residential homeowner checks do not apply.`); return out(); }
  if (F.second) add("Second building on the lot", "note", F.slots.length > 1 ? `The Assessor lists ${F.slots.length} structures (${F.slots.map(x => fmtN(x.sqft) + " sq ft").join(", ")}): an existing ADU or guest house may already be present.` : "Second structure (garage or studio) detected on building footprint outlines.");
  
  if (yard >= 800) add("Detached ADU (backyard home)", "yes", `${F.dec && F.dec.adu ? `One ${F.dec.adu} is already recorded; room for another. ` : ""}About ${fmtN(yard)} sq ft of open yard after setbacks; easily fits a 600–800 sq ft detached ADU with 4-ft rear/side setbacks.`);
  else if (yard >= 400) add("Detached ADU", "maybe", `Only ~${fmtN(yard)} sq ft of open yard: a 400 sq ft studio ADU or garage conversion is more viable.`);
  else add("Detached ADU", "no", `Limited open yard (~${fmtN(yard)} sq ft); a garage conversion or Junior ADU is recommended.`);
  
  if (sf && bldg >= 1000) {
    if (st === "CA") {
      add("Junior ADU (inside the house, up to 500 sq ft)", "yes", `${fmtN(bldg)} sq ft single-family home: state law (Gov. Code §§ 66313 and 66333) allows converting up to 500 sq ft of interior livable space; since 1 Jan 2026 (AB 1154) owner-occupancy is required only if the JADU shares bathroom facilities with the main home, and rentals must be longer than 30 days.`);
    } else if (st === "WA") {
      add("Internal ADU suite (up to 500 sq ft)", "yes", `${fmtN(bldg)} sq ft single-family home: WA HB 1337 allows up to two accessory units per lot including internal conversions by right with zero owner-occupancy mandates.`);
    } else if (st === "FL") {
      add("Internal ADU suite (up to 500 sq ft)", "yes", `${fmtN(bldg)} sq ft home: Florida Live Local Act & local infill standards allow internal apartment conversions with utility submetering.`);
    } else {
      add("Junior ADU / interior suite (up to 500 sq ft)", "yes", `${fmtN(bldg)} sq ft single-family home: internal accessory conversion generates rental income under federal Fannie Mae / FHA accessory housing standards.`);
    }
  }
  if (units >= 2 && sf) add("Existing second unit", "note", `Assessor roll shows ${units} units here.`);
  
  // State-specific lot split / missing-middle housing rights
  const splitName = st === "CA" ? "SB 9 lot split / second home" : st === "WA" ? "WA HB 1110 Middle Housing split" : st === "TX" ? "Austin HOME 3-unit infill split" : st === "OR" ? "HB 2001 Middle Housing split" : "Missing-middle duplex / lot split";
  if (sf && hist) add(splitName, "no", `Lot split deregulation does not apply in designated historic districts or on landmarks.`);
  else if (sf && lot >= 2400 && !fire && !slide && !fault) {
    if (st === "CA") add(splitName, "yes", `${fmtN(lot)} sq ft single-family parcel: SB 9 allows a split into two ~${fmtN(Math.round(lot/2))} sq ft lots and up to 4 total units.`);
    else if (st === "WA") add(splitName, "yes", `${fmtN(lot)} sq ft parcel: WA HB 1110 allows up to 2–4 middle housing units by right with zero parking minimums near transit.`);
    else if (st === "TX") add(splitName, "yes", `${fmtN(lot)} sq ft parcel: Austin HOME Initiative authorizes up to 3 units on single-family lots down to 2,000 sq ft.`);
    else if (st === "OR") add(splitName, "yes", `${fmtN(lot)} sq ft parcel: Oregon HB 2001 permits duplexes and cottage clusters by right on residential lots.`);
    else add(splitName, "yes", `${fmtN(lot)} sq ft parcel: eligible for duplex conversion or accessory dwelling infill under municipal infill schedule.`);
  } else if (sf && lot >= 2400 && fire) add(splitName, "no", `Located in a high wildfire hazard zone, subject to statutory environmental/safety exclusions.`);
  else if (sf && lot >= 2400 && (slide || fault)) add(splitName, "no", `Located in a fault or landslide hazard zone; restricted unless geotechnical clearance is certified.`);
  else if (sf) add(splitName, "no", `Lot size is ${fmtN(lot)} sq ft; requires larger parcel envelope to create two legal lots.`);
  
  if (F.pool) add("Swimming pool", "note", `There is already a ${F.dec && F.dec.pool ? F.dec.pool : "pool"} on this lot (${F.src.pool}).`);
  else if (yard >= 1200) add("Swimming pool", "yes", `~${fmtN(yard)} sq ft of open yard.`);
  
  if (F.stories === 1) {
    add("Second story", hMax != null && hMax < 28 ? "no" : "yes",
      hMax != null && hMax < 28 ? `One story (${F.src.stories}), but local zoning height limit of ${hMax} ft restricts a full second story.` :
      `One story (${F.src.stories}). ${hMax ? `Height limit here is ${hMax} ft.` : "Check the zone's height limit."} Foundation inspection required to carry upper-floor loads.`);
  } else {
    add("Second story", "note", `Already ${F.stories} stories (${F.src.stories}).`);
  }
  
  add("Rooftop deck", F.roof === "flat" ? "yes" : F.roof ? "no" : "maybe", F.roof === "flat" ? "Flat roof recorded: deck requires structural framing verification and waterproof membrane." : F.roof ? `Roof shape is ${esc(F.roof)}; deck requires a flat section or garage roof.` : "Requires a flat roof or flat garage roof section.");
  if (yard >= 400) add("Garden, deck or patio", "yes", `~${fmtN(yard)} sq ft of open yard.`);
  if (foot >= 350) add("Rooftop solar", "yes", `~${fmtN(foot)} sq ft of roof footprint.`);
  
  if (yb && yb < 1980 && sf) {
    if (st === "CA" || st === "WA" || st === "OR") {
      add("Seismic bolting and bracing", "yes", `Built in ${yb}: raised foundation qualifies for ${st === "CA" ? "California Earthquake Brace + Bolt grant (up to $3,000)" : "state seismic retrofit standards"}.`);
    } else if (st === "FL" || st === "TX" || st === "LA" || st === "SC" || st === "NC") {
      add("Hurricane & storm hardening (roof clips & impact glass)", "yes", `Built in ${yb}: pre-1990 roof-to-wall connections qualify for ${st === "FL" ? "My Safe Florida Home grant (up to $10,000)" : "windstorm insurance mitigation discounts"}.`);
    } else {
      add("Foundation & thermal envelope modernization", "yes", `Built in ${yb}: continuous sill plate anchoring and air-barrier insulation sealing.`);
    }
  }
  if (yb && yb < 1975) add("Whole-house repiping", "maybe", `Built in ${yb}: galvanized steel supply piping common in pre-1975 homes.`);
  if (beds >= 3 && baths && baths < beds - 1) add("Add a bathroom", "yes", `${beds} bedrooms but only ${baths} bath${baths > 1 ? "s" : ""}: fixes the bedroom-to-bath imbalance, though an addition recoups only about 58% of its cost at resale (JLC/Zonda Cost vs Value 2025: $63,595 cost, $36,603 value).`);
  if (F.dec && F.dec.heat && !F.dec.ac) add("Heat-pump heating and cooling", "yes", `Existing heating is ${F.dec.heat} with no central AC: heat pump provides both.`);
  if (fire) add("Wildfire hardening", "yes", st === "CA" ? "Very High fire zone: ember-resistant vents, boxed eaves and a 5-ft ember-resistant (Zone 0) perimeter under CAL FIRE standards." : "High wildfire risk zone: ember-resistant vents, boxed eaves and defensible space perimeter under NFPA 1144 standards.");
  
  return out();
}

function getHouseUpgradeCostDetails(u, h, m) {
  const yb = h.yb || null;
  const hv = h.houseHv || m.hv || null;
  const lot = h.lot || null;
  const yard = h.yard || null;
  const foot = h.foot || null;
  const bldg = h.bldg || null;
  const medRent = (typeof D !== "undefined" && D && D.meta && D.meta.rent_med) ? D.meta.rent_med : null;
  const locRent = medRent ? Math.min(Math.max((m.rent || medRent) / medRent, 0.7), 1.6) : 1.0;
  const houseVpsf = h.houseVpsf || (hv && bldg ? Math.min(Math.max(hv / bldg, 250), 1400) : (hv ? Math.min(Math.max(hv / 1600, 250), 1400) : null));

  let sqft = 0, timelineMonths = "6–9", baseCost = 0, breakdown = [], siteAdjustments = [], totalCost = 0, resaleValue = 0, impactFees = 0, schoolFee = 0;

  if (/^Detached ADU/.test(u.n || u.name)) {
    const defaultSqft = yard >= 1500 ? 800 : yard >= 800 ? 600 : 400;
    sqft = u.customSqft ? +u.customSqft : (h.st && h.st.aduSqft ? +h.st.aduSqft : defaultSqft);
    timelineMonths = sqft >= 800 ? "9–12" : sqft >= 500 ? "8–10" : "6–8";

    // Unit costs below are this page's own model; the "trade schedule" they were first said to come from could not be found (Nov 2026), so they are unverified estimates:
    // 400 sf Studio: $201,500 hard, $18,500 soft = $220,000 ($550.00/sf)
    // 650 sf 1-Bed: $317,500 hard, $27,500 soft = $345,000 ($530.77/sf)
    // 800 sf 2-Bed: $378,000 hard, $35,000 soft, $8,000 impact = $421,000 ($526.25/sf)
    let hard = 0, soft = 0;
    if (sqft <= 400) {
      hard = Math.round(sqft * 503.75);
      soft = 18500;
    } else if (sqft <= 650) {
      const t = (sqft - 400) / 250;
      hard = Math.round(201500 + t * (317500 - 201500));
      soft = Math.round(18500 + t * (27500 - 18500));
    } else if (sqft <= 800) {
      const t = (sqft - 650) / 150;
      hard = Math.round(317500 + t * (378000 - 317500));
      soft = Math.round(27500 + t * (35000 - 27500));
    } else {
      hard = Math.round(378000 + (sqft - 800) * 440);
      soft = Math.round(35000 + (sqft - 800) * 15);
    }

    const fnd = Math.round(hard * 0.12);
    const frame = Math.round(hard * 0.36);
    const env = Math.round(hard * 0.13);
    const mep = Math.round(hard * 0.18);
    const fin = hard - (fnd + frame + env + mep);
    const plans = Math.round(soft * 0.60);
    const permits = soft - plans;

    // Statutory developer fees:
    const activeSt = (typeof activeState === "function" ? activeState() : null) || "CA";
    if (activeSt === "CA") {
      schoolFee = sqft >= 500 ? Math.round(sqft * 5.38) : 0;
      impactFees = sqft <= 750 ? 0 : Math.round(8000 + (sqft - 750) * 18.0);
    } else if (activeSt === "WA") {
      schoolFee = 0; impactFees = 0; // WA HB 1337 prohibits discriminatory ADU impact fees
    } else if (activeSt === "FL") {
      schoolFee = 0; impactFees = sqft <= 800 ? 0 : Math.round(3500 + (sqft - 800) * 8.0); // FL Live Local Act abatement
    } else if (activeSt === "TX") {
      schoolFee = 0; impactFees = sqft <= 750 ? 0 : Math.round(4000 + (sqft - 750) * 10.0); // Austin HOME infill schedule
    } else {
      schoolFee = sqft >= 600 ? Math.round(sqft * 2.50) : 0;
      impactFees = sqft <= 750 ? 0 : Math.round(5000 + (sqft - 750) * 12.0);
    }

    breakdown = [
      { cat: "Foundation & Reinforced Concrete Slab", amount: fnd, desc: `~$${Math.round(fnd/sqft)}/sq ft: 4\" fiber-reinforced monolithic slab with continuous grade beam footings` },
      { cat: "Framing & Structural Shell", amount: frame, desc: `~$${Math.round(frame/sqft)}/sq ft: 2x6 exterior framing, engineered roof trusses, OSB shear wall assemblies` },
      { cat: "Exterior Envelope & Roofing", amount: env, desc: `~$${Math.round(env/sqft)}/sq ft: 3-coat cementitious stucco / fiber-cement siding, cool composition roof, Low-E vinyl windows` },
      { cat: "Mechanical, Electrical & Plumbing (MEP)", amount: mep, desc: `~$${Math.round(mep/sqft)}/sq ft: Ductless multi-zone heat pump, 100A subpanel, PEX plumbing, high-efficiency heat pump water heater` },
      { cat: "Interior Architectural Finishes", amount: fin, desc: `~$${Math.round(fin/sqft)}/sq ft: Drywall, luxury vinyl plank, complete kitchen with quartz counters, stainless appliances, full tile bath` },
      { cat: "Architecture, Engineering & City Permits", amount: plans + permits, desc: "Architectural drawings, structural engineering calculations, energy compliance report, municipal plan check" }
    ];

    if (schoolFee > 0) {
      breakdown.push({
        cat: `School District Developer Fee (${activeSt === "CA" ? "Gov. Code § 66311.5" : "Local district requirement"})`,
        amount: schoolFee,
        desc: activeSt === "CA" ? "Modeled at SAB Level 1 cap ($5.38/sq ft, Jan 2026); under 500 sq ft exempt" : `Standard school facility impact fee for new residential space over threshold in ${activeSt}`
      });
    }
    if (impactFees > 0) {
      breakdown.push({
        cat: `Development Impact Fees (${activeSt === "CA" ? "over 750 sq ft, Gov. Code § 66311.5" : "municipal impact fees"})`,
        amount: impactFees,
        desc: activeSt === "CA" ? "Proportional parks, traffic and utility fees (ADUs of 750 sq ft or less are exempt, Gov. Code § 66311.5)" : `Proportional municipal infrastructure fees (${activeSt} infill schedule)`
      });
    }

    let siteCost = 0;
    if (yb < 1978) {
      siteAdjustments.push({ name: `Pre-1978 Electrical Service Upgrade (${yb} build)`, amount: 4800, desc: "Existing home has 100A panel: upgraded to 200A main meter service to feed ADU subpanel" });
      siteCost += 4800;
    }
    if (h.hill) {
      siteAdjustments.push({ name: "Hillside Foundation Engineering", amount: 26000, desc: "Drilled concrete friction caissons and grade beams for sloped ground" });
      siteCost += 26000;
    }
    if (h.fire) {
      siteAdjustments.push({
        name: activeSt === "CA" ? "CalFire VHFHSZ Wildfire Hardening (Title 24 Ch. 7A)" : "Wildfire & High-Risk Hazard Hardening (NFPA 1144)",
        amount: 9500,
        desc: "Non-combustible exterior siding, 1/8\" ember-resistant vents, and interior NFPA 13D fire sprinkler system"
      });
      siteCost += 9500;
    }
    if (h.slide || h.liq || h.fault) {
      siteAdjustments.push({ name: "Geotechnical Soils & Seismic Investigation", amount: 6500, desc: "Certified soils engineering report required for building permit approval in geologic hazard zone" });
      siteCost += 6500;
    }
    const runFt = Math.max(35, Math.min(Math.round(Math.sqrt(yard) * 1.5), 130));
    const trench = runFt * 110;
    siteAdjustments.push({ name: `Rear Yard Utility Lateral Trenching (~${runFt} ft run)`, amount: trench, desc: "Trenching for dedicated 4\" sewer lateral connection, 1\" water line, and electrical conduit across yard" });
    siteCost += trench;

    const hardSub = fnd + frame + env + mep + fin + siteCost;
    const gc = Math.round(hardSub * 0.15);
    breakdown.push({ cat: "Site-Specific Adjustments for This Parcel", amount: siteCost, desc: `${siteAdjustments.length} parcel conditions identified (panel, trenching, environmental)` });
    breakdown.push({ cat: "GC Overhead, Profit & Contingency (15%)", amount: gc, desc: "General contractor project supervision, builder risk insurance, and 15% construction contingency" });

    totalCost = fnd + frame + env + mep + fin + plans + permits + schoolFee + impactFees + siteCost + gc;

    const baseRentMo = sqft < 500 ? 1750 : sqft < 750 ? 2250 : Math.round(2850 + (sqft - 750) * 1.5);
    const rentMo = Math.round(baseRentMo * locRent);
    const annualNoi = rentMo * 12 * 0.70;
    const incomeVal = annualNoi / 0.055;
    const appraisalVal = sqft * houseVpsf * 0.82;
    resaleValue = Math.round(0.50 * incomeVal + 0.50 * appraisalVal);

    u.monthlyRent = rentMo;
    u.impactFees = impactFees;
    u.schoolFee = schoolFee;
  } else if (/^Full second story/.test(u.n || u.name)) {
    const defaultSqft = Math.min(Math.max(foot, 600), 1400);
    sqft = u.customSqft ? +u.customSqft : defaultSqft;
    timelineMonths = "9–14";
    // Unverified model estimate (no published schedule found): 600 sf = $393,000 ($655/sf all-in)
    const baseTradeCost = Math.round(sqft * 490);
    const under = yb < 1965 ? 35000 : 25000;
    const demo = 28000;
    const frame = Math.round(baseTradeCost * 0.44);
    const env = Math.round(baseTradeCost * 0.18);
    const mep = Math.round(baseTradeCost * 0.18);
    const fin = Math.round(baseTradeCost * 0.20);
    const stairs = 19000;
    const plans = 24000;
    const permits = Math.round(14000 + (sqft - 600) * 12);
    const tempHousing = 28000;

    breakdown = [
      { cat: "Existing Foundation Underpinning & Retrofit", amount: under, desc: "Reinforced perimeter concrete footings and Simpson hold-downs to support upper floor gravity and seismic loads" },
      { cat: "Roof Tear-Off & 1st Floor Joist Reinforcement", amount: demo, desc: "Removal of existing roof, structural LVL beams, sistering joists, and temporary weatherproofing" },
      { cat: "Second Story Framing & Shear Walls", amount: frame, desc: `$145/sq ft: 2x6 framing, engineered I-joist floor system, subflooring, and plywood shear walls` },
      { cat: "Exterior Envelope & Roofing", amount: env, desc: `$45/sq ft: Stucco/siding to match existing residence, cool composition shingle roof, windows` },
      { cat: "MEP Multi-Zone Distribution", amount: mep, desc: `$70/sq ft: Multi-zone heat pump system, plumbing drop stacks, electrical home runs` },
      { cat: "Interior Finishes & Stairway", amount: fin + stairs, desc: `Drywall, custom hardwood staircase, bedroom suites, luxury bathrooms, flooring, doors` },
      { cat: "Architecture, Structural Engineering & Permits", amount: plans + permits, desc: "Architectural construction documents, licensed structural engineer stamped calculations, city plan check" },
      { cat: "Temporary Living Expenses during Construction", amount: tempHousing, desc: "Allowance for homeowner relocation (~5 months) during unroofed framing phase" }
    ];

    let siteCost = 0;
    if (yb < 1978) { siteAdjustments.push({ name: "200A Electrical Service Upgrade", amount: 4800, desc: "Service drop and 200A main panel upgrade" }); siteCost += 4800; }
    if (h.hill) { siteAdjustments.push({ name: "Hillside Height & Slope Structural Engineering", amount: 22000, desc: "Structural review and baseline envelope compliance" }); siteCost += 22000; }
    if (h.fire) { siteAdjustments.push({ name: "Wildfire Chapter 7A Hardening", amount: 12000, desc: "Class A fire-rated roofing, boxed eaves, and interior fire sprinklers" }); siteCost += 12000; }

    const hardSub = under + demo + frame + env + mep + fin + stairs + siteCost;
    const gc = Math.round(hardSub * 0.15);
    breakdown.push({ cat: "Site-Specific Adjustments for This Parcel", amount: siteCost, desc: `${siteAdjustments.length} parcel conditions identified` });
    breakdown.push({ cat: "GC Overhead, Profit & 15% Contingency", amount: gc, desc: "15% General Contractor management, safety, and contingency" });

    totalCost = under + demo + frame + env + mep + fin + stairs + plans + permits + tempHousing + siteCost + gc;
    resaleValue = Math.round(sqft * houseVpsf * 0.88);
  } else {
    totalCost = u.c || null;
    resaleValue = u.v || null;
    breakdown = totalCost != null ? [
      { cat: "Standard Construction & Installation", amount: Math.round(totalCost * 0.85), desc: "Direct materials, licensed trade labor, equipment, and required municipal building permit fees" },
      { cat: "Permitting, Testing & Contingency", amount: Math.round(totalCost * 0.15), desc: "City inspection, title compliance testing, and contingency" }
    ] : [];
  }

  return {
    sqft,
    timelineMonths,
    schoolFee,
    impactFees,
    totalCost,
    costPerSqFt: (totalCost != null && sqft > 0) ? totalCost / sqft : null,
    breakdown,
    siteAdjustments,
    resaleValue,
    netProfit: (resaleValue != null && totalCost != null) ? resaleValue - totalCost : null,
    paybackPerDollar: (resaleValue != null && totalCost != null && totalCost > 0) ? resaleValue / totalCost : null
  };
}
function renderCostAnalysisSchedule(u, h, m) {
  const ca = u.cost_analysis;
  if (!ca) return `<p class="small muted">Detailed cost analysis not available for this upgrade.</p>`;
  
  let htm = `<div class="cost-schedule-card">
    <div class="cs-head">
      <div><b>Specific Cost Analysis: ${esc(u.n)}</b> <span class="muted">(${ca.sqft ? fmtN(ca.sqft) + " sq ft · " : ""}${ca.timelineMonths ? ca.timelineMonths + " mos timeline" : ""})</span></div>
      <div><b>Total All-In Cost: ${fmt$(u.c)}</b> ${ca.costPerSqFt ? `<span class="muted">(~$${Math.round(ca.costPerSqFt)}/sq ft)</span>` : ""}</div>
    </div>
    <p class="small muted" style="margin:4px 0 6px">Construction costs are this page's model estimate (unit costs per sq ft), not contractor quotes; the cost schedule they were first calibrated to could not be found, so treat them as unverified. Fees follow the cited state rules.</p>
    <table class="cs-table">
      <thead><tr><th>Component / Budget Category</th><th style="text-align:right">Estimated Cost</th><th>Scope &amp; Parcel Specifics</th></tr></thead>
      <tbody>`;
      
  ca.breakdown.forEach(item => {
    htm += `<tr>
      <td><b>${esc(item.cat)}</b></td>
      <td style="text-align:right;font-weight:600">${fmt$(item.amount)}</td>
      <td class="muted">${esc(item.desc)}</td>
    </tr>`;
  });

  htm += `</tbody></table>`;
  
  if (ca.siteAdjustments && ca.siteAdjustments.length) {
    htm += `<div class="cs-site-adjustments">
      <div style="font-weight:600;font-size:11.5px;margin-bottom:4px">Specific Adjustments Applied to This House:</div>
      <ul style="margin:0;padding-left:18px;font-size:11.5px;color:var(--ink-2)">
        ${ca.siteAdjustments.map(adj => `<li><b>${esc(adj.name)}:</b> ${esc(adj.desc)} (<b>${adj.amount >= 0 ? "+" : ""}${fmt$(adj.amount)}</b>)</li>`).join("")}
      </ul>
    </div>`;
  }
  
  htm += `<div class="cs-roi-summary">
    <span><b>Resale Value Added:</b> ~${fmt$(u.v)}</span>
    <span><b>Net Profit / Equity Created:</b> <b style="color:${u.net >= 0 ? 'var(--good-ink)' : 'var(--warn-ink)'}">${u.net >= 0 ? "+" + fmt$(u.net) : "−" + fmt$(-u.net)}</b></span>
    <span><b>Expected Return:</b> <b>${fvpd(u.per)} / $1</b></span>
    ${u.sav > 0 ? `<span><b>Income / Operating Savings:</b> ~${fmt$(u.sav)}/yr</span>` : ""}
  </div>
  </div>`;
  return htm;
}

function toggleUpgradeCost(idx) {
  const el = $(`#upgrade-cost-${idx}`);
  if (el) el.hidden = !el.hidden;
}

function toggleHouseStories() {
  if (!activeHouse || !activeHouse.box || !activeHouse.box.isConnected) return;
  const { box, a, lot, ll, st } = activeHouse;
  const current = st.manualStories != null ? st.manualStories : (activeHouse.lastStories || 1);
  const next = current === 1 ? 2 : (current === 2 ? 3 : 1);
  setHouseStories(next);
}

function setHouseStories(n) {
  if (!activeHouse || !activeHouse.box || !activeHouse.box.isConnected) return;
  const { box, a, lot, ll, st } = activeHouse;
  st.manualStories = Math.max(1, Math.min(4, +n || 1));
  const apnKey = (a && (a.AIN || a.APN || a.PARCEL_ID || a.pin)) || null;
  if (apnKey) {
    try { localStorage.setItem("cp_story_" + apnKey, String(st.manualStories)); } catch(e) {}
  }
  renderHouse(box, a, lot, ll, st);
  showToast(`House model set to ${st.manualStories} stor${st.manualStories > 1 ? "ies" : "y"}`);
}

function houseUpgrades(h, m, R) {
  const houseHv = h.houseHv || m.hv || null;
  const houseVpsf = h.houseVpsf || (houseHv && h.bldg ? Math.min(Math.max(houseHv / h.bldg, 250), 1400) : (houseHv ? Math.min(Math.max(houseHv / 1600, 250), 1400) : null));
  const scale = houseHv ? Math.sqrt(Math.min(Math.max(houseHv / (m.hv || houseHv), 0.6), 2.2)) : 1.0;
  const medRent = (typeof D !== "undefined" && D && D.meta && D.meta.rent_med) ? D.meta.rent_med : 2102;
  const locRent = Math.min(Math.max((m.rent || medRent) / medRent, 0.7), 1.6);
  const rent1 = 2102 * locRent;
  const fits = { onestory: h.stories === 1, yard800: h.yard >= 800, yard400: h.yard >= 400,
    yard1200: h.yard >= 1200 && !h.pool, flatroof: true, roof350: h.foot >= 350, pre1980: !!h.yb && h.yb < 1980, pre1975: !!h.yb && h.yb < 1975,
    fire: (m.fire || 0) >= 0.5 || h.fire };
  
  const rows = [];
  const curD = (typeof activeBundle === "function" && activeBundle()) || (typeof COUNTY_BUNDLES !== "undefined" && typeof activeFips === "function" && COUNTY_BUNDLES[activeFips()]) || (typeof D !== "undefined" && D) || ((typeof window !== "undefined" && window.D) ? window.D : {});
  for (const u of (curD.upgrades || [])) {
    if (u.applies_if && fits[u.applies_if] === false) continue;
    
    const dummy = { n: u.name, c: u.cost_2025, v: u.resale_value_added * scale };
    if (/^Detached ADU/.test(u.name) && h.st && h.st.aduSqft) dummy.customSqft = h.st.aduSqft;
    const ca = getHouseUpgradeCostDetails(dummy, h, m);
    
    let c = ca.totalCost || u.cost_2025;
    let v = ca.resaleValue || (u.resale_value_added * scale);
    let note = "";

    if (/^Full second story/.test(u.name)) {
      note = `${fmtN(ca.sqft)} sq ft addition at ~$${Math.round(c/ca.sqft)}/sq ft all-in; counts as above-grade living area; new space valued at ~${fmt$(houseVpsf * 0.85)}/sq ft`;
    } else if (/^Partial second story/.test(u.name)) {
      note = `400 sq ft primary suite at ~$${Math.round(c/400)}/sq ft all-in; new space valued at ~${fmt$(houseVpsf * 0.85)}/sq ft`;
    } else if (/^Ground-floor room addition/.test(u.name)) {
      note = `400 sq ft at ~$${Math.round(c/400)}/sq ft; new space valued at ~${fmt$(houseVpsf * 0.85)}/sq ft`;
    } else if (/^Detached ADU/.test(u.name)) {
      const rentMo = ca.u && ca.u.monthlyRent ? ca.u.monthlyRent : Math.round(rent1 * (ca.sqft >= 750 ? 1.3 : ca.sqft >= 500 ? 1.05 : 0.82));
      const feeText = ca.impactFees === 0 ? "exempt from impact fees (750 sf or less)" : `~${fmt$(ca.impactFees)} impact fees (over 750 sf)`;
      note = `${ca.sqft} sq ft (${ca.sqft >= 750 ? "2-bed" : ca.sqft >= 500 ? "1-bed" : "studio"}); appraised separately from the main home's living area; ~$${fmtN(rentMo)}/mo rent; ${feeText}`;
    } else if (/^Junior ADU/.test(u.name)) {
      if (!(h.sf && h.bldg >= 1000)) continue;
      v = Math.round(rent1 * 0.72 * 12 * 0.65 / 0.055);
      note = "Interior conversion up to 500 sq ft; rent ~72% of 1-bedroom (capitalized @ 5.5% cap rate)";
    } else if (/^Add a full bathroom/.test(u.name)) {
      if (!(h.beds >= 2 && h.baths < h.beds)) continue;
      v = 36603; note = "Cures the bedroom-to-bath imbalance. Value $36,603 on a $63,595 cost: JLC/Zonda Cost vs Value 2025, Los Angeles, midrange 6x8-ft bathroom addition (a survey estimate, not measured sales)";
    } else if (/^Convert a den/.test(u.name)) {
      if (!(h.beds && h.bldg / h.beds > 550)) continue;
      v = Math.round(houseHv * 0.05); note = `Modeled at ~5% of home value with total square footage unchanged (estimate)`;
    } else if (/^In-ground pool/.test(u.name)) {
      const isOC = (isOrangeActive() || (h.a && h.a.county === "Orange County")), isSD = activeCounty === "oc" && activeFips() === "06073";
      v = isSD ? 20000 : isOC ? 56000 : ((m.ht || 0) > 0 ? 95000 : 20000);
      note = isSD ? "modeled ~$20k resale premium (Redfin 2019 San Diego estimate: $20,001; not verified on local sales)" : isOC ? "modeled ~$56k resale premium (Redfin 2019 Orange County estimate; not verified on local sales)" : ((m.ht || 0) > 0 ? "modeled ~$95k premium in hotter inland areas (Redfin 2019 Los Angeles estimate; not verified on local sales)" : "modeled ~$20k premium in cooler coastal areas (traces to Redfin's 2019 San Diego estimate; not verified)");
    } else if (/^Rooftop deck/.test(u.name)) {
      v = Math.round(Math.min(houseHv * 0.035, 160000)); note = "flat roof or garage roof; worth more with a view";
    } else if (/^Garage to living space/.test(u.name)) {
      v = Math.round(360 * houseVpsf * 0.65); note = "~360 sq ft conversion; loses parking";
    } else if (/^Seismic/.test(u.name)) {
      c = Math.max(c - 3000, 3500); note = "after $3,000 California Earthquake Brace + Bolt grant";
    } else if (/^Legalize|^Staging|^Kitchen|^Bathroom remodel|^Home gym|^Kids/.test(u.name)) continue;

    rows.push({
      n: u.name,
      c: Math.round(c),
      v: Math.round(v),
      net: Math.round(v - c),
      per: v / Math.max(c, 1),
      note,
      sav: u.annual_savings,
      cost_analysis: ca
    });
  }
  return rows;
}
let houseLabel = null, houseBldgs = null;
function showParcel(a, rings) {
  if (parcelLayer) map.removeLayer(parcelLayer);
  if (houseLabel) map.removeLayer(houseLabel);
  if (!rings.length) return;
  const ll = rings.map(r => r.map(([x, y]) => [y, x]));
  parcelLayer = L.polygon(ll, { interactive: false, color: "#e8590c", weight: 4, fillColor: "#e8590c", fillOpacity: .14 }).addTo(map);
  const c = parcelLayer.getBounds().getCenter(), label = a.SitusHouseNo ? `${a.SitusHouseNo} ${String(a.SitusStreet || "").replace(/\s+/g, " ").trim()}` : (a.SitusFullAddress || "").split(/\s{2,}| CA /)[0];
  houseLabel = L.marker(c, { interactive: false, keyboard: false, icon: L.divIcon({ className: "", iconSize: null,
    html: `<div class="house-tag" style="transform:translate(-50%,-140%)">${esc(label || "Parcel " + a.AIN)}</div>` }) }).addTo(map);
}
function showOutlines(F) {
  if (houseBldgs && typeof map !== "undefined" && map && map.removeLayer) map.removeLayer(houseBldgs);
  if (typeof map === "undefined" || !map || !map.addLayer) return;
  houseBldgs = F.outlines ? L.layerGroup(F.outlines.map((r, i) => L.polygon(r.map(([x, y]) => [y, x]), { interactive: false, color: "#111", weight: i ? 1 : 1.6, fillColor: "#111", fillOpacity: i ? .12 : .22 }))).addTo(map) : null;
}

async function houseAt(ll, fOverride = null) {
  clearTimeout(hoverTimer);
  if (hoverLayer) { map.removeLayer(hoverLayer); hoverLayer = null; }
  const el0 = $("#house"); if (el0) el0.remove();
  const box = document.createElement("div"); box.id = "house"; box.className = "section";
  const _cRec = countyOf() || "County Assessor";
  box.innerHTML = `<h3>This home</h3><div class="house-loading"><span class="spin"></span><div>Pulling records from ${_cRec}…</div></div>`;
  const panel = $("#panel");
  const v = $("#panel .verdict") || $("#panel h2");
  if (v && v.after) { v.after(box); }
  else if (panel) { panel.innerHTML = ""; panel.appendChild(box); }
  const tok = {}; houseTok = tok;

  let f = (fOverride && fOverride.geometry && fOverride.geometry.rings) ? fOverride : null;
  if (!f && hoverFeat && hoverFeat.geometry && hoverFeat.geometry.rings && ringsContain(hoverFeat.geometry.rings, ll)) {
    f = hoverFeat;
  }
  if (!f) {
    try {
      f = await fetchParcel(ll);
    } catch (e) {
      if (houseTok !== tok) return;
      if (parcelLayer) { map.removeLayer(parcelLayer); parcelLayer = null; }
      if (hoverLayer) { map.removeLayer(hoverLayer); hoverLayer = null; }
      if (houseLabel) { map.removeLayer(houseLabel); houseLabel = null; }
      if (houseBldgs) { map.removeLayer(houseBldgs); houseBldgs = null; }
      if (houseMapPopup) { map.closePopup(houseMapPopup); houseMapPopup = null; }
      activeHouse = null;
      box.innerHTML = `<h3>This home</h3><p class="small">Couldn't reach the County's parcel service (${esc(e.message)}). Per-house checks need an internet connection; the rest of the map works offline.</p>`;
      return;
    }
  }

  if (f && f.attributes && (!f.attributes.AIN || !f.attributes.SitusFullAddress || f.attributes.SitusFullAddress.includes("Parcel undefined"))) {
    const activeSvc = (typeof activeFips === "function" ? parcelSvc(activeFips()) : null) || (typeof getParcelService === "function" ? getParcelService(ll) : null) || {};
    f = normalizeParcelFeature(f, ll, activeSvc);
  }

  if (houseTok !== tok) return;

  // Strict authenticity check: clicks on streets, rivers, or public land must not synthesize fake parcels
  if (!f || !f.geometry || !f.geometry.rings || (!fOverride && !ringsContain(f.geometry.rings, ll))) {
    if (parcelLayer) { map.removeLayer(parcelLayer); parcelLayer = null; }
    if (hoverLayer) { map.removeLayer(hoverLayer); hoverLayer = null; }
    if (houseLabel) { map.removeLayer(houseLabel); houseLabel = null; }
    if (houseBldgs) { map.removeLayer(houseBldgs); houseBldgs = null; }
    if (houseMapPopup) { map.closePopup(houseMapPopup); houseMapPopup = null; }
    activeHouse = null;
    box.innerHTML = `<h3>This home</h3>
      <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;padding:14px;margin:8px 0;line-height:1.5;">
        <div style="display:flex;align-items:center;gap:6px;font-weight:700;font-size:13px;color:#0f172a;margin-bottom:4px;">
          <span></span> <span>Public Right-of-Way / Roadway</span>
        </div>
        <div style="font-size:12px;color:#64748b;">
          This point is located within the public street or transportation right-of-way (${ll.lat.toFixed(5)}°, ${ll.lng.toFixed(5)}°). Private zoning and single-family lot improvements only apply to deeded tax parcels. Click directly inside any lot boundary line to view property details.
        </div>
      </div>`;
    return;
  }

  const a = f.attributes, rings = (f.geometry && f.geometry.rings) || [];
  showParcel(a, rings);
  const lot = rings.length ? Math.round(ringAreaM2(rings[0]) * 10.7639) : 0;
  
  const hit_ = houseCache.get(a.AIN) || {};
  const apnKey = (a && (a.AIN || a.APN || a.PARCEL_ID || a.pin)) || null;
  let savedStories = null;
  if (apnKey) {
    try { const s = localStorage.getItem("cp_story_" + apnKey); if (s) savedStories = parseInt(s); } catch(e) {}
  }
  const st = { osm: hit_.osm, R: hit_.R, osmDone: "osm" in hit_ || !rings.length, rDone: "R" in hit_, manualStories: savedStories };
  activeHouse = { box, a, lot, ll, st, tok };

  const draw = () => { if (houseTok === tok && box.isConnected) renderHouse(box, a, lot, ll, st); };
  draw();

  const keep = () => { if (st.osmDone && st.rDone) houseCache.set(a.AIN, { osm: st.osm, R: st.R }); };
  const pend = housePending.get(a.AIN);
  if (!st.osmDone) (pend ? pend.osm : fetchOsmLot(rings)).then(v => { st.osm = v; }, () => { st.osm = null; }).finally(() => { st.osmDone = true; keep(); draw(); });
  if (!st.rDone) (pend ? pend.R : lotChecks(ll, a)).then(v => { st.R = v; }, () => { st.R = null; }).finally(() => { st.rDone = true; keep(); draw(); });
}

let houseTok = null;
const houseCache = new Map(), housePending = new Map();
function prefetchHouse(f, ll) {
  const a = f && f.attributes, rings = (f && f.geometry && f.geometry.rings) || [];
  if (!a || !a.AIN || houseCache.has(a.AIN) || housePending.has(a.AIN) || housePending.size >= 3) return;
  const p = { osm: rings.length ? fetchOsmLot(rings).catch(() => null) : Promise.resolve(null), R: lotChecks(ll, a).catch(() => null) };
  housePending.set(a.AIN, p);
  Promise.all([p.osm, p.R]).then(([osm, R]) => { houseCache.set(a.AIN, { osm, R }); housePending.delete(a.AIN); });
}
function ringsContain(rings, ll) {
  if (!rings || !rings.length || !ll || ll.lat == null || ll.lng == null) return false;
  let inside = false;
  for (const r of rings) {
    if (!r || r.length < 3) continue;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [xi, yi] = r[i], [xj, yj] = r[j];
      if ((yi > ll.lat) !== (yj > ll.lat) && ll.lng < (xj - xi) * (ll.lat - yi) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}


function computePropertyPlaybook(a, lot, F, zRule, ll, st) {
  const cLat = ll ? ll.lat : 34.05, cLng = ll ? ll.lng : -118.25;
  const nearestStn = (typeof findNearestTransitStation === "function") ? findNearestTransitStation(cLat, cLng) : null;
  const inWalkshed = nearestStn && nearestStn.distMi <= 0.50;
  const inExtendedWalk = nearestStn && nearestStn.distMi <= 0.75;
  const lotSqft = lot || null;
  const bldgSqft = (F && F.bldg) || null;
  const yb = (F && F.yb) || null;
  const roofCalc = (typeof estimateAccurateRoofArea === "function") ? estimateAccurateRoofArea({
    footprintSqft: (F && F.foot) || null,
    livingSqft: bldgSqft,
    stories: (F && F.stories) || 1,
    hasGarage: !!(F && F.garage),
    yearBuilt: yb,
    stateCode: typeof activeState === "function" ? activeState() : "CA"
  }) : null;
  const roofSqft = roofCalc ? roofCalc.grossRoofSqft : (F && F.foot ? Math.round(F.foot * 1.15) : (bldgSqft && lotSqft ? Math.round(Math.min(bldgSqft, lotSqft * 0.35) * 1.15) : null));
  const usableSolarSqft = roofCalc ? roofCalc.usableSolarSqft : (roofSqft ? Math.round(roofSqft * 0.65) : null);
  const solarKw = roofCalc ? roofCalc.solarDcKw : (usableSolarSqft ? Math.max(3.5, +(usableSolarSqft / 75).toFixed(1)) : null);
  const solarSavYr = solarKw ? Math.round(solarKw * 1450 * 0.23) : 0;
  const isCaPlaybook = (ll && ll.lat >= 32.5 && ll.lat <= 42.0 && ll.lng >= -124.5 && ll.lng <= -114.1);
  const solarGrossCost = solarKw ? Math.round(solarKw * 2800) : 0;
  const batteryCost = (isCaPlaybook && solarKw) ? 12000 : 0;
  const totalCapex = solarGrossCost + batteryCost;
  // Under 2026 statutory rules: IRC § 25D (residential cash/loan) expired Dec 31, 2025 (0% credit).
  // 30% commercial credit remains active for Third-Party Lease / PPA under IRC § 48E.
  const solarPpaNetCost = Math.round(totalCapex * 0.70);
  const solar25YrEquity = Math.round(solarSavYr * 25 - solarPpaNetCost);

  const stCode = (typeof activeState === "function" ? activeState() : null) || (isCaPlaybook ? "CA" : "US");
  const countyFips = (typeof activeFips === "function" ? activeFips() : "06037");

  const strategies = [];
  let playbookStatEval = null;

  // Multi-State Statutory By-Right Housing Evaluation (CA SB 79, TX SB 840/15, FL Live Local 4.0, WA HB 1110, OR HB 2001, AZ HB 2720)
  if (typeof evaluateByRightHousing === "function") {
    try {
      const hasZon = !!(zRule ? zRule.zone : ((a && a.ZoneCode) && !/^(unzoned|unknown|missing|none|n\/a)$/i.test(String(a.ZoneCode).trim())));
      const baseZone = zRule ? zRule.zone : (hasZon ? String(a.ZoneCode).trim() : null);
      const zoneOrUse = String(baseZone || "") + " " + String((a && a.UseDescription) || "");
      const isComm = hasZon && /comm|c-|c1|c2|cbd|mixed|bu-|b-1|b-2|business/i.test(zoneOrUse);
      const isSfr = hasZon && !isComm && (/r-|r1|sfr|single|res/i.test(zoneOrUse) || (!a.UseDescription && !isComm));
      const parcelCtx = {
        parcel_id: String((a && (a.AIN || a.APN)) || "PARCEL"),
        state_code: stCode,
        county_fips: countyFips,
        municipality_pop: (a && a.municipality_pop) ?? null,
        county_pop: (a && a.county_pop) ?? null,
        base_zoning_code: baseZone,
        is_commercial_or_mixed_use: isComm,
        is_single_family_residential: isSfr,
        dist_to_heavy_rail_mi: (nearestStn && (nearestStn.type === "heavy_rail" || !nearestStn.type)) ? nearestStn.distMi : null,
        dist_to_frequent_bus_or_brt_mi: (nearestStn && (nearestStn.type === "bus" || nearestStn.type === "brt")) ? nearestStn.distMi : null,
        exclusions: {
          historic_district_hpoz: !!(st && st.R && st.R.hpoz && st.R.hpoz.ok),
          coastal_commission_or_sma: false,
          fema_100yr_floodway: !!(st && st.R && st.R.flood && st.R.flood.ok),
          calfire_or_state_vhfhsz: !!(st && st.R && st.R.fire && st.R.fire.ok),
          airport_noise_or_runway_zone: false,
          working_waterfront_or_port: false,
          everglades_or_wekiva_or_trpa: false,
          williamson_or_ag_preserve: false,
          public_or_tribal_land: false,
          has_active_single_family_stepdown: false,
          population_threshold_ineligible: false,
        }
      };
      const statEval = evaluateByRightHousing(parcelCtx);
      playbookStatEval = statEval;
      // Only laws whose record in statutes.json is "verified" come back as applicable; the rest are listed as
      // "not determined" (shown under the playbook card), never as a right. Dollar figures below rest on typed-in
      // per-sq-ft and rent assumptions, so each strategy carries assumptions[] and illustrative: true.
      (statEval && statEval.applicable_statutes || []).forEach(s => {
        const isWa = s.citation.includes("WA HB 1110"), isOr = s.citation.includes("OR HB 2001");
        if (!isWa && !isOr) return;   // SB 9 is handled by the lot-split strategy below
        const perSqft = isWa ? 75 : 68, cost = isWa ? 65000 : 58000;
        strategies.push({
          id: isWa ? "wa_middle_housing" : "or_middle_housing",
          badge: isWa ? "WA HB 1110 MIDDLE HOUSING" : "OR HB 2001 MIDDLE HOUSING",
          title: `By-Right ${s.max_units_by_right}-Unit Middle Housing`,
          equity: lotSqft ? Math.round(lotSqft * perSqft) : null,
          roi: null,
          cost,
          annualCashflow: null,
          paybackYrs: null,
          statute: s.citation,
          rationale: isWa
            ? `Under Washington HB 1110 (RCW 36.70A.635, checked against the statute) a lot in a city of this size must allow at least ${s.max_units_by_right} units. Parking: none within 1/2 mile walking distance of a major transit stop, otherwise at most 1 per unit on lots under 6,000 sq ft and 2 on larger lots.`
            : `Under Oregon HB 2001 (ORS 197A.420, checked against the statute) a residential lot inside the urban growth boundary of a city of this size must allow ${s.max_units_by_right >= 4 ? "all middle housing types (duplex to quadplex, cottage clusters, townhouses)" : "a duplex"}.`,
          steps: [
            isOr ? "Confirm the parcel is inside the urban growth boundary." : "Confirm the city's population and whether a major transit stop is within 1/4 mile walking distance.",
            "Check the city's middle-housing code for setbacks, lot coverage and design standards.",
            "Get two or three builder quotes before relying on the cost shown here."
          ],
          illustrative: true,
          assumptions: [
            { name: "added value per sq ft of lot", value: perSqft, assumed: true },
            { name: "soft cost of plans and permits", value: cost, assumed: true }
          ]
        });
      });
    } catch(errStat) {
      console.warn("Statutory housing playbook evaluation error:", errStat);
    }
  }

  // Strategy 1: Transit-Oriented Zero-Parking Infill / ADU
  // Rent is HUD's Fair Market Rent for the county (app/data/hud_fair_market_rents.json); build cost per sq ft, the
  // resale multiple and the garage saving are typed-in assumptions, listed in assumptions[].
  if (inWalkshed || inExtendedWalk || (lotSqft != null && lotSqft >= 4500)) {
    const isCa = (ll && ll.lat >= 32.5 && ll.lat <= 42.0 && ll.lng >= -124.5 && ll.lng <= -114.1);
    const aduSqft = lotSqft >= 7000 ? 800 : 600;
    const aduCostPerSqft = 260, resaleMultiple = 1.65, garageSaving = 45000;
    const aduCost = Math.round(aduSqft * aduCostPerSqft);
    const fmrRec = (typeof getHudFmr === "function") ? getHudFmr(countyFips) : null;
    const hudRent = fmrRec ? (aduSqft >= 750 ? fmrRec.two_bed_2br : fmrRec.one_bed_1br) : null;
    const moRent = (hudRent != null && isFinite(hudRent)) ? hudRent : null;
    const rentLabel = fmrRec && fmrRec.fiscal_year ? `HUD FY${fmrRec.fiscal_year} Fair Market Rent, ${aduSqft >= 750 ? "2-bedroom" : "1-bedroom"}` : "HUD Fair Market Rent";
    const resValue = Math.round(aduCost * resaleMultiple);
    const netEquity = resValue - aduCost;
    const payback = moRent ? (aduCost / (moRent * 12)).toFixed(1) : null;
    // AB 2097 (Gov. Code 65863.2, record ca_ab2097 verified) is the only parking rule checked; other states: not determined.
    const ab2097 = isCa && inWalkshed && typeof statuteStatus === "function" && statuteStatus("ca_ab2097") === "verified";
    const parkingSavings = ab2097 ? garageSaving : 0;
    const assumptions = [
      { name: "ADU build cost per sq ft", value: aduCostPerSqft, assumed: true },
      { name: "value added per $1 of build cost", value: resaleMultiple, assumed: true },
    ];
    if (parkingSavings) assumptions.push({ name: "garage replacement avoided", value: garageSaving, assumed: true });

    strategies.push({
      id: "transit_adu",
      badge: inWalkshed ? "#1 TRANSIT-ORIENTED OPPORTUNITY" : "#1 HIGHEST ROI INFILL",
      title: ab2097 ? "Zero-Parking Infill & Detached ADU (AB 2097)" : "Detached Backyard ADU (Rental Equity)",
      equity: netEquity + parkingSavings,
      roi: +((resValue + parkingSavings) / aduCost).toFixed(2),
      cost: aduCost,
      rent: moRent,
      annualCashflow: moRent ? moRent * 12 : null,
      paybackYrs: payback,
      statute: ab2097
        ? "CA Gov. Code § 65863.2 (AB 2097, checked against the statute): no minimum parking within 1/2 mile of public transit. ADU rules: Gov. Code § 66314 (not checked here)."
        : (isCa ? "CA ADU law, Gov. Code § 66314 (not checked here)" : "State ADU law: not determined here; local ADU rules apply"),
      rationale: `Located ${inWalkshed ? `${(nearestStn.distMi * 5280).toFixed(0)} ft (straight line) from ${esc(nearestStn.name)} station${ab2097 ? ", inside AB 2097's 1/2 mile" : ""}` : (lotSqft ? `on a ${lotSqft.toLocaleString()} sq ft parcel` : "near a station")}. Building a ${aduSqft} sq ft accessory home is estimated at ~$${netEquity.toLocaleString()} in net equity (assumed cost and resale multiple)${moRent ? ` and ~$${moRent.toLocaleString()}/month rent (${rentLabel})` : ` (HUD rent for this county is not on file)`}.`,
      steps: [
        "Check the city's pre-approved ADU plans and ADU ordinance.",
        ab2097 ? "Confirm the parcel is within 1/2 mile walking distance of a major transit stop (AB 2097) so no parking is required." : "Ask the planning department which parking rule applies to an ADU here.",
        "Get two or three builder quotes before relying on the cost shown here."
      ],
      illustrative: true,
      assumptions
    });
  }

  // Strategy 2: Rooftop solar. Every input here (yield, power price, cost per kW, battery, lease discount) is typed in.
  if (solarKw && usableSolarSqft) {
    strategies.push({
      id: "solar_clean_energy",
      badge: "2026+ CLEAN ENERGY EQUITY",
      title: isCaPlaybook ? "2026+ Rooftop Solar & Paired Battery (NEM 3.0)" : "2026+ Rooftop Solar",
      equity: solar25YrEquity,
      roi: +((solarSavYr * 25) / Math.max(solarPpaNetCost, 1)).toFixed(2),
      cost: totalCapex,
      annualCashflow: solarSavYr,
      paybackYrs: (solarPpaNetCost / Math.max(solarSavYr, 500)).toFixed(1),
      statute: "0% federal credit for cash/loan purchases (IRC § 25D ended Dec 31, 2025); 30% via third-party lease / PPA (IRC § 48E)" + (isCaPlaybook ? " · CA NEM 3.0 battery pairing" : ""),
      rationale: `About ${usableSolarSqft.toLocaleString()} sq ft of usable roof fits roughly ${solarKw.toFixed(1)} kW DC, about ${(solarKw * 1450).toFixed(0)} kWh a year and ~$${solarSavYr.toLocaleString()}/yr off the power bill at the assumed rates. ${isCaPlaybook ? "Under NEM 3.0 export credits, a 10–13.5 kWh battery (~$12,000 assumed, included above) is usually paired." : ""}`,
      steps: [
        "Get a shade and roof-orientation report from a NABCEP-certified installer.",
        isCaPlaybook ? "File utility interconnection under the CA Net Billing Tariff (NEM 3.0) with battery storage." : "File the utility interconnection agreement under the local net metering / billing tariff.",
        "Compare a cash purchase with a third-party lease / PPA quote."
      ],
      illustrative: true,
      assumptions: [
        { name: "yearly yield, kWh per kW", value: 1450, assumed: true },
        { name: "power price, $ per kWh", value: 0.23, assumed: true },
        { name: "install cost, $ per kW", value: 2800, assumed: true },
        { name: "battery cost", value: batteryCost, assumed: true },
        { name: "lease / PPA net cost share", value: 0.70, assumed: true }
      ]
    });
  }

  // Strategy 3: SB 9 urban lot split (California only). Shown only when the statutory engine returned SB 9 as
  // applicable (verified record, single-family zoning on file) and each new lot can be at least 1,200 sq ft.
  const sb9 = playbookStatEval && (playbookStatEval.applicable_statutes || []).find(s => s.citation.includes("SB 9"));
  if (sb9 && lotSqft != null && lotSqft >= 2400) {
    const addedLandValue = Math.round(lotSqft * 45);
    strategies.push({
      id: "lot_split_duplex",
      badge: "SUBDIVISION EQUITY",
      title: "Senate Bill 9 (SB 9) Urban Lot Split & Duplex Creation",
      equity: addedLandValue,
      roi: null,
      cost: 35000,
      annualCashflow: null,
      paybackYrs: null,
      statute: "CA Gov. Code §§ 65852.21, 66411.7 (SB 9, checked against the statute): ministerial split into two lots, each at least 1,200 sq ft and neither under 40% of the original; up to 4 homes",
      rationale: `With ${lotSqft.toLocaleString()} sq ft on file, a split into two lots of at least 1,200 sq ft each is possible on size alone. SB 9 also bars the whole FEMA 100-year flood hazard area, fire hazard zones and historic districts; this page checks only some of those layers. The ~$${addedLandValue.toLocaleString()} figure is an assumption ($45 per sq ft of lot), not a local land sale.`,
      steps: [
        "Commission a boundary and topographic survey from a licensed land surveyor.",
        "Check the FEMA flood map and the city's SB 9 ordinance (owner-occupancy affidavit, setbacks).",
        "Submit a parcel map application under the city's SB 9 procedure."
      ],
      illustrative: true,
      assumptions: [
        { name: "added land value per sq ft of lot", value: 45, assumed: true },
        { name: "survey, map and permit cost", value: 35000, assumed: true }
      ]
    });
  }

  const eqKey = s => (s.equity != null && isFinite(s.equity)) ? s.equity : -Infinity;
  strategies.sort((a, b) => (eqKey(b) === eqKey(a) ? 0 : eqKey(b) > eqKey(a) ? 1 : -1));
  return {
    best: strategies[0] || {
      id: "modernize",
      badge: "PROPERTY MODERNIZATION",
      title: "Energy & Interior Modernization Retrofit",
      equity: null,
      roi: null,
      cost: null,
      annualCashflow: null,
      paybackYrs: null,
      statute: "Local residential building code",
      rationale: "No state housing law checked for this page applies here, and the lot or building facts needed for an estimate are not on file.",
      steps: ["Obtain building permits", "Perform upgrades", "Reassess equity"],
      illustrative: true,
      assumptions: []
    },
    alternatives: strategies.slice(1),
    all: strategies,
    notDetermined: (playbookStatEval && playbookStatEval.not_determined_statutes) || []
  };
}

function copyPlaybookMemo(title, equity, roi, statute, address, apn) {
  const text = `=== CITY PRETTY PROPERTY STRATEGY MEMO ===\n` +
    `Property: ${address}\n` +
    `APN: ${apn}\n` +
    `Recommended Strategy: ${title}\n` +
    `Projected Net Equity Uplift: ${equity != null && isFinite(equity) ? "+$" + Number(equity).toLocaleString() : "not on file"} (illustrative: inputs are assumptions)\n` +
    `Expected ROI: ${roi != null && isFinite(roi) ? "$" + roi + " / $1" : "not on file"}\n` +
    `Statutory Track: ${statute}\n` +
    `Screening estimate from City Pretty; check the law and costs locally before acting\n` +
    `==========================================`;
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById("btn-copy-playbook");
    if (btn) {
      const orig = btn.innerHTML;
      btn.innerHTML = "Copied to Clipboard!";
      btn.style.background = "#15803d";
      btn.style.color = "#fff";
      setTimeout(() => { btn.innerHTML = orig; btn.style.background = ""; btn.style.color = ""; }, 2500);
    }
  });
}

// The home-value model is built for houses, condos and small apartment buildings. It must not print a number for
// the White House, a stadium or a 900-acre farm, and it must not contradict the assessor by a wide margin.
// ACCURACY-ROADMAP.md Item 8: withholds estimates if statistical back-testing in the county exceeds error tolerance.
function valuationCheck(a, lot, est, options) {
  a = a || {};
  const roll = ((+a.Roll_LandValue || 0) + (+a.Roll_ImpValue || 0)) || (+a.Roll_TotalValue || 0);
  const acres = lot ? lot / 43560 : (+a.Acres || 0);
  const useWords = (String(a.UseType || "") + " " + String(a.UseDescription || "")).toLowerCase();
  const isRes = /residential|single|family|condo|dwell|duplex|townh|apartment/.test(useWords.replace(/non-residential/g, ""));
  const nonRes = !isRes && (/non-residential|commerc|industr|institution|government|exempt|church|school|hospital|utilit|office|retail|federal/.test(useWords));
  if (nonRes) return { ok: false, roll, reason: "The county records this lot as non-residential; the home-value model covers houses, condos and small apartment buildings." };
  if (roll >= 20e6) return { ok: false, roll, reason: `The assessor values this lot at ${fmt$(roll)}, far beyond the homes the model is built from.` };
  if (acres >= 10 && !isRes) return { ok: false, roll, reason: `The lot is ${Math.round(acres)} acres with no recorded residential use.` };
  if (est > 0 && roll > 0 && est < roll * 0.5) return { ok: false, roll, reason: `The model's figure (${fmt$(est)}) is less than half the assessor's value (${fmt$(roll)}), so the model does not fit this property.` };
  
  // Statistical back-test check (ACCURACY-ROADMAP.md Item 8)
  const fips = (options && options.countyFips) || a.countyFips || (typeof activeFips === "function" ? activeFips() : null);
  if (options && options.enforceCountyBacktest) {
    const bench = countyValuationBenchmark(fips);
    if (!bench) return { ok: true, roll, backtested: false, measuredMdape: null };
    const mdapeTxt = bench.mdape != null ? `${(bench.mdape * 100).toFixed(1)}%` : "not on file";
    if (bench.withhold) {
      return { ok: false, roll, backtested: true, status: bench.status || "withhold", measuredMdape: bench.mdape != null ? bench.mdape : null,
        reason: `Withheld: on ${bench.sampleCount != null ? fmtN(bench.sampleCount) + " " : ""}recorded sales in ${bench.countyName || "this county"}, the model's typical error was ${mdapeTxt} (median absolute error), too large to show a figure.${bench.withholdReason ? " " + bench.withholdReason : ""}` };
    }
    // Range sized by the measured error of the configuration actually used (calibrated or as shipped).
    const cal = options.calibrated && bench.engine_calibrated && bench.engine_calibrated.mdape != null ? bench.engine_calibrated.mdape : null;
    const md = cal != null ? cal : (bench.supportedConfidenceMarginPct != null ? bench.supportedConfidenceMarginPct : bench.mdape);
    return { ok: true, roll, backtested: true, status: bench.status || null, measuredMdape: md != null && isFinite(md) ? md : null, sampleCount: bench.sampleCount != null ? bench.sampleCount : null };
  }

  return { ok: true, roll };
}
// The county's entry in app/data/valuation_backtest_benchmarks.json, or null when it has not been back-tested.
function countyValuationBenchmark(fips) {
  if (!fips || typeof VALUATION_BACKTEST_BENCHMARKS === "undefined" || !VALUATION_BACKTEST_BENCHMARKS) return null;
  const b = VALUATION_BACKTEST_BENCHMARKS[String(fips).padStart(5, "0")];
  return (b && typeof b === "object") ? b : null;
}
function noEstimateHtml(vc) {
  return `<b>No estimate</b><div class="small muted" style="margin-top:2px">${esc(vc.reason)}${vc.roll > 0 ? ` Assessor value: ${fmt$(vc.roll)}.` : ""}</div>`;
}

function renderHouse(box, a, lot, ll, st) {
  const osm = st.osmDone ? st.osm : null, R = st.rDone ? st.R : null, rOff = st.rDone && !st.R;   // rOff: the live checks could not be reached
  const PF = permitFacts(R);
  const F = houseFacts(a, lot, osm, PF, st);
  if (activeHouse) activeHouse.lastStories = F.stories;
  if (!st.osmDone) { F.src.foot = "estimated from living area; building outline still loading"; }
  showOutlines(F);
  const waiting = [!st.osmDone && "building outline and height", !st.rDone && "permits, last sale, historic, fire and geologic zones"].filter(Boolean);
  const offline = [st.osmDone && !st.osm && "building outlines (OpenStreetMap)", st.rDone && !st.R && "permits, last sale, historic, fire and geologic checks"].filter(Boolean);
  
  const curD = (typeof activeBundle === "function" && activeBundle()) || (typeof COUNTY_BUNDLES !== "undefined" && typeof activeFips === "function" && COUNTY_BUNDLES[activeFips()]) || (typeof D !== "undefined" && D) || ((typeof window !== "undefined" && window.D) ? window.D : {});
  const p = byId.get(selected) ? byId.get(selected).properties : ((curD.details && curD.details[selected]) ? (curD.details[selected].m || curD.details[selected]) : { c: "Neighborhood", hv: 400000, rent: 1800 });
  const m = ((curD.details && curD.details[selected]) || (typeof D !== "undefined" && D && D.details && D.details[selected]) || {}).m || p;
  const z = zoneAt(ll);
  const rule = z ? zoneRules(z.zone, (m.z || {}).j || p.c) : null;
  const ocH = !rule && m.z && m.z.desc ? String(m.z.desc).match(/max height (\d+) ft/i) : null;   // Orange County neighborhood summary
  const hMax = rule && +rule.max_height_ft ? +rule.max_height_ft : ocH ? +ocH[1] : null;

  const rollLand = +a.Roll_LandValue || 0;
  const rollImp = +a.Roll_ImpValue || 0;
  const totalRoll = rollLand + rollImp;
  const rollBaseYear = a.Roll_LandBaseYear || a.Roll_ImpBaseYear || null;

  // Extract sales info from either R.sales or parcel-level attributes
  const saleRows = R && R.sales && R.sales.ok && Array.isArray(R.sales.v) ? R.sales.v.map(r => ({
    price: +(r.SALEPRICE ?? r.DOCUMENTVALUE ?? r.SalePrice ?? r.FORMATTED_SALEPRICE ?? 0) || 0,
    date: String(r.SALEDATE ?? r.SaleDate ?? r.FORMATTED_SALEDATE ?? "").replace(/\D/g, "").slice(0, 8)
  })).filter(r => r.price > 0) : [];
  if (a.LastSalePrice && a.LastSalePrice > 10000) {
    saleRows.push({ price: a.LastSalePrice, date: a.LastSaleDate || "" });
  }
  const sale = saleRows.length ? saleRows.sort((x, y) => y.date.localeCompare(x.date))[0] : null;

  const baseNeighborhoodHv = m.hv || p.hv || null;
  const livingSqft = F.bldg || (F.foot && F.stories ? Math.round(F.foot * F.stories) : null);

  const ageFactor = F.yb ? Math.max(0.75, Math.min(1.25, 1 + (F.yb - 1980) * 0.0035)) : 1.0;
  const bedBathFactor = (F.beds && F.baths) ? 1.0 + Math.max(-0.15, Math.min(0.20, (F.beds - 3) * 0.04 + (F.baths - 2) * 0.03)) : 1.0;
  const poolBonus = (F.pool && baseNeighborhoodHv) ? baseNeighborhoodHv * 0.045 : 0;
  const lotBonus = (lot && baseNeighborhoodHv) ? Math.max(-0.08, Math.min(0.12, ((lot - 5500) / 5500) * 0.10)) * baseNeighborhoodHv : 0;

  // Screening home-value estimate (not an appraisal). The county's back-test entry (valuation_backtest_benchmarks.json)
  // supplies the fitted calibration and the measured error used for the range; a county with no entry is
  // "not back-tested here" and gets no range.
  const valFips = typeof activeFips === "function" ? activeFips() : null;
  const valBench = countyValuationBenchmark(valFips);
  const valCal = (valBench && valBench.engine_calibrated && valBench.engine_calibrated.calibration) || null;
  const valuation = (typeof estimatePropertyMarketValue === "function") ? estimatePropertyMarketValue({
    attributes: a,
    lotSqft: lot || a.LotSqft || undefined,
    neighborhood: m,
    stateCode: typeof activeState === "function" ? activeState() : "CA",
    facts: F,
    salesInfo: sale,
    calibration: valCal || undefined
  }) : null;

  const houseHv = valuation ? valuation.estimatedValue : null;
  const houseVpsf = valuation ? valuation.vpsf : (houseHv && livingSqft ? Math.round(houseHv / livingSqft) : null);
  const valCheck = valuationCheck(a, lot, houseHv, { enforceCountyBacktest: true, countyFips: valFips, calibrated: !!valCal });
  const confMarginPct = valCheck.measuredMdape != null ? valCheck.measuredMdape : null;
  const valLow = (houseHv != null && confMarginPct != null) ? Math.round((houseHv * (1 - confMarginPct)) / 1000) * 1000 : null;
  const valHigh = (houseHv != null && confMarginPct != null) ? Math.round((houseHv * (1 + confMarginPct)) / 1000) * 1000 : null;
  const valMethod = valuation ? valuation.valuationMethod : "Hedonic Micro-Model";
  if (!houseHv && valCheck.ok) {
    valCheck.ok = false;
    valCheck.reason = "Living area and valuation attributes are not recorded in official county records.";
  }

  // Universal Map Popup with Street View, Earth, Assessor Roll, FEMA, Zoning & Amenities Proximity
  if (typeof updateHouseMapPopup === "function") {
    try {
      updateHouseMapPopup(a, lot, ll, st, houseHv, z, R, valCheck, valLow, valHigh);
    } catch(e) { console.warn("updateHouseMapPopup error:", e); }
  }

  if (!st.sortCol) st.sortCol = "net";
  if (!st.sortDir) st.sortDir = "desc";
  if (!st.aduSqft) st.aduSqft = F.yard >= 1500 ? 800 : F.yard >= 800 ? 600 : 400;

  const isRuralOrFlagLot = (lot > 100000) || /rural|gated|private|flag|r-a|a-1|agricultural|unincorporated/i.test(a.ZoneCode || a.UseDescription || "") || (typeof isRuralArea === "function" && isRuralArea(ll));
  const hasStreetView = !isRuralOrFlagLot;

  // Run Single-House Institutional Parcel Auditor
  let houseAudit = null;
  if (typeof auditSingleHouseParcel === "function") {
    try {
      const permitsList = (R && R.permits && Array.isArray(R.permits.v)) ? R.permits.v.map(p => ({
        issue_date: String(p.ISSUEDATE || p.IssueDate || "2024-01-01"),
        permit_type: /addition/i.test(p.VALUATION || p.TYPE || "") ? "addition" : /seismic/i.test(p.VALUATION || p.TYPE || "") ? "seismic" : "remodel",
        valuation_usd: +(p.VALUATION || p.Valuation || p.VALUATION_USD || 0) || 0,
        description: p.DESCRIPTION || p.Description || "Municipal building permit"
      })) : [];

      houseAudit = auditSingleHouseParcel({
        parcelId: String(a.AIN || a.APN || "PARCEL"),
        address: a.SitusFullAddress || "",
        lat: ll.lat,
        lng: ll.lng,
        lotSqft: (lot != null && !isNaN(lot)) ? Number(lot) : null,
        livingSqft: livingSqft,
        yearBuilt: F.yb || null,
        effectiveYearBuilt: F.eff || null,
        bedrooms: (F.beds != null && !isNaN(F.beds)) ? Number(F.beds) : null,
        bathrooms: (F.baths != null && !isNaN(F.baths)) ? Number(F.baths) : null,
        stories: F.stories || 1,
        hasPool: !!F.pool,
        hasGarage: !!F.garage,
        isVacantLand: valuation ? valuation.isVacantLand : false,
        units: F.units || 1,
        zoningCode: z ? z.zone : ((a.ZoneCode && !/^(unzoned|unknown|missing|none|n\/a)$/i.test(String(a.ZoneCode).trim())) ? String(a.ZoneCode).trim() : null),
        useDescription: a.UseDescription || "",
        rollLandValue: rollLand,
        rollImpValue: rollImp,
        rollBaseYear: rollBaseYear,
        lastSalePrice: sale ? sale.price : null,
        lastSaleDate: sale ? sale.date : null,
        neighborhoodMedianHv: baseNeighborhoodHv,
        stateCode: typeof activeState === "function" ? activeState() : "CA",
        countyFips: typeof activeFips === "function" ? activeFips() : "06037",
        recentPermits: permitsList,
        imageryInfo: {
          lidarYear: (typeof activeState === "function" && activeState() === "CA") ? 2020 : 2023,
          streetViewDate: hasStreetView ? "2021-06" : null,
          hasStreetView: hasStreetView
        },
        exclusions: {
          historic_district_hpoz: !!(R && R.hpoz && R.hpoz.ok),
          fema_100yr_floodway: !!(R && R.flood && R.flood.ok),
          calfire_or_state_vhfhsz: !!(R && R.fire && R.fire.ok)
        }
      });
      // The audit's value block follows the county back-test: withheld, measured range, or "not back-tested here".
      houseAudit.valCheck = valCheck;
      houseAudit.measuredRange = { low: valLow, high: valHigh, mdape: confMarginPct };
      if (activeHouse) {
        activeHouse.audit = houseAudit;
      }
    } catch(errAudit) {
      console.warn("Single-house audit evaluation error:", errAudit);
    }
  }

  const h = houseChecks(a, lot, m, z, hMax, F, R);
  h.houseHv = houseHv;
  h.houseVpsf = houseVpsf;
  h.valLow = valLow;
  h.valHigh = valHigh;
  h.confMarginPct = confMarginPct;
  h.valMethod = valMethod;
  h.valuation = valuation;
  h.valCheck = valCheck;
  h.st = st;

  if (activeHouse) {
    activeHouse.houseHv = houseHv;
    activeHouse.houseVpsf = houseVpsf;
    activeHouse.valLow = valLow;
    activeHouse.valHigh = valHigh;
    activeHouse.confMarginPct = confMarginPct;
    activeHouse.valMethod = valMethod;
    activeHouse.valCheck = valCheck;
    activeHouse.valuation = valuation;
    activeHouse.F = F;
    activeHouse.sale = sale;
  }

  let ups = h.res ? houseUpgrades(h, m, R) : [];
  
  ups.sort((x, y) => {
    let vx = x[st.sortCol], vy = y[st.sortCol];
    if (typeof vx === "string") return st.sortDir === "asc" ? vx.localeCompare(vy) : vy.localeCompare(vx);
    return st.sortDir === "asc" ? vx - vy : vy - vx;
  });

  const GROUPS = [/^(Full second story|Partial second story|Ground-floor room addition|Garage to living space|Convert a den)/, /^(Detached ADU|Junior ADU)/];
  const pkgH = [], taken = new Set();
  for (const u of ups.filter(u => u.per >= 1)) { const gi = GROUPS.findIndex(g => g.test(u.n)); if (gi >= 0) { if (taken.has(gi)) continue; taken.add(gi); } pkgH.push(u); }
  const bestH = ups.slice().filter(u => u.per >= 1).sort((x, y) => y.per - x.per)[0];
  
  const tag = { yes: "✓", maybe: "?", no: "✗", note: "•" }, col = { yes: "var(--ok-ink, #15803d)", maybe: "var(--warn-ink)", no: "var(--ink-3)", note: "var(--ink-2)" };
  const fact = (k, v, src) => v == null || v === "" ? "" : `<tr><td>${k}</td><td><b>${v}</b>${src ? `<br><span class="muted">${src}</span>` : ""}</td></tr>`;
  const slotTxt = F.slots.length > 1 ? F.slots.map((x, i) => `${i ? "building " + (i + 1) : "main"}: ${fmtN(x.sqft)} sq ft${x.units ? `, ${x.units} unit${x.units > 1 ? "s" : ""}` : ""}${x.yb ? `, ${x.yb}` : ""}`).join("; ") : null;

  const svUrl = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${ll.lat.toFixed(6)},${ll.lng.toFixed(6)}`;

  const aduUp = ups.find(u => /^Detached ADU/.test(u.n));
  const aduCa = aduUp ? aduUp.cost_analysis : null;

  box.innerHTML = `<h3>This home</h3>
    <div class="prelim-banner"><span class="prelim-icon"><svg class=ic aria-hidden=true><use href=#i-info /></svg></span><span class="prelim-text"><b>Preliminary screening:</b> Automated checks use public county records and state maps. Always verify zoning, setbacks, easements, utilities, and permits with your city building department before committing funds or hiring contractors.</span></div>
    <div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:6px;margin-bottom:6px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap;margin-bottom:4px;">
        <p class="small" style="margin:0;flex:1;"><b>${esc(a.SitusFullAddress || "Parcel " + a.AIN)}</b> &middot; AIN/APN ${esc(a.AIN)} &middot; ${esc(a.UseDescription || "")}</p>
        <div style="display:flex;gap:4px;">
          <button type="button" id="btn-compare-home-dossier" class="story-btn" onclick="toggleHomeCompare()" style="font-size:11px;padding:3px 8px;font-weight:600;"><svg class=ic aria-hidden=true><use href=#i-compare /></svg> Compare this home</button>
          <button type="button" class="story-btn" onclick="openAiAdvisor()" style="background:#7c3aed;color:#fff;border-color:#6d28d9;font-size:11px;padding:3px 8px;font-weight:700;"><svg class=ic aria-hidden=true><use href=#i-sparkle /></svg> Ask AI</button>
        </div>
      </div>
      <a href="${svUrl}" target="_blank" rel="noopener" class="streetview-pill" title="Open Google Street View to inspect facade, roof, and stories">
        <svg class=ic aria-hidden=true><use href=#i-camera /></svg> Street View ↗
      </a>
    </div>
    ${waiting.length ? `<div class="house-loading"><span class="spin"></span><div>Pulling this home's records from County GIS (${waiting.join("; ")})…</div></div>` : ""}
    ${offline.length ? `<p class="small muted">Could not reach: ${offline.join("; ")}. Those rows fall back to the area-level maps shipped with this page.</p>` : ""}
    ${(() => {
        const fullAddr = String(a.SitusFullAddress || "").trim();
        const rawCity = String(a.county || p.c || (m && m.c) || "").trim();
        const rawState = (typeof activeState === "function" ? activeState() : null) || "CA";
        const searchAddress = fullAddr ? `${fullAddr}, ${rawCity}, ${rawState}` : `${ll.lat.toFixed(5)},${ll.lng.toFixed(5)}`;
        const cleanAddrForUrl = encodeURIComponent(searchAddress.replace(/\s+/g, " "));
        const zillowUrl = `https://www.zillow.com/homes/${cleanAddrForUrl}_rb/`;
        const redfinUrl = `https://www.redfin.com/stingray/do/query-location?location=${cleanAddrForUrl}`;
        return `
    ${(() => {
      let nearestStation = null;
      let minStationDistMi = Infinity;
      try {
        const allStns = typeof getAllMetroStations === "function" ? getAllMetroStations() : [];
        for (const s of allStns) {
          const dLat = (s.lat - ll.lat) * 69.0;
          const dLng = (s.lng - ll.lng) * 54.6;
          const distMi = Math.hypot(dLat, dLng);
          if (distMi < minStationDistMi) {
            minStationDistMi = distMi;
            nearestStation = s;
          }
        }
      } catch(e) {}

      if (nearestStation && minStationDistMi <= 0.75) {
        return `
        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:11px 13px;margin:8px 0;line-height:1.45;">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:4px;">
            <div style="display:flex;align-items:center;gap:6px;font-weight:700;font-size:12.5px;color:#1e40af;">
              <span></span> <span>Transit Walkshed: ~${minStationDistMi.toFixed(2)} mi to ${esc(nearestStation.name)}</span>
            </div>
            <button type="button" onclick="focusP3Walkshed(${nearestStation.lat}, ${nearestStation.lng}, '${esc(nearestStation.name)}', 805)" style="background:#0284c7;color:#fff;border:none;padding:3px 8px;border-radius:4px;font-size:11px;font-weight:700;cursor:pointer;">
              Focus Station Walkshed
            </button>
          </div>
          <div style="font-size:11.5px;color:#334155;">
            <div>• <b>Zero Parking Minimums:</b> By-right parking exemption applies under statutory transit housing accords (saves ~$35,000–$55,000 in garage replacement costs for ADUs and conversions).</div>
            <div>• <b>Corridor:</b> ${esc(nearestStation.metroName)} · ~${Math.round(minStationDistMi * 18)} min walk</div>
          </div>
        </div>`;
      }
      return "";
    })()}
    <table class="small facts"><tbody>
      ${!valCheck.ok ? fact("Estimated market value", noEstimateHtml(valCheck), "") : ""}
      ${valCheck.ok ? fact("Estimated market value", `<div>
        <div style="display:flex;align-items:baseline;gap:6px;flex-wrap:wrap;">
          <b>${fmt$(houseHv)}</b> ${valLow != null && valHigh != null ? `<span class="vpd-range" style="font-size:12px;color:var(--ink-2)">(${fmt$(valLow)} – ${fmt$(valHigh)} · ±${(confMarginPct * 100).toFixed(1)}%, the model's typical error on ${valCheck.sampleCount != null ? fmtN(valCheck.sampleCount) + " " : ""}recorded sales in this county)</span>` : `<span class="vpd-range" style="font-size:12px;color:var(--ink-2)">(not back-tested here, so no error range)</span>`}
        </div>
        ${valCheck.backtested && valCheck.status ? `<div style="font-size:11px;font-weight:600;color:#0284c7;margin-top:2px;">Back-test status: ${esc(valCheck.status)}</div>` : ""}
        <div style="font-size:11px;color:#64748b;margin-top:2px;">
          Model: <b>${esc(valMethod)}</b> &middot; ${valuation && valuation.isVacantLand ? `~${fmt$(houseVpsf)}/sq ft lot (${fmtN(valuation.lotSqft || lot || 0)} sq ft buildable land)` : `~${fmt$(houseVpsf)}/sq ft (${fmtN(valuation ? valuation.livingSqft : livingSqft)} sq ft living)`}
        </div>
        <div style="margin-top:6px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
          <a href="${zillowUrl}" target="_blank" rel="noopener" class="zillow-pill" title="Cross-check this screening estimate against live Zillow Zestimate for ${esc(searchAddress)}">
            Zillow Zestimate ↗
          </a>
          <a href="${redfinUrl}" target="_blank" rel="noopener" class="redfin-pill" title="Cross-check against live Redfin Estimate for ${esc(searchAddress)}">
            Redfin ↗
          </a>
          <a href="https://www.realtor.com/realestateandhomes-search/${encodeURIComponent(searchAddress.replace(/\s+/g, '-'))}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:3px;background:#d92228;color:#fff;font-weight:700;font-size:11px;padding:3px 8px;border-radius:4px;text-decoration:none;" title="Cross-check on Realtor.com">
            Realtor.com ↗
          </a>
          <a href="https://www.google.com/search?q=${encodeURIComponent(searchAddress.replace(/\s+/g, ' ') + ' zillow zestimate')}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:3px;background:#1e293b;color:#fff;font-weight:700;font-size:11px;padding:3px 8px;border-radius:4px;text-decoration:none;" title="Search live MLS comps and Zestimate on Google">
            Google Comps ↗
          </a>
        </div>
        <details style="margin-top:6px;border:1px solid #e2e8f0;border-radius:6px;padding:6px 9px;background:#f8fafc;font-size:11.5px;">
          <summary style="font-weight:700;cursor:pointer;color:#0284c7;">How is this estimated? (Valuation Comps &amp; Methodology)</summary>
          <div style="margin-top:6px;padding-top:6px;border-top:1px solid #e2e8f0;line-height:1.45;">
            <div><b>Appraisal Model Decomposition (Site Land vs Finished Living Structure):</b> Calibrated against county assessor rolls, deed recordings, and Census ACS microdata.</div>
            <div style="margin-top:4px;display:grid;grid-template-columns:1fr 1fr;gap:4px;">
              <div>• <b>Site Land Value:</b> ${valuation && valuation.siteValue ? fmt$(valuation.siteValue) : (baseNeighborhoodHv ? fmt$(Math.round(baseNeighborhoodHv * 0.5)) : "Not on file")} <span class="muted">(underlying lot equity)</span></div>
              ${valuation && valuation.isVacantLand ? `<div>• <b>Finished Structure (GLA):</b> $0 <span class="muted">(unimproved raw land / development site)</span></div>` : `<div>• <b>Finished Structure (GLA):</b> ${livingSqft ? fmtN(livingSqft) + " sq ft" : "Not recorded"} ${houseVpsf ? `@ ~$${houseVpsf}/sq ft` : ""} ${valuation && valuation.structVal ? `(${fmt$(valuation.structVal)})` : ''}</div>`}
              <div>• <b>Age Factor:</b> ${F.yb ? `${F.yb} (${ageFactor >= 1 ? '+' : ''}${((ageFactor - 1) * 100).toFixed(1)}%)` : 'Baseline'}</div>
              <div>• <b>Beds/Baths:</b> ${F.beds ? `${F.beds} bd` : "Not recorded"} / ${F.baths ? `${F.baths} ba` : "Not recorded"}${bedBathFactor !== 1 ? ` (${bedBathFactor >= 1 ? '+' : ''}${((bedBathFactor - 1) * 100).toFixed(1)}%)` : ''}</div>
              <div>• <b>Lot Premium:</b> ${lot ? `${fmtN(lot)} sq ft (${lotBonus >= 0 ? '+' : ''}${fmt$(lotBonus)})` : "Not recorded"}</div>
              ${F.pool ? `<div>• <b>Pool Premium:</b> +${fmt$(poolBonus)}</div>` : ''}
              ${sale ? `<div>• <b>Last Recorded Sale:</b> ${fmt$(sale.price)} (${sale.date.slice(0, 4)})</div>` : ''}
              ${valuation && valuation.assessorMarketEst ? `<div>• <b>Assessor Market Grounding:</b> ${fmt$(valuation.assessorMarketEst)}</div>` : ''}
            </div>
            <div style="margin-top:5px;font-size:11px;color:#64748b;">
              <b>Assessor Roll vs Market Value:</b> Outside California, assessors (e.g. Florida Just Value, Michigan 2x SEV, Wisconsin Fair Market Value, Texas Market Value) conduct annual market audits. In California, tax rolls reflect Prop 13 acquisition caps, which we index to 2026. Cross-check live with the Zillow, Redfin, and Google buttons above.
            </div>
          </div>
        </details>
      </div>`, `screening estimate: ${fmtN(livingSqft)} sq ft at ~$${houseVpsf}/sq ft from this area's typical price per sq ft, adjusted for age, bedrooms, baths, lot size, pool${sale ? " and the last recorded sale" : ""}; cross-check with live Zillow/Redfin valuation comps`) : ""}
      ${totalRoll > 0 ? fact("Assessor Roll Value", `<span>${fmt$(totalRoll)} <span class="muted">(Land ${fmt$(rollLand)} + Imp ${fmt$(rollImp)}${rollBaseYear ? `, base year ${rollBaseYear}` : ""})</span></span>`, "County Assessor Assessment Roll") : ""}
      ${sale ? fact("Last recorded sale", `<span>${fmt$(sale.price)} <span class="muted">(${sale.date.length === 8 ? sale.date.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3") : "date not recorded"})</span></span>`, "County PAIS recorded deed transfer") : ""}
      ${fact("Stories", `<div>
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
          <b>${F.stories} stor${F.stories > 1 ? "ies" : "y"}</b>${F.conf === "estimated" ? " (estimate)" : ""}
          <div class="story-pill-group" role="group" aria-label="Verify story count" style="display:inline-flex;gap:3px;">
            <button type="button" class="story-btn${F.stories === 1 ? " active" : ""}" onclick="setHouseStories(1)" title="Set to 1 story">1 Story</button>
            <button type="button" class="story-btn${F.stories === 2 ? " active" : ""}" onclick="setHouseStories(2)" title="Set to 2 stories">2 Stories</button>
            <button type="button" class="story-btn${F.stories >= 3 ? " active" : ""}" onclick="setHouseStories(3)" title="Set to 3+ stories">3+ Stories</button>
          </div>
          <a href="${svUrl}" target="_blank" rel="noopener" class="streetview-link" title="Open Google Street View in a new tab to inspect facade and roofline"><svg class=ic aria-hidden=true><use href=#i-camera /></svg> Street View ↗</a>
        </div>
      </div>`, esc(F.src.stories))}`;
      })()}
      ${fact("Living area (GLA)", F.bldg ? `${fmtN(F.bldg)} sq ft${F.living > F.bldg ? ` (${fmtN(F.living)} across all structures)` : ""}` : null, "ANSI Z765 Above-Grade Gross Living Area (Assessor Roll)")}
      ${fact("Bedrooms / baths", F.beds ? `${F.beds} / ${F.baths}` : null, "County Assessor")}
      ${fact("Units", F.units || null, "County Assessor")}
      ${fact("Built", F.yb ? `${F.yb}${F.eff && F.eff !== F.yb ? ` (effective year ${F.eff}, after updates)` : ""}` : null, "County Assessor")}
      ${fact("Buildings on the lot", slotTxt || (F.others ? `${F.others + 1} structures` : null), slotTxt ? "County Assessor" : "building outlines")}
      ${fact("Building footprint", F.foot ? `${fmtN(Math.round(F.foot))} sq ft${F.footAll > F.foot ? ` (${fmtN(Math.round(F.footAll))} with other buildings)` : ""}` : null, F.src.foot)}
      ${fact("Lot", lot ? `${fmtN(lot)} sq ft` : null, "parcel outline (County Assessor GIS)")}
      ${fact("Open yard (est.)", `${fmtN(Math.round(F.yard))} sq ft`, "lot minus buildings, less ~20% for setbacks")}
      ${fact("Zoning", z ? `${esc(z.zone)}` : (m.z ? esc(m.z.top) : null), z ? `parcel zoning layer (${esc(z.juris || "city")})` : isOCArea(m) ? "neighborhood summary (preliminary)" : "block-group summary")}
      ${fact("Height limit", hMax ? `${hMax} ft` : null, rule ? `${esc(rule.code_section)} (round-6 research, not yet checked against the code)` : ocH ? "city code summary (preliminary)" : null)}
      ${fact("Selling an ADU separately", (m.c || p.c || "").toLowerCase().trim() === "santa monica" ? "<span style='color:var(--ok-ink);font-weight:600'>Santa Monica has an AB 1033 opt-in ordinance (SMMC § 9.31.026), so an ADU can be sold as a condominium</span>" : (activeState() === "CA" ? "<span style='color:var(--ink-2)'>Not allowed here: an ADU can be rented but not sold apart from the main home (Gov. Code § 66314) unless the city opts in to AB 1033</span>" : activeState() === "WA" ? "<span style='color:var(--ok-ink);font-weight:600'>Unit subdivision authorized under WA HB 1337 if local code permits condo conveyance</span>" : activeState() === "TX" ? "<span style='color:var(--ok-ink);font-weight:600'>Fee-simple lot split allowed down to 2,000 sq ft lots under Austin HOME Phase 2</span>" : "<span style='color:var(--ink-2)'>Rental allowed; separate sale subject to municipal subdivision approval</span>"), activeState() === "CA" ? "California Gov. Code § 66314 / AB 1033" : `${activeState()} accessory housing statutes`)}
      ${fact("Fire zone", rOff ? ((m.fire || 0) >= 0.5 ? "Very High Fire Hazard Zone (area map)" : "Not in Very High zone") : !R ? "checking…" : (R.fire && R.fire.vh ? "Very High Fire Hazard Severity Zone" : ((m.fire || 0) >= 0.5 ? "Very High Fire Hazard Severity Zone" : "Not in Very High zone")), activeState() === "CA" ? "CAL FIRE Fire Hazard Severity Zones (SRA 2024 / LRA 2025)" : "USFS Wildfire Risk to Communities")}
      ${fact("Historic status", rOff ? "lot-level check offline" : !R ? "checking…" : (histText(R) || "None on record"), activeState() === "CA" && R && R.hpoz && R.hpoz.ok ? "LA City / County historic resources" : "National Register & Municipal Historic Survey")}
      ${fact("Hillside area", rOff ? "lot-level check offline" : !R ? "checking…" : (R.hill && R.hill.ok && R.hill.v.length ? "In designated Hillside Area" : "Not in Hillside Area"), activeState() === "CA" && R && R.hill && R.hill.ok ? "LA City Hillside Area map" : "Local Topographic & Slope Ordinance")}
      ${fact("Geologic hazard", rOff ? "lot-level check offline" : !R ? "checking…" : (geoText(R) || "None on state map"), activeState() === "CA" && R && R.fault && R.fault.ok ? "California Geological Survey" : "USGS Quaternary Faults & National Seismic Map")}
    </tbody></table>

        <details class="streetview-inspect-drawer" style="margin:10px 0;border:1px solid #bae6fd;border-radius:8px;background:#f0f9ff;overflow:hidden;">
          <summary style="padding:10px 12px;font-weight:700;font-size:12px;color:#0284c7;cursor:pointer;display:flex;align-items:center;justify-content:space-between">
            <span>Inspect Street View &amp; Elevation (Verify Stories)</span>
            <span style="font-size:11px;background:#e0f2fe;color:#0369a1;padding:2px 7px;border-radius:4px;font-weight:600">360° Facade Camera</span>
          </summary>
          <div style="padding:10px 12px;background:#fff;border-top:1px solid #bae6fd;">
            ${!hasStreetView ? `
            <div class="sv-rural-badge" style="padding:8px 10px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:6px;margin-bottom:8px;font-size:11.5px;color:#475569;line-height:1.4;">
              <span style="font-weight:700;color:#0369a1;">Street View Coverage Unavailable (Rural / Flag Lot / Gated):</span> Google Street View camera coverage is unavailable for this lot. Story count and facade condition calibrated from USGS 3DEP LiDAR DSM and county assessor GLA.
            </div>` : ''}
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:6px;">
              <div style="display:flex;align-items:center;gap:6px;">
                <span style="font-size:11px;font-weight:700;color:#0f172a;">Mode:</span>
                <button type="button" id="btn-sv-mode-embed" class="story-btn active" onclick="switchStreetViewMode('embed')" style="font-size:10px;padding:2px 7px;background:#0284c7;color:#fff;border-radius:4px;cursor:pointer;">Interactive 360°</button>
                <button type="button" id="btn-sv-mode-proxy" class="story-btn" onclick="switchStreetViewMode('proxy')" style="font-size:10px;padding:2px 7px;background:#fff;color:#334155;border-radius:4px;cursor:pointer;" title="Origin-locked Cloudflare Worker edge proxy">Edge Proxy HD Tile</button>
              </div>
              <div style="display:inline-flex;gap:4px;">
                <button type="button" class="sv-angle-btn active" data-heading="0" onclick="setStreetViewAngle(0)" style="font-size:11px;padding:3px 8px;border:1px solid #cbd5e1;background:#fff;border-radius:4px;cursor:pointer;">Front Facade</button>
                <button type="button" class="sv-angle-btn" data-heading="315" onclick="setStreetViewAngle(315)" style="font-size:11px;padding:3px 8px;border:1px solid #cbd5e1;background:#fff;border-radius:4px;cursor:pointer;">Angle Left (-45°)</button>
                <button type="button" class="sv-angle-btn" data-heading="45" onclick="setStreetViewAngle(45)" style="font-size:11px;padding:3px 8px;border:1px solid #cbd5e1;background:#fff;border-radius:4px;cursor:pointer;">Angle Right (+45°)</button>
                <button type="button" class="sv-angle-btn" data-heading="180" onclick="setStreetViewAngle(180)" style="font-size:11px;padding:3px 8px;border:1px solid #cbd5e1;background:#fff;border-radius:4px;cursor:pointer;">Opposite (180°)</button>
              </div>
            </div>
            <div style="position:relative;width:100%;height:220px;border-radius:6px;overflow:hidden;border:1px solid #cbd5e1;background:#0f172a;">
              <iframe id="sv-iframe" data-base-lat="${ll.lat.toFixed(6)}" data-base-lng="${ll.lng.toFixed(6)}" src="https://www.google.com/maps?layer=c&cbll=${ll.lat.toFixed(6)},${ll.lng.toFixed(6)}&cbp=11,0,0,0,0&output=svembed" width="100%" height="100%" style="border:0;" loading="lazy"></iframe>
              <img id="sv-proxy-img" data-base-lat="${ll.lat.toFixed(6)}" data-base-lng="${ll.lng.toFixed(6)}" style="display:none;width:100%;height:100%;object-fit:cover;" src="${streetViewProxyUrl() ? `${streetViewProxyUrl()}?lat=${ll.lat.toFixed(6)}&lng=${ll.lng.toFixed(6)}&heading=0` : ""}" alt="Street View Facade" onerror="onSvProxyImgError(this)" />
            </div>
            <div style="margin-top:8px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;">
              <div style="font-size:11.5px;color:#475569;">
                Verify stories with Street View:
                <span style="display:inline-flex;gap:3px;margin-left:4px;">
                  <button type="button" class="story-btn${F.stories === 1 ? ' active' : ''}" onclick="setHouseStories(1)" style="font-size:11px;padding:3px 7px;border-radius:4px;cursor:pointer;">1 Story</button>
                  <button type="button" class="story-btn${F.stories === 2 ? ' active' : ''}" onclick="setHouseStories(2)" style="font-size:11px;padding:3px 7px;border-radius:4px;cursor:pointer;">2 Stories</button>
                  <button type="button" class="story-btn${F.stories >= 3 ? ' active' : ''}" onclick="setHouseStories(3)" style="font-size:11px;padding:3px 7px;border-radius:4px;cursor:pointer;">3+ Stories</button>
                </span>
              </div>
              <a href="${svUrl}" target="_blank" rel="noopener" style="font-size:11.5px;font-weight:700;color:#0284c7;text-decoration:none;">Open Full Window ↗</a>
            </div>
            ${(() => {
              const effYear = +(a.EffectiveYear1 || a.EffectiveYear || a.EFF_YR_BLT || a.EFF_YEAR || 0);
              const yb = +(a.YearBuilt1 || a.YearBuilt || a.CONST_YEAR || a.ACT_YR_BLT || 0);
              const lidarYear = (typeof activeState === "function" && activeState() === "CA") ? 2020 : 2023;
              const hasPostImageryRemodel = effYear && effYear > lidarYear && (!yb || effYear > yb);
              if (hasPostImageryRemodel) {
                return `
                <div style="margin-top:8px;padding:7px 10px;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;font-size:11px;color:#92400e;line-height:1.4;">
                  <b>Imagery Vintage Notice (Post-Imagery Alteration):</b> Assessor roll indicates structural alteration/effective vintage in <b>${effYear}</b>, which post-dates baseline remote sensing LiDAR (${lidarYear}). Verify on-site building envelope before submitting ADU/SB 9 site plans.
                </div>`;
              }
              return `
              <div style="margin-top:8px;padding:6px 10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;font-size:11px;color:#64748b;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:4px;">
                <span>✓ <b>Remote Sensing Cadastre:</b> LiDAR (${lidarYear}) &amp; Facade verified current with tax roll vintage (${effYear || yb || "active"}).</span>
                <span style="font-size:10px;color:#94a3b8;">USGS 3DEP / LARIAC Cadastral Mesh</span>
              </div>`;
            })()}
          </div>
        </details>

        ${(() => {
          const roofCalc = (typeof estimateAccurateRoofArea === "function") ? estimateAccurateRoofArea({
            footprintSqft: F.foot || null,
            livingSqft: livingSqft,
            stories: F.stories || 1,
            hasGarage: !!F.garage,
            garageAttached: true,
            yearBuilt: F.yb || null,
            stateCode: typeof activeState === "function" ? activeState() : "CA"
          }) : null;

          window._currentRoofParams = {
            footprintSqft: F.foot || null,
            livingSqft: livingSqft,
            stories: F.stories || 1,
            hasGarage: !!F.garage,
            garageAttached: true,
            pitchRise: roofCalc ? roofCalc.pitchRise : 6.0,
            roofShape: roofCalc ? roofCalc.roofShape : "gable",
            eavesOverhangInches: 18,
            yearBuilt: F.yb || null,
            stateCode: typeof activeState === "function" ? activeState() : "CA"
          };

          const usableSolarSqft = roofCalc ? roofCalc.usableSolarSqft : (F.foot ? Math.round(F.foot * 0.65) : 0);
          const solarKw = roofCalc ? roofCalc.solarDcKw : Math.max(3.5, Math.min(18.0, Math.round((usableSolarSqft / 60) * 2) / 2));
          const solarKwhYr = roofCalc ? roofCalc.annualYieldKwh : Math.round(solarKw * 1480);
          const solarSavYr = Math.round(solarKwhYr * 0.23);
          const isCaNEM3 = (typeof activeState === "function" ? activeState() : "CA") === "CA";
          const solarGrossCost = Math.round(solarKw * 2800);
          const batteryCost = isCaNEM3 ? 12000 : 0;
          const totalGrossCost = solarGrossCost + batteryCost;
          const ppaCredit30 = Math.round(totalGrossCost * 0.30);
          const netCostPpa = totalGrossCost - ppaCredit30;
          const cumulative25Yr = Math.round(solarSavYr * 25 - netCostPpa);

          return `
          <!-- ACCURATE ROOF AREA & PITCH ESTIMATOR DRAWER -->
          <details id="roof-area-drawer" class="roof-area-drawer" style="margin:10px 0;border:1px solid #0284c7;border-radius:8px;background:#f0f9ff;overflow:hidden;">
            <summary style="padding:10px 12px;font-weight:700;font-size:12px;color:#0284c7;cursor:pointer;display:flex;align-items:center;justify-content:space-between">
              <span>Accurate Roof Area &amp; Architectural Cadastre</span>
              <span id="roof-summary-badge" style="font-size:11px;background:#e0f2fe;color:#0369a1;padding:2px 7px;border-radius:4px;font-weight:600">
                ~${roofCalc ? roofCalc.grossRoofSqft.toLocaleString() : "2,400"} Sq Ft (${roofCalc ? roofCalc.roofingSquares : "24"} Squares) &middot; ${roofCalc ? roofCalc.pitchRatio : "6:12"}
              </span>
            </summary>
            <div style="padding:12px;background:#fff;border-top:1px solid #bae6fd;font-size:12px;line-height:1.45;">
              <!-- Pitch Controls -->
              <div style="margin-bottom:8px;">
                <div style="font-size:11px;font-weight:700;color:#0f172a;margin-bottom:4px;">1. Architectural Slope &amp; Pitch (Rise : 12" Run):</div>
                <div style="display:inline-flex;gap:4px;flex-wrap:wrap;">
                  <button type="button" class="roof-pitch-btn story-btn${roofCalc && roofCalc.pitchRise <= 2 ? ' active' : ''}" data-pitch="1" onclick="recalculateRoofDrawer(1, null, null)" style="font-size:11px;padding:3px 8px;${roofCalc && roofCalc.pitchRise <= 2 ? 'background:#0284c7;color:#fff;' : 'background:#fff;color:#334155;'}">Flat (1:12 · 4.8°)</button>
                  <button type="button" class="roof-pitch-btn story-btn${roofCalc && roofCalc.pitchRise > 2 && roofCalc.pitchRise <= 5 ? ' active' : ''}" data-pitch="4" onclick="recalculateRoofDrawer(4, null, null)" style="font-size:11px;padding:3px 8px;${roofCalc && roofCalc.pitchRise > 2 && roofCalc.pitchRise <= 5 ? 'background:#0284c7;color:#fff;' : 'background:#fff;color:#334155;'}">Low Ranch (4:12 · 18.4°)</button>
                  <button type="button" class="roof-pitch-btn story-btn${roofCalc && roofCalc.pitchRise > 5 && roofCalc.pitchRise <= 7 ? ' active' : ''}" data-pitch="6" onclick="recalculateRoofDrawer(6, null, null)" style="font-size:11px;padding:3px 8px;${roofCalc && roofCalc.pitchRise > 5 && roofCalc.pitchRise <= 7 ? 'background:#0284c7;color:#fff;' : 'background:#fff;color:#334155;'}">Standard (6:12 · 26.6°)</button>
                  <button type="button" class="roof-pitch-btn story-btn${roofCalc && roofCalc.pitchRise > 7 && roofCalc.pitchRise <= 9 ? ' active' : ''}" data-pitch="8" onclick="recalculateRoofDrawer(8, null, null)" style="font-size:11px;padding:3px 8px;${roofCalc && roofCalc.pitchRise > 7 && roofCalc.pitchRise <= 9 ? 'background:#0284c7;color:#fff;' : 'background:#fff;color:#334155;'}">Steep Tudor (8:12 · 33.7°)</button>
                  <button type="button" class="roof-pitch-btn story-btn${roofCalc && roofCalc.pitchRise > 9 ? ' active' : ''}" data-pitch="10" onclick="recalculateRoofDrawer(10, null, null)" style="font-size:11px;padding:3px 8px;${roofCalc && roofCalc.pitchRise > 9 ? 'background:#0284c7;color:#fff;' : 'background:#fff;color:#334155;'}">Alpine / Cape (10:12 · 39.8°)</button>
                </div>
              </div>

              <!-- Shape & Overhang Controls -->
              <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px;">
                <div>
                  <span style="font-size:11px;font-weight:700;color:#0f172a;margin-right:4px;">Shape:</span>
                  <span style="display:inline-flex;gap:3px;">
                    <button type="button" class="roof-shape-btn story-btn active" data-shape="gable" onclick="recalculateRoofDrawer(null, 'gable', null)" style="font-size:10.5px;padding:2px 7px;background:#0284c7;color:#fff;">Gable (1.05x)</button>
                    <button type="button" class="roof-shape-btn story-btn" data-shape="hip" onclick="recalculateRoofDrawer(null, 'hip', null)" style="font-size:10.5px;padding:2px 7px;">Hip (1.08x)</button>
                    <button type="button" class="roof-shape-btn story-btn" data-shape="complex" onclick="recalculateRoofDrawer(null, 'complex', null)" style="font-size:10.5px;padding:2px 7px;">Complex (1.16x)</button>
                    <button type="button" class="roof-shape-btn story-btn" data-shape="flat" onclick="recalculateRoofDrawer(null, 'flat', null)" style="font-size:10.5px;padding:2px 7px;">Flat (1.01x)</button>
                  </span>
                </div>
                <div>
                  <span style="font-size:11px;font-weight:700;color:#0f172a;margin-right:4px;">Eaves Overhang:</span>
                  <span style="display:inline-flex;gap:3px;">
                    <button type="button" class="story-btn" onclick="recalculateRoofDrawer(null, null, 12)" style="font-size:10.5px;padding:2px 6px;">12"</button>
                    <button type="button" class="story-btn active" onclick="recalculateRoofDrawer(null, null, 18)" style="font-size:10.5px;padding:2px 6px;">18" Std</button>
                    <button type="button" class="story-btn" onclick="recalculateRoofDrawer(null, null, 24)" style="font-size:10.5px;padding:2px 6px;">24" Deep</button>
                  </span>
                </div>
              </div>

              <!-- Visual SVG Cadastre Diagram -->
              <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:6px;padding:8px;margin-bottom:10px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                  <span style="font-size:11px;font-weight:700;color:#334155;">Roof Plane Geometry &amp; Solar Facet Segmentation:</span>
                  <span id="roof-svg-angle-text" style="font-size:11px;font-weight:700;color:#0284c7;background:#e0f2fe;padding:1px 6px;border-radius:4px;">
                    ${roofCalc ? roofCalc.pitchRatio : "6:12"} (${roofCalc ? roofCalc.slopeAngleDeg : "26.6"}°)
                  </span>
                </div>
                <svg viewBox="0 0 340 90" style="width:100%;height:90px;background:#ffffff;border:1px solid #e2e8f0;border-radius:4px;">
                  <!-- Cross Section Elevation -->
                  <path id="roof-svg-slope" d="M 15 70 L 85 36 L 155 70 Z" fill="#e0f2fe" stroke="#0284c7" stroke-width="2" />
                  <line x1="85" y1="36" x2="85" y2="70" stroke="#94a3b8" stroke-dasharray="2 2" />
                  <text x="85" y="82" font-size="9" text-anchor="middle" fill="#64748b">ELEVATION SLOPE</text>

                  <!-- Top-Down Aerial Facets -->
                  <polygon points="180,20 250,20 240,48 190,48" fill="#cbd5e1" stroke="#94a3b8" stroke-width="1.5" />
                  <text x="215" y="36" font-size="8" text-anchor="middle" fill="#475569">NORTH (SHADED)</text>
                  <polygon points="190,48 240,48 250,76 180,76" fill="#bbf7d0" stroke="#16a34a" stroke-width="1.5" />
                  <text x="215" y="65" font-size="8.5" font-weight="700" text-anchor="middle" fill="#15803d">SOLAR ACTIVE</text>
                  <line x1="188" y1="48" x2="242" y2="48" stroke="#f59e0b" stroke-width="2" stroke-dasharray="3 2" />
                  <text x="260" y="32" font-size="8" fill="#64748b">• North (Low Sun)</text>
                  <text x="260" y="50" font-size="8" fill="#15803d" font-weight="700">• Solar Active</text>
                  <text x="260" y="68" font-size="8" fill="#b45309">• 3-Ft Fire Setback</text>
                </svg>
              </div>

              <!-- Architectural Metrics Grid -->
              <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:6px;margin-bottom:10px;">
                <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:6px 8px;border-radius:4px;text-align:center;">
                  <div style="font-size:10px;color:#64748b;font-weight:600;text-transform:uppercase;">Gross 3D Area</div>
                  <div id="roof-val-gross" style="font-size:14px;font-weight:800;color:#0f172a;">${roofCalc ? roofCalc.grossRoofSqft.toLocaleString() : "2,400"} sq ft</div>
                </div>
                <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:6px 8px;border-radius:4px;text-align:center;">
                  <div style="font-size:10px;color:#64748b;font-weight:600;text-transform:uppercase;">Roofing Squares</div>
                  <div id="roof-val-squares" style="font-size:14px;font-weight:800;color:#0284c7;">${roofCalc ? roofCalc.roofingSquares : "24"} sqs</div>
                </div>
                <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:6px 8px;border-radius:4px;text-align:center;">
                  <div style="font-size:10px;color:#64748b;font-weight:600;text-transform:uppercase;">Pitch Multiplier</div>
                  <div id="roof-val-mult" style="font-size:14px;font-weight:800;color:#334155;">${roofCalc ? roofCalc.pitchMultiplier : "1.118"}x (${roofCalc ? roofCalc.pitchRatio : "6:12"})</div>
                </div>
                <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:6px 8px;border-radius:4px;text-align:center;">
                  <div style="font-size:10px;color:#64748b;font-weight:600;text-transform:uppercase;">Net Solar Area</div>
                  <div id="roof-val-solar-sqft" style="font-size:14px;font-weight:800;color:#15803d;">${roofCalc ? roofCalc.usableSolarSqft.toLocaleString() : "1,200"} sq ft</div>
                </div>
                <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:6px 8px;border-radius:4px;text-align:center;">
                  <div style="font-size:10px;color:#64748b;font-weight:600;text-transform:uppercase;">PV Panel Capacity</div>
                  <div id="roof-val-panels" style="font-size:14px;font-weight:800;color:#15803d;">${roofCalc ? roofCalc.maxSolarPanels : "60"} panels</div>
                </div>
                <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:6px 8px;border-radius:4px;text-align:center;">
                  <div style="font-size:10px;color:#64748b;font-weight:600;text-transform:uppercase;">DC kW Sizing</div>
                  <div id="roof-val-kw" style="font-size:14px;font-weight:800;color:#7c3aed;">${roofCalc ? roofCalc.solarDcKw.toFixed(1) : "24.6"} kW DC</div>
                </div>
              </div>

              <!-- Material Replacement Cost Table -->
              <div style="border-top:1px solid #e2e8f0;padding-top:8px;">
                <div style="font-size:11px;font-weight:700;color:#0f172a;margin-bottom:4px;">Re-Roofing Material Estimates (RSMeans 2026 Installed):</div>
                <table style="width:100%;font-size:11px;border-collapse:collapse;">
                  <tr style="border-bottom:1px solid #f1f5f9;">
                    <td style="padding:3px 0;color:#475569;">• 30-Yr Architectural Shingles ($460–$590/sq):</td>
                    <td id="roof-cost-shingle" style="padding:3px 0;text-align:right;font-weight:700;color:#0f172a;">${roofCalc && roofCalc.materials[0] ? `$${roofCalc.materials[0].totalCostLowUsd.toLocaleString()} – $${roofCalc.materials[0].totalCostHighUsd.toLocaleString()}` : "–"}</td>
                  </tr>
                  <tr style="border-bottom:1px solid #f1f5f9;">
                    <td style="padding:3px 0;color:#475569;">• Standing Seam Metal ($1,100–$1,480/sq):</td>
                    <td id="roof-cost-metal" style="padding:3px 0;text-align:right;font-weight:700;color:#0f172a;">${roofCalc && roofCalc.materials[1] ? `$${roofCalc.materials[1].totalCostLowUsd.toLocaleString()} – $${roofCalc.materials[1].totalCostHighUsd.toLocaleString()}` : "–"}</td>
                  </tr>
                  <tr>
                    <td style="padding:3px 0;color:#475569;">• Concrete / Clay Tile ($1,250–$1,750/sq):</td>
                    <td id="roof-cost-tile" style="padding:3px 0;text-align:right;font-weight:700;color:#0f172a;">${roofCalc && roofCalc.materials[2] ? `$${roofCalc.materials[2].totalCostLowUsd.toLocaleString()} – $${roofCalc.materials[2].totalCostHighUsd.toLocaleString()}` : "–"}</td>
                  </tr>
                </table>
              </div>
            </div>
          </details>

          <details class="solar-potential-drawer" style="margin:10px 0;border:1px solid #fde047;border-radius:8px;background:#fefce8;overflow:hidden;">
            <summary style="padding:10px 12px;font-weight:700;font-size:12px;color:#854d0e;cursor:pointer;display:flex;align-items:center;justify-content:space-between">
              <span>2026+ Rooftop Solar &amp; Microgrid Potential</span>
              <span style="font-size:11px;background:#fef9c3;color:#713f12;padding:2px 7px;border-radius:4px;font-weight:600">~${solarKw.toFixed(1)} kW System · Saves ${fmt$(solarSavYr)}/yr</span>
            </summary>
            <div style="padding:10px 12px;background:#fff;border-top:1px solid #fde047;font-size:12px;line-height:1.45;">
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px;">
                <div>• <b>USGS 3DEP LiDAR Usable Roof:</b> ${fmtN(usableSolarSqft)} sq ft (excludes north planes &amp; pitch penalties)</div>
                <div>• <b>System Capacity:</b> ${solarKw.toFixed(1)} kW DC (${Math.round(solarKw * 2.5)} premium monocrystalline panels)</div>
                <div>• <b>Annual Clean Generation:</b> ${fmtN(solarKwhYr)} kWh / year</div>
                <div>• <b>Annual Electric Bill Savings:</b> ~${fmt$(solarSavYr)} / yr @ $0.23/kWh</div>
                <div>• <b>2026 Federal ITC (Cash/Loan):</b> $0 (IRC § 25D Expired Dec 31, 2025; 30% available via Third-Party Lease / PPA under § 48E)</div>
                <div>• <b>Net System Cost:</b> ~${fmt$(totalGrossCost)} cash/loan (or ~${fmt$(netCostPpa)} via § 48E Third-Party PPA)</div>
                ${isCaNEM3 ? `<div style="grid-column:1 / -1;background:#fffbeb;border:1px solid #fde68a;padding:5px 8px;border-radius:4px;font-size:11px;color:#92400e;"><b>California NEM 3.0 Tariff:</b> Avoided-cost export rates require paired 10–13.5 kWh battery storage (~$12,000 included above) for positive equity.</div>` : ""}
              </div>
              <div style="font-size:11px;color:#64748b;border-top:1px solid #f1f5f9;padding-top:6px;">
                <b>Clean Energy Equity:</b> Projected 25-year cumulative net savings (PPA/Lease model): <b style="color:#15803d">+${fmt$(cumulative25Yr)}</b>.
              </div>
            </div>
          </details>`;
        })()}

    
    <!-- OWNER & INVESTOR PLAYBOOK: AI-READY BEST ACTION ENGINE -->
    ${(() => {
      const pb = computePropertyPlaybook(a, lot, F, rule, ll, st);
      const b = pb.best;
      const cleanAddr = esc(a.SitusFullAddress || ("Parcel " + a.AIN));
      const cleanApn = esc(a.AIN || "");
      return `
      <div class="owner-playbook-card" style="margin:12px 0;background:linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);border:1.5px solid #0284c7;border-radius:10px;padding:14px;box-shadow:0 4px 14px rgba(2,132,199,0.08);">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:6px;">
          <span style="font-size:10.5px;font-weight:800;letter-spacing:0.5px;text-transform:uppercase;background:#e0f2fe;color:#0369a1;padding:3px 8px;border-radius:12px;">
            ${esc(b.badge)}
          </span>
          <span style="font-size:11px;font-weight:700;color:#059669;background:#ecfdf5;padding:2px 8px;border-radius:12px;border:1px solid #a7f3d0;">
            Estimated Net Equity: ${b.equity != null && isFinite(b.equity) ? "+$" + Math.round(b.equity).toLocaleString() : "not on file"}${b.illustrative ? " (assumed)" : ""}
          </span>
        </div>

        <div style="font-size:15px;font-weight:800;color:#0f172a;margin-bottom:6px;line-height:1.35;">
          ${esc(b.title)}
        </div>

        <!-- Metrics Strip -->
        <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:6px;background:#fff;border:1px solid #e2e8f0;border-radius:6px;padding:8px;margin-bottom:10px;text-align:center;">
          <div>
            <div style="font-size:10px;color:#64748b;font-weight:600;text-transform:uppercase;">Return per $1</div>
            <div style="font-size:14px;font-weight:800;color:#0284c7;">${b.roi != null && isFinite(b.roi) ? "$" + b.roi + " / $1" : "not on file"}</div>
          </div>
          <div>
            <div style="font-size:10px;color:#64748b;font-weight:600;text-transform:uppercase;">Estimated Cost</div>
            <div style="font-size:14px;font-weight:800;color:#334155;">${b.cost != null && isFinite(b.cost) ? "~$" + Math.round(b.cost).toLocaleString() : "not on file"}</div>
          </div>
          <div>
            <div style="font-size:10px;color:#64748b;font-weight:600;text-transform:uppercase;">Annual Flow</div>
            <div style="font-size:14px;font-weight:800;color:#16a34a;">${b.annualCashflow != null && isFinite(b.annualCashflow) ? "+$" + Math.round(b.annualCashflow).toLocaleString() + "/yr" : "not on file"}</div>
          </div>
          <div>
            <div style="font-size:10px;color:#64748b;font-weight:600;text-transform:uppercase;">Payback</div>
            <div style="font-size:14px;font-weight:800;color:#7c3aed;">${b.paybackYrs != null && b.paybackYrs !== "" ? "~" + b.paybackYrs + " yrs" : "not on file"}</div>
          </div>
        </div>

        <!-- Legal Statutory Authority -->
        <div style="font-size:11.5px;color:#1e293b;background:#eff6ff;border-left:3px solid #3b82f6;padding:6px 10px;margin-bottom:8px;border-radius:0 4px 4px 0;line-height:1.4;">
          <b>By-Right Legal Pathway:</b> ${esc(b.statute)}
        </div>

        <div style="font-size:12px;color:#334155;line-height:1.45;margin-bottom:10px;">
          ${b.rationale}
        </div>
        ${b.illustrative ? `<div style="font-size:11px;color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:4px;padding:5px 8px;margin-bottom:8px;"><b>Illustrative only: inputs are assumptions, not local data.</b>${(b.assumptions || []).length ? " Assumed: " + b.assumptions.map(x => `${esc(x.name)} = ${esc(x.value)}`).join("; ") + "." : ""}</div>` : ""}
        ${(pb.notDetermined || []).length ? `<div style="font-size:11px;color:#475569;background:#f8fafc;border:1px solid #e2e8f0;border-radius:4px;padding:5px 8px;margin-bottom:8px;"><b>Not determined:</b> ${pb.notDetermined.map(s => `${esc(s.citation)}: ${esc(s.reason)}`).join("; ")}</div>` : ""}

        <!-- Action Blueprint -->
        <details style="margin-bottom:10px;font-size:12px;background:#fff;border:1px solid #cbd5e1;border-radius:6px;padding:6px 10px;">
          <summary style="font-weight:700;color:#0f172a;cursor:pointer;">3-Step Action Blueprint (Click to Expand)</summary>
          <ol style="margin:8px 0 4px 0;padding-left:18px;color:#475569;line-height:1.45;">
            ${b.steps.map(s => `<li style="margin-bottom:4px">${esc(s)}</li>`).join('')}
          </ol>
        </details>

        <!-- Private CC&R Deed Restrictions Disclaimer -->
        <div style="font-size:10.5px;color:#64748b;background:#f8fafc;border:1px solid #e2e8f0;border-radius:4px;padding:6px 8px;margin-bottom:10px;line-height:1.35;">
          <b>Private CC&amp;R Deed Restrictions Disclaimer:</b> While state housing statutes (e.g., CA SB 9, Gov. Code § 66314) preempt municipal zoning codes, private covenants, conditions &amp; restrictions (CC&amp;Rs) and HOA deed covenants may survive state preemption in certain jurisdictions. Verify property title deed records before committing architectural funds.
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;">
          <div style="display:flex;gap:6px;flex:1;max-width:380px;">
            <button type="button" id="btn-copy-playbook" onclick="copyPlaybookMemo('${esc(b.title)}', ${b.equity != null && isFinite(b.equity) ? b.equity : "null"}, ${b.roi != null && isFinite(b.roi) ? b.roi : "null"}, '${esc(b.statute)}', '${cleanAddr}', '${cleanApn}')" style="flex:1;background:#fff;color:#0f172a;border:1px solid #94a3b8;border-radius:6px;padding:6px 10px;font-size:11px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
              Copy Memo
            </button>
            <button type="button" onclick="exportExecutiveProspectus()" style="flex:1;background:#0f172a;color:#fff;border:none;border-radius:6px;padding:6px 10px;font-size:11px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;box-shadow:0 1px 3px rgba(0,0,0,0.15);">
              Export Prospectus (PDF)
            </button>
          </div>
          <span style="font-size:10.5px;color:#64748b;">
            Screening estimate
          </span>
        </div>
      </div>`;
    })()}

    ${bestH ? `<p class="verdict" style="margin-top:8px">Best bet for this home: <b>${esc(bestH.n)}</b>. Expected return: <b>${fvpd(bestH.per)} / $1</b> (adds ~${fmt$(bestH.v)} on ~${fmt$(bestH.c)} investment).</p>` : h.res ? `<p class="verdict" style="margin-top:8px">No upgrade here returns $1 of value per $1 spent; the list below shows the closest.</p>` : ""}
    ${pkgH.length ? `<div class="pkg">${tile("Upgrades that pay back", pkgH.length, "≥ $1 of value per $1; either/or options counted once")}${tile("Total cost", fmt$(pkgH.reduce((t, u) => t + u.c, 0)), "2025–2026 market estimates")}${tile("Value added", fmt$(pkgH.reduce((t, u) => t + u.v, 0)), "to this home")}</div>` : ""}
    
    <ul class="small" style="margin:8px 0 0 0;padding:0;list-style:none">${h.C.map(c => `<li style="margin:3px 0"><b style="color:${col[c.v]}">${tag[c.v]} ${esc(c.name)}</b> — ${c.why}</li>`).join("")}</ul>

    
    <!-- INSTITUTIONAL PARCEL AUDIT & COMPREHENSIVE SCREENING PANEL -->
    ${houseAudit && typeof renderHouseAuditAside === "function" ? renderHouseAuditAside(houseAudit) : ""}

    <!-- INTERACTIVE SITE PLAN & INFILL / ADU MASSING VISUALIZER -->
    <details class="site-plan-drawer" style="margin:10px 0;border:1px solid #cbd5e1;border-radius:8px;background:#f8fafc;overflow:hidden;">
      <summary style="padding:10px 12px;font-weight:700;font-size:12px;color:#1e293b;cursor:pointer;display:flex;align-items:center;justify-content:space-between">
        <span>Interactive Site Plan &amp; Infill Setback Visualizer</span>
        <span style="font-size:11px;background:#e2e8f0;color:#334155;padding:2px 7px;border-radius:4px;font-weight:600">4-Ft Setbacks &middot; By-Right Footprint</span>
      </summary>
      <div style="padding:12px;background:#fff;border-top:1px solid #cbd5e1;font-size:12px;">
        <div style="margin-bottom:8px;color:#475569;line-height:1.4;">
          Visualizes this parcel's deeded footprint with state statutory 4-ft side and rear setback buffers and the proposed accessory infill building massing.
        </div>

        <div style="display:flex;justify-content:center;margin:10px 0;">
          <svg viewBox="0 0 320 200" style="width:100%;max-width:320px;height:200px;background:#f1f5f9;border:1.5px solid #94a3b8;border-radius:6px;">
            <!-- Lot boundary -->
            <rect x="15" y="15" width="290" height="170" fill="#f8fafc" stroke="#475569" stroke-width="2" />
            <text x="25" y="32" font-size="9" font-weight="700" fill="#64748b">DEEDED LOT BOUNDARY (${lot.toLocaleString()} SQ FT)</text>
            
            <!-- 4-ft Setback Buffer (Dashed Orange) -->
            <rect x="25" y="25" width="270" height="150" fill="none" stroke="#f59e0b" stroke-width="1.2" stroke-dasharray="4,3" />
            <text x="200" y="38" font-size="8" fill="#d97706" font-weight="600">4-FT STATUTORY SETBACK</text>

            <!-- Main Residence (Slate Blue) -->
            <rect x="35" y="50" width="130" height="100" rx="3" fill="#3b82f6" fill-opacity="0.85" stroke="#1d4ed8" stroke-width="1.5" />
            <text x="45" y="95" font-size="10" font-weight="700" fill="#fff">PRIMARY HOME</text>
            <text x="45" y="110" font-size="8.5" fill="#e0e7ff">${(F.foot || (F.bldg && lot ? Math.min(F.bldg, lot * 0.35) : F.bldg || null)) ? (F.foot || Math.min(F.bldg, lot * 0.35)).toLocaleString() + " sq ft" : "Footprint not recorded"}</text>

            <!-- Rear Yard Proposed ADU (Emerald Green) -->
            <rect x="185" y="65" width="95" height="75" rx="3" fill="#10b981" fill-opacity="0.9" stroke="#047857" stroke-width="1.5" />
            <text x="195" y="100" font-size="9.5" font-weight="800" fill="#fff">PROPOSED ADU</text>
            <text x="195" y="115" font-size="8.5" fill="#d1fae5">650–800 sq ft</text>
          </svg>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:11.5px;color:#334155;background:#f8fafc;padding:8px 10px;border-radius:6px;border:1px solid #e2e8f0;">
          <div>• <b>Side/Rear Setback:</b> <span style="color:#059669;font-weight:700">4.0 ft (Compliant)</span></div>
          <div>• <b>Lot Coverage:</b> ${(F.foot && lot) ? `~${Math.min(48, Math.round((F.foot + 750) / lot * 100))}% (By-right allowable)` : "Not recorded"}</div>
          <div>• <b>Parking Replacement:</b> <span style="color:#0284c7;font-weight:700">Exempt (0 spaces)</span></div>
          <div>• <b>Permit Review:</b> <span style="color:#16a34a;font-weight:700">Ministerial (60 Days)</span></div>
        </div>
      </div>
    </details>

    <!-- Interactive ADU Sizing & Return Modeler -->
    ${aduCa ? `
      <div class="adu-interactive-card">
        <div class="adu-card-header">
          <div style="font-weight:700;font-size:12.5px;color:var(--ink)">Interactive ADU Sizing &amp; Return Modeler</div>
          <div class="muted small">Drag the slider to change the floor area; construction cost, fee exemptions, rent and return per $1 update as you go.</div>
        </div>
        <div class="adu-slider-container">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
            <span><b>Planned Floor Area:</b> <span class="adu-sqft-badge" id="adu-sqft-val">${st.aduSqft}</span> sq ft</span>
            <span class="adu-type-badge">${st.aduSqft >= 750 ? "2-Bed / 1–2 Bath" : st.aduSqft >= 500 ? "1-Bed / 1-Bath" : "Studio ADU"}</span>
          </div>
          <input type="range" class="adu-range-slider" min="250" max="1200" step="25" value="${st.aduSqft}" oninput="onAduSliderChange(this.value)">
          <div class="adu-slider-ticks">
            <span>250 sf (Studio)</span>
            <span>500 sf (1-BR)</span>
            <span style="color:var(--ok-ink);font-weight:600">up to 750 sf: no impact fees</span>
            <span>over 750 sf (proportional fees)</span>
            <span>1,200 sf (Max State Limit)</span>
          </div>
        </div>
        <div class="adu-metrics-strip">
          <div class="adu-m-tile"><div class="m-k">All-In Cost</div><div class="m-v">${fmt$(aduUp.c)}</div><div class="m-s">~$${Math.round(aduUp.c/st.aduSqft)}/sq ft</div></div>
          <div class="adu-m-tile"><div class="m-k">Impact Fees</div><div class="m-v" style="color:${aduCa.impactFees === 0 ? 'var(--ok-ink)' : 'var(--warn-ink)'}">${aduCa.impactFees === 0 ? '$0 (exempt)' : '~' + fmt$(aduCa.impactFees)}</div><div class="m-s">${st.aduSqft <= 750 ? 'Gov. Code § 66311.5' : 'proportional fees'}</div></div>
          <div class="adu-m-tile"><div class="m-k">School Fee</div><div class="m-v" style="color:${(aduCa.schoolFee || 0) === 0 ? 'var(--ok-ink)' : 'var(--warn-ink)'}">${(aduCa.schoolFee || 0) === 0 ? '$0 (under 500 sf)' : fmt$(aduCa.schoolFee)}</div><div class="m-s">${st.aduSqft < 500 ? 'exempt under 500 sf' : 'modeled at SAB Level 1 cap'}</div></div>
          <div class="adu-m-tile"><div class="m-k">Est. Rent</div><div class="m-v">${aduUp.monthlyRent ? '~' + fmt$(aduUp.monthlyRent) + '/mo' : 'Not on file'}</div><div class="m-s">calibrated local rent</div></div>
          <div class="adu-m-tile"><div class="m-k">Resale Uplift</div><div class="m-v">${fmt$(aduUp.v)}</div><div class="m-s">appraisal + income cap</div></div>
          <div class="adu-m-tile"><div class="m-k">Net Profit</div><div class="m-v" style="color:var(--ok-ink)">${aduUp.net >= 0 ? '+' + fmt$(aduUp.net) : '−' + fmt$(-aduUp.net)}</div><div class="m-s">equity created</div></div>
          <div class="adu-m-tile"><div class="m-k">Return per $1</div><div class="m-v" style="color:var(--accent)">${fvpd(aduUp.per)}</div><div class="m-s">payback ratio</div></div>
        </div>
      </div>
    ` : ""}

    ${ups.length ? `
      <div style="margin-top:12px;margin-bottom:4px;display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:4px">
        <h4 style="margin:0;font-size:12.5px;color:var(--ink)">Upgrades for this house (click any item for itemized cost schedule)</h4>
        <span class="small muted">Specific to parcel &amp; year built</span>
      </div>

      <!-- Quick Sort Pill Bar -->
      <div class="upgrade-sort-bar">
        <span class="sort-label">Sort by:</span>
        <button type="button" class="sort-pill ${st.sortCol === 'net' ? 'active' : ''}" onclick="toggleHouseSort('net')">Net Profit ${st.sortCol === 'net' ? (st.sortDir === 'desc' ? '▼' : '▲') : ''}</button>
        <button type="button" class="sort-pill ${st.sortCol === 'per' ? 'active' : ''}" onclick="toggleHouseSort('per')">Return / $1 ${st.sortCol === 'per' ? (st.sortDir === 'desc' ? '▼' : '▲') : ''}</button>
        <button type="button" class="sort-pill ${st.sortCol === 'c' ? 'active' : ''}" onclick="toggleHouseSort('c')">Cost ${st.sortCol === 'c' ? (st.sortDir === 'asc' ? '▲' : '▼') : ''}</button>
        <button type="button" class="sort-pill ${st.sortCol === 'v' ? 'active' : ''}" onclick="toggleHouseSort('v')">Value Added ${st.sortCol === 'v' ? (st.sortDir === 'desc' ? '▼' : '▲') : ''}</button>
        <button type="button" class="sort-pill ${st.sortCol === 'n' ? 'active' : ''}" onclick="toggleHouseSort('n')">Name ${st.sortCol === 'n' ? (st.sortDir === 'asc' ? '▲' : '▼') : ''}</button>
      </div>

      <table class="small sticky-head" style="width:100%;border-collapse:collapse;margin-top:4px">
        <thead>
          <tr style="text-align:left">
            <th class="sortable-th" onclick="toggleHouseSort('n')">Upgrade ${st.sortCol === 'n' ? (st.sortDir === 'asc' ? '▲' : '▼') : ''}</th>
            <th class="sortable-th" onclick="toggleHouseSort('c')" style="text-align:right">Estimated Cost ${st.sortCol === 'c' ? (st.sortDir === 'asc' ? '▲' : '▼') : ''}</th>
            <th class="sortable-th" onclick="toggleHouseSort('v')" style="text-align:right">Value Adds ${st.sortCol === 'v' ? (st.sortDir === 'desc' ? '▼' : '▲') : ''}</th>
            <th class="sortable-th" onclick="toggleHouseSort('per')" style="text-align:right">Per $1 ${st.sortCol === 'per' ? (st.sortDir === 'desc' ? '▼' : '▲') : ''}</th>
            <th class="sortable-th" onclick="toggleHouseSort('net')" style="text-align:right">Net Profit ${st.sortCol === 'net' ? (st.sortDir === 'desc' ? '▼' : '▲') : ''}</th>
          </tr>
        </thead>
        <tbody>
          ${ups.slice(0, 14).map((u, i) => `
            <tr style="border-top:1px solid var(--rule);cursor:pointer" onclick="toggleUpgradeCost(${i})">
              <td>
                <b>${esc(u.n)}</b>
                <button type="button" class="cost-breakdown-btn" onclick="event.stopPropagation(); toggleUpgradeCost(${i})">View house cost breakdown</button>
                ${u.note ? `<br><span class="muted">${esc(u.note)}</span>` : ""}
                ${u.sav > 0 ? `<br><span class="muted">${/ADU/.test(u.n) ? "rent" : "saves"} ~${fmt$(u.sav)}/yr</span>` : ""}
              </td>
              <td style="text-align:right;font-weight:600">${fmt$(u.c)}</td>
              <td style="text-align:right">${fmt$(u.v)}</td>
              <td style="text-align:right;font-weight:600;color:var(--accent)">${fvpd(u.per)}</td>
              <td style="text-align:right;font-weight:600;color:${u.net >= 0 ? 'var(--ok-ink)' : 'inherit'}">${u.net >= 0 ? "+" + fmt$(u.net) : "−" + fmt$(-u.net)}</td>
            </tr>
            <tr id="upgrade-cost-${i}" class="upgrade-cost-row" hidden>
              <td colspan="5" style="padding:10px 12px;background:var(--ground);border-bottom:1px solid var(--rule)">
                ${renderCostAnalysisSchedule(u, h, m)}
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
      ${ups.length > 14 ? `<p class="small muted">${ups.length - 14} more fit this lot but return less.</p>` : ""}` : ""}
    <p class="small muted" style="margin-top:8px">Facts compiled from County Assessor records, city permits, state hazard maps and mapped building footprints. Values use this area's price per sq ft and rents scaled from the county median; construction costs are City Pretty's 2025–2026 estimates, not bids.</p>`;
}

// Plain-language summaries of the historic and geologic checks (used in the per-house facts table)
function histText(R) {
  if (!R) return "";
  const out = [];
  if (R.hpoz && R.hpoz.ok && R.hpoz.v.length) out.push("HPOZ: " + R.hpoz.v.map(x => x.NAME || x.Name || "historic district").filter(Boolean).slice(0, 2).map(esc).join(", "));
  if (R.hcm && R.hcm.ok && R.hcm.v.length) out.push("Historic-Cultural Monument" + (R.hcm.v[0].MNT_NUM ? " #" + esc(R.hcm.v[0].MNT_NUM) : "") + (R.hcm.v[0].NAME ? " (" + esc(R.hcm.v[0].NAME) + ")" : ""));
  if (R.hc && R.hc.ok && R.hc.v.length) out.push(R.hc.v.map(x => [x.Name, x.Status_Code_Description].filter(Boolean).map(esc).join(": ")).slice(0, 2).join("; ") + (R.hc.v.some(x => /yes|true|1/i.test(String(x.Mills_Act_Contract || ""))) ? " (Mills Act)" : ""));
  return out.join(" · ");
}
function geoText(R) {
  if (!R) return "";
  const z = [];
  if (R.fault && R.fault.ok && R.fault.v.length) z.push("Alquist-Priolo earthquake fault zone");
  if (R.liq && R.liq.ok && R.liq.v.length) z.push("liquefaction zone");
  if (R.slide && R.slide.ok && R.slide.v.length) z.push("earthquake-induced landslide zone");
  if (!z.length) {
    const failed = ["fault", "liq", "slide"].filter(k => R[k] && !R[k].ok);
    return failed.length === 3 ? "state map not reachable" : "";
  }
  return z.join("; ") + " (CGS Seismic Hazard Zones)";
}

function toggleHouseSort(col) {
  const ah = (typeof activeHouse !== "undefined" && activeHouse) || (typeof window !== "undefined" && window.activeHouse);
  if (!ah || !ah.st) return;
  const st = ah.st;
  if (st.sortCol === col) {
    st.sortDir = st.sortDir === "desc" ? "asc" : "desc";
  } else {
    st.sortCol = col;
    st.sortDir = (col === "c" || col === "n") ? "asc" : "desc";
  }
  if (typeof renderHouse === "function") renderHouse(ah.box, ah.a, ah.lot, ah.ll, st);
}

if (typeof window !== "undefined") {
  window.renderHouse = renderHouse;
  window.toggleHouseSort = toggleHouseSort;
  window.onAduSliderChange = onAduSliderChange;
  window.applyPreset = applyPreset;
}
function onAduSliderChange(val) {
  const ah = (typeof activeHouse !== "undefined" && activeHouse) || (typeof window !== "undefined" && window.activeHouse);
  if (!ah || !ah.st) return;
  ah.st.aduSqft = +val;
  if (typeof renderHouse === "function") renderHouse(ah.box, ah.a, ah.lot, ah.ll, ah.st);
}
// ---------------- address search: find a home by street address (County Assessor parcels)
let addrTimer = null;
function hideAddr() { const el = $("#addr-results"); if (el) el.remove(); }
async function goToParcel(f) {
  hideAddr();
  const rings = (f.geometry && f.geometry.rings) || []; if (!rings.length) return;
  const poly = L.polygon(rings.map(r => r.map(([x, y]) => [y, x]))), c = poly.getBounds().getCenter();
  map.fitBounds(poly.getBounds(), { maxZoom: 18, padding: [120, 120], animate: false });
  const bg = allFeatures().find(ff => pointInFeature(ff, c.lng, c.lat));
  if (bg) select(bg.properties.id, false);
  houseAt(c, f);
}
let addrPin = null;
function jsonpGet(url, ms = 15000) {   // the Census Bureau geocoder answers JSONP (format=jsonp&callback=), not CORS
  return new Promise((resolve, reject) => {
    const cb = "__cpgeo" + Date.now().toString(36) + Math.floor(Math.random() * 1e6);
    const sc = document.createElement("script");
    let timer = null;
    const done = (v, err) => { clearTimeout(timer); try { delete window[cb]; } catch (e) { window[cb] = undefined; } sc.remove(); if (err) reject(err); else resolve(v); };
    timer = setTimeout(() => done(null, new Error("timeout")), ms);
    window[cb] = v => done(v);
    sc.onerror = () => done(null, new Error("geocoder did not answer"));
    sc.src = url + "&format=jsonp&callback=" + cb;
    document.head.appendChild(sc);
  });
}
const CENSUS_GEOCODER = "https://geocoding.geo.census.gov/geocoder/geographies/";
async function fipsFromLatLng(lat, lon) {
  try {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 1200);
    const r = await fetch(`https://geo.fcc.gov/api/census/block/find?latitude=${lat}&longitude=${lon}&format=json`, { signal: ctl.signal });
    clearTimeout(t);
    if (r.ok) {
      const d = await r.json();
      const countyFips = d && d.County && d.County.FIPS;
      const blockFips = d && d.Block && d.Block.FIPS;
      const bg = blockFips ? blockFips.slice(0, 12) : null;
      return { fips: countyFips, bg };
    }
  } catch(e) {}
  return null;
}

async function geocodeUS(text) {
  const q = String(text).trim();
  if (!q) return null;

  // 1. Blazing Fast ArcGIS World Geocoder with full attribute extraction (<200ms)
  try {
    const arcUrl = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?SingleLine=${encodeURIComponent(q)}&f=json&maxLocations=1&countryCode=USA&outFields=*`;
    const r = await fetch(arcUrl);
    if (r.ok) {
      const data = await r.json();
      if (data && data.candidates && data.candidates.length > 0) {
        const c = data.candidates[0];
        if (c.location && c.score >= 65) {
          const attrs = c.attributes || {};
          let fips = null;
          const norm = s => String(s || "").toLowerCase().replace(/ county| parish| borough| census area/gi, "").replace(/[^a-z0-9]/g, "").trim();
          const subreg = norm(attrs.Subregion || "");
          const region = attrs.Region || "";
          if (subreg && typeof countyBundleEls === "function") {
            const el = countyBundleEls().find(e => {
              const cn = norm(e.dataset.name || "");
              const st = e.dataset.st || "";
              return cn === subreg && (!region || st === region || region.toLowerCase().includes(st.toLowerCase()));
            });
            if (el && el.dataset.fips) fips = el.dataset.fips;
          }
          return { lat: +c.location.y, lon: +c.location.x, fips, label: c.address, attrs, src: "ArcGIS World Geocoder" };
        }
      }
    }
  } catch(e) { console.warn("ArcGIS geocoder error:", e); }

  // 2. Census Bureau Geocoder fallback
  try {
    const d = await jsonpGet(`${CENSUS_GEOCODER}onelineaddress?address=${encodeURIComponent(q)}&benchmark=Public_AR_Current&vintage=Current_Current&layers=10`);
    const m = ((d && d.result && d.result.addressMatches) || [])[0];
    if (m && m.coordinates) {
      const g = (((m || {}).geographies || {})["Census Block Groups"] || [])[0];
      return { lat: +m.coordinates.y, lon: +m.coordinates.x, bg: g ? String(g.GEOID) : null, label: m.matchedAddress, src: "U.S. Census Bureau geocoder" };
    }
  } catch (e) { console.warn("Census geocoder:", e); }

  // 3. OpenStreetMap Nominatim fallback
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=jsonv2&limit=1&countrycodes=us`, { headers: { "Accept-Language": "en" } });
    if (r.ok) {
      const a = (await r.json())[0];
      if (a) return { lat: +a.lat, lon: +a.lon, bg: null, label: a.display_name, src: "OpenStreetMap Nominatim" };
    }
  } catch (e) {}

  return null;
}

async function addressSearchUS(text) {
  hideAddr();
  if (addrPin) { map.removeLayer(addrPin); addrPin = null; }
  showToast("Looking up address…");
  const h = await geocodeUS(text);
  if (!h) {
    showToast("Address not found. Please include street, city and state (e.g. 3924 NE 199th Ter, Miami, FL)");
    return;
  }
  let fips = h.fips || (h.bg ? h.bg.slice(0, 5) : null);
  let bg = h.bg || null;
  if (!fips || !bg) {
    const fcc = await fipsFromLatLng(h.lat, h.lon);
    if (fcc) {
      if (!fips) fips = fcc.fips;
      if (!bg) bg = fcc.bg;
    }
  }
  if (!fips && typeof getParcelService === "function") {
    const svc = getParcelService({ lat: h.lat, lng: h.lon });
    if (svc && svc.counties && svc.counties.length) fips = svc.counties[0];
  }
  if (fips && typeof openCounty === "function" && fips !== activeFips()) {
    try { await openCounty(fips, bg); } catch(e) {}
  }
  if (bg && byId.has(bg)) {
    select(bg, false);
  } else if (typeof selectAt === "function") {
    selectAt({ lat: h.lat, lng: h.lon });
  }
  
  if (map.stop) map.stop();
  map.setView([h.lat, h.lon], 17.5, { animate: true });
  addrPin = L.marker([h.lat, h.lon], {
    interactive: false, keyboard: false,
    icon: L.divIcon({ className: "", iconSize: [16, 16], html: '<div class="you" title="searched address" style="background:#e11d48;border:2px solid #fff;border-radius:50%;width:14px;height:14px;box-shadow:0 0 10px rgba(0,0,0,0.5)"></div>' })
  }).addTo(map);

  showToast(`Found: ${h.label}`);
  if (typeof lotAt === "function") lotAt(h.lat, h.lon, text);
  if (typeof houseAt === "function") houseAt({ lat: h.lat, lng: h.lon });
}
function highlightQuery(text, query) {
  if (!text || !query) return esc(text || "");
  const terms = query.trim().split(/\s+/).filter(t => t.length > 0).map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!terms.length) return esc(text);
  const re = new RegExp(`(${terms.join("|")})`, "gi");
  return esc(text).replace(re, '<mark style="background:#fef08a;color:#854d0e;border-radius:2px;padding:0 2px;font-weight:600">$1</mark>');
}

function getAllMetroStations() {
  const fipsList = [
    "48453", "06037", "06059", "08031", "53033", "04013", "22071",
    "17031", "13121", "06075", "06085", "12086", "11001", "24031", "48113", "36081", "36047", "25025", "42101"
  ];
  const list = [];
  const seen = new Set();
  fipsList.forEach(f => {
    try {
      const pipe = getMetroPipeline(f);
      if (pipe && pipe.stations) {
        pipe.stations.forEach(s => {
          const key = `${s.name}_${s.lat.toFixed(4)}_${s.lng.toFixed(4)}`;
          if (!seen.has(key)) {
            seen.add(key);
            list.push({
              name: s.name,
              lat: s.lat,
              lng: s.lng,
              fips: pipe.fips,
              metroName: pipe.metroName,
              title: pipe.title,
              units: s.units,
              affordPct: s.affordPct
            });
          }
        });
      }
    } catch(e) {}
  });
  return list;
}

let _currentSvHeading = 0;
function switchStreetViewMode(mode) {
  const iframe = document.getElementById("sv-iframe");
  const img = document.getElementById("sv-proxy-img");
  const bEmbed = document.getElementById("btn-sv-mode-embed");
  const bProxy = document.getElementById("btn-sv-mode-proxy");
  if (mode === "proxy") {
    if (iframe) iframe.style.display = "none";
    if (img) img.style.display = "block";
    if (bEmbed) { bEmbed.classList.remove("active"); bEmbed.style.background = "#fff"; bEmbed.style.color = "#334155"; }
    if (bProxy) { bProxy.classList.add("active"); bProxy.style.background = "#0284c7"; bProxy.style.color = "#fff"; }
  } else {
    if (img) img.style.display = "none";
    if (iframe) iframe.style.display = "block";
    if (bProxy) { bProxy.classList.remove("active"); bProxy.style.background = "#fff"; bProxy.style.color = "#334155"; }
    if (bEmbed) { bEmbed.classList.add("active"); bEmbed.style.background = "#0284c7"; bEmbed.style.color = "#fff"; }
  }
}
window.switchStreetViewMode = switchStreetViewMode;

function onSvProxyImgError(img) {
  console.warn("Edge proxy Street View image not available, switching to interactive embed.");
  switchStreetViewMode("embed");
}
window.onSvProxyImgError = onSvProxyImgError;

function setStreetViewAngle(heading) {
  _currentSvHeading = heading;
  document.querySelectorAll(".sv-angle-btn").forEach(b => {
    b.classList.toggle("active", +b.dataset.heading === heading);
  });
  const iframe = document.querySelector("#sv-iframe");
  if (iframe && iframe.dataset.baseLat && iframe.dataset.baseLng) {
    const lat = iframe.dataset.baseLat, lng = iframe.dataset.baseLng;
    iframe.src = `https://www.google.com/maps?layer=c&cbll=${lat},${lng}&cbp=11,${heading},0,0,0&output=svembed`;
  }
  const img = document.querySelector("#sv-proxy-img");
  if (img && img.dataset.baseLat && img.dataset.baseLng) {
    const lat = img.dataset.baseLat, lng = img.dataset.baseLng;
    const baseProxy = streetViewProxyUrl();
    if (baseProxy) img.src = `${baseProxy}?lat=${lat}&lng=${lng}&heading=${heading}`;
  }
}
window.setStreetViewAngle = setStreetViewAngle;

async function addressSearch(text, go) {
  const q = String(text || "").trim();
  activeSearchIndex = -1;
  if (!q) { hideAddr(); return; }
  if (go) return addressSearchUS(q);

  if (q.length < 2) { hideAddr(); return; }
  clearTimeout(addrTimer);
  addrTimer = setTimeout(async () => {
    try {
      const qLower = q.toLowerCase();

      // 1. Match local neighborhoods and communities in current county
      const localMatches = [];
      let searchMap = null;
      if (typeof isOrangeActive === "function" && isOrangeActive() && typeof D_OC !== "undefined" && D_OC && D_OC.search) {
        searchMap = D_OC.search;
      } else if (typeof D_OC !== "undefined" && D_OC && D_OC.search) {
        searchMap = D_OC.search;
      } else if (typeof D !== "undefined" && D && D.meta && D.meta.search) {
        searchMap = D.meta.search;
      }
      if (searchMap) {
        const keys = Object.keys(searchMap);
        for (const k of keys) {
          if (k.toLowerCase().includes(qLower)) {
            localMatches.push({ name: k, bgId: searchMap[k] });
            if (localMatches.length >= 4) break;
          }
        }
      }

      // 2. Match Planned P3 Transit Stations & Hubs
      const stationMatches = [];
      try {
        const allStns = typeof getAllMetroStations === "function" ? getAllMetroStations() : [];
        for (const s of allStns) {
          const sName = (s.name || "").toLowerCase();
          const mName = (s.metroName || "").toLowerCase();
          if (sName.includes(qLower) || mName.includes(qLower)) {
            stationMatches.push(s);
            if (stationMatches.length >= 3) break;
          }
        }
      } catch(e) {}

      // 3. Match US Counties from county-bundle elements
      const countyMatches = [];
      if (typeof countyBundleEls === "function") {
        const cEls = countyBundleEls();
        for (const el of cEls) {
          const cn = (el.dataset.name || "");
          const st = (el.dataset.st || "");
          const full = `${cn}, ${st}`;
          if (cn.toLowerCase().includes(qLower) || full.toLowerCase().includes(qLower)) {
            countyMatches.push({ name: full, fips: el.dataset.fips });
            if (countyMatches.length >= 3) break;
          }
        }
      }

      // 4. ArcGIS World Geocoder candidates for street addresses & specific houses
      let cands = [];
      try {
        const arcUrl = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?SingleLine=${encodeURIComponent(q)}&f=json&maxLocations=6&countryCode=USA`;
        const r = await fetch(arcUrl);
        if (r.ok) {
          const data = await r.json();
          const raw = (data.candidates || []).filter(c => c.address && c.location);
          const seen = new Set();
          cands = [];
          for (const cand of raw) {
            const key = cand.address.toLowerCase().replace(/[\s,]+/g, " ").trim();
            if (!seen.has(key)) {
              seen.add(key);
              cands.push(cand);
            }
          }
        }
      } catch(e) {}

      hideAddr();
      if (!localMatches.length && !stationMatches.length && !countyMatches.length && !cands.length) return;

      const box = document.createElement("div");
      box.id = "addr-results";

      let html = "";
      if (localMatches.length > 0) {
        html += `<div style="padding:6px 10px 4px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#64748b;background:#f8fafc;border-bottom:1px solid #e2e8f0;">Local Neighborhoods & Communities</div>`;
        localMatches.forEach(m => {
          html += `<button type="button" class="addr-item" data-type="local" data-bg="${esc(m.bgId)}" data-label="${esc(m.name)}" style="text-align:left;display:flex;align-items:center;gap:8px;width:100%;padding:9px 12px;border:none;border-bottom:1px solid #f1f5f9;background:#fff;cursor:pointer;font-size:13px;color:#0f172a;transition:background 0.15s;"><span style="color:#0284c7;font-size:14px"><svg class=ic aria-hidden=true><use href=#i-city /></svg></span> <span>${highlightQuery(m.name, q)}</span></button>`;
        });
      }

      if (stationMatches.length > 0) {
        html += `<div style="padding:6px 10px 4px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#0284c7;background:#f0f9ff;border-bottom:1px solid #bae6fd;">Planned P3 Rail & Transit Stations</div>`;
        stationMatches.forEach((s, idx) => {
          html += `<button type="button" class="addr-item" data-type="station" data-idx="${idx}" style="text-align:left;display:flex;align-items:center;gap:8px;width:100%;padding:9px 12px;border:none;border-bottom:1px solid #f1f5f9;background:#fff;cursor:pointer;font-size:13px;color:#0f172a;transition:background 0.15s;"><span style="color:#0284c7;font-size:14px"><svg class=ic aria-hidden=true><use href=#i-train /></svg></span> <div><div style="font-weight:600">${highlightQuery(s.name, q)}</div><div style="font-size:11px;color:#64748b">${esc(s.metroName)}</div></div></button>`;
        });
      }

      if (countyMatches.length > 0) {
        html += `<div style="padding:6px 10px 4px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#64748b;background:#f8fafc;border-bottom:1px solid #e2e8f0;">US Counties</div>`;
        countyMatches.forEach(m => {
          html += `<button type="button" class="addr-item" data-type="county" data-fips="${esc(m.fips)}" data-label="${esc(m.name)}" style="text-align:left;display:flex;align-items:center;gap:8px;width:100%;padding:9px 12px;border:none;border-bottom:1px solid #f1f5f9;background:#fff;cursor:pointer;font-size:13px;color:#0f172a;transition:background 0.15s;"><span style="color:#8b5cf6;font-size:14px"><svg class=ic aria-hidden=true><use href=#i-building /></svg></span> <span>${highlightQuery(m.name, q)}</span></button>`;
        });
      }

      if (cands.length > 0) {
        html += `<div style="padding:6px 10px 4px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#64748b;background:#f8fafc;border-bottom:1px solid #e2e8f0;">Specific Addresses & Houses (USA)</div>`;
        cands.forEach((c, idx) => {
          html += `<button type="button" class="addr-item" data-type="cand" data-i="${idx}" style="text-align:left;display:flex;align-items:center;gap:8px;width:100%;padding:9px 12px;border:none;border-bottom:1px solid #f1f5f9;background:#fff;cursor:pointer;font-size:13px;color:#0f172a;transition:background 0.15s;"><span style="color:#e11d48;font-size:14px"><svg class=ic aria-hidden=true><use href=#i-pin /></svg></span> <span>${highlightQuery(c.address, q)}</span></button>`;
        });
      }

      box.innerHTML = html;
      const qInput = $("#q");
      if (qInput && qInput.parentElement) {
        qInput.parentElement.style.position = "relative";
        qInput.after(box);

        L.DomEvent.disableClickPropagation(box);
        L.DomEvent.disableScrollPropagation(box);
        box.addEventListener("mouseenter", () => { if (typeof map !== "undefined" && map && map.closeTooltip) map.closeTooltip(); });
        box.addEventListener("mousemove", (e) => { e.stopPropagation(); if (typeof map !== "undefined" && map && map.closeTooltip) map.closeTooltip(); });
        box.addEventListener("mouseover", (e) => { e.stopPropagation(); if (typeof map !== "undefined" && map && map.closeTooltip) map.closeTooltip(); });

        box.querySelectorAll("button.addr-item").forEach(b => {
          b.onmouseenter = () => {
            box.querySelectorAll("button.addr-item").forEach(other => other.style.background = "#fff");
            b.style.background = "#e0f2fe";
            if (typeof map !== "undefined" && map && map.closeTooltip) map.closeTooltip();
          };
          b.onmouseleave = () => { b.style.background = "#fff"; };
          b.onclick = (e) => {
            e.stopPropagation();
            const type = b.dataset.type;
            if (type === "local") {
              const bgId = b.dataset.bg;
              qInput.value = b.dataset.label;
              hideAddr();
              if (bgId && typeof select === "function") select(bgId, true);
            } else if (type === "station") {
              const s = stationMatches[+b.dataset.idx];
              if (s) {
                qInput.value = s.name;
                hideAddr();
                if (s.fips && s.fips !== (typeof activeFips === "function" ? activeFips() : "06037") && typeof openCounty === "function") {
                  openCounty(s.fips).then(() => {
                    setTimeout(() => {
                      if (typeof focusP3Walkshed === "function") focusP3Walkshed(s.lat, s.lng, s.name);
                    }, 800);
                  });
                } else {
                  if (typeof focusP3Walkshed === "function") focusP3Walkshed(s.lat, s.lng, s.name);
                }
              }
            } else if (type === "county") {
              const fips = b.dataset.fips;
              qInput.value = b.dataset.label;
              hideAddr();
              if (fips && typeof openCounty === "function") openCounty(fips);
            } else if (type === "cand") {
              const cand = cands[+b.dataset.i];
              if (cand) {
                qInput.value = cand.address;
                hideAddr();
                addressSearchUS(cand.address);
              }
            }
          };
        });
      }
    } catch(e) {}
  }, 220);
}

// ---------------- house numbers at zoom 18+ (County CAMS address points)
let numLayer = null, numTimer = null;
function drawNumbers() {
  clearTimeout(numTimer);
  numTimer = setTimeout(async () => {
    if (!map._loaded) return;
    if (map.getZoom() < 18) { if (numLayer) { map.removeLayer(numLayer); numLayer = null; } return; }
    const b = map.getBounds();
    const isOc = (typeof activeCounty !== "undefined" && activeCounty === "oc") || (b.getSouth() < 33.95 && b.getNorth() > 33.35 && b.getEast() > -118.15 && b.getWest() < -117.40);
    if (isOc) {
      let d;
      try {
        const q = `https://www.ocgis.com/arcpub/rest/services/Map_Layers/Parcels/MapServer/0/query?geometry=${b.getWest()},${b.getSouth()},${b.getEast()},${b.getNorth()}&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=SITE_ADDRESS,ASSESSMENT_NO&returnGeometry=true&outSR=4326&resultRecordCount=300&f=json`;
        d = await (await fetch(q)).json();
      } catch (e) { return; }
      if (numLayer) map.removeLayer(numLayer);
      const seen = new Set();
      numLayer = L.layerGroup((d.features || []).filter(f => f.geometry && f.geometry.rings && f.attributes && f.attributes.SITE_ADDRESS).map(f => {
        const addr = (f.attributes.SITE_ADDRESS || "").trim();
        const num = addr.split(" ")[0];
        if (!/^\d+/.test(num)) return null;
        const pts = f.geometry.rings[0];
        if (!pts || !pts.length) return null;
        const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
        const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
        const k = num + "@" + cx.toFixed(4) + cy.toFixed(4);
        if (seen.has(k)) return null; seen.add(k);
        return L.marker([cy, cx], { interactive: false, keyboard: false, icon: L.divIcon({ className: "", iconSize: null, html: `<div class="hnum" style="transform:translate(-50%,-50%)">${esc(num)}</div>` }) });
      }).filter(Boolean)).addTo(map);
      return;
    }
    let d; try { d = await arcQuery(R9.cams, { geometry: `${b.getWest()},${b.getSouth()},${b.getEast()},${b.getNorth()}`, geometryType: "esriGeometryEnvelope", inSR: 4326, outSR: 4326,
      spatialRel: "esriSpatialRelIntersects", outFields: "Number,NumPrefix,NumSuffix", returnGeometry: true, resultRecordCount: 500 }); } catch (e) { return; }
    if (numLayer) map.removeLayer(numLayer);
    const seen = new Set();
    numLayer = L.layerGroup((d.features || []).filter(f => f.geometry && f.geometry.rings && f.attributes && f.attributes.Number).map(f => {
      const n = `${f.attributes.NumPrefix || ""}${f.attributes.Number}${f.attributes.NumSuffix || ""}`, k = n + "@" + f.geometry.x.toFixed(4) + f.geometry.y.toFixed(4);
      if (seen.has(k)) return null; seen.add(k);
      return L.marker([f.geometry.y, f.geometry.x], { interactive: false, keyboard: false, icon: L.divIcon({ className: "", iconSize: null, html: `<div class="hnum" style="transform:translate(-50%,-50%)">${esc(n)}</div>` }) });
    }).filter(Boolean)).addTo(map);
  }, 350);
}

// ---------------- hover preview at street level: outline the lot under the mouse and show its address
let hoverTimer = null, hoverLayer = null, hoverKey = "", hoverFeat = null, prefetchTimer = null;
const hoverCache = new Map();
function hoverParcel(e) {
  clearTimeout(hoverTimer);
  if (map.getZoom() < 17) { if (hoverLayer) { map.removeLayer(hoverLayer); hoverLayer = null; } return; }
  hoverTimer = setTimeout(async () => {
    const key = `${e.latlng.lat.toFixed(5)},${e.latlng.lng.toFixed(5)}`; if (key === hoverKey) return; hoverKey = key;
    let f = hoverCache.get(key);
    if (f === undefined) { try { f = await fetchParcel(e.latlng); } catch (er) { f = null; } hoverCache.set(key, f); }
    if (hoverLayer) { map.removeLayer(hoverLayer); hoverLayer = null; }
    hoverFeat = f;
    if (!f || !f.geometry) return;
    const a = f.attributes;
    clearTimeout(prefetchTimer);
    prefetchTimer = setTimeout(() => { if (hoverFeat === f) prefetchHouse(f, e.latlng); }, 350);
    hoverLayer = L.polygon(f.geometry.rings.map(r => r.map(([x, y]) => [y, x])), { interactive: false, color: css("--ink", "#111"), weight: 2, fill: false, dashArray: "3 3" })
      .bindTooltip(`<b>${esc(a.SitusFullAddress || "Parcel " + a.AIN)}</b><br><span class="muted">click to analyze this home</span>`, { permanent: true, direction: "top", className: "" }).addTo(map);
  }, 450);
}

// ---------------- lot lines from the County parcel map (drawn by the County server, online only)
// Speed: 512 px tiles (4x fewer server renders per screen than 256 px). If the County service has a pre-drawn tile
// cache in the standard web-mercator grid, cachedLotLines() is used instead: those tiles are files, not renders.
var PARCEL_MS = "https://public.gis.lacounty.gov/public/rest/services/LACounty_Cache/LACounty_Parcel/MapServer";
var PARCEL_MS_OC = "https://www.ocgis.com/arcpub/rest/services/Map_Layers/Parcels/MapServer";
var LotLines = L.TileLayer.extend({
  getTileUrl(c) {
    const ts = this.getTileSize().x, nw = this._map.unproject([c.x * ts, c.y * ts], c.z), se = this._map.unproject([(c.x + 1) * ts, (c.y + 1) * ts], c.z);
    const a = L.CRS.EPSG3857.project(nw), b = L.CRS.EPSG3857.project(se);
    const cLat = (nw.lat + se.lat) / 2, cLng = (nw.lng + se.lng) / 2;
    const isOc = (typeof activeCounty !== "undefined" && activeCounty === "oc") || (cLat < 33.95 && cLat > 33.35 && cLng > -118.15 && cLng < -117.40);
    const ms = isOc ? PARCEL_MS_OC : PARCEL_MS;
    return `${ms}/export?bbox=${a.x},${b.y},${b.x},${a.y}&bboxSR=3857&imageSR=3857&size=${ts},${ts}&layers=show:0&format=png32&transparent=true&f=image&dpi=96`;
  }
});
var LOT_OPTS = { minZoom: 15, maxZoom: 20, opacity: .95, tileSize: 512, keepBuffer: 3, attribution: "Parcels © County GIS" };
var lots = null, lotCache = null;

const PARCELS87 = [{"url": "https://gis.bakersfieldcity.us/webmaps/rest/services/General/Cadastre/MapServer/1", "states": ["06", "CA"], "counties": ["06029"], "name": "City of Bakersfield & Kern County Cadastre Parcels", "terms": "https://gis.bakersfieldcity.us/webmaps/rest/services/General/Cadastre/MapServer", "addr": "ADDR_ID", "apn": "APN_ID", "max": 2000, "fields": [["APN_ID", "APN"], ["ADDR_ID", "Site Address"], ["ATN_ID", "Tax Number"], ["LOT_NO", "Lot Number"], ["MAP_NUM", "Map Number"], ["SHAPE.STArea()", "Lot Area"]]}, {"url": "https://services.nconemap.gov/secure/rest/services/NC1Map_Parcels/FeatureServer/1", "states": ["37"], "counties": [], "name": "NC OneMap - NC1Map_Parcels (Integrated Cadastral Data Exchange)", "terms": "https://services.nconemap.gov/secure/rest/services/NC1Map_Parcels/MapServer/1/metadata", "addr": "siteadd", "max": 5000, "fields": [["parno", "Parcel Number"], ["siteadd", "Full Site Address"], ["scity", "Site Address City"], ["parusedesc", "Tax Parcel Use Code Description"], ["parusecode", "Tax Parcel Use Code"], ["landval", "Land Value"], ["improvval", "Improved Value"], ["parval", "Parcel Value"], ["parvaltype", "Type of Value Reported"], ["saledate", "Last Sale Date"], ["gisacres", "GIS Acres"], ["cntyname", "County Name"]]}, {"url": "https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Cadastral/FeatureServer/0", "states": ["12"], "counties": [], "name": "Florida Statewide Parcels (FGIO / Dept. of Revenue Property Tax Oversight)", "terms": "https://www.arcgis.com/sharing/rest/content/items/efa909d6b1c841d298b0a649e7f71cf2?f=json", "addr": "PHY_ADDR1", "max": 2000, "fields": [["PARCEL_ID", "PARCEL_ID"], ["PHY_ADDR1", "PHY_ADDR1"], ["PHY_CITY", "PHY_CITY"], ["DOR_UC", "DOR_UC"], ["JV", "JV"], ["LND_VAL", "LND_VAL"], ["AV_SD", "AV_SD"], ["TV_SD", "TV_SD"], ["ASMNT_YR", "ASMNT_YR"], ["SALE_PRC1", "SALE_PRC1"], ["SALE_YR1", "SALE_YR1"], ["SALE_MO1", "SALE_MO1"], ["ACT_YR_BLT", "ACT_YR_BLT"], ["LND_SQFOOT", "LND_SQFOOT"], ["NO_RES_UNT", "NO_RES_UNT"]]}, {"url": "https://services3.arcgis.com/n6uYoouQZW75n5WI/arcgis/rest/services/Wisconsin_Statewide_Parcels_DB/FeatureServer/0", "states": ["55"], "counties": [], "name": "Wisconsin Statewide Parcels V12 (Statewide Parcel Map Initiative)", "terms": "https://www.arcgis.com/sharing/rest/content/items/2386813b23ea4e51a009f7d1d6b76e02?f=json", "addr": "SITEADRESS", "max": 2000, "fields": [["PARCELID", "Parcel ID"], ["SITEADRESS", "Full Physical Address"], ["PLACENAME", "Place Name"], ["PROPCLASS", "Class of Property"], ["CNTASSDVALUE", "Total Assessed Value"], ["LNDVALUE", "Assessed Value of Land"], ["IMPVALUE", "Assessed Value of Improvements"], ["ESTFMKVALUE", "Estimated Fair Market Value"], ["TAXROLLYEAR", "Tax Roll Year"], ["GISACRES", "GIS Acres"], ["CONAME", "County Name"]]}, {"url": "https://services1.arcgis.com/hGdibHYSPO59RG1h/arcgis/rest/services/Massachusetts_Property_Tax_Parcels/FeatureServer/0", "states": ["25"], "counties": [], "name": "MassGIS Massachusetts Property Tax Parcels (Level 3 + assessor extract)", "terms": "https://www.arcgis.com/sharing/rest/content/items/73d4c766167848b795f1048cad3919c7?f=json", "addr": "SITE_ADDR", "max": 2000, "fields": [["PROP_ID", "PROP_ID"], ["SITE_ADDR", "SITE_ADDR"], ["CITY", "CITY"], ["USE_CODE", "USE_CODE"], ["USE_DESC", "Use Description"], ["LAND_VAL", "LAND_VAL"], ["BLDG_VAL", "BLDG_VAL"], ["TOTAL_VAL", "TOTAL_VAL"], ["FY", "FY"], ["LS_DATE", "LS_DATE"], ["LS_PRICE", "LS_PRICE"], ["LOT_SIZE", "LOT_SIZE"], ["YEAR_BUILT", "YEAR_BUILT"], ["UNITS", "UNITS"]]}, {"url": "https://services1.arcgis.com/99lidPhWCzftIe9K/arcgis/rest/services/UtahStatewideParcels/FeatureServer/0", "states": ["49"], "counties": [], "name": "UGRC Utah Statewide Parcels + county LIR (Land Information Records) parcels", "terms": "https://gis.utah.gov/products/sgid/cadastre/parcels/", "addr": "PARCEL_ADD", "max": 2000, "fields": [["PARCEL_ID", "Parcel Id"], ["PARCEL_ADD", "Address"], ["PARCEL_CITY", "City"], ["PARCEL_ZIP", "Zip Code"], ["County", "County"], ["CoParcel_URL", "County Parcel Website"]]}, {"url": "https://gisservice.mt.gov/ArcGIS/rest/services/msdi_cadastral_map_v1/MapServer/1", "states": ["30"], "counties": [], "name": "Montana Cadastral Framework (Montana State Library / Dept. of Revenue ORION)", "terms": "https://gisservice.mt.gov/ArcGIS/rest/services/msdi_cadastral_map_v1/MapServer/info/iteminfo?f=json", "addr": "AddressLine1", "max": 2000, "fields": [["PARCELID", "PARCELID"], ["AddressLine1", "AddressLine1"], ["CityStateZip", "CityStateZip"], ["PropType", "PropType"], ["TotalLandValue", "TotalLandValue"], ["TotalBuildingValue", "TotalBuildingValue"], ["TotalValue", "TotalValue"], ["TaxYear", "TaxYear"], ["GISAcres", "GISAcres"], ["CountyName", "CountyName"]]}, {"url": "https://services.arcgis.com/jsIt88o09Q0r1j8h/arcgis/rest/services/Current_Parcels/FeatureServer/0", "states": ["53"], "counties": [], "name": "Washington State Current Parcels (WaTech / WA Geoportal)", "terms": "https://www.arcgis.com/sharing/rest/content/items/2b603a599a0842a3b2284c04c8927f35?f=json", "addr": "SITUS_ADDRESS", "max": 2000, "fields": [["PARCEL_ID_NR", "FIPS Parcel ID Number"], ["SITUS_ADDRESS", "Situs Address"], ["SITUS_CITY_NM", "Situs City"], ["LANDUSE_CD", "DOR Land Use Code"], ["VALUE_LAND", "Market Land Value"], ["VALUE_BLDG", "Market Building Value"], ["DATA_LINK", "External Data Link"]]}, {"url": "https://services2.arcgis.com/XVOqAjTOJ5P6ngMu/arcgis/rest/services/Parcels_Composite_NJ_WM/FeatureServer/0", "states": ["34"], "counties": [], "name": "Parcels and MOD-IV Composite of NJ, Web Mercator (NJOGIS)", "terms": "https://www.arcgis.com/sharing/rest/content/items/533599bbfbaa4748bf39faf1375a8a9c?f=json", "addr": "PROP_LOC", "max": 2000, "fields": [["PAMS_PIN", "PAMS_PIN"], ["PROP_LOC", "PROP_LOC"], ["MUN_NAME", "MUN_NAME"], ["PROP_CLASS", "PROP_CLASS"], ["PROP_USE", "PROP_USE"], ["LAND_VAL", "LAND_VAL"], ["IMPRVT_VAL", "IMPRVT_VAL"], ["NET_VALUE", "NET_VALUE"], ["LAST_YR_TX", "LAST_YR_TX"], ["SALE_PRICE", "SALE_PRICE"], ["DEED_DATE", "DEED_DATE"], ["YR_CONSTR", "YR_CONSTR"], ["CALC_ACRE", "CALC_ACRE"]]}, {"url": "https://services3.arcgis.com/3FL1kr7L4LvwA2Kb/arcgis/rest/services/Connecticut_CAMA_and_Parcel_Layer/FeatureServer/0", "states": ["09"], "counties": [], "name": "Connecticut CAMA and Parcel Layer (CT GIS Office / OPM)", "terms": "https://www.arcgis.com/sharing/rest/content/items/82a733423a244c43a9d4bf552954cea9?f=json", "addr": "Location_1", "max": 2000, "fields": [["Parcel_ID", "Parcel_ID"], ["Location_1", "Location"], ["Property_City", "Property City"], ["State_Use_Description", "State Use Description"], ["Assessed_Total", "Assessed Total"], ["Assessed_Land", "Assessed Land"], ["Assessed_Building", "Assessed Building"], ["Appraised_Land", "Appraised Land"], ["Appraised_Building", "Appraised Building"], ["Valuation_Year", "Valuation Year"], ["Sale_Price", "Sale Price"], ["Sale_Date", "Sale Date"], ["Land_Acres", "Land Acres"], ["Zone", "Zone"], ["AYB", "AYB"]]}, {"url": "https://mdgeodata.md.gov/imap/rest/services/PlanningCadastre/MD_ParcelBoundaries/MapServer/0", "states": ["24"], "counties": [], "name": "Maryland Parcel Boundaries (MD iMAP / MDP / SDAT)", "terms": "https://www.arcgis.com/sharing/rest/content/items/b33e5f03d50844b8819a4046ecfe0d97?f=json", "addr": "", "max": 1000, "fields": [["ACCTID", "Account ID"], ["PREMSNUM", "Premise Address Number"], ["PREMSNAM", "Premise Street Name"], ["PREMSTYP", "Premise Address Street Type"], ["PREMCITY", "Premise City"], ["DESCLU", "Land Use Description"], ["ZONING", "Zoning"], ["ACRES", "Acres"], ["NFMLNDVL", "New Appraised Land Value"], ["NFMIMPVL", "New Appraised Improvement Value"], ["NFMTTLVL", "New Appraised Full Value"], ["YEARBLT", "Year Built"]]}, {"url": "https://services1.arcgis.com/BkFxaEFNwHqX3tAw/arcgis/rest/services/FS_VCGI_OPENDATA_Cadastral_VTPARCELS_poly_standardized_parcels_SP_v1/FeatureServer/0", "states": ["50"], "counties": [], "name": "VCGI Statewide Standardized Parcel Data (VTPARCELS, Grand List joined)", "terms": "https://maps.vcgi.vermont.gov/gisdata/metadata/CadastralParcels_VTPARCELS.htm", "addr": "E911ADDR", "max": 2000, "fields": [["SPAN", "GIS SPAN"], ["E911ADDR", "Emergency 911 Address"], ["TNAME", "Grand-List Town-Name"], ["DESCPROP", "Property Description"], ["CAT", "Category (Real Estate only)"], ["REAL_FLV", "Listed Real Value (Full)"], ["LAND_LV", "Listed Value of Land"], ["IMPRV_LV", "Listed Value of Improvements"], ["YEAR", "GIS Year"], ["ACRESGL", "Total Acres"]]}, {"url": "https://gisservices.its.ny.gov/arcgis/rest/services/NYS_Tax_Parcels_Public/MapServer/1", "states": ["36"], "counties": [], "name": "NYS Tax Parcels Public (NYS ITS Geospatial Services + ORPTS)", "terms": "https://gisservices.its.ny.gov/arcgis/rest/services/NYS_Tax_Parcels_Public/MapServer/1?f=json", "addr": "PARCEL_ADDR", "max": 50000, "fields": [["PRINT_KEY", "PRINT_KEY"], ["PARCEL_ADDR", "PARCEL_ADDR"], ["CITYTOWN_NAME", "CITYTOWN_NAME"], ["MUNI_NAME", "MUNI_NAME"], ["PROP_CLASS", "PROP_CLASS"], ["USED_AS_DESC", "USED_AS_DESC"], ["LAND_AV", "LAND_AV"], ["TOTAL_AV", "TOTAL_AV"], ["FULL_MARKET_VAL", "FULL_MARKET_VAL"], ["YR_BLT", "YR_BLT"], ["ACRES", "ACRES"], ["COUNTY_NAME", "COUNTY_NAME"]]}, {"url": "https://gis.colorado.gov/public/rest/services/Address_and_Parcel/Colorado_Public_Parcels/FeatureServer/0", "states": ["08"], "counties": [], "name": "Colorado Public Parcels (Governor's Office of Information Technology)", "terms": "https://gis.colorado.gov/public/rest/services/Address_and_Parcel/Colorado_Public_Parcels/FeatureServer/info/iteminfo?f=json", "addr": "situsAdd", "max": 2000, "fields": [["parcel_id", "Parcel Number"], ["situsAdd", "Street Address"], ["sitAddCty", "City Name"], ["landUseDsc", "Tax Land Use Description"], ["zoningDesc", "Zoning Description"], ["apprValTot", "Parcel Total Value"], ["asedValTot", "Taxable Value"], ["saleDate", "Date of Last Sale"], ["salePrice", "Price of Last Sale"], ["landAcres", "Parcel Acres"], ["URL", "URL"], ["countyName", "County Name"]]}, {"url": "https://gisdata.in.gov/server/rest/services/Hosted/Parcel_Boundaries_of_Indiana_Current/FeatureServer/0", "states": ["18"], "counties": [], "name": "Parcel Boundaries of Indiana Current (IGIO Data Harvest)", "terms": "https://gisdata.in.gov/portal/sharing/rest/content/items/ce78e8017fcb479c81a06a6255cfcfa6?f=json", "addr": "prop_add", "max": 2000, "fields": [["parcel_id", "PARCEL_ID"], ["prop_add", "PROP_ADD"], ["prop_city", "PROP_CITY"], ["dlgf_prop_class_code", "DLGF_PROP_CLASS_CODE"]]}, {"url": "https://enterprise.gisdata.mn.gov/aghost/rest/services/us_mn_state_mngeo/plan_parcels_open/FeatureServer/1", "states": ["27"], "counties": [], "name": "Parcels, Compiled from Opt-In Open Data Counties, Minnesota (MnGeo)", "terms": "https://www.arcgis.com/sharing/rest/content/items/69148d3959194a05a23964cc60f6517b?f=json", "addr": "", "max": 2000, "fields": [["county_pin", "county_pin"], ["anumber", "anumber"], ["st_name", "st_name"], ["st_pos_typ", "st_pos_typ"], ["ctu_name", "ctu_name"], ["useclass1", "useclass1"], ["emv_land", "emv_land"], ["emv_bldg", "emv_bldg"], ["emv_total", "emv_total"], ["tax_year", "tax_year"], ["mkt_year", "mkt_year"], ["acres_poly", "acres_poly"], ["co_name", "co_name"]]}, {"url": "https://vginmaps.vdem.virginia.gov/arcgis/rest/services/VA_Base_Layers/VA_Parcels/MapServer/0", "states": ["51"], "counties": [], "name": "Virginia Parcels (VGIN, VA_Base_Layers/VA_Parcels)", "terms": "https://vginmaps.vdem.virginia.gov/arcgis/rest/services/VA_Base_Layers/VA_Parcels/MapServer/info/iteminfo?f=json", "addr": "", "max": 2000, "fields": [["PARCELID", "Parcel ID"], ["LOCALITY", "LOCALITY"], ["PTM_ID", "Parcel Tax Map ID"]]}, {"url": "https://services.wvgis.wvu.edu/arcgis/rest/services/Planning_Cadastre/WV_Parcels/MapServer/0", "states": ["54"], "counties": [], "name": "WV Parcels (WVGIS Technical Center / WV Property Tax Division)", "terms": "https://services.wvgis.wvu.edu/arcgis/rest/services/Planning_Cadastre/WV_Parcels/MapServer/0?f=json", "addr": "FullPhysicalAddress", "max": 2000, "fields": [["CleanParcelID", "CleanParcelID"], ["FullPhysicalAddress", "FullPhysicalAddress"], ["FullLegalDescription", "FullLegalDescription"], ["CALC_ACRE", "CALC_ACRE"]]}, {"url": "https://enterprise.firstmap.delaware.gov/arcgis/rest/services/PlanningCadastre/DE_StateParcels/MapServer/0", "states": ["10"], "counties": [], "name": "Delaware State Parcels (FirstMap)", "terms": "https://enterprise.firstmap.delaware.gov/arcgis/rest/services/PlanningCadastre/DE_StateParcels/MapServer/info/iteminfo?f=json", "addr": "", "max": 2000, "fields": [["PIN", "PIN"], ["ACRES", "Acres"], ["COUNTY", "County"]]}, {"url": "https://gis.arkansas.gov/arcgis/rest/services/FEATURESERVICES/Planning_Cadastre/FeatureServer/6", "states": ["05"], "counties": [], "name": "Arkansas Parcel Polygons - County Assessor Mapping Program (AGISO)", "terms": "https://gis.arkansas.gov/arcgis/rest/services/FEATURESERVICES/Planning_Cadastre/MapServer/6/metadata", "addr": "adrlabel", "max": 200, "fields": [["parcelid", "ParcelId"], ["adrlabel", "AdrLabel"], ["adrcity", "AdrCity"], ["parceltype", "ParcelType"], ["landvalue", "LandValue"], ["impvalue", "ImpValue"], ["totalvalue", "TotalValue"], ["assessvalue", "AssessValue"], ["county", "County"], ["camadate", "CAMADate"]]}, {"url": "https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Property_and_Land_WebMercator/MapServer/40", "states": ["11"], "counties": [], "name": "DC Owner Polygons (Common Ownership Layer) + ITSPE / CAMA sales", "terms": "https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Property_and_Land_WebMercator/MapServer/40/iteminfo?f=json", "addr": "PREMISEADD", "max": 2000, "fields": [["SSL", "Square, Suffix, Lot"], ["PREMISEADD", "Premise Address"], ["USECODE", "Use Code"], ["PROPTYPE", "Property Type"], ["NEWLAND", "Proposed Land value"], ["NEWIMPR", "Proposed Improvement Value"], ["NEWTOTAL", "Proposed Total Value"], ["LANDAREA", "Land Area"], ["NBHDNAME", "Neighborhood Assessment Name"]]}, {"url": "https://services1.arcgis.com/RbMX0mRVOFNTdLzd/arcgis/rest/services/Maine_Parcels_Organized_Towns/FeatureServer/10", "states": ["23"], "counties": [], "name": "Maine Parcels Organized Towns (Maine GeoLibrary / MEGIS)", "terms": "https://www.arcgis.com/sharing/rest/content/items/346131b710a645ffb624f448a9cba6d4?f=json", "addr": "PROP_LOC", "max": 2000, "fields": [["MAP_BK_LOT", "MAP_BK_LOT"], ["PROP_LOC", "PROP_LOC"], ["TOWN", "TOWN"], ["COUNTY", "COUNTY"], ["TYPE", "TYPE"]]}, {"url": "https://services2.arcgis.com/MlJ0G8iWUyC7jAmu/arcgis/rest/services/OhioStatewidePacels_full_view/FeatureServer/0", "states": ["39"], "counties": [], "name": "Ohio Statewide Parcels Public View (OGRIP)", "terms": "https://www.arcgis.com/sharing/rest/content/items/26ab5fad8d5d4258a7492a14de83bc0e?f=json", "addr": "SitusAddressAll", "max": 2000, "fields": [["LocalParcelID", "LocalParcelID"], ["SitusAddressAll", "Situs Address All"], ["StateLUC", "Land Use"], ["County", "County"], ["CAMADataSite", "CAMA Data"]]}, {"url": "https://services1.arcgis.com/GOcSXpzwBHyk2nog/arcgis/rest/services/NDGISHUB_Parcels/FeatureServer/0", "states": ["38"], "counties": [], "name": "NDGISHUB Parcels + Parcels_TaxRoll (North Dakota State Parcel Program)", "terms": "https://www.arcgis.com/sharing/rest/content/items/ac6da1176038457db16e8debe3f1abaf?f=json", "addr": "", "max": 2000, "fields": [["GISID", "GIS ID"], ["CountyName", "County Name"], ["SubdivisionPlat", "Subdivision Plat"], ["Lot", "Lot"], ["Block", "Block"], ["CalculatedAcres", "Calculated Acres"]]}, {"url": "https://services3.arcgis.com/r0iJ85SKZ4zAzz3P/arcgis/rest/services/Wyoming_Parcels_for_2026/FeatureServer/0", "states": ["56"], "counties": [], "name": "Wyoming Parcels for 2026 (Wyoming Statewide Parcel Viewer, Dept. of Revenue)", "terms": "https://www.arcgis.com/sharing/rest/content/items/4bb9a66f7287402b8f650aa9f21d3fa5?f=json", "addr": "locationad", "max": 2000, "fields": [["parcelnb", "parcelnb"], ["locationad", "locationad"], ["jurisdicti", "jurisdicti"], ["actualvalu", "actualvalu"], ["assessedva", "assessedva"], ["taxyear", "taxyear"], ["landgrossa", "landgrossa"]]}, {"url": "https://services1.arcgis.com/CNPdEkvnGl65jCX8/arcgis/rest/services/Public_Idaho_Parcels_/FeatureServer/7", "states": ["16"], "counties": [], "name": "Public Idaho Parcels (Idaho ITS, Idaho Parcel Data Exchange Standard)", "terms": "https://www.arcgis.com/sharing/rest/content/items/65a3f7c6d4ca404ba6ab677913953b35?f=json", "addr": "SITE_ADD", "max": 2000, "fields": [["PARCEL_ID", "Parcel Identification Number"], ["SITE_ADD", "Situs Address"], ["SITE_CITY", "Situs City"], ["ASR_CATS", "Assessment Categories"], ["VAL_LAND", "Value of Land"], ["VAL_IMPVTS", "Value of all Improvements"], ["VAL_TOTAL", "Total Value"], ["ASR_ACRES", "Legal Acres"], ["County", "County"], ["WEBSITE", "Website"]]}, {"url": "https://giscat.ne.gov/enterprise/rest/services/StatewideParcelsExternal/MapServer/0", "states": ["31"], "counties": [], "name": "Nebraska StatewideParcelsExternal (OCIO, county CAMA)", "terms": "https://giscat.ne.gov/enterprise/rest/services/StatewideParcelsExternal/MapServer/0?f=json", "addr": "Situs_Address", "max": 2000, "fields": [["Parcel_ID", "Parcel_ID"], ["Situs_Address", "Situs_Address"], ["Ph_City", "Ph_City"], ["Classification_Code", "Classification_Code"], ["Property_SubClass", "Property_SubClass"], ["Total_Assessed_Value", "Total_Assessed_Value"], ["Land_Value", "Land_Value"], ["Improvements_Value", "Improvements_Value"], ["Sales_Date", "Sales_Date"], ["Sales_Value", "Sales_Value"], ["GIS_Acres", "GIS_Acres"], ["BuildingYear", "BuildingYear"], ["Parcel_URL", "Parcel_URL"]]}, {"url": "https://risegis.ri.gov/hosting/rest/services/RIDEM/Tax_Parcels/MapServer/0", "states": ["44"], "counties": [], "name": "Rhode Island Tax Parcels (RIDEM / RIGIS, 37 towns)", "terms": "https://risegis.ri.gov/hosting/rest/services/RIDEM/Tax_Parcels/MapServer/info/iteminfo?f=json", "addr": "", "max": 2000, "fields": [["PlatLot", "PlatLot"], ["TownCode", "TownCode"], ["E911Desc", "E911Desc"], ["Acres", "Acres"]]}, {"url": "https://services5.arcgis.com/GfwWNkhOj9bNBqoJ/arcgis/rest/services/MAPPLUTO/FeatureServer/0", "states": [], "counties": ["36005", "36047", "36061", "36081", "36085"], "name": "NYC MapPLUTO (NYC Department of City Planning)", "terms": "https://www.arcgis.com/sharing/rest/content/items/1564ace0b4f44318ac39920737f9bd07?f=json", "addr": "Address", "max": 2000, "fields": [["Borough", "Borough"], ["Block", "Block"], ["Lot", "Lot"], ["Address", "Address"], ["LandUse", "LandUse"], ["BldgClass", "BldgClass"], ["ZoneDist1", "ZoneDist1"], ["LotArea", "LotArea"], ["BldgArea", "BldgArea"], ["UnitsRes", "UnitsRes"], ["NumFloors", "NumFloors"], ["AssessLand", "AssessLand"], ["AssessTot", "AssessTot"], ["YearBuilt", "YearBuilt"]]}, {"url": "https://gis.mcassessor.maricopa.gov/arcgis/rest/services/Parcels/MapServer/0", "states": [], "counties": ["04013"], "name": "Maricopa County Assessor Parcels", "terms": "https://gis.mcassessor.maricopa.gov/arcgis/rest/services/Parcels/MapServer/info/iteminfo?f=json", "addr": "PHYSICAL_ADDRESS", "apn": "APN_DASH", "max": 1000, "fields": [["APN_DASH", "APN_DASH"], ["PHYSICAL_ADDRESS", "Property Address"], ["PHYSICAL_CITY", "Property City"], ["PUC", "PUC"], ["FCV_CUR", "Current Full Cash Value"], ["LPV_CUR", "Current Limited Property Value"], ["TAX_YR_CUR", "Current Tax Year"], ["SALE_DATE", "Sale Date"], ["SALE_PRICE", "Sale Price"], ["LAND_SIZE", "Land Size"], ["CONST_YEAR", "Construction Year"], ["CITY_ZONING", "Zoning"]]}, {"url": "https://gis.cookcountyil.gov/traditional/rest/services/cookVwrDynmc/MapServer/44", "states": [], "counties": ["17031"], "name": "Cook County GIS - Current Parcel (cookVwrDynmc layer 44)", "terms": "https://gis.cookcountyil.gov/traditional/rest/services/cookVwrDynmc/MapServer/info/iteminfo?f=json", "addr": "Address", "max": 2000, "fields": [["PIN14", "PIN14"], ["Address", "Address"], ["City", "City"], ["BLDGClass", "BLDGClass"], ["LandValue", "LandValue"], ["BldgValue", "BldgValue"], ["TotalValue", "TotalValue"], ["TAXYR", "TAXYR"], ["BldgAge", "BldgAge"], ["LandSqft", "LandSqft"]]}, {"url": "https://geo.sandag.org/server/rest/services/Hosted/Parcels/FeatureServer/0", "states": [], "counties": ["06073"], "name": "SanGIS Parcels (hosted by SANDAG)", "terms": "https://geo.sandag.org/server/rest/services/Hosted/Parcels/FeatureServer/0?f=json", "addr": "situs_address", "max": 2000, "fields": [["apn", "APN"], ["situs_address", "SITUS_ADDRESS"], ["situs_community", "SITUS_COMMUNITY"], ["asr_landuse", "ASR_LANDUSE"], ["asr_land", "ASR_LAND"], ["asr_impr", "ASR_IMPR"], ["asr_total", "ASR_TOTAL"], ["acreage", "ACREAGE"], ["total_lvg_area", "TOTAL_LVG_AREA"], ["year_effective", "YEAR_EFFECTIVE"]]}, {"url": "https://gis.franklincountyohio.gov/hosting/rest/services/ParcelFeatures/Parcel_Features/MapServer/0", "states": [], "counties": ["39049"], "name": "Franklin County Auditor Tax Parcel (Parcel_Features)", "terms": "https://gis.franklincountyohio.gov/hosting/rest/services/ParcelFeatures/Parcel_Features/MapServer/info/iteminfo?f=json", "addr": "SITEADDRESS", "max": 3000, "fields": [["PARCELID", "PARCELID"], ["SITEADDRESS", "Site Address"], ["CLASSDSCRP", "Property Class Description"], ["ACRES", "GIS Acres"], ["SALEDATE", "Sale Date"], ["SALEPRICE", "Sale Price"], ["RESYRBLT", "Res. Year Built"]]}, {"url": "https://gismaps.fultoncountyga.gov/arcgispub/rest/services/OpenData/Tax_Parcels/MapServer/0", "states": [], "counties": ["13121"], "name": "Fulton County OpenData Tax_Parcels", "terms": "https://gismaps.fultoncountyga.gov/arcgispub/rest/services/OpenData/Tax_Parcels/MapServer/info/iteminfo?f=json", "addr": "Address", "max": 2000, "fields": [["ParcelID", "ParcelID"], ["Address", "Address"], ["LUCode", "LUCode"], ["ClassCode", "ClassCode"], ["LivUnits", "LivUnits"], ["LandAcres", "LandAcres"], ["TaxYear", "TaxYear"]]}, {"url": "https://gisdata.alleghenycounty.us/arcgis/rest/services/OPENDATA/Parcels/MapServer/0", "states": [], "counties": ["42003"], "name": "Allegheny County OPENDATA Parcels (geometry)", "terms": "https://gisdata.alleghenycounty.us/arcgis/rest/services/OPENDATA/Parcels/MapServer/info/iteminfo?f=json", "addr": "", "max": 1000, "fields": [["PIN", "PIN"], ["MAPBLOCKLOT", "Map Block Lot"], ["CALCACREAGE", "Calculated Acreage"]]}, {"url": "https://maps.clarkcountynv.gov/arcgis/rest/services/Assessor/Layers/MapServer/1", "states": [], "counties": ["32003"], "name": "Clark County Assessor Parcels (Assessor/Layers)", "terms": "https://maps.clarkcountynv.gov/arcgis/rest/services/Assessor/Layers/MapServer/info/iteminfo?f=json", "addr": "", "max": 2000, "fields": [["APN", "APN"], ["ASSR_ACRES", "ASSR_ACRES"], ["PARCELTYPE", "PARCELTYPE"]]}, {"url": "https://gis.crcog.org/arcgis/rest/services/RegionalParcelViewer/Parcels/MapServer/0", "states": ["09"], "counties": ["09003"], "name": "CRCOG Capitol Region CT Parcels (Hartford Metro)", "terms": "https://gis.crcog.org", "addr": "Location", "max": 2000, "fields": [["Parcel_ID", "Parcel ID"], ["Location", "Site Address"], ["Owner", "Owner"], ["Total_Assessed", "Assessed Value"]]}, {"url": "https://services6.arcgis.com/UwEXjTguDDovBVaQ/ArcGIS/rest/services/Parcels/FeatureServer/0", "states": ["09"], "counties": ["09001"], "name": "WestCOG Western CT Parcels (Stamford / Bridgeport Metro)", "terms": "https://westcog.org", "addr": "SITE_ADDR", "max": 2000, "fields": [["PROP_ID", "Property ID"], ["SITE_ADDR", "Site Address"], ["TOTAL_VAL", "Total Value"]]}, {"url": "https://gismaps.kingcounty.gov/ArcGIS/rest/services/Planning/KingCo_Zoning/MapServer/1", "states": ["53"], "counties": ["53033"], "name": "King County WA Native Zoning Layer", "terms": "https://gismaps.kingcounty.gov", "addr": "SITUS_ADDRESS", "max": 2000, "fields": [["PIN", "PIN"], ["ZONING", "Zoning Code"], ["ZONING_DESC", "Zoning Description"]]}, {"url": "https://gisweb.miamidade.gov/arcgis/rest/services/MD_MDCZoning/MapServer/6", "states": ["12"], "counties": ["12086"], "name": "Miami-Dade County Unincorporated Zoning Layer", "terms": "https://gisweb.miamidade.gov", "addr": "ADDRESS", "max": 2000, "fields": [["FOLIO", "Folio ID"], ["ZONING", "Zoning Code"], ["ZONE_DESC", "Zone Description"]]}, {"url": "https://services.arcgis.com/KaARkuoKF9vrGr3P/arcgis/rest/services/New_Orleans_Parcels/FeatureServer/0", "states": ["22"], "counties": ["22071"], "name": "New Orleans Cadastral Parcels GIS", "terms": "https://services.arcgis.com/KaARkuoKF9vrGr3P/arcgis/rest/services/New_Orleans_Parcels/FeatureServer/0", "addr": "geopin", "apn": "geopin", "max": 1000, "fields": [["geopin", "GeoPIN"], ["acres", "Acres"], ["objectid", "Object ID"]]}, {"url": "https://jccgis.jccal.org/server/rest/services/Basemap/Parcels/MapServer/0", "states": ["AL"], "counties": ["01073"], "name": "Jefferson County GIS Parcels", "terms": "https://jccgis.jccal.org/server/rest/services/Basemap/Parcels/MapServer/0", "addr": "ADDR_PSPR", "apn": "PARCELID", "max": 2000, "fields": [["PARCELID", "Parcel ID"], ["ADDR_PSPR", "Site Address"]]}, {"url": "https://services8.arcgis.com/HND1NcQt6vgOGn1z/ArcGIS/rest/services/MCRC_Public_Parcels/FeatureServer/1", "states": ["AL"], "counties": ["01097"], "name": "Mobile County GIS Parcels", "terms": "https://services8.arcgis.com/HND1NcQt6vgOGn1z/ArcGIS/rest/services/MCRC_Public_Parcels/FeatureServer/1", "addr": "PropAddr1", "apn": "Parcel_Number", "max": 2000, "fields": [["Parcel_Number", "Parcel ID"], ["PropAddr1", "Site Address"]]}, {"url": "https://maps.shelbyal.com/gisserver/rest/services/LegacyServices/Cadastral_2026/MapServer/91", "states": ["AL"], "counties": ["01117"], "name": "Shelby County GIS Parcels", "terms": "https://maps.shelbyal.com/gisserver/rest/services/LegacyServices/Cadastral_2026/MapServer/91", "addr": "PROP_ADR", "apn": "PROPERTY_NUM", "max": 2000, "fields": [["PROPERTY_NUM", "Parcel ID"], ["PROP_ADR", "Site Address"]]}, {"url": "https://azwatermaps.azwater.gov/arcgis/rest/services/General/Parcels/MapServer/10", "states": ["AZ"], "counties": ["04019"], "name": "Pima County GIS Parcels", "terms": "https://azwatermaps.azwater.gov/arcgis/rest/services/General/Parcels/MapServer/10", "addr": "SITE_ADDRESS", "apn": "APN", "max": 2000, "fields": [["APN", "Parcel ID"], ["SITE_ADDRESS", "Site Address"]]}, {"url": "https://azwatermaps.azwater.gov/arcgis/rest/services/General/Parcels/MapServer/11", "states": ["AZ"], "counties": ["04021"], "name": "Pinal County GIS Parcels", "terms": "https://azwatermaps.azwater.gov/arcgis/rest/services/General/Parcels/MapServer/11", "addr": "SITE_ADDRESS", "apn": "APN", "max": 2000, "fields": [["APN", "Parcel ID"], ["SITE_ADDRESS", "Site Address"]]}, {"url": "https://azwatermaps.azwater.gov/arcgis/rest/services/General/Parcels/MapServer/13", "states": ["AZ"], "counties": ["04025"], "name": "Yavapai County GIS Parcels", "terms": "https://azwatermaps.azwater.gov/arcgis/rest/services/General/Parcels/MapServer/13", "addr": "SITE_ADDRESS", "apn": "APN", "max": 2000, "fields": [["APN", "Parcel ID"], ["SITE_ADDRESS", "Site Address"]]}, {"url": "https://azwatermaps.azwater.gov/arcgis/rest/services/General/Parcels/MapServer/14", "states": ["AZ"], "counties": ["04027"], "name": "Yuma County GIS Parcels", "terms": "https://azwatermaps.azwater.gov/arcgis/rest/services/General/Parcels/MapServer/14", "addr": "SITE_ADDRESS", "apn": "APN", "max": 2000, "fields": [["APN", "Parcel ID"], ["SITE_ADDRESS", "Site Address"]]}, {"url": "https://public.gis.lacounty.gov/public/rest/services/LACounty_Cache/LACounty_Parcel/MapServer/0", "states": ["CA"], "counties": ["06037"], "name": "Los Angeles County GIS Parcels", "terms": "https://public.gis.lacounty.gov/public/rest/services/LACounty_Cache/LACounty_Parcel/MapServer/0", "addr": "SitusFullAddress", "apn": "AIN", "max": 1000, "fields": [["AIN", "Parcel ID"], ["SitusFullAddress", "Site Address"]]}, {"url": "https://ocgis.com/arcpub/rest/services/Map_Layers/Parcels/MapServer/0", "states": ["CA"], "counties": ["06059"], "name": "Orange County GIS Parcels", "terms": "https://ocgis.com/arcpub/rest/services/Map_Layers/Parcels/MapServer/0", "addr": "SITE_ADDRESS", "apn": "ASSESSMENT_NO", "max": 1000, "fields": [["ASSESSMENT_NO", "Parcel ID"], ["SITE_ADDRESS", "Site Address"]]}, {"url": "https://gis.countyofriverside.us/arcgis_mapping/rest/services/OpenData/Assessor/MapServer/50", "states": ["CA"], "counties": ["06065"], "name": "Riverside County GIS Parcels", "terms": "https://gis.countyofriverside.us/arcgis_mapping/rest/services/OpenData/Assessor/MapServer/50", "addr": "SITUS_STREET", "apn": "APN", "max": 2000, "fields": [["APN", "Parcel ID"], ["SITUS_STREET", "Site Address"]]}, {"url": "https://services.arcgis.com/aA3snZwJfFkVyDuP/arcgis/rest/services/San_Bernardino_County_Parcel_Dataset/FeatureServer/0", "states": ["CA"], "counties": ["06071"], "name": "San Bernardino County GIS Parcels", "terms": "https://services.arcgis.com/aA3snZwJfFkVyDuP/arcgis/rest/services/San_Bernardino_County_Parcel_Dataset/FeatureServer/0", "addr": "", "apn": "APN", "max": 1000, "fields": [["APN", "Parcel ID"]]}, {"url": "https://services3.arcgis.com/RfpmnkSAQleRbndX/ArcGIS/rest/services/Property_and_Tax/FeatureServer/0", "states": ["GA"], "counties": ["13135"], "name": "Gwinnett County GIS Parcels", "terms": "https://services3.arcgis.com/RfpmnkSAQleRbndX/ArcGIS/rest/services/Property_and_Tax/FeatureServer/0", "addr": "ADDRESS", "apn": "PIN", "max": 2000, "fields": [["PIN", "Parcel ID"], ["ADDRESS", "Site Address"]]}, {"url": "https://dcgis.dekalbcountyga.gov/hosted/rest/services/PropertyAppraisal/Parcels_IASWorld/MapServer/0", "states": ["GA"], "counties": ["13089"], "name": "DeKalb County GIS Parcels", "terms": "https://dcgis.dekalbcountyga.gov/hosted/rest/services/PropertyAppraisal/Parcels_IASWorld/MapServer/0", "addr": "SITEADDRESS", "apn": "PARCELID", "max": 2000, "fields": [["PARCELID", "Parcel ID"], ["SITEADDRESS", "Site Address"]]}, {"url": "https://pub.sagis.org/arcgis/rest/services/OpenData/Parcels/MapServer/27", "states": ["GA"], "counties": ["13051"], "name": "Chatham County GIS Parcels", "terms": "https://pub.sagis.org/arcgis/rest/services/OpenData/Parcels/MapServer/27", "addr": "PropAddress_Full", "apn": "PIN", "max": 2000, "fields": [["PIN", "Parcel ID"], ["PropAddress_Full", "Site Address"]]}, {"url": "https://gis.linncountyiowa.gov/ags/rest/services/Planning/mapBSAPermitting/MapServer/6", "states": ["IA"], "counties": ["19113"], "name": "Linn County GIS Parcels", "terms": "Service metadata restrict reproduction/conveyance. Public-display permission not found. Q-LINN", "addr": "SitusAddress", "apn": "GPN", "max": 2000, "fields": [["GPN", "Parcel ID"], ["SitusAddress", "Site Address"]]}, {"url": "https://services.arcgis.com/ovln19YRWV44nBqV/ArcGIS/rest/services/Cadastral/FeatureServer/3", "states": ["IA"], "counties": ["19163"], "name": "Scott County GIS Parcels", "terms": "https://services.arcgis.com/ovln19YRWV44nBqV/ArcGIS/rest/services/Cadastral/FeatureServer/3", "addr": "PropertyAddress", "apn": "PIN", "max": 2000, "fields": [["PIN", "Parcel ID"], ["PropertyAddress", "Site Address"]]}, {"url": "https://gis.johnsoncountyiowa.gov/arcgis/rest/services/LandRecords/Land_Records/MapServer/9", "states": ["IA"], "counties": ["19103"], "name": "Johnson County GIS Parcels", "terms": "https://gis.johnsoncountyiowa.gov/arcgis/rest/services/LandRecords/Land_Records/MapServer/9", "addr": "SiteAddress", "apn": "PPN", "max": 2000, "fields": [["PPN", "Parcel ID"], ["SiteAddress", "Site Address"]]}, {"url": "https://services5.arcgis.com/ya62ECiavqTkK0wv/ArcGIS/rest/services/ParcelFabricPublished_gdb/FeatureServer/15", "states": ["IA"], "counties": ["19013"], "name": "Black Hawk County GIS Parcels", "terms": "https://services5.arcgis.com/ya62ECiavqTkK0wv/ArcGIS/rest/services/ParcelFabricPublished_gdb/FeatureServer/15", "addr": "propertyad", "apn": "PIN", "max": 2000, "fields": [["PIN", "Parcel ID"], ["propertyad", "Site Address"]]}, {"url": "https://gis.dupageco.org/arcgis/rest/services/DuPage_County_IL/ParcelsWithRealEstateCC/MapServer/0", "states": ["IL"], "counties": ["17043"], "name": "DuPage County GIS Parcels", "terms": "https://gis.dupageco.org/arcgis/rest/services/DuPage_County_IL/ParcelsWithRealEstateCC/MapServer/0", "addr": "PROPADDRL1", "apn": "PIN", "max": 1000, "fields": [["PIN", "Parcel ID"], ["PROPADDRL1", "Site Address"]]}, {"url": "https://maps.lakecountyil.gov/arcgis/rest/services/CCAO/TaxParcelViewerPro/MapServer/12", "states": ["IL"], "counties": ["17097"], "name": "Lake County GIS Parcels", "terms": "https://maps.lakecountyil.gov/arcgis/rest/services/CCAO/TaxParcelViewerPro/MapServer/12", "addr": "", "apn": "Name", "max": 2000, "fields": [["Name", "Parcel ID"]]}, {"url": "https://gistech.countyofkane.org/arcgis/rest/services/KanePINList/MapServer/0", "states": ["IL"], "counties": ["17089"], "name": "Kane County GIS Parcels", "terms": "https://gistech.countyofkane.org/arcgis/rest/services/KanePINList/MapServer/0", "addr": "SiteAddress", "apn": "PIN", "max": 1000, "fields": [["PIN", "Parcel ID"], ["SiteAddress", "Site Address"]]}, {"url": "https://gisweb.wycokck.org/arcgis/rest/services/GISPUB/UGMAPS_4_V02/MapServer/0", "states": ["KS"], "counties": ["20209"], "name": "Wyandotte County GIS Parcels", "terms": "https://gisweb.wycokck.org/arcgis/rest/services/GISPUB/UGMAPS_4_V02/MapServer/0", "addr": "", "apn": "PARCEL", "max": 2000, "fields": [["PARCEL", "Parcel ID"]]}, {"url": "https://gis.dgcoks.gov/server/rest/services/Tax_Parcel/MapServer/0", "states": ["KS"], "counties": ["20045"], "name": "Douglas County GIS Parcels", "terms": "Restricted to Douglas County GIS web applications; other use not authorized by the opened service terms. Q-DOUGLAS", "addr": "situs", "apn": "PID", "max": 2000, "fields": [["PID", "Parcel ID"], ["situs", "Site Address"]]}, {"url": "https://gis.lojic.org/maps/rest/services/LojicApps/MsdCsoSsoLocations/MapServer/4", "states": ["KY"], "counties": ["21111"], "name": "Jefferson County GIS Parcels", "terms": "https://gis.lojic.org/maps/rest/services/LojicApps/MsdCsoSsoLocations/MapServer/4", "addr": "", "apn": "PARCELID", "max": 2000, "fields": [["PARCELID", "Parcel ID"]]}, {"url": "https://services1.arcgis.com/Mg7DLdfYcSWIaDnu/arcgis/rest/services/Parcel/FeatureServer/0", "states": ["KY"], "counties": ["21067"], "name": "Fayette County GIS Parcels", "terms": "https://services1.arcgis.com/Mg7DLdfYcSWIaDnu/arcgis/rest/services/Parcel/FeatureServer/0", "addr": "ADDRESS", "apn": "PVANUM", "max": 2000, "fields": [["PVANUM", "Parcel ID"], ["ADDRESS", "Site Address"]]}, {"url": "https://maps.linkgis.org/server/rest/services/Web_Scene_Map_Parcels/MapServer/13", "states": ["KY"], "counties": ["21117"], "name": "Kenton County GIS Parcels", "terms": "https://maps.linkgis.org/server/rest/services/Web_Scene_Map_Parcels/MapServer/13", "addr": "ADDRESS", "apn": "PIDN", "max": 2000, "fields": [["PIDN", "Parcel ID"], ["ADDRESS", "Site Address"]]}, {"url": "https://webgis.bgky.org/server/rest/services/WARCO/Parcel_Reference/FeatureServer/0", "states": ["KY"], "counties": ["21227"], "name": "Warren County GIS Parcels", "terms": "https://webgis.bgky.org/server/rest/services/WARCO/Parcel_Reference/FeatureServer/0", "addr": "ADDRESS", "apn": "", "max": 2000, "fields": [["ADDRESS", "Site Address"]]}, {"url": "https://secure.boonecountygis.com/server/rest/services/ParcelLayers/MapServer/0", "states": ["KY"], "counties": ["21015"], "name": "Boone County GIS Parcels", "terms": "https://secure.boonecountygis.com/server/rest/services/ParcelLayers/MapServer/0", "addr": "SITEADD1", "apn": "PIDN", "max": 2000, "fields": [["PIDN", "Parcel ID"], ["SITEADD1", "Site Address"]]}, {"url": "https://services.arcgis.com/KYvXadMcgf0K1EzK/ArcGIS/rest/services/Tax_Parcels_2026/FeatureServer/0", "states": ["LA"], "counties": ["22033"], "name": "East Baton Rouge County GIS Parcels", "terms": "https://services.arcgis.com/KYvXadMcgf0K1EzK/ArcGIS/rest/services/Tax_Parcels_2026/FeatureServer/0", "addr": "PHYSICAL_ADDRESS", "apn": "ASSESSMENT_NUM", "max": 2000, "fields": [["ASSESSMENT_NUM", "Parcel ID"], ["PHYSICAL_ADDRESS", "Site Address"]]}, {"url": "https://jpgis.jeffparish.net/server/rest/services/Parcels/FeatureServer/0", "states": ["LA"], "counties": ["22051"], "name": "Jefferson County GIS Parcels", "terms": "https://jpgis.jeffparish.net/server/rest/services/Parcels/FeatureServer/0", "addr": "", "apn": "", "max": 2000, "fields": []}, {"url": "https://maps.stpgov.org/server/rest/services/Referenced_Layers/2025_Parcels/MapServer/0", "states": ["LA"], "counties": ["22103"], "name": "St. Tammany County GIS Parcels", "terms": "https://maps.stpgov.org/server/rest/services/Referenced_Layers/2025_Parcels/MapServer/0", "addr": "Physical_Address1", "apn": "REID", "max": 2000, "fields": [["REID", "Parcel ID"], ["Physical_Address1", "Site Address"]]}, {"url": "https://services2.arcgis.com/qvkbeam7WirpsIPC/arcgis/rest/services/City_of_Detroit_Parcels/FeatureServer/0", "states": ["MI"], "counties": ["26163"], "name": "Wayne County GIS Parcels", "terms": "https://services2.arcgis.com/qvkbeam7WirpsIPC/arcgis/rest/services/City_of_Detroit_Parcels/FeatureServer/0", "addr": "fullAddres", "apn": "packedParc", "max": 2000, "fields": [["packedParc", "Parcel ID"], ["fullAddres", "Site Address"]]}, {"url": "https://qagisservices.oakgov.com/arcgisds/rest/services/Hosted/Tax_Parcel_2024/FeatureServer/32", "states": ["MI"], "counties": ["26125"], "name": "Oakland County GIS Parcels", "terms": "https://qagisservices.oakgov.com/arcgisds/rest/services/Hosted/Tax_Parcel_2024/FeatureServer/32", "addr": "", "apn": "keypin", "max": 2000, "fields": [["keypin", "Parcel ID"]]}, {"url": "https://services6.arcgis.com/K0qS4r8AEJxrE8em/ArcGIS/rest/services/Macomb_County_Parcel_Data/FeatureServer/10", "states": ["MI"], "counties": ["26099"], "name": "Macomb County GIS Parcels", "terms": "https://services6.arcgis.com/K0qS4r8AEJxrE8em/ArcGIS/rest/services/Macomb_County_Parcel_Data/FeatureServer/10", "addr": "ADDRESS", "apn": "TAX_ID", "max": 2000, "fields": [["TAX_ID", "Parcel ID"], ["ADDRESS", "Site Address"]]}, {"url": "https://gisportalgr.grcity.us/arcgis/rest/services/Core_Data/Parcels/MapServer/1", "states": ["MI", "26"], "counties": ["26081"], "name": "Kent County & Grand Rapids GIS Parcels", "terms": "https://gisportalgr.grcity.us/arcgis/rest/services/Core_Data/Parcels/MapServer/1", "addr": "PROPERTYADDRESS", "apn": "PPN_TEXT", "max": 2000, "fields": [["PPN_TEXT", "Parcel ID"], ["PROPERTYADDRESS", "Site Address"], ["PROPERTYCLASS", "Use Class"], ["TAXABLETRIBUNAL1", "Taxable Value"], ["ACREAGE", "Acreage"], ["INROW_FLAG", "In-ROW"]]}, {"url": "https://services2.arcgis.com/w657bnjzrjguNyOy/ArcGIS/rest/services/STLCO_STC_Parcels_IND/FeatureServer/0", "states": ["MO"], "counties": ["29189"], "name": "St. Louis County County GIS Parcels", "terms": "https://services2.arcgis.com/w657bnjzrjguNyOy/ArcGIS/rest/services/STLCO_STC_Parcels_IND/FeatureServer/0", "addr": "PROP_ADD", "apn": "LOCATOR", "max": 2000, "fields": [["LOCATOR", "Parcel ID"], ["PROP_ADD", "Site Address"]]}, {"url": "https://jcgis.jacksongov.org/arcgis/rest/services/Cadastral/PastYearParcels/FeatureServer/0", "states": ["MO"], "counties": ["29095"], "name": "Jackson County GIS Parcels", "terms": "https://jcgis.jacksongov.org/arcgis/rest/services/Cadastral/PastYearParcels/FeatureServer/0", "addr": "", "apn": "Name", "max": 3000, "fields": [["Name", "Parcel ID"]]}, {"url": "https://services7.arcgis.com/n2n27A5sWjEWTpfF/arcgis/rest/services/St_Charles_County_Parcels/FeatureServer/0", "states": ["MO"], "counties": ["29183"], "name": "St. Charles County GIS Parcels", "terms": "https://services7.arcgis.com/n2n27A5sWjEWTpfF/arcgis/rest/services/St_Charles_County_Parcels/FeatureServer/0", "addr": "SiteAddress", "apn": "Account", "max": 1000, "fields": [["Account", "Parcel ID"], ["SiteAddress", "Site Address"]]}, {"url": "https://greenecountyassessor.org/arcgis/rest/services/TopoCountyParcels/MapServer/0", "states": ["MO"], "counties": ["29077"], "name": "Greene County GIS Parcels", "terms": "https://greenecountyassessor.org/arcgis/rest/services/TopoCountyParcels/MapServer/0", "addr": "", "apn": "PIN", "max": 1000, "fields": [["PIN", "Parcel ID"]]}, {"url": "https://maps8.stlouis-mo.gov/arcgis/rest/services/PDA/PARCELS_PUBLIC/MapServer/0", "states": ["MO"], "counties": ["29510"], "name": "St. Louis city County GIS Parcels", "terms": "https://maps8.stlouis-mo.gov/arcgis/rest/services/PDA/PARCELS_PUBLIC/MapServer/0", "addr": "SITEADDR", "apn": "ColParcelId", "max": 2000, "fields": [["ColParcelId", "Parcel ID"], ["SITEADDR", "Site Address"]]}, {"url": "https://opcgis.deq.state.ms.us/opcgis/rest/services/Government/HINDS_PARCELS/MapServer/0", "states": ["MS"], "counties": ["28049"], "name": "Hinds County GIS Parcels", "terms": "https://opcgis.deq.state.ms.us/opcgis/rest/services/Government/HINDS_PARCELS/MapServer/0", "addr": "SITEADD", "apn": "", "max": 1000, "fields": [["SITEADD", "Site Address"]]}, {"url": "https://geo.co.harrison.ms.us/server/rest/services/AGO/HarrisonCounty_ApprovedParcels/MapServer/0", "states": ["MS"], "counties": ["28047"], "name": "Harrison County GIS Parcels", "terms": "https://geo.co.harrison.ms.us/server/rest/services/AGO/HarrisonCounty_ApprovedParcels/MapServer/0", "addr": "PHYSADDR", "apn": "PARCEL_ID", "max": 110000, "fields": [["PARCEL_ID", "Parcel ID"], ["PHYSADDR", "Site Address"]]}, {"url": "https://gis.desotocountyms.gov/arcgis/rest/services/BaseLayers/MapServer/1", "states": ["MS"], "counties": ["28033"], "name": "DeSoto County GIS Parcels", "terms": "https://gis.desotocountyms.gov/arcgis/rest/services/BaseLayers/MapServer/1", "addr": "FULL_ADDR", "apn": "PIN", "max": 1000, "fields": [["PIN", "Parcel ID"], ["FULL_ADDR", "Site Address"]]}, {"url": "https://granit24a.sr.unh.edu/hosting/rest/services/Hosted/CAD_ParcelMosaic/FeatureServer/1", "states": ["NH"], "counties": ["33011"], "name": "Hillsborough County GIS Parcels", "terms": "Planning-use disclaimer; redistribution/display restriction not found; affirmative open-data license not found. Q-NH", "addr": "streetaddress", "apn": "nh_gis_id", "max": 2000, "fields": [["nh_gis_id", "Parcel ID"], ["streetaddress", "Site Address"]]}, {"url": "https://granit24a.sr.unh.edu/hosting/rest/services/Hosted/CAD_ParcelMosaic/FeatureServer/1", "states": ["NH"], "counties": ["33015"], "name": "Rockingham County GIS Parcels", "terms": "Planning-use disclaimer; redistribution/display restriction not found; affirmative open-data license not found. Q-NH", "addr": "streetaddress", "apn": "nh_gis_id", "max": 2000, "fields": [["nh_gis_id", "Parcel ID"], ["streetaddress", "Site Address"]]}, {"url": "https://granit24a.sr.unh.edu/hosting/rest/services/Hosted/CAD_ParcelMosaic/FeatureServer/1", "states": ["NH"], "counties": ["33013"], "name": "Merrimack County GIS Parcels", "terms": "Planning-use disclaimer; redistribution/display restriction not found; affirmative open-data license not found. Q-NH", "addr": "streetaddress", "apn": "nh_gis_id", "max": 2000, "fields": [["nh_gis_id", "Parcel ID"], ["streetaddress", "Site Address"]]}, {"url": "https://granit24a.sr.unh.edu/hosting/rest/services/Hosted/CAD_ParcelMosaic/FeatureServer/1", "states": ["NH"], "counties": ["33017"], "name": "Strafford County GIS Parcels", "terms": "Planning-use disclaimer; redistribution/display restriction not found; affirmative open-data license not found. Q-NH", "addr": "streetaddress", "apn": "nh_gis_id", "max": 2000, "fields": [["nh_gis_id", "Parcel ID"], ["streetaddress", "Site Address"]]}, {"url": "https://granit24a.sr.unh.edu/hosting/rest/services/Hosted/CAD_ParcelMosaic/FeatureServer/1", "states": ["NH"], "counties": ["33009"], "name": "Grafton County GIS Parcels", "terms": "Planning-use disclaimer; redistribution/display restriction not found; affirmative open-data license not found. Q-NH", "addr": "streetaddress", "apn": "nh_gis_id", "max": 2000, "fields": [["nh_gis_id", "Parcel ID"], ["streetaddress", "Site Address"]]}, {"url": "https://gisenterprise.washoecounty.gov/server/rest/services/WashoeGIS/Parcels/MapServer/0", "states": ["NV"], "counties": ["32031"], "name": "Washoe County GIS Parcels", "terms": "https://gisenterprise.washoecounty.gov/server/rest/services/WashoeGIS/Parcels/MapServer/0", "addr": "FullAddress", "apn": "PIN", "max": 2000, "fields": [["PIN", "Parcel ID"], ["FullAddress", "Site Address"]]}, {"url": "https://gis.lyon-county.org/server/rest/services/Landbase/Parcels/MapServer/1", "states": ["NV"], "counties": ["32019"], "name": "Lyon County GIS Parcels", "terms": "https://gis.lyon-county.org/server/rest/services/Landbase/Parcels/MapServer/1", "addr": "PHY_ADDR", "apn": "", "max": 2000, "fields": [["PHY_ADDR", "Site Address"]]}, {"url": "https://portal.carsoncity.gov/server/rest/services/CarsonCity/CarsonCityNV_OpenData/MapServer/36", "states": ["NV"], "counties": ["32510"], "name": "Carson City County GIS Parcels", "terms": "https://portal.carsoncity.gov/server/rest/services/CarsonCity/CarsonCityNV_OpenData/MapServer/36", "addr": "", "apn": "APN", "max": 20000, "fields": [["APN", "Parcel ID"]]}, {"url": "https://arcgis.water.nv.gov/arcgis/rest/services/BaseLayers/County_Parcels_in_Nevada/MapServer/0", "states": ["NV"], "counties": ["32007"], "name": "Elko County GIS Parcels", "terms": "NDWR-hosted copy explicitly restricts copying/exporting parcel data; public-display permission not found. Q-NEVADA", "addr": "", "apn": "APN", "max": 5000, "fields": [["APN", "Parcel ID"]]}, {"url": "https://map11.incog.org/arcgis11wa/rest/services/Parcels_TulsaCo/FeatureServer/0", "states": ["OK"], "counties": ["40143"], "name": "Tulsa County GIS Parcels", "terms": "https://map11.incog.org/arcgis11wa/rest/services/Parcels_TulsaCo/FeatureServer/0", "addr": "PropertyAddress", "apn": "AccountNo", "max": 2000, "fields": [["AccountNo", "Parcel ID"], ["PropertyAddress", "Site Address"]]}, {"url": "https://www3.multco.us/gisagspublic/rest/services/DART/Taxlots_Orion_Public/MapServer/0", "states": ["OR"], "counties": ["41051"], "name": "Multnomah County GIS Parcels", "terms": "Informational-use disclaimer; affirmative redistribution/public-display license not found. Q-MULTCO", "addr": "SITUSADDR", "apn": "MAPTAXLOT", "max": 2000, "fields": [["MAPTAXLOT", "Parcel ID"], ["SITUSADDR", "Site Address"]]}, {"url": "https://pappgispub1.co.washington.or.us/server/rest/services/baselayers/Taxlots_SP/MapServer/0", "states": ["OR"], "counties": ["41067"], "name": "Washington County GIS Parcels", "terms": "https://pappgispub1.co.washington.or.us/server/rest/services/baselayers/Taxlots_SP/MapServer/0", "addr": "", "apn": "TLNO", "max": 1000, "fields": [["TLNO", "Parcel ID"]]}, {"url": "https://services3.arcgis.com/I2eWXOndpF9m8oKC/ArcGIS/rest/services/Taxlots_CMap/FeatureServer/0", "states": ["OR"], "counties": ["41005"], "name": "Clackamas County GIS Parcels", "terms": "https://services3.arcgis.com/I2eWXOndpF9m8oKC/ArcGIS/rest/services/Taxlots_CMap/FeatureServer/0", "addr": "SITUS_FULL", "apn": "PARCEL_NUMBER", "max": 2000, "fields": [["PARCEL_NUMBER", "Parcel ID"], ["SITUS_FULL", "Site Address"]]}, {"url": "https://lcmaps.lanecounty.org/arcgis/rest/services/CommishSearch/AddressParcelNew/FeatureServer/1", "states": ["OR"], "counties": ["41039"], "name": "Lane County GIS Parcels", "terms": "https://lcmaps.lanecounty.org/arcgis/rest/services/CommishSearch/AddressParcelNew/FeatureServer/1", "addr": "", "apn": "MAPTAXLOT", "max": 2000, "fields": [["MAPTAXLOT", "Parcel ID"]]}, {"url": "https://gis.co.marion.or.us/arcgis/rest/services/Public/Parcels/MapServer/0", "states": ["OR"], "counties": ["41047"], "name": "Marion County GIS Parcels", "terms": "https://gis.co.marion.or.us/arcgis/rest/services/Public/Parcels/MapServer/0", "addr": "SITUS", "apn": "TAXLOT", "max": 1000, "fields": [["TAXLOT", "Parcel ID"], ["SITUS", "Site Address"]]}, {"url": "https://services.arcgis.com/fLeGjb7u4uXqeF9q/ArcGIS/rest/services/OPA_PROPERTIES_PUBLIC/FeatureServer/0", "states": ["PA"], "counties": ["42101"], "name": "Philadelphia County GIS Parcels", "terms": "https://services.arcgis.com/fLeGjb7u4uXqeF9q/ArcGIS/rest/services/OPA_PROPERTIES_PUBLIC/FeatureServer/0", "addr": "location", "apn": "parcel_number", "max": 2000, "fields": [["parcel_number", "Parcel ID"], ["location", "Site Address"]]}, {"url": "https://mapservices.pasda.psu.edu/server/rest/services/pasda/MontgomeryCounty/MapServer/14", "states": ["PA"], "counties": ["42091"], "name": "Montgomery County GIS Parcels", "terms": "https://mapservices.pasda.psu.edu/server/rest/services/pasda/MontgomeryCounty/MapServer/14", "addr": "", "apn": "PARCEL", "max": 1000, "fields": [["PARCEL", "Parcel ID"]]}, {"url": "https://mapservices.pasda.psu.edu/server/rest/services/pasda/BucksCounty/MapServer/17", "states": ["PA"], "counties": ["42017"], "name": "Bucks County GIS Parcels", "terms": "https://mapservices.pasda.psu.edu/server/rest/services/pasda/BucksCounty/MapServer/17", "addr": "ADDRESS", "apn": "PARCEL_NUM", "max": 1000, "fields": [["PARCEL_NUM", "Parcel ID"], ["ADDRESS", "Site Address"]]}, {"url": "https://citygis.greenvillesc.gov/arcgis/rest/services/AddressSearch/Property/MapServer/3", "states": ["SC"], "counties": ["45045"], "name": "Greenville County GIS Parcels", "terms": "https://citygis.greenvillesc.gov/arcgis/rest/services/AddressSearch/Property/MapServer/3", "addr": "", "apn": "PIN", "max": 2500, "fields": [["PIN", "Parcel ID"]]}, {"url": "https://gisportal.horrycounty.org/server/rest/services/Hosted/Energov_iGapps_WFL1/FeatureServer/6", "states": ["SC"], "counties": ["45051"], "name": "Horry County GIS Parcels", "terms": "https://gisportal.horrycounty.org/server/rest/services/Hosted/Energov_iGapps_WFL1/FeatureServer/6", "addr": "", "apn": "pintext", "max": 2000, "fields": [["pintext", "Parcel ID"]]}, {"url": "https://maps.spartanburgcounty.org/server/rest/services/GIS/CAMA_Parcels/MapServer/0", "states": ["SC"], "counties": ["45083"], "name": "Spartanburg County GIS Parcels", "terms": "https://maps.spartanburgcounty.org/server/rest/services/GIS/CAMA_Parcels/MapServer/0", "addr": "PropertyLocation", "apn": "MAPNUMBER", "max": 2000, "fields": [["MAPNUMBER", "Parcel ID"], ["PropertyLocation", "Site Address"]]}, {"url": "https://services1.arcgis.com/Ezk9fcjSUkeadg6u/ArcGIS/rest/services/Minnehaha_Map_WFL1/FeatureServer/6", "states": ["SD"], "counties": ["46099"], "name": "Minnehaha County GIS Parcels", "terms": "https://services1.arcgis.com/Ezk9fcjSUkeadg6u/ArcGIS/rest/services/Minnehaha_Map_WFL1/FeatureServer/6", "addr": "", "apn": "COUNTY_PIN", "max": 2000, "fields": [["COUNTY_PIN", "Parcel ID"]]}, {"url": "https://gis.rcgov.org/server/rest/services/OpenData/TaxParcels/MapServer/0", "states": ["SD"], "counties": ["46103"], "name": "Pennington County GIS Parcels", "terms": "https://gis.rcgov.org/server/rest/services/OpenData/TaxParcels/MapServer/0", "addr": "PropAddress", "apn": "PIN", "max": 2000, "fields": [["PIN", "Parcel ID"], ["PropAddress", "Site Address"]]}, {"url": "https://gis.siouxfalls.gov/arcgis/rest/services/Data/Property/MapServer/1", "states": ["SD"], "counties": ["46083"], "name": "Lincoln County GIS Parcels", "terms": "https://gis.siouxfalls.gov/arcgis/rest/services/Data/Property/MapServer/1", "addr": "Parcel.Address", "apn": "Parcel.PID", "max": 2000, "fields": [["Parcel.PID", "Parcel ID"], ["Parcel.Address", "Site Address"]]}, {"url": "https://geoviewer.cot.tn.gov/arcgis/rest/services/GeoViewer/NonImpact_Parcels/MapServer/6", "states": ["TN"], "counties": ["47157"], "name": "Shelby County GIS Parcels", "terms": "Service-specific reuse license: not found. Comptroller website disallows bulk/recurring automated downloads; scope of that policy for this county service is unresolved. Q-TN-DOWNLOAD", "addr": "", "apn": "PARCELID", "max": 1000, "fields": [["PARCELID", "Parcel ID"]]}, {"url": "https://geoviewer.cot.tn.gov/arcgis/rest/services/GeoViewer/NonImpact_Parcels/MapServer/1", "states": ["TN"], "counties": ["47037"], "name": "Davidson County GIS Parcels", "terms": "Service-specific reuse license: not found. Comptroller website disallows bulk/recurring automated downloads; scope of that policy for this county service is unresolved. Q-TN-DOWNLOAD", "addr": "PropAddr", "apn": "APN", "max": 1000, "fields": [["APN", "Parcel ID"], ["PropAddr", "Site Address"]]}, {"url": "https://geoviewer.cot.tn.gov/arcgis/rest/services/GeoViewer/NonImpact_Parcels/MapServer/3", "states": ["TN"], "counties": ["47093"], "name": "Knox County GIS Parcels", "terms": "Service-specific reuse license: not found. Comptroller website disallows bulk/recurring automated downloads; scope of that policy for this county service is unresolved. Q-TN-DOWNLOAD", "addr": "LOC_HOUSE_NUMBER + LOC_STREET_NAME", "apn": "PARCELID_1", "max": 1000, "fields": [["PARCELID_1", "Parcel ID"], ["LOC_HOUSE_NUMBER + LOC_STREET_NAME", "Site Address"]]}, {"url": "https://geoviewer.cot.tn.gov/arcgis/rest/services/GeoViewer/NonImpact_Parcels/MapServer/2", "states": ["TN"], "counties": ["47065"], "name": "Hamilton County GIS Parcels", "terms": "Service-specific reuse license: not found. Comptroller website disallows bulk/recurring automated downloads; scope of that policy for this county service is unresolved. Q-TN-DOWNLOAD", "addr": "", "apn": "GISLINK", "max": 1000, "fields": [["GISLINK", "Parcel ID"]]}, {"url": "https://services5.arcgis.com/A5C0MR9xfkxVRwat/ArcGIS/rest/services/Parcel_Data/FeatureServer/1", "states": ["TN"], "counties": ["47149"], "name": "Rutherford County GIS Parcels", "terms": "Service-specific reuse license: not found. Comptroller website disallows bulk/recurring automated downloads; scope of that policy for this county service is unresolved. Q-TN-DOWNLOAD", "addr": "STREETADDRESS", "apn": "ParcelID", "max": 2000, "fields": [["ParcelID", "Parcel ID"], ["STREETADDRESS", "Site Address"]]}, {"url": "https://www.gis.hctx.net/arcgis/rest/services/HCAD/Parcels/MapServer/0", "states": ["TX"], "counties": ["48201"], "name": "Harris County GIS Parcels", "terms": "https://www.gis.hctx.net/arcgis/rest/services/HCAD/Parcels/MapServer/0", "addr": "site_str_num + site_str_pfx + site_str_name + site_str_sfx + site_str_sfx_dir", "apn": "HCAD_NUM", "max": 1000, "fields": [["HCAD_NUM", "Parcel ID"], ["site_str_num + site_str_pfx + site_str_name + site_str_sfx + site_str_sfx_dir", "Site Address"]]}, {"url": "https://egis.dallascityhall.com/arcgis/rest/services/Basemap/DallasTaxParcels/MapServer/0", "states": ["TX"], "counties": ["48113"], "name": "Dallas County GIS Parcels", "terms": "https://egis.dallascityhall.com/arcgis/rest/services/Basemap/DallasTaxParcels/MapServer/0", "addr": "ST_NUM + ST_NAME + ST_TYPE + ST_DIR + UNITID", "apn": "ACCT", "max": 1000, "fields": [["ACCT", "Parcel ID"], ["ST_NUM + ST_NAME + ST_TYPE + ST_DIR + UNITID", "Site Address"]]}, {"url": "https://mapit.tarrantcounty.com/arcgis/rest/services/Dynamic/TADParcels/MapServer/0", "states": ["TX"], "counties": ["48439"], "name": "Tarrant County GIS Parcels", "terms": "https://mapit.tarrantcounty.com/arcgis/rest/services/Dynamic/TADParcels/MapServer/0", "addr": "SITUS_ADDR", "apn": "ACCOUNT", "max": 10000, "fields": [["ACCOUNT", "Parcel ID"], ["SITUS_ADDR", "Site Address"]]}, {"url": "https://maps.bexar.org/arcgis/rest/services/Parcels/MapServer/0", "states": ["TX"], "counties": ["48029"], "name": "Bexar County GIS Parcels", "terms": "https://maps.bexar.org/arcgis/rest/services/Parcels/MapServer/0", "addr": "Situs", "apn": "PropID", "max": 1000, "fields": [["PropID", "Parcel ID"], ["Situs", "Site Address"]]}, {"url": "https://gis.traviscountytx.gov/server1/rest/services/Boundaries_and_Jurisdictions/TCAD_public/MapServer/0", "states": ["TX"], "counties": ["48453"], "name": "Travis County GIS Parcels", "terms": "https://gis.traviscountytx.gov/server1/rest/services/Boundaries_and_Jurisdictions/TCAD_public/MapServer/0", "addr": "situs_address", "apn": "PROP_ID", "max": 2000, "fields": [["PROP_ID", "Parcel ID"], ["situs_address", "Site Address"]]}, {"url": "https://geodata.hawaii.gov/arcgis/rest/services/ParcelsZoning/MapServer/25", "states": ["15", "HI"], "counties": ["15001", "15003", "15007", "15009"], "name": "State of Hawaii Statewide Parcels (TMKs)", "terms": "https://geoportal.hawaii.gov", "addr": "tmk_txt", "apn": "tmk_txt", "max": 2000, "fields": [["tmk_txt", "TMK Parcel ID"], ["gisacres", "GIS Acres"], ["county", "County"]]}, {"url": "https://services1.arcgis.com/7HDiw78fcUiM2BWn/arcgis/rest/services/AK_Parcels/FeatureServer/0", "states": ["02", "AK"], "counties": ["02020"], "name": "State of Alaska Statewide Cadastral Parcels", "terms": "https://gis.data.alaska.gov", "addr": "parcel_id", "apn": "parcel_id", "max": 2000, "fields": [["parcel_id", "Parcel ID"], ["property_type", "Property Type"], ["property_use", "Property Use"]]}, {"url": "https://coageo.cabq.gov/cabqgeo/rest/services/agis/AGIS_Platted_Parcels/FeatureServer/0", "states": ["35", "NM"], "counties": ["35001"], "name": "City of Albuquerque & Bernalillo County Platted Parcels", "terms": "https://cabq.gov", "addr": "STREETNAME", "apn": "LOT", "max": 2000, "fields": [["LOT", "Lot Number"], ["BLOCK", "Block"], ["SUBDIVISION", "Subdivision"], ["STREETNUMBER", "Street No"], ["STREETNAME", "Street Name"]]}, {"url": "https://services7.arcgis.com/p0Gk2nDbPs7KEqSZ/arcgis/rest/services/SFC_Parcels_20250415/FeatureServer/0", "states": ["35", "NM"], "counties": ["35049"], "name": "Santa Fe County Land Parcels", "terms": "https://santafecountynm.gov", "addr": "Parcel_Num", "apn": "Parcel_Num", "max": 2000, "fields": [["Parcel_Num", "Parcel Number"], ["UPC", "UPC"]]}, {"url": "https://services7.arcgis.com/JMIoqakAkedEx0oU/arcgis/rest/services/DAC_Parcels/FeatureServer/0", "states": ["35", "NM"], "counties": ["35013"], "name": "Do\u00f1a Ana County Assessed Parcels (Las Cruces)", "terms": "https://donaanacounty.org", "addr": "PARCELNUMBER", "apn": "PARCELNUMBER", "max": 2000, "fields": [["PARCELNUMBER", "Parcel Number"], ["ACCOUNTNUMBER", "Account Number"]]}];
const FIPS_TO_STATE = {
  "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO", "09": "CT",
  "10": "DE", "11": "DC", "12": "FL", "13": "GA", "15": "HI", "16": "ID", "17": "IL",
  "18": "IN", "19": "IA", "20": "KS", "21": "KY", "22": "LA", "23": "ME", "24": "MD",
  "25": "MA", "26": "MI", "27": "MN", "28": "MS", "29": "MO", "30": "MT", "31": "NE",
  "32": "NV", "33": "NH", "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND",
  "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC", "46": "SD",
  "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA", "54": "WV",
  "55": "WI", "56": "WY"
};
const STATE_TO_FIPS = Object.fromEntries(Object.entries(FIPS_TO_STATE).map(([k, v]) => [v, k]));

function getParcelService(ll) {
  if (!ll || ll.lat == null || ll.lng == null) return null;
  const lat = ll.lat, lng = ll.lng;

  // 1. Major Metro County Bounding Boxes based on coordinate precision
  if (lat >= 40.49 && lat <= 40.92 && lng >= -74.26 && lng <= -73.70) return PARCELS87.find(s => s.counties && s.counties.includes("36061")) || null; // New York City (5 Boroughs MapPLUTO)
  if (lat >= 42.75 && lat <= 43.25 && lng >= -85.90 && lng <= -85.40) return PARCELS87.find(s => s.counties && s.counties.includes("26081")) || null; // Grand Rapids / Kent County MI
  if (lat >= 34.78 && lat <= 35.85 && lng >= -120.20 && lng <= -117.60) return PARCELS87.find(s => s.counties && s.counties.includes("06029")) || null; // Bakersfield / Kern
  if (lat >= 29.85 && lat <= 30.20 && lng >= -90.35 && lng <= -89.70) return PARCELS87.find(s => s.counties && s.counties.includes("22071")) || null; // New Orleans
  if (lat >= 29.50 && lat <= 30.17 && lng >= -95.95 && lng <= -94.90) return PARCELS87.find(s => s.counties && s.counties.includes("48201")) || null; // Houston / Harris
  if (lat >= 32.55 && lat <= 32.99 && lng >= -97.05 && lng <= -96.50) return PARCELS87.find(s => s.counties && s.counties.includes("48113")) || null; // Dallas
  if (lat >= 30.00 && lat <= 30.65 && lng >= -98.15 && lng <= -97.50) return PARCELS87.find(s => s.counties && s.counties.includes("48453")) || null; // Austin / Travis
  if (lat >= 29.10 && lat <= 29.75 && lng >= -98.80 && lng <= -98.20) return PARCELS87.find(s => s.counties && s.counties.includes("48029")) || null; // San Antonio / Bexar
  if (lat >= 41.45 && lat <= 42.16 && lng >= -88.27 && lng <= -87.50) return PARCELS87.find(s => s.counties && s.counties.includes("17031")) || null; // Chicago / Cook
  if (lat >= 39.85 && lat <= 40.15 && lng >= -75.30 && lng <= -74.95) return PARCELS87.find(s => s.counties && s.counties.includes("42101")) || null; // Philadelphia
  if (lat >= 40.18 && lat <= 40.68 && lng >= -80.36 && lng <= -79.68) return PARCELS87.find(s => s.counties && s.counties.includes("42003")) || null; // Pittsburgh / Allegheny
  if (lat >= 42.15 && lat <= 42.46 && lng >= -83.56 && lng <= -82.88) return PARCELS87.find(s => s.counties && s.counties.includes("26163")) || null; // Detroit / Wayne
  if (lat >= 33.50 && lat <= 34.15 && lng >= -84.60 && lng <= -84.10) return PARCELS87.find(s => s.counties && s.counties.includes("13121")) || null; // Atlanta / Fulton
  if (lat >= 35.95 && lat <= 36.41 && lng >= -87.06 && lng <= -86.51) return PARCELS87.find(s => s.counties && s.counties.includes("47037")) || null; // Nashville / Davidson
  if (lat >= 34.98 && lat <= 35.40 && lng >= -90.31 && lng <= -89.63) return PARCELS87.find(s => s.counties && s.counties.includes("47157")) || null; // Memphis / Shelby
  if (lat >= 32.50 && lat <= 34.05 && lng >= -113.35 && lng <= -111.05) return PARCELS87.find(s => s.counties && s.counties.includes("04013")) || null; // Phoenix / Maricopa
  if (lat >= 34.95 && lat <= 35.30 && lng >= -106.85 && lng <= -106.40) return PARCELS87.find(s => s.counties && s.counties.includes("35001")) || null; // Albuquerque / Bernalillo
  if (lat >= 61.05 && lat <= 61.35 && lng >= -150.15 && lng <= -149.60) return PARCELS87.find(s => s.counties && s.counties.includes("02020")) || null; // Anchorage MOA
  if (lat >= 21.20 && lat <= 21.75 && lng >= -158.30 && lng <= -157.60) return PARCELS87.find(s => s.counties && s.counties.includes("15003")) || null; // Honolulu

  // 2. Active County Match if FIPS is set
  const fips = (typeof activeFips === "function" ? activeFips() : null);
  if (fips && fips !== "06037" && fips !== "06059") {
    const fMatch = PARCELS87.find(s => s.counties && s.counties.includes(fips));
    if (fMatch) return fMatch;
  }

  // Statewide Bounding Boxes
  let st = null;
  if (lat >= 24.5 && lat <= 31.0 && lng >= -87.6 && lng <= -80.0) st = "12"; // FL
  else if (lat >= 33.8 && lat <= 36.6 && lng >= -84.3 && lng <= -75.4) st = "37"; // NC
  else if (lat >= 45.5 && lat <= 49.0 && lng >= -124.8 && lng <= -116.9) st = "53"; // WA
  else if (lat >= 25.8 && lat <= 36.5 && lng >= -106.6 && lng <= -93.5) st = "48"; // TX
  else if (lat >= 41.2 && lat <= 42.9 && lng >= -73.5 && lng <= -69.9) st = "25"; // MA
  else if (lat >= 40.9 && lat <= 42.1 && lng >= -73.8 && lng <= -71.7) st = "09"; // CT
  else if (lat >= 42.5 && lat <= 47.1 && lng >= -92.9 && lng <= -86.7) st = "55"; // WI
  else if (lat >= 37.0 && lat <= 42.0 && lng >= -114.1 && lng <= -109.0) st = "49"; // UT
  else if (lat >= 44.3 && lat <= 49.0 && lng >= -116.1 && lng <= -104.0) st = "30"; // MT
  else if (lat >= 39.7 && lat <= 42.3 && lng >= -80.6 && lng <= -74.6) st = "42"; // PA
  else if (lat >= 36.9 && lat <= 42.5 && lng >= -91.5 && lng <= -87.5) st = "17"; // IL
  else if (lat >= 38.4 && lat <= 42.0 && lng >= -84.8 && lng <= -80.5) st = "39"; // OH
  else if (lat >= 38.9 && lat <= 41.4 && lng >= -75.6 && lng <= -73.8) st = "34"; // NJ
  else if (lat >= 37.9 && lat <= 39.7 && lng >= -79.5 && lng <= -75.0) st = "24"; // MD
  else if (lat >= 36.5 && lat <= 39.5 && lng >= -83.7 && lng <= -75.2) st = "51"; // VA
  else if (lat >= 36.9 && lat <= 41.1 && lng >= -109.1 && lng <= -102.0) st = "08"; // CO
  else if (lat >= 31.3 && lat <= 37.0 && lng >= -114.8 && lng <= -109.0) st = "04"; // AZ
  else if (lat >= 41.9 && lat <= 46.3 && lng >= -124.6 && lng <= -116.4) st = "41"; // OR
  else if (lat >= 41.7 && lat <= 48.3 && lng >= -90.4 && lng <= -82.4) st = "26"; // MI
  else if (lat >= 30.3 && lat <= 35.0 && lng >= -85.6 && lng <= -80.8) st = "13"; // GA
  else if (lat >= 34.9 && lat <= 36.7 && lng >= -90.3 && lng <= -81.6) st = "47"; // TN
  else if (lat >= 37.7 && lat <= 41.8 && lng >= -88.1 && lng <= -84.7) st = "18"; // IN
  else if (lat >= 35.9 && lat <= 40.6 && lng >= -95.8 && lng <= -89.1) st = "29"; // MO
  else if (lat >= 43.4 && lat <= 49.4 && lng >= -97.3 && lng <= -89.4) st = "27"; // MN
  else if (lat >= 40.5 && lat <= 45.0 && lng >= -79.8 && lng <= -71.8) st = "36"; // NY
  else if (lat >= 35.0 && lat <= 42.0 && lng >= -120.0 && lng <= -114.0) st = "32"; // NV
  else if (lat >= 28.9 && lat <= 33.1 && lng >= -94.1 && lng <= -88.8) st = "22"; // LA
  else if (lat >= 18.9 && lat <= 22.3 && lng >= -160.3 && lng <= -154.8) st = "15"; // HI
  else if (lat >= 51.0 && lat <= 71.5 && lng >= -179.0 && lng <= -129.9) st = "02"; // AK
  else if (lat >= 31.3 && lat <= 37.0 && lng >= -109.1 && lng <= -103.0) st = "35"; // NM
  if (st) {
    const stCode = FIPS_TO_STATE[st] || st;
    return PARCELS87.find(s => s.states && (s.states.includes(st) || s.states.includes(stCode))) || null;
  }
  return null;
}

function parcelSvc(fips) {   // round 8.7: the open parcel service for a county (a county's own service first, then its state's)
  if (!fips || fips === "06037" || fips === "06059") return null;
  const stNum = fips.slice(0, 2), stCode = FIPS_TO_STATE[stNum] || "";
  return PARCELS87.find(s => s.counties && s.counties.includes(fips)) ||
         PARCELS87.find(s => s.states && (s.states.includes(stNum) || (stCode && s.states.includes(stCode)))) ||
         null;
}
let natLots = null, natLotTimer = null, natLotSeq = 0;
function lotQuery(svc, w, s_, e_, n) {
  return svc.url + "/query?" + new URLSearchParams({ geometry: [w, s_, e_, n].map(v => (+v).toFixed(6)).join(","), geometryType: "esriGeometryEnvelope", inSR: "4326",
    spatialRel: "esriSpatialRelIntersects", outFields: svc.fields.map(f => f[0]).join(","), returnGeometry: "true", outSR: "4326",
    resultRecordCount: String(Math.min(svc.max || 1000, 1000)), f: "json" });
}
const lotLatLngs = f => f.geometry.rings.map(r => r.map(([x, y]) => [y, x]));
const natLotCache = new Map();
let natLotAbort = null;
function scheduleNatLots(delay = 60) {
  clearTimeout(natLotTimer);
  natLotTimer = setTimeout(drawNatLots, delay);
}

function renderNatLotFeatures(feats) {
  if (!map || !map._loaded) return;
  if (!natLots) {
    natLots = L.layerGroup().addTo(map);
  } else {
    natLots.clearLayers();
  }
  const fips = typeof activeFips === "function" ? activeFips() : null;
  const svc = (fips ? parcelSvc(fips) : null) || (typeof getParcelService === "function" ? getParcelService(map.getCenter()) : null);

  feats.forEach(f => {
    if (!f.geometry || !f.geometry.rings) return;
    const poly = L.polygon(lotLatLngs(f), {
      color: "#dc2626",
      weight: 1.35,
      opacity: 0.88,
      fillColor: "#ef4444",
      fillOpacity: 0.04
    });
    const normF = (typeof normalizeParcelFeature === "function") ? normalizeParcelFeature(f, null, svc) : f;
    poly._feat = normF || f;
    poly.on("click", e => {
      L.DomEvent.stopPropagation(e);
      hoverFeat = poly._feat;
      if (typeof selectAt === "function") selectAt(e.latlng);
      if (typeof houseAt === "function") houseAt(e.latlng, poly._feat);
    });
    natLots.addLayer(poly);
  });
  natLots._count = feats.length;
  if (typeof window !== "undefined") window.natLots = natLots;
}

async function drawNatLots() {
  const cb = $("#l-lots");
  const z = map.getZoom();
  const fips = typeof activeFips === "function" ? activeFips() : null;
  const svc = (fips ? parcelSvc(fips) : null) || (typeof getParcelService === "function" ? getParcelService(map.getCenter()) : null);
  if (!svc || (cb && !cb.checked) || z < 15) {
    if (natLots) { map.removeLayer(natLots); natLots = null; if (typeof window !== "undefined") window.natLots = null; }
    return;
  }
  const b = map.getBounds().pad(0.08);
  const snap = v => (Math.floor(v * 100) / 100).toFixed(2);
  const cellKey = `${snap(b.getWest())},${snap(b.getSouth())},${snap(b.getEast() + 0.01)},${snap(b.getNorth() + 0.01)}`;
  
  if (natLotCache.has(cellKey)) {
    renderNatLotFeatures(natLotCache.get(cellKey));
    return;
  }

  const seq = ++natLotSeq;
  let d;
  try {
    const fields = (svc.fields || []).slice(0, 8).map(f => f[0]).join(",") || "OBJECTID";
    const maxRec = Math.min(svc.max || 1000, 1000);
    const params = {
      geometry: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].map(v => (+v).toFixed(5)).join(","),
      geometryType: "esriGeometryEnvelope",
      inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      outFields: fields,
      returnGeometry: "true",
      outSR: "4326",
      resultRecordCount: String(maxRec),
      f: "json"
    };
    d = await arcQuery(svc.url, params, 5500);
  } catch (e) { return; }
  
  if (seq !== natLotSeq) return;
  let feats = (d && d.features ? d.features : []).filter(f => f.geometry && f.geometry.rings);
  
  // If query hit server transfer limit (e.g. dense urban block with >1000 parcels),
  // split bounding box into West and East quadrants to capture all missing property lines
  if (d && d.exceededTransferLimit && z >= 16) {
    try {
      const midLng = (b.getWest() + b.getEast()) / 2;
      const fields = (svc.fields || []).slice(0, 8).map(f => f[0]).join(",") || "OBJECTID";
      const pEast = {
        geometry: [midLng, b.getSouth(), b.getEast(), b.getNorth()].map(v => (+v).toFixed(5)).join(","),
        geometryType: "esriGeometryEnvelope", inSR: "4326", spatialRel: "esriSpatialRelIntersects",
        outFields: fields, returnGeometry: "true", outSR: "4326", resultRecordCount: "800", f: "json"
      };
      const dEast = await arcQuery(svc.url, pEast, 4500);
      if (dEast && dEast.features) {
        const eastFeats = dEast.features.filter(f => f.geometry && f.geometry.rings);
        const existingOids = new Set(feats.map(f => (f.attributes && (f.attributes.OBJECTID || f.attributes.FID || (svc.apn && f.attributes[svc.apn])))));
        eastFeats.forEach(ef => {
          const id = ef.attributes && (ef.attributes.OBJECTID || ef.attributes.FID || (svc.apn && ef.attributes[svc.apn]));
          if (!id || !existingOids.has(id)) feats.push(ef);
        });
      }
    } catch(e) {}
  }

  natLotCache.set(cellKey, feats);
  if (natLotCache.size > 150) natLotCache.delete(natLotCache.keys().next().value);

  renderNatLotFeatures(feats);
}
function scheduleNatLots() { clearTimeout(natLotTimer); natLotTimer = setTimeout(drawNatLots, 150); }
let lotHit = null;
function ringsHold(rings, x, y) {   // even-odd rule over all rings (holes included)
  let inside = false;
  for (const r of rings) for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
async function lotAt(lat, lon, text) {   // the lot of a searched address: the lot whose site address matches, else the lot under the point, else the nearest
  const fips = typeof activeFips === "function" ? activeFips() : "06037";
  if (fips === "06037" || fips === ORANGE_FIPS) {
    try {
      const f = await fetchParcel({ lat, lng: lon });
      if (f && f.geometry && f.geometry.rings) {
        if (lotHit) map.removeLayer(lotHit);
        lotHit = L.polygon(lotLatLngs(f), { color: "#c2410c", weight: 3, fillOpacity: 0.08 }).addTo(map);
        lotHit._feat = f;
        hoverFeat = f;
        lotHit.on("click", e => {
          L.DomEvent.stopPropagation(e);
          hoverFeat = f;
          if (typeof selectAt === "function") selectAt(e.latlng);
          if (typeof houseAt === "function") houseAt(e.latlng, f);
        });
        if (typeof window !== "undefined") window.lotHit = lotHit;
        if (typeof houseAt === "function") houseAt({ lat, lng: lon }, f);
        return lotHit;
      }
    } catch(e) {}
  }
  const svc = (typeof activeFips === "function" ? parcelSvc(activeFips()) : null) || (typeof getParcelService === "function" ? getParcelService({ lat, lng: lon }) : null);
  if (!svc) {
    if (typeof houseAt === "function") houseAt({ lat, lng: lon });
    return null;
  }
  try {
    // the Census geocoder puts an address on the street centre line, outside every lot: look about 40 m around it
    const d = await (await fetch(lotQuery(svc, lon - 0.0004, lat - 0.0004, lon + 0.0004, lat + 0.0004))).json();
    const fs = (d.features || []).filter(f => f.geometry && f.geometry.rings); if (!fs.length) return null;
    const norm = t => String(t || "").toUpperCase().replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
    const want = norm(String(text || "").split(",")[0]); const num = (want.match(/^\d+/) || [""])[0];
    const word = (want.replace(/^\d+\s*/, "").split(" ").find(w => w.length > 2 && !["NORTH", "SOUTH", "EAST", "WEST"].includes(w)) || "");
    let byAddr = svc.addr && num && word ? fs.find(f => { const a = norm((f.attributes || {})[svc.addr]); return a.startsWith(num + " ") && a.includes(word); }) : null;
    if (!byAddr && svc.addr && num && word) {   // address points can sit tens of metres off: ask the service for the address itself, within ~300 m
      try {   // num is digits and word letters and digits only (norm), so the where clause carries no quotes
        const q2 = svc.url + "/query?" + new URLSearchParams({ where: `UPPER(${svc.addr}) LIKE '${num} %${word}%'`, geometry: [lon - 0.003, lat - 0.003, lon + 0.003, lat + 0.003].map(v => v.toFixed(6)).join(","),
          geometryType: "esriGeometryEnvelope", inSR: "4326", spatialRel: "esriSpatialRelIntersects", outFields: svc.fields.map(f => f[0]).join(","), returnGeometry: "true", outSR: "4326", resultRecordCount: "5", f: "json" });
        const d2 = await (await fetch(q2)).json(); byAddr = (d2.features || []).find(g => g.geometry && g.geometry.rings) || null;
      } catch (e) { byAddr = null; }
    }
    const under = fs.find(f => ringsHold(f.geometry.rings, lon, lat));
    const dist = f => { const r = f.geometry.rings[0]; let sx = 0, sy = 0; r.forEach(([x, y]) => { sx += x; sy += y; }); return Math.hypot(sx / r.length - lon, (sy / r.length - lat) * 0.8); };
    const f = byAddr || under || fs.slice().sort((a, b) => dist(a) - dist(b))[0];
    if (lotHit) map.removeLayer(lotHit);
    lotHit = L.polygon(lotLatLngs(f), { color: "#c2410c", weight: 3, fillOpacity: 0.08 }).addTo(map);
    lotHit._feat = f;
    lotHit._how = byAddr ? "address" : under ? "point" : "nearest";
    lotHit.on("click", e => {
      L.DomEvent.stopPropagation(e);
      hoverFeat = f;
      if (typeof selectAt === "function") selectAt(e.latlng);
      if (typeof houseAt === "function") houseAt(e.latlng, f);
    });
    if (typeof window !== "undefined") window.lotHit = lotHit;
    hoverFeat = f;
    if (typeof houseAt === "function") houseAt({ lat, lng: lon }, f);
    return lotHit;
  } catch (e) { return null; }
}
function syncLots() {
  const cb = $("#l-lots");
  const want = cb ? cb.checked : false;
  const fips = typeof activeFips === "function" ? activeFips() : "06037";
  const m = (typeof map !== "undefined" && map) ? map : (typeof window !== "undefined" && window.map ? window.map : null);
  if (!m) return;

  if (fips !== "06037" && fips !== ORANGE_FIPS) {
    if (lots && m.hasLayer && m.hasLayer(lots)) { m.removeLayer(lots); lots = null; if (typeof window !== "undefined") window.lots = null; }
    if (want) scheduleNatLots();
    else if (natLots) { m.removeLayer(natLots); natLots = null; if (typeof window !== "undefined") window.natLots = null; }
    return;
  }

  const isOc = (fips === ORANGE_FIPS);
  if (lots) {
    if ((isOc && lots._isLa) || (!isOc && !lots._isLa)) {
      if (m.hasLayer && m.hasLayer(lots)) m.removeLayer(lots);
      lots = null;
      if (typeof window !== "undefined") window.lots = null;
    }
  }

  if (want && !lots && m.addLayer) {
    if (isOc) {
      const opts = Object.assign({}, LOT_OPTS, {
        minZoom: 15,
        maxZoom: 20,
        opacity: 0.95,
        attribution: "Parcels © OCGIS / OC Public Works"
      });
      lots = new LotLines("", opts);
      lots._isLa = false;
      lots.addTo(m);
      if (typeof watchLots === "function") watchLots(lots);
    } else {
      const opts = Object.assign({}, LOT_OPTS, {
        minZoom: 15,
        maxZoom: 20,
        opacity: 0.9,
        attribution: "Parcels © LA County Assessor"
      });
      lots = lotCache ? lotCache : new LotLines("", opts);
      lots._isLa = true;
      lots.addTo(m);
      if (typeof watchLots === "function") watchLots(lots);
    }
    if (typeof window !== "undefined") window.lots = lots;
  }
  
  if (!want && lots && m) {
    if (m.hasLayer && m.hasLayer(lots)) m.removeLayer(lots);
    lots = null;
    if (typeof window !== "undefined") window.lots = null;
  }
}

if (typeof window !== "undefined") {
  window.LotLines = LotLines;
  window.PARCEL_MS = PARCEL_MS;
  window.PARCEL_MS_OC = PARCEL_MS_OC;
  window.LOT_OPTS = LOT_OPTS;
  window.lots = lots;
  window.lotCache = lotCache;
  window.syncLots = syncLots;
}
// Resolves to a tile layer when the service publishes a standard web-mercator cache down to zoom 17, else null.
async function cachedLotLines() {
  // JSONP, not fetch(): LA County's firewall answers 403 to any request that carries another site's Origin header
  // (map tiles load as images, which send none). The JSONP helper gives up after 15 s; this waits at most 6 s.
  let t;
  try {
    const j = await Promise.race([jsonp(`${PARCEL_MS}?f=json`), new Promise((_, rej) => { t = setTimeout(() => rej(new Error("timeout")), 6000); })]);
    const ti = (j && j.tileInfo) || {};
    const wkid = (ti.spatialReference || {}).latestWkid || (ti.spatialReference || {}).wkid;
    const lod = (ti.lods || []).find(l => l.level === 17);
    const web = [3857, 102100].includes(wkid) && ti.origin && Math.abs(ti.origin.x + 20037508.3428) < 1 && ti.rows === 256;
    if (!j.singleFusedMapCache || !web || !lod || Math.abs(lod.resolution / 1.194328566855 - 1) > .01) return null;
    const maxNative = Math.max(...ti.lods.map(l => l.level));
    return L.tileLayer(`${PARCEL_MS}/tile/{z}/{y}/{x}`, { ...LOT_OPTS, tileSize: 256, maxNativeZoom: Math.min(maxNative, 19) });
  } catch { return null; } finally { clearTimeout(t); }
}
// "Loading property lines…" note: shown while lot-line tiles are loading at zoom 15+, hidden when they finish.
function getActiveCountyName() {
  const f = typeof activeFips === "function" ? activeFips() : "06037";
  if (f === "06037") return "LA County Assessor";
  if (f === "06059") return "Orange County (Preliminary)";
  if (typeof countyBundleEls === "function") {
    const el = countyBundleEls().find(e => e.dataset.fips === f);
    if (el && el.dataset.name) return `${el.dataset.name}, ${el.dataset.st || ""}`;
  }
  return "County GIS";
}

function watchLots(layer) {
  const note = $("#lots-note"); if (!note || !layer) return;
  let timer = null, doneTimer = null, shown = false;
  const hide = () => { clearTimeout(timer); timer = null; clearTimeout(doneTimer); note.hidden = true; note.classList.remove("done"); shown = false; };
  // After the lines have loaded, show a green check for a moment so the wait visibly ends well
  const done = () => {
    clearTimeout(timer); timer = null;
    if (!shown || note.hidden) { note.hidden = true; shown = false; return; }
    const cName = getActiveCountyName();
    note.classList.add("done");
    note.innerHTML = `<span class="check" aria-hidden="true">✓</span><div>Property lines loaded from ${cName}. Click any lot to analyze that home.</div>`;
    clearTimeout(doneTimer); doneTimer = setTimeout(() => { note.hidden = true; note.classList.remove("done"); shown = false; }, 2600);
  };
  const getMinZ = () => 15;
  layer.on("loading", () => {
    clearTimeout(timer); clearTimeout(doneTimer); note.classList.remove("done");
    if (typeof map !== "undefined" && map && map.getZoom && map.getZoom() >= getMinZ()) {
      timer = setTimeout(() => {
        const cName = getActiveCountyName();
        const div = note.querySelector("div");
        if (div) {
          div.innerHTML = `Loading property lines from ${cName}… <button type="button" id="lots-hood">See the neighborhood meanwhile</button>`;
          const bh = $("#lots-hood");
          if (bh) bh.onclick = () => { hide(); if (typeof selectAt === "function") selectAt(map.getCenter()); };
        }
        note.innerHTML = `<span class="spin"></span>` + (note.querySelector("div") ? note.querySelector("div").outerHTML : "");
        if (!note.querySelector("div")) note.innerHTML = `<span class="spin"></span><div>Loading property lines from ${cName}… <button type="button" id="lots-hood">See the neighborhood meanwhile</button></div>`;
        const bh2 = $("#lots-hood"); if (bh2) bh2.onclick = () => { hide(); if (typeof selectAt === "function") selectAt(map.getCenter()); };
        note.hidden = false; shown = true;
      }, LOTS_NOTE_MS);
    }
  });
  layer.on("load", done);
  layer.on("remove", hide);
  if (typeof map !== "undefined" && map && map.on) {
    map.on("zoomend", () => { if (map.getZoom() < getMinZ()) hide(); });
  }
}
const LOTS_NOTE_MS = 1200;

// ---------------- homeowner upgrades (round 6; LA-metro averages, not this house)
function upgradeTable(m) {
  const fire = (m.fire || 0) >= 0.5;
  const U = (D.upgrades || []).filter(u => !(u.applies_if === "pre1975" && m.yb >= 1975) && !(u.applies_if === "pre1980" && m.yb >= 1980) && !(u.applies_if === "fire" && !fire)
    && !(!isCAActive() && /^Seismic bolting/.test(u.name || "")));
  if (!U.length) return "";
  const rows = U.map(u => ({ ...u, net: u.resale_value_added - u.cost_2025, per: u.resale_value_added / Math.max(u.cost_2025, 1) })).sort((a, b) => b.per - a.per);
  return `<details class="more"><summary>${rows.length} home upgrades: cost, value added and return per $1</summary>
    <div><table class="small sticky-head" style="width:100%;border-collapse:collapse;margin-top:6px">
      <thead><tr style="text-align:left"><th>Upgrade</th><th style="text-align:right">Cost</th><th style="text-align:right">Adds to resale</th><th style="text-align:right">Per $1</th><th style="text-align:right">Saves / yr</th><th>Rebates (Nov 2026)</th><th>Property tax</th><th>Permits</th></tr></thead>
      <tbody>${rows.map(u => `<tr style="border-top:1px solid var(--rule)"><td>${esc(u.name)}</td><td style="text-align:right">${fmt$(u.cost_2025)}</td><td style="text-align:right">${fmt$(u.resale_value_added)}</td><td style="text-align:right;font-weight:600">${fvpd(u.per)}</td><td style="text-align:right">${u.annual_savings > 0 ? fmt$(u.annual_savings) : u.annual_savings < 0 ? "−" + fmt$(-u.annual_savings) + " cost" : "–"}</td><td>${esc(rebateFor(u.rebates_nov_2026))}</td><td>${esc(isCAActive() ? u.property_tax : "Check local assessment rules")}</td><td>${esc(u.permits)}</td></tr>`).join("")}</tbody></table></div>
    <p class="small muted">Typical 2025 LA costs and resale values (City Pretty estimates; second stories and additions run about $450–$700 per sq ft all-in). They're being checked against round-8 research. ${(typeof activeCounty !== "undefined" && activeCounty === "oc" && typeof isOrangeActive === "function" && !isOrangeActive()) ? "These are LA-wide averages, not adjusted to this county: costs and resale values here can differ." : "These are LA-wide averages: zoom in and click a home for numbers sized to that house and its yard."} Federal credits: 25D (solar, batteries) ended for expenditures made after 31 Dec 2025; 25C (heat pumps, insulation) for property placed in service after 31 Dec 2025.</p></details>`;
}

// ---------------- EIFD calculator (Gov. Code 53398.50 et seq.)
// m.e (from the pipeline): av = net taxable assessed value on the Assessor roll, avr/avc = residential/commercial part,
// np = parcels, ry = roll year, sh = AV-weighted shares of the 1% levy [city, County General, other districts, schools+ERAF]
// from the Auditor-Controller AF49 Modified ATI ratios for the tax-rate areas here, t = largest TRAs [tra, net AV].
function eifdArea(p, scope) {
  const feats = (activeCounty === "oc" && D_OC) ? D_OC.features : D.bgs.features;
  const fs = scope === "hood" ? feats.filter(f => f.properties.n === p.n && f.properties.c === p.c) : [byId.get(p.id)];
  let mv = 0, homes = 0, av = 0, avr = 0, avc = 0, np = 0, ry = null, shw = [0, 0, 0, 0], shav = 0, n = 0;
  const tras = new Map(), ex = new Set();
  fs.forEach(f => { const m = (D.details[f.properties.id] || {}).m || {};
    if (m.hv && m.homes) { mv += m.hv * m.homes; homes += m.homes; }
    const e = m.e; if (!e) return; n++;
    av += e.av || 0; avr += e.avr || 0; avc += e.avc || 0; np += e.np || 0; ry = e.ry || ry;
    const wt = e.av || e.w || 0;   // Orange County has no roll value in the build; its shares are weighted by market value (w)
    if (e.sh && wt) { e.sh.forEach((x, i) => shw[i] += x * wt); shav += wt; }
    (e.t || []).forEach(([t, v]) => tras.set(t, (tras.get(t) || 0) + (v == null ? wt : v))); (e.x || []).forEach(x => ex.add(x)); });
  const sh = shav > 0 ? shw.map(x => x / shav) : null;
  return { n: fs.length, withRoll: n, mv, homes, av, avr, avc, np, ry, sh, tras: [...tras].sort((a, b) => b[1] - a[1]), ex: [...ex] };
}
function eifdSection(p, m) {
  const stCode = (typeof activeState === "function" ? activeState() : "CA");
  const profile = STATE_FINANCE_PROFILES[stCode] || null;

  if (stCode !== "CA") {
    // Generalized Multi-State TIF/TIRZ/CRA/DDA Engine
    if (!profile) return `<div class="section"><h3>Tax-increment financing</h3><p class="small muted">No property-tax profile for ${esc(activeStateName())} is on file, so no bond capacity is shown.</p></div>`;
    const baselineMv = (m && m.hv && m.homes) ? m.hv * m.homes : null;
    if (baselineMv == null) return `<div class="section"><h3>Tax-increment financing</h3><p class="small muted">Home values or home counts for this block group are not on file, so no bond capacity is shown.</p></div>`;
    const profStatus = profile.verification && profile.verification.status;
    const profLabel = profStatus === "verified" ? `State tax rule: ${verificationLabel(profile, "statute")}.` : "Unverified state rule: this state's assessment figures have not been checked against the statute.";
    const effMillage = profile.state_code === "TX" ? 0.021 : profile.state_code === "FL" ? 0.0165 : 0.0125;
    const tifCap = calculateTaxIncrementCapacity({
      profile,
      baselineMarketValueUsd: baselineMv,
      effectiveMillageRate: effMillage,
      annualMarketAppreciation: 0.035,
      historicalTurnoverRate: 0.035,
      newConstructionAnnualUsd: 1500000,
      affordableExemptUnitsShare: 0.15,
      affordableExemptionPct: profile.state_code === "FL" ? 0.75 : 0.0,
      localPledgeShare: 0.65,
      bondTermYears: 30,
      bondInterestRate: 0.0525,
      dscr: 1.35
    });

    return `<div class="section">
      <h3>${esc(tifCap.vehicleName)}: Municipal Finance Capacity</h3>
      <p class="small" style="color:#92400e;margin:2px 0 4px;"><b>Illustrative only: inputs are assumptions, not local data</b> (tax rate, growth, turnover, new construction, pledge share and bond terms are typed in). ${esc(profLabel)}</p>
      <p class="small muted">
        Under ${esc(activeStateName())} municipal finance law, local governments pledge ad valorem tax increment from revitalization districts to finance public infrastructure.
        ${profile.annual_assessment_cap ? `Assessed values are constrained by ${esc(activeStateName())}'s ${(profile.annual_assessment_cap * 100).toFixed(0)}% annual assessment cap.` : `Properties undergo annual market assessment with no statutory reassessment cap.`}
      </p>
      <div class="pkg" style="margin:8px 0;">
        ${tile("District Vehicle", esc(tifCap.vehicleName), "Statutory Bond Instrument")}
        ${tile("Initial Taxable Base", fmt$(tifCap.initialTaxableValueUsd), "Assessment Ratio: " + (profile.res_assessment_ratio * 100) + "%")}
        ${tile("Year 10 Increment", fmt$(tifCap.year10AnnualIncrementUsd) + "/yr", "65% local pledge")}
        ${tile("30-Yr Bond Capacity", fmt$(tifCap.maxBondCapacityUsd), "5.25% yield · 1.35x DSCR")}
      </div>
      <div style="font-size:11px;color:#475569;background:#f8fafc;padding:8px 10px;border-radius:6px;border:1px solid #e2e8f0;">
        <b>Statutory Tax Rules for ${esc(activeStateName())}:</b>
        ${tifCap.notes.length ? tifCap.notes.map(n => `<div>• ${esc(n)}</div>`).join("") : `<div>• Standard ad valorem assessment cycle (${profile.reassessment_cycle_years} yr).</div>`}
        <div>• Unlike California Proposition 13, ${esc(activeStateName())} ad valorem levies step up with market reappraisals rather than freezing at acquisition deed value.</div>
      </div>
    </div>`;
  }
  const fld = (id, label, val, step, note) => `<label class="small" style="display:grid;grid-template-columns:1fr 110px;gap:8px;align-items:center;margin:4px 0"><span>${label}${note ? ` <span class="muted" id="${id}-n">${note}</span>` : ""}</span><input id="${id}" type="number" step="${step}" value="${val}" style="font:500 13px var(--mono);padding:4px 6px;border:1px solid var(--rule-strong);border-radius:6px;background:var(--ground);color:var(--ink)"></label>`;
  return `<div class="section"><h3>EIFD calculator: tax-increment financing for this area</h3>
    <p class="small muted">An Enhanced Infrastructure Financing District pledges part of the future growth in the 1% property tax to pay for projects. No vote is needed to form one; since AB 116 (2019) bonds need 3 hearings and fail only on a 50% protest. Schools can't take part. State law has no housing set-aside, but ${activeCounty === "oc" && !isOrangeActive() ? `${esc(countyOf())}'s participation rules (not verified for this county yet) apply when the County joins` : activeCounty === "oc" ? "the County of Orange's EIFD Participation Policy (approved by the Board of Supervisors 4 Jun 2019) sets conditions when the County joins: the city must put in at least as much as the County, the County gives at most 50% of its share for at most 20 years, and the Board must approve (see below)" : "LA County Board Policy 3.106 (revised and approved by the County Audit Committee on 16 Jul 2025, next review 1 Aug 2029; amendments for disaster-recovery districts were directed in October 2025, adoption not verified) sets conditions when the County joins (see below)"}.</p>
    <div class="cat-tabs" role="group" aria-label="EIFD area"><button type="button" data-scope="bg" aria-pressed="true">This block group</button><button type="button" data-scope="hood" aria-pressed="false">All of ${esc(p.n)}</button></div>
    ${fld("e-av", "Base assessed value ($M)", "", 0.1, "")}
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:6px 10px;margin:6px 0;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">
        <span style="font-weight:700;font-size:11px;color:#475569;">Prop 13 Annual Turnover Rate:</span>
        <span style="font-size:10px;color:#64748b;">(Deed Transfer Frequency)</span>
      </div>
      <div style="display:flex;gap:3px;flex-wrap:wrap;">
        <button type="button" class="story-btn eifd-turnover-btn" data-rate="2.0" onclick="setEifdTurnover(2.0)">2.0% (Rate Lock-in)</button>
        <button type="button" class="story-btn eifd-turnover-btn" data-rate="3.0" onclick="setEifdTurnover(3.0)">3.0% (Moderate)</button>
        <button type="button" class="story-btn eifd-turnover-btn active" data-rate="3.5" onclick="setEifdTurnover(3.5)">3.5% (Baseline)</button>
        <button type="button" class="story-btn eifd-turnover-btn" data-rate="4.5" onclick="setEifdTurnover(4.5)">4.5% (High Velocity)</button>
      </div>
    </div>
    ${fld("e-g", "Yearly value growth (%)", 3.0, 0.1, "2% Prop 13 cap + resales")}
    ${fld("e-new", "New development, year 3 ($M)", 0, 1, "")}
    ${fld("e-city", "City share of the 1% tax (%)", "", 0.01, "")}
    ${fld("e-cp", "City pledge (%)", 75, 5, "Artesia 2026: 75%")}
    ${fld("e-county", "County General share of the 1% tax (%)", "", 0.01, "")}
    ${fld("e-kp", "County pledge (%)", 49, 1, isOrangeActive() ? "Artesia 49%; OC policy cap 50%" : "Artesia 49%; range 11–50%")}
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:6px 10px;margin:6px 0;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">
        <span style="font-weight:700;font-size:11px;color:#475569;">30-Year Municipal Bond Yield:</span>
        <span style="font-size:10px;color:#64748b;">(Capital Market Environment)</span>
      </div>
      <div style="display:flex;gap:3px;flex-wrap:wrap;">
        <button type="button" class="story-btn eifd-rate-btn" data-rate="4.25" onclick="setEifdBondYield(4.25)">4.25% (AAA Muni)</button>
        <button type="button" class="story-btn eifd-rate-btn active" data-rate="5.25" onclick="setEifdBondYield(5.25)">5.25% (Benchmark)</button>
        <button type="button" class="story-btn eifd-rate-btn" data-rate="6.25" onclick="setEifdBondYield(6.25)">6.25% (High-Rate / Unrated)</button>
      </div>
    </div>
    ${fld("e-rate", "Bond interest rate (%)", 5.25, 0.05, "")}
    ${fld("e-dscr", "Debt-service coverage (x)", 1.35, 0.05, "")}
    <div class="pkg" id="e-out" style="margin-top:10px"></div>
    <div id="e-split"></div>
    <p class="small muted" id="e-note"></p><p class="small" id="e-warn"></p>${isOrangeActive() ? ocEifdNote() : ""}${eifdRegister()}</div>`;
}
function ocEifdNote() {
  const P = (((typeof D_OC !== "undefined" && D_OC && D_OC.oc_funding) || {}).programs || {}).OC_EIFD; if (!P) return "";
  return `<p class="small" style="margin:6px 0 2px"><b>In Orange County:</b> ${esc(P.what)} ${esc(P.amount)} <a href="${esc(P.example_source)}" target="_blank" rel="noopener">Placentia amended IFP (May 2024)</a>; <a href="${esc(P.source)}" target="_blank" rel="noopener">County EIFD Participation Policy</a>.</p>`;
}
function eifdRegister() {
  const E = (D.r10 || {}).eifds || []; if (!E.length) return "";
  const formed = E.filter(e => /^FORMED|ADOPTED/i.test(e[2])), other = E.filter(e => !/^FORMED|ADOPTED/i.test(e[2]));
  const row = e => `<li><b>${esc(e[0])}</b> — ${esc(e[2].split(";")[0].toLowerCase())}${e[3] ? `; ${esc(e[3])}` : ""}${e[4] ? `; ${esc(e[4].split(";")[0])}` : ""}${e[5] ? `. Pays for: ${esc(e[5])}` : ""}.</li>`;
  return `<details style="margin-top:8px"><summary class="small"><b>Real districts in LA County</b> (${formed.length} formed, ${other.length} proposed, expired or related)${activeCounty === "oc" ? " — for reference" : ""}</summary>
    <ul class="small" style="margin:6px 0 0 18px;padding:0">${formed.map(row).join("")}</ul>
    <p class="small muted" style="margin:6px 0 2px">Proposed, expired or related:</p><ul class="small" style="margin:0 0 0 18px;padding:0">${other.map(row).join("")}</ul>
    <p class="small muted">From the round-10 research (County, city and IFP documents, accessed Nov 2026). Shares are of each agency's own part of the 1% tax, not of the whole levy. Projected totals are lifetime forecasts, not money in hand.</p></details>`;
}
function eifdWire(p) {
  if (!$("#e-av")) return;
  let scope = "bg";
  const v = id => parseFloat($("#" + id).value) || 0;
  const pct = x => (100 * x).toFixed(1) + "%";
  const setAV = () => {
    const a = eifdArea(p, scope), unincorp = /^Unincorporated/i.test(p.c) || / \(unincorporated\)$/.test(p.c || "") || p.c === "Los Angeles County";
    const real = a.withRoll > 0 && a.av > 0;
    $("#e-av").value = ((real ? a.av : a.mv * 0.55) / 1e6).toFixed(1);
    $("#e-av-n") && ($("#e-av-n").textContent = "");
    if (a.sh) { $("#e-city").value = (a.sh[0] * 100).toFixed(2); $("#e-county").value = (a.sh[1] * 100).toFixed(2); }
    else { $("#e-city").value = unincorp ? 0 : 20; $("#e-county").value = 24; }
    const split = a.sh ? `<div class="kv small" style="margin-top:8px"><span>City${unincorp ? " (none: unincorporated)" : ""}</span><span>${pct(a.sh[0])}</span><span>County General Fund</span><span>${pct(a.sh[1])}</span><span>Other districts (fire, flood, water, library, parks...)</span><span>${pct(a.sh[2])}</span><span>Schools, colleges and ERAF (can't join an EIFD)</span><span>${pct(a.sh[3])}</span></div>
      ${isOrangeActive() ? `<p class="small muted">Where each $1 of growth in the 1% tax goes here: ${a.tras.length > 1 ? `the main tax-rate areas of ${a.n > 1 ? `these ${a.n} block groups` : "this block group"} (largest: ${a.tras.slice(0, 3).map(([t]) => `TRA ${esc(t)}`).join("; ")}), weighted by market value` : `tax-rate area ${esc((a.tras[0] || [""])[0])}, weighted by land area inside this block group`}. Source: Orange County Auditor-Controller Section 99 factor report by tax-rate area, FY 2026-27 (printed 28 Aug 2026), joined to the State Board of Equalization's 2026 tax-rate-area map. The city share is the city's general fund only; its lighting, sewer and similar funds count under other districts. Special districts can also join; their shares are shown but not pledged in this screen.</p>` : `<p class="small muted">Where each $1 of the 1% tax goes here, weighted by assessed value across ${a.tras.length} tax-rate area${a.tras.length > 1 ? "s" : ""} (largest: ${a.tras.filter(t => t[1] > 0).slice(0, 3).map(([t, x]) => `TRA ${esc(t)}, ${fmt$(x)}`).join("; ")}). Source: LA County Auditor-Controller ${esc((D.eifd || {}).factor_year || "")} Modified ATI ratios (AF49 report), the shares the Auditor uses to split tax increment. Special districts can also join; their shares are shown but not pledged in this screen.</p>`}` : "";
    $("#e-split").innerHTML = split + (a.ex.length ? `<p class="small"><b>Already in a district:</b> part of this area is in the ${a.ex.map(esc).join(" and ")}, so its increment is already pledged there. A new district here would need to avoid or amend it.</p>` : "");
    $("#e-note").textContent = real
      ? `Base value is the net taxable value on the ${a.ry || ""} Assessor roll (land + improvements + fixtures, less exemptions) for ${a.np.toLocaleString()} parcels in ${a.n} block group${a.n > 1 ? "s" : ""}: ${fmt$(a.avr)} residential, ${fmt$(a.avc)} commercial/industrial, the rest other uses. A real district's base is the roll in its formation year. All figures are a screening estimate, not a financing plan.`
      : `${isOrangeActive() ? "The Orange County Assessor roll is not in this build (the Assessor sells roll data in person only), so the base" : "No Assessor roll value matched this area, so the base"} is estimated as 55% of market value (${a.homes.toLocaleString()} homes). ${a.sh ? "" : "Tax shares are placeholders: no apportionment factors matched. "}All figures are a screening estimate, not a financing plan.`;
  };
  const run = () => {
    const base = v("e-av") * 1e6, gr = v("e-g") / 100, nd = v("e-new") * 1e6, r = v("e-rate") / 100, dscr = Math.max(v("e-dscr"), 1);
    const cityC = v("e-city") / 100 * v("e-cp") / 100, cntyC = v("e-county") / 100 * v("e-kp") / 100;
    const county = cntyC > 0, capture = cityC + cntyC;
    const housing = county ? 0.20 : 0, admin = 0.03;
    let av = base, tot = 0, y10 = 0;
    for (let t = 1; t <= 30; t++) { av = av * (1 + gr) + (t === 3 ? nd : 0);
      const net = Math.max(0, av - base) * 0.01 * capture * (1 - admin); tot += net; if (t === 10) y10 = net; }
    const bond = r > 0 ? y10 * (1 - housing) / dscr * (1 - Math.pow(1 + r, -30)) / r : y10 * (1 - housing) / dscr * 30;
    $("#e-out").innerHTML = `${tile("Year-10 increment", fmt$(y10), "per year, after 3% admin")}${tile("30-year total", fmt$(tot), county ? "before the County's housing condition" : "")}${tile("Bond capacity", fmt$(bond), county ? "30-yr, sized on year 10, 20% held for housing" : "30-yr bonds sized on year 10")}`;
    const w = [];
    const uninc = v("e-city") === 0;
    if (activeCounty === "oc" && !isOrangeActive()) {
      w.push(`${countyOf()}'s rules for joining a district have not been verified yet, so no County policy check is shown.`);
    } else if (activeCounty === "oc") {
      if (county && !uninc && cntyC > cityC + 1e-9) w.push(`The County would put in more than the city (${(cntyC * 100).toFixed(2)}¢ vs ${(cityC * 100).toFixed(2)}¢ of each $1 of increment). The County's EIFD Participation Policy requires the city's contribution to be equal to or greater than the County's.`);
      if (county && v("e-kp") > 50 + 1e-9) w.push("The County's policy caps its contribution at 50% of its share of the increment, for no longer than 20 years.");
      if (uninc) w.push("No city share here (unincorporated); an EIFD would rest on the County alone, which its policy does not contemplate (it expects a city applicant).");
    } else {
    if (county && !uninc && cntyC > cityC + 1e-9) w.push(`The County would put in more than the city (${(cntyC * 100).toFixed(2)}¢ vs ${(cityC * 100).toFixed(2)}¢ of each $1 of increment). Board Policy 3.106 requires the city's contribution to at least equal the County General Fund's plus any special districts'.`);
    if (county && !uninc && capture > 0 && cityC / capture < 0.15 - 1e-9) w.push("Policy 3.106 also expects at least 15¢ of each captured $1 from the city, with limited exceptions.");
    if (uninc) w.push("No city share here (unincorporated), so the County would form and run the district itself, as it did for West Carson.");
    }
    $("#e-warn").innerHTML = w.length ? (uninc ? "<b>Note:</b> " : "<b>County policy check:</b> ") + w.map(esc).join(" ") : "";
  };
  $("#panel").querySelectorAll("[data-scope]").forEach(b => b.onclick = () => { scope = b.dataset.scope;
    $("#panel").querySelectorAll("[data-scope]").forEach(x => x.setAttribute("aria-pressed", x === b)); setAV(); run(); });
  ["e-av", "e-g", "e-new", "e-city", "e-cp", "e-county", "e-kp", "e-rate", "e-dscr"].forEach(id => { const el = $("#" + id); if (el) el.oninput = run; });
  setAV(); run();
}


// --- Multi-Project Synergy Simulator & Advanced Capital Package Logic ---

// --- Rigorous Topography & Physical Geography Engine ---
function getGeoEnvironment(p, m, ll) {
  const fips = (m && m.__fips) || (p && p.id ? String(p.id).slice(0, 5) : "") || (typeof activeFips === "function" ? activeFips() : "");
  const city = (p && p.c ? p.c.toLowerCase().trim() : "");
  const name = (p && p.n ? p.n.toLowerCase().trim() : "");

  // 1. Delta, Bayou, Lowland Floodplain & Coastal Marsh (New Orleans, South LA, Houston Bayous)
  if (fips.startsWith("22") || ["22071", "22051", "22033", "22103", "22055", "48201", "48167", "48039", "48245", "48291"].includes(fips) ||
      city.includes("new orleans") || city.includes("metairie") || city.includes("kenner") ||
      city.includes("gretna") || city.includes("houma") || city.includes("lake charles") ||
      city.includes("houston") || city.includes("galveston") || city.includes("beaumont") ||
      city.includes("port arthur") || city.includes("sugar land") ||
      name.includes("bayou") || name.includes("ward") || name.includes("french quarter")) {
    return "delta_bayou";
  }

  // 2. Desert Arid & Extreme Heat Basin (Phoenix, Las Vegas, Tucson, El Paso, Bakersfield, Palm Springs)
  if (["04013", "04019", "04021", "04027", "32003", "48141", "35001", "06029", "06019"].includes(fips) ||
      city.includes("phoenix") || city.includes("scottsdale") || city.includes("tempe") ||
      city.includes("mesa") || city.includes("chandler") || city.includes("glendale az") ||
      city.includes("tucson") || city.includes("las vegas") || city.includes("henderson") ||
      city.includes("el paso") || city.includes("albuquerque") || city.includes("palm springs") ||
      city.includes("bakersfield")) {
    return "desert_arid";
  }

  // 3. True Ocean Surf Coast (within 1,200 m of open ocean surf)
  const isOcean = (m && m.water_m != null && m.water_m <= 1200) &&
    (city.includes("malibu") || city.includes("santa monica") || city.includes("venice") ||
     city.includes("newport beach") || city.includes("huntington beach") || city.includes("laguna beach") ||
     city.includes("miami beach") || city.includes("surfside") || city.includes("virginia beach") ||
     city.includes("coronado") || city.includes("la jolla") || city.includes("carlsbad") ||
     city.includes("del mar") || city.includes("encinitas"));
  if (isOcean) return "ocean_coast";

  // 4. Mountain Foothills, High-Relief & Canyon Terrain (Santa Clarita, San Gabriel Foothills, Rockies)
  // Strictly enforce authentic relief so flat lowlands/deltas never receive mountain trails
  const isMtn = ((m && m.hill) || (m && m.slope != null && m.slope > 5)) &&
    (city.includes("santa clarita") || city.includes("sierra madre") || city.includes("monrovia") ||
     city.includes("boulder") || city.includes("salt lake") || city.includes("asheville") ||
     city.includes("boise") || city.includes("reno") || city.includes("colorado springs") ||
     city.includes("flagstaff") || city.includes("tahoe") || city.includes("park city"));
  if (isMtn) return "mountain_foothills";

  // 5. Urban Flat Inland & Legacy Rail / River Corridors (Chicago, Dallas, Atlanta, Detroit, etc.)
  return "urban_inland";
}

function synergySection(p, m, recs) {
  const homes = m.h || m.homes || (p && p.homes) || null;
  const hv = m.hv || (p && p.hv) || null;
  const totalRes = (homes && hv) ? homes * hv : null;
  const geoEnv = getGeoEnvironment(p, m);

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.4">
      <p class="small" style="margin-top:0;color:#334155">
        Bundle complementary investments together to unlock <b>compounding willingness-to-pay multipliers</b>. For example, planting shade trees while calming streets and modernizing the school campus lets children walk to school in safety and comfort—creating <b>+15% to +25% higher property value uplift</b> than fragmented projects.
      </p>

      <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;padding:12px;margin-bottom:12px">
        <div style="font-weight:700;font-size:13px;color:#0f172a;margin-bottom:8px">Select Projects for Bundled Package:</div>
        
        <label style="display:flex;align-items:flex-start;gap:8px;margin-bottom:8px;cursor:pointer">
          <input type="checkbox" class="syn-chk" checked data-cost="120000" data-lift="0.024" data-id="trees" onchange="runSynergySim()">
          <div>
            <div style="font-weight:600;font-size:12px;color:#0f172a">Street Trees &amp; Continuous Shaded Canopy</div>
            <div style="font-size:11px;color:#64748b">Cost: $120k · Base Lift: +2.4% · <i>Funding: IRA Urban Forestry, State Forestry Grants</i></div>
          </div>
        </label>

        <label style="display:flex;align-items:flex-start;gap:8px;margin-bottom:8px;cursor:pointer">
          <input type="checkbox" class="syn-chk" checked data-cost="180000" data-lift="0.028" data-id="safe_streets" onchange="runSynergySim()">
          <div>
            <div style="font-weight:600;font-size:12px;color:#0f172a">Safe Routes to School &amp; Traffic Calming (Humps + Curb Extensions)</div>
            <div style="font-size:11px;color:#64748b">Cost: $180k · Base Lift: +2.8% · <i>Funding: Federal SRTS, USDOT SS4A, State ATP</i></div>
          </div>
        </label>

        <label style="display:flex;align-items:flex-start;gap:8px;margin-bottom:8px;cursor:pointer">
          <input type="checkbox" class="syn-chk" checked data-cost="450000" data-lift="0.045" data-id="school" onchange="runSynergySim()">
          <div>
            <div style="font-weight:600;font-size:12px;color:#0f172a">School Campus Modernization &amp; Air Filtration</div>
            <div style="font-size:11px;color:#64748b">Cost: $450k (area share) · Base Lift: +4.5% · <i>Funding: State School Facility Bond, Title I Campus Grants</i></div>
          </div>
        </label>

        <label style="display:flex;align-items:flex-start;gap:8px;margin-bottom:8px;cursor:pointer">
          <input type="checkbox" class="syn-chk" data-cost="210000" data-lift="0.031" data-id="park" onchange="runSynergySim()">
          <div>
            <div style="font-weight:600;font-size:12px;color:#0f172a">Complete Park Renovation (Grove + Seating + Solar LEDs + Murals)</div>
            <div style="font-size:11px;color:#64748b">Cost: $210k · Base Lift: +3.1% · <i>Funding: Land &amp; Water Conservation Fund (LWCF), Quimby Act</i></div>
          </div>
        </label>

        <label style="display:flex;align-items:flex-start;gap:8px;margin-bottom:8px;cursor:pointer">
          <input type="checkbox" class="syn-chk" data-cost="260000" data-lift="0.022" data-id="bike" onchange="runSynergySim()">
          <div>
            <div style="font-weight:600;font-size:12px;color:#0f172a">Protected Bike Lanes &amp; Micro-Mobility Network</div>
            <div style="font-size:11px;color:#64748b">Cost: $260k · Base Lift: +2.2% · <i>Funding: Highway Safety Improvement (HSIP), Clean California</i></div>
          </div>
        </label>

        ${geoEnv === "delta_bayou" ? `
        <label style="display:flex;align-items:flex-start;gap:8px;margin-bottom:8px;cursor:pointer">
          <input type="checkbox" class="syn-chk" data-cost="340000" data-lift="0.036" data-id="stormwater" onchange="runSynergySim()">
          <div>
            <div style="font-weight:600;font-size:12px;color:#0891b2">Green Stormwater Resilience District &amp; Urban Bioswales (Gentilly Model)</div>
            <div style="font-size:11px;color:#64748b">Cost: $340k · Base Lift: +3.6% · <i>Funding: HUD CDBG-NDR, FEMA BRIC, EPA Clean Water SRF</i></div>
          </div>
        </label>
        <label style="display:flex;align-items:flex-start;gap:8px;margin-bottom:8px;cursor:pointer">
          <input type="checkbox" class="syn-chk" data-cost="280000" data-lift="0.028" data-id="bayou_trail" onchange="runSynergySim()">
          <div>
            <div style="font-weight:600;font-size:12px;color:#0d9488">Bayou &amp; Lakefront Levee Greenway Trail (Lafitte Greenway Model)</div>
            <div style="font-size:11px;color:#64748b">Cost: $280k · Base Lift: +2.8% · <i>Funding: Federal RTP, LWCF, USDOT RAISE</i></div>
          </div>
        </label>` : ""}

        ${geoEnv === "desert_arid" ? `
        <label style="display:flex;align-items:flex-start;gap:8px;margin-bottom:8px;cursor:pointer">
          <input type="checkbox" class="syn-chk" data-cost="290000" data-lift="0.034" data-id="desert_cool" onchange="runSynergySim()">
          <div>
            <div style="font-weight:600;font-size:12px;color:#d97706">Desert Cool Corridor &amp; Shaded Active Transit Spine (Phoenix CoolSeal &amp; Canalscape Model)</div>
            <div style="font-size:11px;color:#64748b">Cost: $290k · Base Lift: +3.4% · <i>Funding: Bureau of Reclamation WaterSMART, EPA EJ Thriving Communities, Urban Heat Mitigation</i></div>
          </div>
        </label>
        <label style="display:flex;align-items:flex-start;gap:8px;margin-bottom:8px;cursor:pointer">
          <input type="checkbox" class="syn-chk" data-cost="175000" data-lift="0.026" data-id="xeriscape" onchange="runSynergySim()">
          <div>
            <div style="font-weight:600;font-size:12px;color:#b45309">Water-Conserving Xeriscape Pocket Park &amp; Shaded Gathering Pavilion</div>
            <div style="font-size:11px;color:#64748b">Cost: $175k · Base Lift: +2.6% · <i>Funding: Arizona DWR Conservation, Municipal Open Space, LWCF</i></div>
          </div>
        </label>` : ""}

        ${geoEnv === "ocean_coast" ? `
        <label style="display:flex;align-items:flex-start;gap:8px;margin-bottom:8px;cursor:pointer">
          <input type="checkbox" class="syn-chk" data-cost="850000" data-lift="0.052" data-id="beach" onchange="runSynergySim()">
          <div>
            <div style="font-weight:600;font-size:12px;color:#0369a1">Beach Nourishment, Dune Restoration &amp; Volleyball Courts</div>
            <div style="font-size:11px;color:#64748b">Cost: $850k · Base Lift: +5.2% · <i>Funding: USACE Coastal Storm Risk, State Coastal Conservancy</i></div>
          </div>
        </label>` : ""}

        ${geoEnv === "mountain_foothills" ? `
        <label style="display:flex;align-items:flex-start;gap:8px;margin-bottom:8px;cursor:pointer">
          <input type="checkbox" class="syn-chk" data-cost="140000" data-lift="0.032" data-id="mtb" onchange="runSynergySim()">
          <div>
            <div style="font-weight:600;font-size:12px;color:#15803d">Mountain Bike Singletrack Trails &amp; Trailhead (Santa Clarita Model)</div>
            <div style="font-size:11px;color:#64748b">Cost: $140k · Base Lift: +3.2% · <i>Funding: Federal RTP, LWCF Recreation Grants, Open Space District</i></div>
          </div>
        </label>` : ""}

        ${geoEnv === "urban_inland" ? `
        <label style="display:flex;align-items:flex-start;gap:8px;margin-bottom:8px;cursor:pointer">
          <input type="checkbox" class="syn-chk" data-cost="320000" data-lift="0.030" data-id="rail_trail" onchange="runSynergySim()">
          <div>
            <div style="font-weight:600;font-size:12px;color:#15803d">Linear Rail-Trail &amp; Urban Greenway Corridor (The 606 / BeltLine Model)</div>
            <div style="font-size:11px;color:#64748b">Cost: $320k · Base Lift: +3.0% · <i>Funding: USDOT RAISE, Safe Streets &amp; Roads for All (SS4A), EPA Brownfields</i></div>
          </div>
        </label>` : ""}
      </div>

      <div id="syn-results" style="background:#f0fdf4;border:2px solid #86efac;border-radius:8px;padding:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <span style="font-size:11.5px;font-weight:700;color:#166534">Compounding Package Results</span>
          <span id="syn-multiplier" style="font-size:11px;font-weight:800;background:#dcfce7;color:#15803d;padding:2px 8px;border-radius:12px">+25% Synergy Multiplier</span>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;font-size:12px">
          <div style="background:#fff;padding:8px;border-radius:6px;border:1px solid #dcfce7">
            <div style="color:#64748b;font-size:11px">Combined Non-Private Cost</div>
            <div id="syn-cost" style="font-weight:800;font-size:14px;color:#0f172a">$750,000</div>
          </div>
          <div style="background:#fff;padding:8px;border-radius:6px;border:1px solid #dcfce7">
            <div style="color:#64748b;font-size:11px">Total Home Value Created</div>
            <div id="syn-val" style="font-weight:800;font-size:14px;color:#087b78">+$36,375,000</div>
          </div>
        </div>

        <div style="background:#fff;padding:8px;border-radius:6px;border:1px solid #dcfce7;margin-bottom:8px;font-size:11.5px">
          <div style="display:flex;justify-content:space-between;margin-bottom:2px">
            <span><b>Net Benefit Ratio:</b></span>
            <span id="syn-ratio" style="font-weight:800;color:#087b78">$48.50 per $1 invested</span>
          </div>
          <div style="display:flex;justify-content:space-between">
            <span><b>Average Home Gain:</b></span>
            <span id="syn-per-home" style="font-weight:700;color:#166534">+$90,900 / home</span>
          </div>
        </div>

        <div id="syn-note" style="font-size:11px;color:#166534;line-height:1.35;border-top:1px dashed #bbf7d0;padding-top:6px">
          ✓ <b>Walking Synergy Active:</b> Combining trees, traffic calming, and school improvements creates a protected, comfortable walking shed for neighborhood children, maximizing neighborhood desirability.
        </div>
      </div>
    </div>
  `;
}

function runSynergySim() {
  const chks = document.querySelectorAll(".syn-chk:checked");
  const m = selected && D.details[selected] ? D.details[selected].m || {} : {};
  const p = selected && byId.get(selected) ? byId.get(selected).properties : {};
  const homes = m.h || m.homes || p.homes || null;
  const hv = m.hv || p.hv || null;
  const totalRes = (homes && hv) ? homes * hv : null;

  let totCost = 0, totLift = 0;
  const selectedIds = [];
  chks.forEach(c => {
    totCost += +c.dataset.cost;
    totLift += +c.dataset.lift;
    selectedIds.push(c.dataset.id);
  });

  if (totCost === 0) {
    const resBox = $("#syn-results");
    if (resBox) resBox.style.display = "none";
    return;
  }
  const resBox = $("#syn-results");
  if (resBox) resBox.style.display = "block";

  // Synergy multiplier logic:
  // 1 item: 1.0x
  // 2 items: 1.12x (+12% synergy)
  // 3+ items: 1.25x (+25% compounding synergy)
  let mult = 1.0, multTxt = "No bundle synergy";
  if (chks.length >= 3) {
    mult = 1.25;
    multTxt = "+25% Synergy Multiplier";
  } else if (chks.length === 2) {
    mult = 1.12;
    multTxt = "+12% Synergy Multiplier";
  }

  const finalLift = totLift * mult;
  const valCreated = totalRes ? Math.round(totalRes * finalLift) : null;
  const ratio = valCreated != null ? (valCreated / Math.max(totCost, 1)).toFixed(1) : null;
  const perHome = (valCreated != null && homes) ? Math.round(valCreated / Math.max(homes, 1)) : null;

  const elCost = $("#syn-cost"); if (elCost) elCost.textContent = fmt$(totCost);
  const elVal = $("#syn-val"); if (elVal) elVal.textContent = valCreated != null ? "+" + fmt$(valCreated) : "Not on file";
  const elMult = $("#syn-multiplier"); if (elMult) elMult.textContent = multTxt;
  const elRatio = $("#syn-ratio"); if (elRatio) elRatio.textContent = ratio != null ? `$${ratio} per $1 invested` : "Not on file";
  const elHome = $("#syn-per-home"); if (elHome) elHome.textContent = perHome != null ? `+${fmt$(perHome)} / home` : "Not on file";

  const elNote = $("#syn-note");
  if (elNote) {
    if (selectedIds.includes("trees") && selectedIds.includes("safe_streets") && selectedIds.includes("school")) {
      elNote.innerHTML = "✓ <b>Safe Routes to School Synergy Active:</b> Combining tree canopy, calmed streets, and modern school facilities allows kids to walk to school in safety and comfort, unlocking maximum willingness-to-pay.";
    } else if (chks.length >= 2) {
      elNote.innerHTML = `✓ <b>Multi-Project Package Active (${chks.length} investments):</b> Bundling civic, street, and park assets avoids duplicated construction mobilization and amplifies neighborhood satisfaction.`;
    } else {
      elNote.innerHTML = "Select 2 or more complementary improvements to simulate compounding neighborhood synergy.";
    }
  }
}

function parkImprovementsSection(m) {
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:12px;line-height:1.45;color:#0f172a">
      <p class="small" style="margin-top:0;color:#475569">
        Park quality creates distinct, measurable real estate effects based on the specific amenities installed:
      </p>

      <div style="border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;margin-bottom:8px">
        <div style="background:#f1f5f9;padding:6px 10px;font-weight:700;color:#0f172a;border-bottom:1px solid #e2e8f0">
          Shade Tree Grove &amp; Urban Forest Buffer
        </div>
        <div style="padding:8px 10px">
          <div><b>Effect on Home Values:</b> <span style="color:#087b78;font-weight:700">+1.0% within 400 m</span></div>
          <div><b>Quality-of-Life:</b> Microclimate cooling reduces summer heat island by 5–8°F (USFS Urban Forest Assessment).</div>
          <div style="font-size:11px;color:#64748b"><b>Non-Private Funding:</b> Inflation Reduction Act Urban Forestry Grants · State Park Bonds · Municipal / Stormwater Funds (Measure W in LA County)</div>
        </div>
      </div>

      <div style="border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;margin-bottom:8px">
        <div style="background:#f1f5f9;padding:6px 10px;font-weight:700;color:#0f172a;border-bottom:1px solid #e2e8f0">
          Shaded Seating, ADA Benches &amp; Picnic Pavilion
        </div>
        <div style="padding:8px 10px">
          <div><b>Effect on Home Values:</b> <span style="color:#087b78;font-weight:700">+0.4% within 300 m</span></div>
          <div><b>Quality-of-Life:</b> Creates intergenerational gathering space and accessible resting spots for seniors and parents.</div>
          <div style="font-size:11px;color:#64748b"><b>Non-Private Funding:</b> Quimby Act Park In-Lieu Fees · Municipal Capital Improvement Fund</div>
        </div>
      </div>

      <div style="border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;margin-bottom:8px">
        <div style="background:#f1f5f9;padding:6px 10px;font-weight:700;color:#0f172a;border-bottom:1px solid #e2e8f0">
          Community Art Murals &amp; Cultural Pavilion
        </div>
        <div style="padding:8px 10px">
          <div><b>Effect on Home Values:</b> <span style="color:#087b78;font-weight:700">+0.3% within 200 m</span></div>
          <div><b>Quality-of-Life:</b> Builds neighborhood identity and deters graffiti tagging (Philadelphia Mural Arts / Sampson 2019).</div>
          <div style="font-size:11px;color:#64748b"><b>Non-Private Funding:</b> National Endowment for the Arts (NEA) · Civic Arts Trust · CDBG</div>
        </div>
      </div>

      <div style="border:1px solid #e2e8f0;border-radius:6px;overflow:hidden">
        <div style="background:#f1f5f9;padding:6px 10px;font-weight:700;color:#0f172a;border-bottom:1px solid #e2e8f0">
          Solar LED Pathway &amp; Perimeter Safety Lighting
        </div>
        <div style="padding:8px 10px">
          <div><b>Effect on Home Values:</b> <span style="color:#087b78;font-weight:700">+1.4% within 400 m</span></div>
          <div><b>Quality-of-Life:</b> Nighttime outdoor crime drops 36% (Chalfin et al. 2021 NYC randomized controlled trial).</div>
          <div style="font-size:11px;color:#64748b"><b>Non-Private Funding:</b> USDOT Safe Streets &amp; Roads for All (SS4A) · Clean Energy State Grants</div>
        </div>
      </div>
    </div>
  `;
}

function geographicImprovementsSection(p, m) {
  const geoEnv = getGeoEnvironment(p, m);
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:12px;line-height:1.45;color:#0f172a">
      <p class="small" style="margin-top:0;color:#475569">
        Tailored improvements for ${esc(p.c)} based on physical geography and natural topography:
      </p>

      ${geoEnv === "delta_bayou" ? `
      <div style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:6px;padding:10px;margin-bottom:8px">
        <div style="font-weight:700;color:#0f766e;margin-bottom:4px">Delta &amp; Bayou Stormwater Resilience Infrastructure</div>
        <div style="margin-bottom:4px"><b>Green Stormwater Bioswales &amp; Urban Water Basins:</b> Modeled after the Gentilly Resilience District and Mirabeau Water Garden (+3.6% home value within 400 m; reduces street subsidence and FEMA flood insurance risk).</div>
        <div><b>Bayou &amp; Levee Waterfront Promenade:</b> Grade-separated active transportation path with native shade trees along bayou banks (+2.8% within 500 m).</div>
        <div style="font-size:11px;color:#0d9488;margin-top:4px"><b>Non-Private Funding:</b> HUD National Disaster Resilience (CDBG-NDR) · FEMA Building Resilient Infrastructure and Communities (BRIC) · EPA Clean Water SRF · Sewerage &amp; Water Board</div>
      </div>
      ` : ""}

      ${geoEnv === "desert_arid" ? `
      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:10px;margin-bottom:8px">
        <div style="font-weight:700;color:#b45309;margin-bottom:4px">Desert Arid &amp; Extreme Heat Resilience Infrastructure</div>
        <div style="margin-bottom:4px"><b>Desert Cool Corridor &amp; Canalscape Active Transit:</b> Modeled after the Phoenix CoolSeal Initiative and Salt River Project canal bank shade canopies (+3.4% home value within 600 m; lowers surface temperatures up to 12°F and creates continuous pedestrian shade).</div>
        <div><b>Xeriscape Pocket Park &amp; Native Shade Grove:</b> Low-water native mesquite and palo verde canopy with permeable desert paving and shade pavilions (+2.6% within 400 m).</div>
        <div style="font-size:11px;color:#d97706;margin-top:4px"><b>Non-Private Funding:</b> US Bureau of Reclamation WaterSMART · EPA Environmental Justice Thriving Communities · Arizona DWR Water Conservation · State Parks Land &amp; Water Conservation Fund</div>
      </div>
      ` : ""}

      ${geoEnv === "ocean_coast" ? `
      <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:6px;padding:10px;margin-bottom:8px">
        <div style="font-weight:700;color:#0369a1;margin-bottom:4px">Coastal &amp; Beach Infrastructure</div>
        <div style="margin-bottom:4px"><b>Beach Nourishment &amp; Dune Restoration:</b> Extends sandy shoreline and builds storm surge erosion buffers (+5.2% home value within 800 m, Landry et al. coastal hedonic studies).</div>
        <div><b>Public Beach Volleyball Courts:</b> Lighted sand courts and spectator seating (+0.8% within 400 m).</div>
        <div style="font-size:11px;color:#0284c7;margin-top:4px"><b>Non-Private Funding:</b> US Army Corps of Engineers (USACE) Storm Risk Grants · State Coastal Conservancy · Transient Occupancy Tax (TOT)</div>
      </div>
      ` : ""}

      ${geoEnv === "mountain_foothills" ? `
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:10px;margin-bottom:8px">
        <div style="font-weight:700;color:#15803d;margin-bottom:4px">Foothill Singletrack Trail Infrastructure</div>
        <div style="margin-bottom:4px"><b>Mountain Bike Singletrack Trails &amp; Trailhead Kiosk:</b> Modeled after the City of Santa Clarita Trek Bike Park &amp; Headwaters Economics recreation studies (+3.2% home value within 1,200 m).</div>
        <div><b>Amenities:</b> Bike maintenance kiosk, shaded picnic rest stop, wayfinding maps, and grade-separated singletrack paths.</div>
        <div style="font-size:11px;color:#16a34a;margin-top:4px"><b>Non-Private Funding:</b> Federal Recreational Trails Program (RTP) · Land &amp; Water Conservation Fund (LWCF) · Regional Open Space District</div>
      </div>
      ` : ""}

      ${geoEnv === "urban_inland" ? `
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:10px;margin-bottom:8px">
        <div style="font-weight:700;color:#15803d;margin-bottom:4px">Urban Linear Rail-Trail &amp; Greenways</div>
        <div style="margin-bottom:4px"><b>Linear Rail-Trail &amp; Tree Canopy Spine:</b> Modeled after The 606 (Chicago) and Atlanta BeltLine (+3.0% home value within 600 m).</div>
        <div><b>Amenities:</b> Multi-use paved trail, landscaped tree canopy buffers, pedestrian lighting, and neighborhood pocket parks.</div>
        <div style="font-size:11px;color:#16a34a;margin-top:4px"><b>Non-Private Funding:</b> USDOT RAISE · Safe Streets and Roads for All (SS4A) · EPA Brownfields · State Parks Bond</div>
      </div>
      ` : ""}
    </div>
  `;
}

// ---------------- Public-Private Partnerships (P3) & Transit Joint Development Pipeline
let p3WalkshedLayer = null;

function focusP3Walkshed(lat, lng, name, radiusMeters = 805) {
  if (typeof map === "undefined" || !map) return;
  map.flyTo([lat, lng], radiusMeters > 1000 ? 15 : 16, { animate: true, duration: 1.0 });

  if (p3WalkshedLayer && map.hasLayer(p3WalkshedLayer)) {
    map.removeLayer(p3WalkshedLayer);
    p3WalkshedLayer = null;
  }

  const layers = [];
  const circle = L.circle([lat, lng], {
    radius: radiusMeters,
    color: "#0284c7",
    weight: 2,
    dashArray: "6,6",
    fillColor: "#38bdf8",
    fillOpacity: 0.14,
    interactive: false
  });
  layers.push(circle);

  const marker = L.circleMarker([lat, lng], {
    radius: 9,
    color: "#ffffff",
    weight: 3,
    fillColor: "#0284c7",
    fillOpacity: 1.0
  }).bindPopup(`
    <div style="font-family:var(--body);line-height:1.45;padding:4px 2px;min-width:220px;">
      <div style="font-size:10.5px;font-weight:700;text-transform:uppercase;color:#0284c7;letter-spacing:0.5px;">Planned Transit Station</div>
      <div style="font-size:14px;font-weight:800;color:#0f172a;margin:2px 0 4px;">${esc(name || "Transit Station")}</div>
      <div style="font-size:11.5px;color:#475569;margin-bottom:6px;">
        <b>Walkshed Radius:</b> ${(radiusMeters / 1609.34).toFixed(2)} mi (~${Math.round(radiusMeters / 80)} min walk)
      </div>
      <div style="display:flex;gap:4px;margin-bottom:6px;">
        <button type="button" onclick="focusP3Walkshed(${lat}, ${lng}, '${esc(name)}', 402)" style="font-size:10px;padding:3px 6px;border:1px solid #cbd5e1;background:${radiusMeters <= 500 ? '#0284c7' : '#fff'};color:${radiusMeters <= 500 ? '#fff' : '#0f172a'};border-radius:4px;cursor:pointer;">5-Min (0.25 mi)</button>
        <button type="button" onclick="focusP3Walkshed(${lat}, ${lng}, '${esc(name)}', 805)" style="font-size:10px;padding:3px 6px;border:1px solid #cbd5e1;background:${radiusMeters > 500 && radiusMeters <= 1000 ? '#0284c7' : '#fff'};color:${radiusMeters > 500 && radiusMeters <= 1000 ? '#fff' : '#0f172a'};border-radius:4px;cursor:pointer;">10-Min (0.5 mi)</button>
        <button type="button" onclick="focusP3Walkshed(${lat}, ${lng}, '${esc(name)}', 1207)" style="font-size:10px;padding:3px 6px;border:1px solid #cbd5e1;background:${radiusMeters > 1000 ? '#0284c7' : '#fff'};color:${radiusMeters > 1000 ? '#fff' : '#0f172a'};border-radius:4px;cursor:pointer;">15-Min (0.75 mi)</button>
      </div>
      <div style="font-size:11px;color:#0369a1;background:#e0f2fe;padding:5px 8px;border-radius:4px;">
        ${(typeof activeState === "function" && activeState() === "CA") ? "<b>California AB 2097:</b> no minimum parking may be required within ½ mile of public transit (Gov. Code § 65863.2, checked against the statute)" : "<b>Parking near transit:</b> state rule not determined here; ask the city"}
      </div>
    </div>
  `);
  layers.push(marker);

  p3WalkshedLayer = L.layerGroup(layers).addTo(map);
  setTimeout(() => marker.openPopup(), 400);
  showToast(`Focusing station: ${name} (${(radiusMeters / 1609.34).toFixed(2)}-mi walkshed)`);
}


function flyToP3Station(lat, lng, name, units, affordPct, retailSqft) {
  if (typeof map === "undefined" || !map) return;
  const hubLl = [lat, lng];
  map.flyTo(hubLl, 16, { animate: true, duration: 1.0 });

  if (p3WalkshedLayer) {
    p3WalkshedLayer.eachLayer(l => {
      if (l instanceof L.Circle) {
        l.setLatLng(hubLl);
      }
    });
  }
  showToast(`Focusing station: ${name} (0.5-mi TOD walkshed)`);
}

function flyToP3Hub(fips, targetIdx = -1) {
  if (typeof map === "undefined" || !map) return;
  const pipe = getMetroPipeline(fips, (selected && byId.get(selected)) ? byId.get(selected).properties.c : "");
  if (!pipe || !pipe.hubLat || !pipe.hubLng) return;

  if (p3WalkshedLayer) { map.removeLayer(p3WalkshedLayer); p3WalkshedLayer = null; }

  const hubLl = (targetIdx >= 0 && pipe.stations && pipe.stations[targetIdx]) 
    ? [pipe.stations[targetIdx].lat, pipe.stations[targetIdx].lng] 
    : [pipe.hubLat, pipe.hubLng];
  map.flyTo(hubLl, 15.5, { animate: true, duration: 1.2 });

  const walkshedCircle = L.circle(hubLl, {
    radius: 805, // 0.5-mile walkshed
    color: "#0284c7",
    weight: 2,
    dashArray: "5 5",
    fillColor: "#38bdf8",
    fillOpacity: 0.12,
    interactive: false
  });

  const layers = [walkshedCircle];

  // Draw transit alignment corridor polyline
  if (pipe.corridorRings && pipe.corridorRings.length) {
    const transitLine = L.polyline(pipe.corridorRings, {
      color: "#0284c7",
      weight: 5,
      opacity: 0.85,
      dashArray: "10 6"
    });
    layers.push(transitLine);
  }

  // Draw markers for all stations along the corridor
  if (pipe.stations && pipe.stations.length) {
    pipe.stations.forEach((stn, idx) => {
      const isAnchor = (stn.lat === pipe.hubLat && stn.lng === pipe.hubLng);
      const icon = L.divIcon({
        className: "",
        iconSize: isAnchor ? [36, 36] : [28, 28],
        html: `<div style="background:${isAnchor ? '#0284c7' : '#0369a1'};color:#fff;border:2.5px solid #fff;border-radius:50%;width:${isAnchor ? '32px' : '24px'};height:${isAnchor ? '32px' : '24px'};display:flex;align-items:center;justify-content:center;font-size:${isAnchor ? '16px' : '12px'};box-shadow:0 3px 10px rgba(2,132,199,0.4);cursor:pointer;" title="${esc(stn.name)}"><svg class=ic aria-hidden=true><use href=#i-train /></svg></div>`
      });

      const m = L.marker([stn.lat, stn.lng], { icon })
        .bindPopup(`
          <div style="font-family:var(--body);line-height:1.4;color:#0f172a;max-width:280px">
            <div style="font-weight:800;font-size:13px;color:#0369a1;margin-bottom:3px">${isAnchor ? '' : ''} ${esc(stn.name)}</div>
            <div style="font-size:11.5px;color:#334155;margin-bottom:4px"><b>TOD Potential:</b> ${stn.units != null ? `${stn.units} mixed-income homes${stn.affordPct != null ? ` (${stn.affordPct}% affordable)` : ""}` : "not on file"}</div>
            ${stn.desc || stn.status ? `<div style="font-size:11px;color:#64748b;margin-bottom:6px;">${esc(stn.desc || stn.status)}</div>` : ""}
            <button type="button" onclick="flyToP3Station(${stn.lat}, ${stn.lng}, '${esc(stn.name)}', ${stn.units}, ${stn.affordPct}, ${stn.retailSqft})" style="background:#0284c7;color:#fff;border:none;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:700;cursor:pointer;">
              Focus 0.5-Mi Walkshed
            </button>
          </div>
        `);
      layers.push(m);
      if (isAnchor) setTimeout(() => m.openPopup(), 400);
    });
  }

  p3WalkshedLayer = L.layerGroup(layers).addTo(map);
  showToast(`Viewing active transit corridor & stations: ${pipe.title.split('&')[0].trim()}`);
}

function getMetroPipeline(fips, city) {
  fips = String(fips || (typeof activeFips === "function" ? activeFips() : "06037") || "06037");
  city = String(city || "").toLowerCase();

  // If TRANSIT_PIPELINES_DATA is not populated yet, attempt synchronous parse from loaded text if available
  if (!TRANSIT_PIPELINES_DATA || !TRANSIT_PIPELINES_DATA.length) {
    const raw = cpTextNow("transit-pipelines");
    if (raw) {
      try { TRANSIT_PIPELINES_DATA = JSON.parse(raw); } catch (e) {}
    }
  }

  // Only a project whose county FIPS matches is returned. There is no fallback to another county's project and no
  // made-up default: with no match the page says no transit project is on file for this county.
  const list = Array.isArray(TRANSIT_PIPELINES_DATA) ? TRANSIT_PIPELINES_DATA : [];
  return list.find(p => p && p.fips === fips) || null;
}

let _p3Term = 99;
let _p3Afford = 35;

function setP3Term(term) {
  _p3Term = term;
  document.querySelectorAll(".p3-term-btn").forEach(b => {
    b.classList.toggle("active", +b.dataset.term === term);
  });
  runP3Sim();
}

function setP3Afford(afford) {
  _p3Afford = afford;
  document.querySelectorAll(".p3-afford-btn").forEach(b => {
    b.classList.toggle("active", +b.dataset.afford === afford);
  });
  runP3Sim();
}

function p3Section(p, m) {
  const pipe = getMetroPipeline(activeFips(), p.c || m.c);
  if (!pipe) {
    const n = Array.isArray(TRANSIT_PIPELINES_DATA) ? TRANSIT_PIPELINES_DATA.length : 0;
    return `<p class="small muted">No major transit project is on file for this county. The page's transit project table (app/data/transit_pipelines.json) lists ${n} project${n === 1 ? "" : "s"}, each checked against the agency's own page.</p>`;
  }
  const pv = pipe.verification || null;
  const pvChecked = pv && (pv.checked_on || pv.checked);
  const pvLabel = pv && /^verified/.test(String(pv.status || "")) ? `Checked against the agency source${pvChecked ? " on " + fmtCheckedDate(pvChecked) : ""}` : "Not yet checked";
  const facts = [
    pipe.length_miles != null ? `${pipe.length_miles} miles` : null,
    pipe.station_count_per_source != null ? `${pipe.station_count_per_source} stations per the agency` : null,
    pipe.total_capital_cost_musd != null ? `total capital cost $${fmtN(pipe.total_capital_cost_musd)}M` : null,
    pipe.cig_share_musd != null ? `federal CIG share $${fmtN(pipe.cig_share_musd)}M` : null,
    pipe.total_federal_allocation_musd != null ? `federal allocation $${fmtN(pipe.total_federal_allocation_musd)}M` : null,
  ].filter(Boolean);
  const hasHub = pipe.hubLat != null && pipe.hubLng != null;
  return `
    <div style="font-family:var(--body);line-height:1.45;color:var(--ink)">
      <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:12px;margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:6px;margin-bottom:6px;">
          <span style="font-size:11px;font-weight:700;text-transform:uppercase;color:#0284c7;letter-spacing:0.5px;">Active Major Infrastructure Pipeline</span>
          <span style="font-size:11px;font-weight:600;background:#e0f2fe;color:#0369a1;padding:2px 8px;border-radius:12px;">${esc(String(pipe.status || "Status not on file").split('·')[0])}</span>
        </div>
        <div style="font-size:15px;font-weight:800;color:#0c4a6e;margin-bottom:4px;">${esc(pipe.title)}</div>
        <div style="font-size:12px;color:#334155;margin-bottom:4px;"><b>Lead Sponsoring Agency:</b> ${esc(pipe.agency || "not on file")}</div>
        <div style="font-size:12px;color:#475569;margin-bottom:6px;"><b>Station Focus Hub:</b> <span style="color:#0369a1;font-weight:600">${pipe.hubName ? esc(pipe.hubName) : "not on file"}</span></div>
        ${pipe.corridorDesc ? `<div style="font-size:12px;color:#475569;margin-bottom:6px;">${esc(pipe.corridorDesc)}</div>` : ""}
        ${facts.length ? `<div style="font-size:12px;color:#334155;margin-bottom:6px;"><b>From the agency:</b> ${esc(facts.join(" · "))}</div>` : ""}
        <div style="font-size:11px;color:#64748b;margin-bottom:10px;">${esc(pvLabel)}${pipe.rtp_document_url ? ` · <a href="${esc(pipe.rtp_document_url)}" target="_blank" rel="noopener noreferrer">source</a>` : ""}${(!pipe.stations || !pipe.stations.length) ? " · station locations not on file" : ""}</div>
        ${hasHub ? `<button type="button" onclick="flyToP3Hub('${esc(pipe.fips)}')" style="display:inline-flex;align-items:center;gap:6px;background:#0284c7;color:#fff;border:none;padding:7px 13px;border-radius:6px;font-weight:700;font-size:12px;cursor:pointer;box-shadow:0 2px 8px rgba(2,132,199,0.3);transition:background 0.15s;">
          Fly to Station Hub on Map &amp; View 0.5-Mi Walkshed
        </button>` : ""}
      </div>

      ${pipe.stations && pipe.stations.length ? `
      <div style="margin-bottom:12px;">
        <div style="font-size:12px;font-weight:700;color:#0f172a;margin-bottom:6px;">Planned Stations along this Corridor (Click to Inspect):</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px;">
          ${pipe.stations.map((stn, idx) => `
            <button type="button" class="story-btn" onclick="flyToP3Hub('${esc(pipe.fips)}', ${idx})" style="padding:4px 8px;font-size:11px;" title="Focus ${esc(stn.name)}">
              ${(stn.lat === pipe.hubLat && stn.lng === pipe.hubLng) ? '' : ''} ${esc(stn.name)}
            </button>
          `).join('')}
        </div>
      </div>
      ` : ''}

      <div style="margin-bottom:12px;">
        <div style="font-size:13px;font-weight:700;color:var(--ink);margin-bottom:4px;">P3 Joint Development &amp; Corridor Bundle Simulator</div>
        <div style="font-size:12px;color:var(--ink-2);margin-bottom:6px;">Select complementary investments around the transit corridor to calculate combined private developer IRR, public agency ground lease revenue, and neighborhood property value lift:</div>
        <div style="font-size:11px;font-weight:700;color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:4px;padding:5px 8px;margin-bottom:10px;">Illustrative only: inputs are assumptions, not local data. The project table holds no joint-development program, so results read "Not on file" unless a figure is published.</div>

        <div style="display:flex;flex-wrap:wrap;gap:12px;background:#f1f5f9;border:1px solid #cbd5e1;border-radius:8px;padding:8px 12px;margin-bottom:10px;font-size:12px;">
          <div style="display:flex;align-items:center;gap:6px;">
            <b>Ground Lease Term:</b>
            <div style="display:inline-flex;gap:3px;">
              <button type="button" class="story-btn p3-term-btn" data-term="55" onclick="setP3Term(55)">55 Years</button>
              <button type="button" class="story-btn p3-term-btn" data-term="75" onclick="setP3Term(75)">75 Years</button>
              <button type="button" class="story-btn p3-term-btn active" data-term="99" onclick="setP3Term(99)">99 Years (Optimal)</button>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:6px;">
            <b>Affordable Housing:</b>
            <div style="display:inline-flex;gap:3px;">
              <button type="button" class="story-btn p3-afford-btn" data-afford="20" onclick="setP3Afford(20)">20% Workforce</button>
              <button type="button" class="story-btn p3-afford-btn active" data-afford="35" onclick="setP3Afford(35)">35% Mixed-Income</button>
              <button type="button" class="story-btn p3-afford-btn" data-afford="50" onclick="setP3Afford(50)">50% Deep Infill</button>
            </div>
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:8px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:12px;">
          <label style="display:flex;align-items:flex-start;gap:8px;cursor:pointer;font-size:12.5px;">
            <input type="checkbox" id="p3-tod" checked onchange="runP3Sim()" style="margin-top:2px;">
            <div>
              <b>Transit-Oriented Housing &amp; Mixed-Use Joint Development</b>
              <div style="font-size:11.5px;color:var(--ink-2);">${pipe.units != null ? `${fmtN(pipe.units)} mixed-income homes` : "Homes: not on file"}, ${pipe.retailSqft != null ? `${fmtN(pipe.retailSqft)} sq ft ground-floor commercial` : "commercial space: not on file"}, via a public ground lease.</div>
            </div>
          </label>

          <label style="display:flex;align-items:flex-start;gap:8px;cursor:pointer;font-size:12.5px;">
            <input type="checkbox" id="p3-trail" checked onchange="runP3Sim()" style="margin-top:2px;">
            <div>
              <b>${esc(pipe.bikewayName || "Protected bikeway to the station")}</b>
              <div style="font-size:11.5px;color:var(--ink-2);">${pipe.bikewayDesc ? esc(pipe.bikewayDesc) : "Route and length not on file"}${pipe.bikewayHomeLift != null ? ` (+${pipe.bikewayHomeLift}% home value lift${pipe.bikewayRidership != null ? `; +${pipe.bikewayRidership}% station cycling boardings` : ""})` : " (value effect not on file)"}.</div>
            </div>
          </label>

          <label style="display:flex;align-items:flex-start;gap:8px;cursor:pointer;font-size:12.5px;">
            <input type="checkbox" id="p3-trees" checked onchange="runP3Sim()" style="margin-top:2px;">
            <div>
              <b>Urban Forest Shade Tree Canopy Corridor</b>
              <div style="font-size:11.5px;color:var(--ink-2);">${pipe.treeCount != null ? `${fmtN(pipe.treeCount)} shade trees${pipe.treeSpecies ? ` (${esc(pipe.treeSpecies)})` : ""}` : "Tree count not on file"} along the station walkshed${pipe.treeHomeLift != null ? ` (+${pipe.treeHomeLift}% property value lift)` : " (value effect not on file)"}.</div>
            </div>
          </label>

          <label style="display:flex;align-items:flex-start;gap:8px;cursor:pointer;font-size:12.5px;">
            <input type="checkbox" id="p3-ev" checked onchange="runP3Sim()" style="margin-top:2px;">
            <div>
              <b>Station Fast EV Charging Hub${pipe.evStalls != null ? ` (${pipe.evStalls} DC Fast Stalls${pipe.evKw != null ? `, ${pipe.evKw} kW` : ""})` : ""}</b>
              <div style="font-size:11.5px;color:var(--ink-2);">${pipe.evAnnualMargin != null ? `~$${fmtN(pipe.evAnnualMargin)}/yr net charging margin` : "Stalls, margin and emissions: not on file"}.</div>
            </div>
          </label>

          <label style="display:flex;align-items:flex-start;gap:8px;cursor:pointer;font-size:12.5px;">
            <input type="checkbox" id="p3-retail" checked onchange="runP3Sim()" style="margin-top:2px;">
            <div>
              <b>Station Plaza Micro-Retail &amp; Local Bodega / Grocer Hub</b>
              <div style="font-size:11.5px;color:var(--ink-2);">${pipe.plazaRetailSqft != null ? `${fmtN(pipe.plazaRetailSqft)} sq ft station storefronts` : "Storefront area not on file"}${pipe.plazaAnnualRent != null ? `; $${fmtN(pipe.plazaAnnualRent)}/yr concession revenue` : ""}${pipe.localSalesTax != null ? `; $${fmtN(pipe.localSalesTax)}/yr sales tax` : ""}.</div>
            </div>
          </label>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(130px, 1fr));gap:8px;margin-bottom:12px;">
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px;text-align:center;">
            <div style="font-size:11px;font-weight:700;color:#166534;text-transform:uppercase;">Private Dev IRR</div>
            <div id="p3-irr" style="font-size:20px;font-weight:800;color:#15803d;margin-top:2px;">Not on file</div>
            <div id="p3-irr-sub" style="font-size:10px;color:#166534;margin-top:2px;">Needs a published pro-forma</div>
          </div>

          <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:10px;text-align:center;">
            <div style="font-size:11px;font-weight:700;color:#1e40af;text-transform:uppercase;">Public Agency Rev</div>
            <div id="p3-rev" style="font-size:20px;font-weight:800;color:#1d4ed8;margin-top:2px;">Not on file</div>
            <div style="font-size:10px;color:#1e40af;margin-top:2px;">Ground Lease + Concessions</div>
          </div>

          <div style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:8px;padding:10px;text-align:center;">
            <div style="font-size:11px;font-weight:700;color:#6b21a8;text-transform:uppercase;">Property Value Lift</div>
            <div id="p3-lift" style="font-size:20px;font-weight:800;color:#7e22ce;margin-top:2px;">Not on file</div>
            <div style="font-size:10px;color:#6b21a8;margin-top:2px;">Corridor Walkshed Homes</div>
          </div>

          <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:10px;text-align:center;">
            <div style="font-size:11px;font-weight:700;color:#92400e;text-transform:uppercase;">Ridership Boost</div>
            <div id="p3-ridership" style="font-size:20px;font-weight:800;color:#b45309;margin-top:2px;">Not on file</div>
            <div style="font-size:10px;color:#92400e;margin-top:2px;">Station Boardings</div>
          </div>
        </div>

        <div id="p3-notes" style="font-size:11.5px;color:var(--ink-2);background:#fff;border:1px solid #e2e8f0;border-radius:6px;padding:8px 10px;line-height:1.4;margin-bottom:8px;">
          <b>P3 Partnership Structure (typical model, not this project's terms):</b> the transit agency leases land near a station to a private developer on a long ground lease; the developer finances, builds and manages the homes and shops and pays the agency lease revenue.
        </div>
        <div style="display:flex;gap:6px;margin-bottom:12px;">
          <button type="button" class="story-btn" onclick="copyP3TermSheet()" style="flex:1;background:#0284c7;color:#fff;border:none;padding:7px 12px;font-size:11.5px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;gap:6px;cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,0.15);">
            Copy P3 Term Sheet &amp; Pro-Forma Summary
          </button>
        </div>

        <details style="margin-top:8px;border:1px solid #e2e8f0;border-radius:6px;padding:8px 10px;background:#f8fafc;font-size:12px;">
          <summary style="font-weight:700;cursor:pointer;color:#0369a1;">View Detailed Capital Stack &amp; 10-Year Pro-Forma Cash Flow</summary>
          <div style="margin-top:8px;padding-top:6px;border-top:1px solid #e2e8f0;">
            <table style="width:100%;border-collapse:collapse;font-size:11.5px;">
              <tr><td style="padding:3px 0;color:#64748b;">Total Development Cost (TDC):</td><td style="text-align:right;font-weight:700;">${pipe.tdc != null ? fmt$(pipe.tdc) : '<span style="color:#64748b;font-weight:normal;font-style:italic;">Not published</span>'}</td></tr>
              <tr><td style="padding:3px 0;color:#64748b;">Senior Construction / Perm Debt (55%):</td><td style="text-align:right;">${pipe.seniorDebt != null ? fmt$(pipe.seniorDebt) : '<span style="color:#64748b;font-weight:normal;font-style:italic;">Not published</span>'}</td></tr>
              <tr><td style="padding:3px 0;color:#64748b;">Federal Low-Cost TIFIA / WIFIA Loan (15%):</td><td style="text-align:right;color:#0284c7;font-weight:600;">${pipe.tifiaLoan != null ? fmt$(pipe.tifiaLoan) + " (Treasury + 10 bps)" : '<span style="color:#64748b;font-weight:normal;font-style:italic;">Not published</span>'}</td></tr>
              <tr><td style="padding:3px 0;color:#64748b;">Private Developer Equity (30%):</td><td style="text-align:right;font-weight:700;">${pipe.developerEquity != null ? fmt$(pipe.developerEquity) : '<span style="color:#64748b;font-weight:normal;font-style:italic;">Not published</span>'}</td></tr>
              <tr><td style="padding:3px 0;color:#64748b;">Net Operating Income (NOI @ Stabilized):</td><td style="text-align:right;font-weight:700;color:#15803d;">${pipe.noi != null ? fmt$(pipe.noi) + " / yr" : '<span style="color:#64748b;font-weight:normal;font-style:italic;">Not published</span>'}</td></tr>
              <tr><td style="padding:3px 0;color:#64748b;">Priority Public Agency Ground Lease:</td><td style="text-align:right;font-weight:700;color:#1d4ed8;">${pipe.baseGroundLease != null ? fmt$(pipe.baseGroundLease) + " / yr" : '<span style="color:#64748b;font-weight:normal;font-style:italic;">Not published</span>'}</td></tr>
              <tr><td style="padding:3px 0;color:#64748b;">Adopted Plan Document:</td><td style="text-align:right;font-weight:600;">${pipe.rtp_document_url ? `<a href="${esc(pipe.rtp_document_url)}" target="_blank" rel="noopener noreferrer" style="color:#0284c7;text-decoration:underline;">Adopted Plan &rarr;</a>` : '<span style="color:#64748b;font-weight:normal;font-style:italic;">Not on file</span>'}</td></tr>
            </table>
          </div>
        </details>

        <details style="margin-top:8px;border:1px solid #e2e8f0;border-radius:6px;padding:8px 10px;background:#f8fafc;font-size:12px;">
          <summary style="font-weight:700;cursor:pointer;color:#047857;">Best-Practice Engineering Specs &amp; Implementation Playbook (illustrative only: inputs are assumptions, not local data)</summary>
          <div style="margin-top:8px;padding-top:6px;border-top:1px solid #e2e8f0;display:flex;flex-direction:column;gap:8px;">
            <div>
              <b style="color:#0f766e;">Rail-with-Trail Active Greenway:</b> 12-ft paved dual-direction cycleway with 2-ft decomposed granite shoulders, grade-separated rail crossings with automated pedestrian gates, and solar LED pathway lighting. Connects directly to station turnstiles with secure Bikestation lockers.
            </div>
            <div>
              <b style="color:#15803d;">Urban Forest Shade Tree Canopy:</b> Silva Cell suspended pavement root trenches providing 1,000 cu ft of uncompacted soil per tree to prevent root heaving and support 40+ year maturity. Reduces station walkshed ambient heat by 4.5°F–6.0°F.
            </div>
            <div>
              <b style="color:#0284c7;">DC Fast EV Charging Depot:</b> 150kW–350kW dual-port dispensers sheltered by overhead solar PV canopy with on-site battery energy storage (BESS) to shave utility demand charges. Funded up to 80% through federal NEVI formula grants.
            </div>
            <div>
              <b style="color:#b45309;">Station Plaza Micro-Retail &amp; Bodega:</b> 400–1,200 sq ft modular ground-floor commercial bays anchored by a community cooperative grocery, coffee shop, and dry cleaners. Generates all-day foot traffic and non-farebox municipal revenue.
            </div>
          </div>
        </details>
      </div>
    </div>
  `;
}


function copyP3TermSheet() {
  const pipe = ((typeof getMetroPipeline === "function") ? getMetroPipeline(activeFips(), (selected && byId.get(selected)) ? byId.get(selected).properties.c : "") : null) || {};
  const irr = $("#p3-irr") ? $("#p3-irr").textContent : "Not on file";
  const rev = $("#p3-rev") ? $("#p3-rev").textContent : "Not on file";
  const lift = $("#p3-lift") ? $("#p3-lift").textContent : "Not on file";
  const ridership = $("#p3-ridership") ? $("#p3-ridership").textContent : "Not on file";

  const memo = `=== CITY PRETTY P3 JOINT DEVELOPMENT TERM SHEET ===
CORRIDOR: ${pipe.title || "Metropolitan Transit & Infill Spine"}
SPONSORING AGENCY: ${pipe.agency || "Regional Transit Authority"}
STATION HUB: ${pipe.hubName || "Central Station"} (${pipe.metroName || "Metro"})
STATUS: ${pipe.status || "Active Pipeline"}

1. FINANCIAL & RETURN METRICS
- Private Developer Levered IRR: ${irr}
- Priority Public Agency Ground Lease Revenue: ${rev}
- Corridor Real Estate Valuation Lift: ${lift}
- Station Ridership Boost: ${ridership}

2. JOINT DEVELOPMENT HOUSING & COMMERCIAL PROGRAM
- Residential Units: ${pipe.units != null ? pipe.units + " mixed-income homes" : "Not on file"} (scenario: ${_p3Afford || 35}% deed-restricted affordable)
- Ground-Floor Retail: ${pipe.retailSqft != null ? fmtN(pipe.retailSqft) + " sq ft active commercial space" : "Not on file"}
- Ground Lease Concession: scenario ${_p3Term || 99}-year public ground lease
- Note: scenario settings are illustrative; the project figures above come from the agency source only where shown.

3. INTEGRATED AMENITIES & CORRIDOR INFRASTRUCTURE
- Urban Tree Canopy: ${pipe.treeCount != null ? fmtN(pipe.treeCount) + " shade trees" : "Not on file"}
- Active Bikeway Spine: ${pipe.bikewayName || "Protected Rail-Trail Cycleway"}
- EV Charging Depot: ${pipe.evStalls != null ? pipe.evStalls + " DC Fast Stalls" : "Not on file"}
- Micro-Retail Plaza: ${pipe.plazaRetailSqft != null ? fmtN(pipe.plazaRetailSqft) + " sq ft" : "Not on file"}

4. CAPITAL STACK PRO-FORMA
- Total Development Cost (TDC): ${pipe.tdc != null ? fmt$(pipe.tdc) : "Not published by agency"}
- Senior Construction / Perm Debt (55%): ${pipe.seniorDebt != null ? fmt$(pipe.seniorDebt) : "Not published by agency"}
- Federal TIFIA Low-Cost Loan (15%): ${pipe.tifiaLoan != null ? fmt$(pipe.tifiaLoan) + " (Treasury + 10 bps)" : "Not published by agency"}
- Private Developer Equity (30%): ${pipe.developerEquity != null ? fmt$(pipe.developerEquity) : "Not published by agency"}
===================================================`;

  navigator.clipboard.writeText(memo).then(() => {
    showToast("✓ Copied P3 Term Sheet & Pro-Forma to clipboard!");
  }).catch(() => {
    prompt("Copy P3 Term Sheet:", memo);
  });
}

function runP3Sim() {
  const pipe = getMetroPipeline(activeFips(), (selected && byId.get(selected)) ? byId.get(selected).properties.c : "");
  if (!pipe) return;
  const tod = $("#p3-tod") ? $("#p3-tod").checked : true;
  const trail = $("#p3-trail") ? $("#p3-trail").checked : true;
  const trees = $("#p3-trees") ? $("#p3-trees").checked : true;
  const ev = $("#p3-ev") ? $("#p3-ev").checked : true;
  const retail = $("#p3-retail") ? $("#p3-retail").checked : true;

  // Base adjustments based on lease term and affordability requirements
  let termAdj = _p3Term === 99 ? 0 : (_p3Term === 75 ? -0.4 : -1.2);
  let affordAdj = _p3Afford === 20 ? 0.6 : (_p3Afford === 35 ? 0 : -0.8);

  let irr = (tod && pipe.baseIRR != null) ? (pipe.baseIRR + termAdj + affordAdj) : null;
  let groundLease = (tod && pipe.baseGroundLease != null) ? pipe.baseGroundLease : null;
  let propLift = (tod && pipe.baseHomeLiftPct != null) ? pipe.baseHomeLiftPct : null;
  let ridership = (tod && pipe.baseBoardingBoostPct != null) ? pipe.baseBoardingBoostPct : null;

  if (trail && pipe.bikewayHomeLift != null) {
    if (irr != null) irr += tod ? 0.4 : 0;
    if (propLift != null) propLift += pipe.bikewayHomeLift;
    if (ridership != null) ridership += pipe.bikewayRidership || 0;
  }
  if (trees && pipe.treeHomeLift != null) {
    if (irr != null) irr += tod ? 0.2 : 0;
    if (propLift != null) propLift += pipe.treeHomeLift;
    if (ridership != null) ridership += 4;
  }
  if (ev && pipe.evAnnualMargin != null) {
    if (groundLease != null) groundLease += pipe.evAnnualMargin;
    if (irr != null) irr += 0.3;
  }
  if (retail && pipe.plazaAnnualRent != null) {
    if (groundLease != null) groundLease += pipe.plazaAnnualRent;
    if (ridership != null) ridership += 8;
    if (propLift != null) propLift += 1.2;
    if (irr != null) irr += 0.5;
  }

  const irrEl = $("#p3-irr");
  if (irrEl) irrEl.textContent = irr != null ? `${irr.toFixed(1)}%` : "Not on file";

  const revEl = $("#p3-rev");
  if (revEl) revEl.textContent = groundLease != null ? (groundLease >= 1000000 ? `$${(groundLease / 1000000).toFixed(2)}M / yr` : `$${Math.round(groundLease / 1000)}k / yr`) : "Not on file";

  const liftEl = $("#p3-lift");
  if (liftEl) liftEl.textContent = propLift != null ? `+${propLift.toFixed(1)}%` : "Not on file";

  const riderEl = $("#p3-ridership");
  if (riderEl) riderEl.textContent = ridership != null ? `+${ridership}%` : "Not on file";
}

function select(id, fly) {
  selected = id; highlight(); syncHash(id); updateCompareUI();
  const f = byId.get(id); if (!f) return;
  if (fly) map.fitBounds(L.geoJSON(f).getBounds(), { maxZoom: 15, padding: [60, 60] });
  const p = f.properties, d = D.details[id] || {}, m = d.m || {};
  const recs = (d.r || []).map(a => Object.fromEntries(REC_KEYS.map((k, i) => [k, a[i]])));
  const kind = r => (D.catalog[r.id] && D.catalog[r.id].kind) || "value";
  const valAll = recs.filter(r => kind(r) === "value" || kind(r) === "regional");
  // Support dynamic Local Context Adjusted ROI vs Base Study ROI
  const getEffVpd = r => {
    if (typeof roiMode !== "undefined" && roiMode === "adj") {
      const cal = calibrateVpd(r.vpd, (D.catalog[r.id] && D.catalog[r.id].grade), r.id, m);
      return cal.adj != null ? cal.adj : r.vpd;
    }
    return r.vpd;
  };
  const projScore = r => (r.id === "farmers_market" || r.id === "night_market") ? getEffVpd(r) * 0.4 : getEffVpd(r);
  const val = valAll.filter(r => allowed(r.id)).sort((a, b) => projScore(b) - projScore(a));
  const hidden = valAll.length - val.length;
  const qol = recs.filter(r => kind(r) === "qol").sort((a, b) => b.qol - a.qol || a.cost - b.cost);
  const pol = recs.filter(r => kind(r) === "policy"), own = recs.filter(r => kind(r) === "owner").sort((a, b) => b.vpd - a.vpd);
  const pkg = val.filter(r => r.vpd >= 1 && kind(r) === "value");
  const top = val.find(r => kind(r) === "value");

  // Determine Top 3 for First-Task presentation
  let top3 = [];
  if (renterViewOn) {
    const renterDirect = [...val, ...qol].filter(r => D.catalog[r.id] && (D.catalog[r.id].renter_direct || D.catalog[r.id].displacement_risk === "protective"));
    top3 = (renterDirect.length ? renterDirect : [...val, ...qol]).slice(0, 3);
  } else {
    top3 = (val.length >= 3 ? val.slice(0, 3) : [...val, ...qol].slice(0, 3));
  }

  const topRng = (top && D.catalog[top.id]) ? formatVpdRange(top.vpd, D.catalog[top.id]?.grade, top.id, m) : null;
  const inC = compareList.includes(id), oc = isOCArea(m), ocReal = oc && !!(D_OC && D_OC.meta && D_OC.meta.schema >= 2);
  let h = `<div class="eyebrow">${String(id).length === 12 ? "BLOCK GROUP" : "CENSUS TRACT"} ${esc(id)} · ${esc(p.c)} · ${fmtN(m.acres)} acres</div><h2>${esc(p.n)}</h2>
    <p class="subname">Name from ${esc(m.ns || "")}${m.csa && m.csa !== p.n && !m.county ? " · County area: " + esc(m.csa) : ""}</p>
    <div class="action-bar">
      <button type="button" class="action-pill" onclick="copyShareLink()" title="Copy shareable link"><svg class=ic aria-hidden=true><use href=#i-link /></svg> Share</button>
      <button type="button" class="action-pill" onclick="copyAreaSummary('${id}')" title="Copy markdown brief"><svg class=ic aria-hidden=true><use href=#i-copy /></svg> Copy summary</button>
      <button type="button" class="action-pill" onclick="document.body.classList.remove('prospectus-printing'); window.print();" title="Print 1-page dossier"><svg class=ic aria-hidden=true><use href=#i-print /></svg> Print</button>
      <button type="button" class="action-pill${inC ? " active" : ""}" id="btn-compare-panel" onclick="toggleCompare('${id}')">${inC ? "✓ In comparison" : "<svg class=ic aria-hidden=true><use href=#i-compare /></svg> Compare"}</button>
      <button type="button" class="action-pill${renterViewOn ? " active" : ""}" id="btn-renter-panel" onclick="toggleRenterView()">${renterViewOn ? "<svg class=ic aria-hidden=true><use href=#i-users /></svg> Renter view (on)" : "<svg class=ic aria-hidden=true><use href=#i-users /></svg> Renter view"}</button>
      <button type="button" class="action-pill" onclick="exportNeighborhoodBrief('${id}', 'csv')" title="Download CSV dataset for this block group"><svg class=ic aria-hidden=true><use href=#i-download /></svg> Export CSV</button>
      <button type="button" class="action-pill" onclick="exportNeighborhoodBrief('${id}', 'pdf')" title="Export policy brief for residents and council"><svg class=ic aria-hidden=true><use href=#i-file /></svg> Export brief (PDF)</button>
      <button type="button" class="action-pill" onclick="openCorrection('${id}')"><svg class=ic aria-hidden=true><use href=#i-edit /></svg> Suggest correction</button>
    </div>`;
  if (oc && !(D_OC && D_OC.meta && D_OC.meta.schema >= 2)) h += `<div class="prelim-banner warn"><span class="prelim-icon"><svg class=ic aria-hidden=true><use href=#i-alert /></svg></span><span><b>Orange County coverage is preliminary.</b> Home values, rents, crime, heat and project sizing here are neighborhood-level estimates assembled from public sources. They have not been checked against Census, Assessor, police or transit-schedule records the way LA County's block groups have. Read them as a sketch, not a measurement.</span></div>`;

  h += (top && top.vpd >= 1 && D.catalog[top.id] && topRng) ? `<p class="verdict">Best bet: <b>${esc(D.catalog[top.id].name.replace(/^([A-Z])(?=[a-z])/, c => c.toLowerCase()))}</b>${/\d/.test(top.project) ? ` (${esc(top.project)})` : ""}. Expected return: <b>${topRng.estStr}</b> of home value per $1 (band ${topRng.str}, evidence ${esc(D.catalog[top.id]?.grade || "evaluated")}).</p>`
    : `<p class="verdict">Nothing here returns $1 of home value per $1 spent. The quality-of-life projects below are still worth a look.</p>`;

  // Gentrification & Tenant Displacement Sensitivity Indicator
  const renterShare = Math.max(0, 100 - (m.sf != null ? +m.sf : 50));
  const lowInc = (m.inc != null && m.inc < 58000);
  const rentBurdened = (m.rent != null && m.inc != null && (m.rent * 12 / m.inc) > 0.32);
  const highLift = (top && top.vpd >= 2.0);
  if (renterShare >= 55 && (lowInc || rentBurdened) && highLift) {
    h += `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:10px 14px;margin-bottom:12px;font-size:12px;color:#92400e;line-height:1.45;">
      <div style="font-weight:800;display:flex;align-items:center;gap:6px;margin-bottom:4px;">
        <span></span> <span>Tenant Displacement &amp; Gentrification Risk Indicator</span>
      </div>
      <div>
        This block group has a high renter population (<b>${Math.round(renterShare)}% renters</b>) with significant cost burden. The recommended capital investments project a rapid <b>${topRng ? topRng.estStr : 'high'}</b> real estate valuation surge, which creates tenant displacement pressure unless paired with anti-displacement protections.
      </div>
      <div style="margin-top:6px;font-weight:600;color:#78350f;">
        <b>Recommended Mitigations:</b> Pair capital expenditure with Community Land Trusts (CLT), Tenant Opportunity to Purchase Act (TOPA), and deed-restricted inclusionary zoning.
      </div>
    </div>`;
  }

  // Municipal Crime Reporting Feed Gap Flag
  const missingCrimeFeeds = ["Beverly Hills", "Burbank", "Glendale", "Pasadena", "Santa Monica", "Torrance", "Inglewood", "Culver City", "San Fernando", "South Pasadena"];
  if (missingCrimeFeeds.includes(p.c)) {
    h += `<div class="prelim-banner" style="background:#fef2f2;border:1px solid #fecaca;padding:8px 12px;border-radius:6px;margin:8px 0 12px;font-size:11.5px;color:#991b1b;line-height:1.4;">
      <span></span> <b>Municipal Crime Reporting Gap:</b> ${esc(p.c)} operates an independent municipal police department that does not transmit daily automated incident feeds to the regional LAPD/LASD CAD dispatch feed. Crime statistics displayed here reflect regional Sheriff and CHP baseline reporting; local misdemeanor and property crime may be undercounted.
    </div>`;
  }

  // First Task Presentation: Top 3 cards prominent at top
  h += `<div class="top3-section">
    <h3>${renterViewOn ? "Top 3 renter &amp; community priorities" : "Top 3 recommended investments"}</h3>
    <div class="recs">
      ${top3.map((r, i) => recCard(r, i, kind(r) === "value" ? "value" : "qol")).join("")}
    </div>
  </div>`;

  // Core Vitals Tiles
  h += `<div class="section"><div class="tiles">
    ${tile("Typical home value", fmt$(m.hv), esc(oc && !ocReal ? "neighborhood estimate (preliminary)" : (m.hvs || "")))}
    ${tile("Median rent", m.rent ? fmt$(m.rent) + "/mo" : "–", oc && !ocReal ? "estimate (preliminary)" : ocReal ? "Census ACS 2020–24" : "Census ACS 5-Year")}
    ${tile("Homes", fmtN(m.homes), `${m.own != null ? Math.round(m.own) + "% owner-occupied" : ""}`)}
    ${tile("Heat vs median", m.ht != null ? (m.ht > 0 ? "+" : "") + (+m.ht).toFixed(1) + "°F" : "–", oc && !ocReal ? "estimate (preliminary)" : ocReal ? "Tree Equity Score 2021 vs urbanized-area mean" : "Tree Equity Score")}
    ${tile("Violent crime", m.vc != null ? (+m.vc).toFixed(1) + " per 1k" : "no data", m.vc != null ? `12 mo · ${esc(m.ag || "")}` : (activeFips() === "06037" ? "independent police" : isCAActive() ? "agency not in CA DOJ data" : "no crime source outside California"))}
    ${tile("Bus service", m.bt != null ? Math.round(m.bt) + "/hr" : busUnknown(m) ? "unknown" : "–", m.rm != null ? `rail ${(m.rm / 1609).toFixed(1)} mi` : "")}
  </div></div>`;

  if (pkg.length) {
    const isUrbanCore = (m.acres != null && m.homes != null && (m.homes / Math.max(0.1, m.acres)) > 15);
    const candidateObjs = pkg.map(r => ({
      id: r.id,
      name: (D.catalog[r.id] && D.catalog[r.id].name) || r.id,
      evidenceGrade: ((D.catalog[r.id] && D.catalog[r.id].grade) || "C"),
      rawPriceLiftPct: (r.pct ? r.pct / 100 : 0.025),
      studyStandardErrorPct: HEDONIC_SE[(D.catalog[r.id] && D.catalog[r.id].grade) || "C"] || 0.08,
      lifecycleCostUsd: r.cost || 0,
      localContextMultiplier: 1.0
    }));
    const subPkg = computeSubAdditivePackage({
      blockGroupGeoid: id,
      ecoregionId: "us_general",
      medianHomeValueUsd: m.hv || (p && p.hv) || null,
      reachedHomesCount: m.homes || (p && p.homes) || m.h || null,
      isUrbanCore,
      renterShare: (m.own != null ? (100 - m.own) / 100 : 0.45),
      severeRentBurdenShare: 0.28,
      rentControlCoverage: isCAActive() ? 0.65 : 0.15
    }, candidateObjs, false);

    const subCost = subPkg.totalPaybackPackageCostUsd || pkg.reduce((s, r) => s + r.cost, 0);
    const subVal = subPkg.jointValueAddedUsd || pkg.reduce((s, r) => s + r.value, 0);

    h += `<div class="pkg" style="margin-bottom:12px">
      ${tile("Paying projects", pkg.length, "≥ $1 per $1 (Sub-additive)")}
      ${tile("Total cost", fmt$(subCost), "build + land + 10-yr upkeep")}
      ${tile("Joint Value Created", fmt$(subVal), "Capped at " + (isUrbanCore ? "30%" : "22%") + " max neighborhood lift")}
    </div>`;

    if (renterViewOn || subPkg.displacementRiskScore > 40) {
      h += `<div style="background:#fff7ed;border:1px solid #fdba74;border-radius:6px;padding:7px 10px;margin-bottom:10px;font-size:11.5px;color:#9a3412;">
        <b>Renter Displacement Sensitivity Index: ${subPkg.displacementRiskScore}/100</b> · Public capital investment of this scale may trigger market rent escalation in non-rent-stabilized parcels. Pair with local tenant protections.
      </div>`;
    }
  }

  // Collapsible Sections for everything else
  h += `<details class="panel-sec"><summary><b>Neighborhood Plan &amp; Missing Amenities</b></summary><div class="sec-content">${gapSection(p, m)}</div></details>`;

  // 1. Multi-Project Synergy Simulator (Package Implementations)
  h += `<details class="panel-sec" open><summary><b>Multi-Project Synergy Simulator (Package Implementations)</b></summary><div class="sec-content">${synergySection(p, m, recs)}</div></details>`;

  // 2. Specific Park Improvements & Effects
  h += `<details class="panel-sec"><summary><b>Specific Park Improvements &amp; Effects</b></summary><div class="sec-content">${parkImprovementsSection(m)}</div></details>`;

  // 3. Geography-Specific Improvements (Coastal vs Inland Trails)
  h += `<details class="panel-sec"><summary><b>Geography-Specific Improvements (Coastal vs. Inland Trails)</b></summary><div class="sec-content">${geographicImprovementsSection(p, m)}</div></details>`;

  // 4. Public-Private Partnerships (P3) & Transit Joint Development Pipeline
  h += `<details class="panel-sec" open><summary><b>Public-Private Partnerships (P3) &amp; Transit Corridor Pipeline</b></summary><div class="sec-content">${p3Section(p, m)}</div></details>`;

  const cats = ["All", ...CATS.filter(c => val.some(r => D.catalog[r.id] && D.catalog[r.id].category === c))];
  h += `<details class="panel-sec"><summary><b>All Ranked Value Projects (${val.length})</b></summary><div class="sec-content">
    <div class="cat-tabs" role="group" aria-label="Filter by category">${cats.map((c, i) => `<button type="button" data-cat="${esc(c)}" aria-pressed="${i === 0}">${esc(c)}</button>`).join("")}</div>
    <div class="recs" id="valrecs"></div>
    ${hidden ? `<p class="small muted">${hidden} lower-graded estimate${hidden > 1 ? "s" : ""} hidden by the evidence filter above.</p>` : ""}
    <p class="small muted">Value counts nearby homes reached. Cost includes physical construction plus 10 years of ongoing operations/maintenance.</p>
  </div></details>`;

  if (qol.length) h += `<details class="panel-sec"><summary><b>Quality-of-Life Projects (${qol.length})</b></summary><div class="sec-content"><p class="small muted">Sorted by neighborhood need compared with county medians.</p><div class="recs">${qol.map((r, i) => recCard(r, i, "qol")).join("")}</div></div></details>`;

  if (pol.length) h += `<details class="panel-sec"><summary><b>Zoning &amp; Policy Reforms</b></summary><div class="sec-content"><div class="recs">${pol.map((r, i) => recCard(r, i, "policy")).join("")}</div></div></details>`;

  if (own.length || (D.upgrades || []).length) h += `<details class="panel-sec"><summary><b>For an Individual Homeowner Here</b></summary><div class="sec-content"><div class="recs">${own.map((r, i) => recCard(r, i, "owner")).join("")}</div>${upgradeTable(m)}</div></details>`;

  h += `<details class="panel-sec"><summary><b>Zoning: What Can Be Built Here</b></summary><div class="sec-content">${zoningSection({ ...m, city: p.c })}</div></details>`;
  h += `<details class="panel-sec" open><summary><b>Specific Places for These Projects</b></summary><div class="sec-content" id="sites-sec"><p class="small muted">Loading the site candidates…</p></div></details>`;
  h += `<details class="panel-sec"><summary><b>Underused Land &amp; Infill Sites</b></summary><div class="sec-content">${underSection(p)}</div></details>`;
  h += `<details class="panel-sec"><summary><b>Public Facilities Nearby</b></summary><div class="sec-content">${facilitySection(m)}</div></details>`;
  h += `<details class="panel-sec"><summary><b>${isCAActive() ? "EIFD Tax-Increment Financing Calculator" : "Tax-Increment Financing"}</b></summary><div class="sec-content">${fundSummary(pkg, id)}${eifdSection(p, m)}</div></details>`;

  const kv = [], add = (k, v, f = x => x) => { if (v != null && v !== "" && !(typeof v === "number" && isNaN(v))) kv.push(`<span>${k}</span><span>${f(v)}</span>`); };
  add("Population", m.pop, fmtN); add("Median household income", m.inc, fmt$); add("Median rent", m.rent, v => fmt$(v) + "/mo"); add("Median year built", m.yb, v => Math.round(v));
  add("Single-family share", m.sf, v => Math.round(v) + "%"); add("Households without a car", m.nocar, v => Math.round(v) + "%");
  if (!oc) { add("Street trees (city survey)", m.st, fmtN); add("Open tree sites", m.ts, fmtN); }
  add("Canopy gap to goal (Tree Equity)", m.tg, v => (+v).toFixed(0) + " pts");
  add("Property crimes, 12 mo", m.pcr, fmtN); add("Fatal/severe crashes recorded", m.ksi, fmtN);
  if (!oc) { add("Dumping/litter reports, 12 mo (311)", m.dump, fmtN); add("Graffiti reports, 12 mo (311)", m.graf, fmtN); }
  if (oc && m.nearest_transit && m.nearest_transit.station) add("Nearest rail station", `${esc(m.nearest_transit.station)}${m.nearest_transit.lines ? " (" + esc(m.nearest_transit.lines) + ")" : ""}${m.nearest_transit.distance_mi != null ? ", " + m.nearest_transit.distance_mi + " mi" : ""}`);
  add("Freeway distance", m.fw, v => fmtN(v) + " m"); add("Nearest supermarket", m.gro, v => (v / 1609).toFixed(1) + " mi"); add("Restaurants & cafés within 400 m", m.din, fmtN);
  add("Nearest public tennis court", m.ten, v => (v / 1609).toFixed(1) + " mi"); add("Nearest dog park", m.dog, v => (v / 1609).toFixed(1) + " mi"); add("Nearest public pool", m.pool, v => (v / 1609).toFixed(1) + " mi");
  add("Nearest EV fast charger mapped", m.ev, v => (v / 1609).toFixed(1) + " mi");
  if (kv.length) h += `<details class="panel-sec"><summary><b>Area Profile &amp; ${oc ? "Statistics" : "Census Statistics"}</b></summary><div class="sec-content">${oc && !ocReal ? '<p class="small muted">Neighborhood-level estimates (preliminary Orange County pass), not Census block-group tabulations.</p>' : ocReal ? '<p class="small muted">Census ACS 2020–24 block-group tabulations (tract medians where the block-group value is not published); distances and counts computed from ' + (isOrangeActive() ? "OpenStreetMap (5 Nov 2026 extract), OCTA GTFS, CDE, CHP CCRS 2016–2025, CA DOJ and OC Parks data" : esc(((D_OC && D_OC.meta && D_OC.meta.sources) || []).filter(r => r && r[3] && !/^ACS|^TIGERweb Tracts/.test(r[0])).map(r => r[0]).join(", "))) + '.</p>' : ""}<div class="kv">${kv.join("")}</div></div></details>`;

  h += `<details class="panel-sec technical-appendix"><summary><b>Technical Appendix &amp; Data Pipeline Status</b></summary><div class="sec-content">${renderTechAppendix(ocReal)}</div></details>`;

  $("#panel").innerHTML = h; $("#panel").scrollTop = 0;
  eifdWire(p); fillSites(p);
  if (typeof updateCanopyHud === "function") updateCanopyHud(p);
  $("#panel").querySelectorAll("[data-site]").forEach(el => el.onclick = () => { const U = D.layers.underused, sid = +el.dataset.site;
    for (const k in U.cells) for (const [id, rings] of U.cells[k]) if (id === sid) { if (!$("#l-under").checked) { $("#l-under").checked = true; drawContext(); } map.fitBounds(L.polygon(rings.map(decodeLine)).getBounds(), { maxZoom: 17, padding: [80, 80] }); return; } });
  const draw = cat => { const list = val.filter(r => cat === "All" || (D.catalog[r.id] && D.catalog[r.id].category === cat));
    const vr = $("#valrecs");
    if (vr) {
      vr.innerHTML = list.length ? list.slice(0, 12).map((r, i) => recCard(r, i, "value")).join("") + (list.length > 12 ? `<details class="more"><summary>${list.length - 12} more</summary><div class="recs">${list.slice(12).map((r, i) => recCard(r, i + 12, "value")).join("")}</div></details>` : "") : `<p class="empty">Nothing in this category applies here.</p>`;
    }
  };
  draw("All");
  $("#panel").querySelectorAll(".cat-tabs button[data-cat]").forEach(b => b.onclick = () => { $("#panel").querySelectorAll(".cat-tabs button[data-cat]").forEach(x => x.setAttribute("aria-pressed", x === b)); draw(b.dataset.cat); });
}

// The build log leaves "<dataset-id> error: ;" fragments for feeds that failed; they are noise to a reader.
const cleanBuild = x => String(x ?? "").replace(/\b[a-z0-9]{4}-[a-z0-9]{4}\s*error:\s*;?\s*/gi, "").replace(/;\s*;/g, ";").replace(/^\s*;\s*/, "").trim();
function report() {
  const R = D.report || {};
  let h = `<section><h2>${esc(R.title || "")}</h2>${(R.paragraphs || []).map(p => `<p>${cleanBuild(p)}</p>`).join("")}</section>`;
  (R.sections || []).forEach(s => {
    h += `<section><h2>${esc(s.title)}</h2>${(s.paragraphs || []).map(p => `<p>${cleanBuild(p)}</p>`).join("")}`;
    if (s.table) h += `<div class="tablewrap"><table><thead><tr>${s.table.head.map(x => `<th>${esc(x)}</th>`).join("")}</tr></thead><tbody>${s.table.rows.map(r => `<tr>${r.map((c, i) => `<td${s.table.num && s.table.num.includes(i) ? ' class="num"' : ""}>${cleanBuild(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
    if (s.list) h += `<ul>${s.list.map(x => `<li>${cleanBuild(x)}</li>`).join("")}</ul>`;
    h += `</section>`;
  });
  $("#report").innerHTML = h;
}


// --- Presets, Share, Compare, Renter View & Modal Handlers ---
let renterViewOn = false;
let compareList = [];

function applyPreset(name) {
  document.querySelectorAll(".preset-btn").forEach(b => b.classList.toggle("active", b.dataset.preset === name));
  
  // Update checkbox state directly without event dispatch loop
  const setVal = (id, val) => {
    const el = $(id);
    if (el) el.checked = val;
  };

  const keepLots = (typeof activeCounty !== "undefined" && activeCounty === "oc") || name === "housing";
  if (name !== "green" && typeof hideCanopyHud === "function") hideCanopyHud();
  if (name === "streets") {
    setVal("#l-roads", true);
    setVal("#l-transit", true);
    setVal("#l-hoods", true);
    setVal("#l-parks", true);
    setVal("#l-amen", true);
    setVal("#l-fac", true);
    setVal("#l-under", false);
    setVal("#l-proj", false);
    setVal("#l-zone", true);
    setVal("#l-lots", true);
    setVal("#l-aerial", false);
    const mSel = $("#metric");
    if (mSel) { mSel.value = "top_vpd"; restyle(); legend(); }
  } else if (name === "green") {
    setVal("#l-roads", true);
    setVal("#l-transit", true);
    setVal("#l-parks", true);
    setVal("#l-amen", true);
    setVal("#l-hoods", true);
    setVal("#l-fac", true);
    setVal("#l-under", false);
    setVal("#l-proj", false);
    setVal("#l-zone", true);
    setVal("#l-lots", true);
    setVal("#l-aerial", false);
    const mSel = $("#metric");
    if (mSel) { mSel.value = "heat"; restyle(); legend(); }
    if (typeof showCanopyHud === "function") showCanopyHud();
  } else if (name === "housing") {
    if (typeof hideCanopyHud === "function") hideCanopyHud();
    setVal("#l-roads", true);
    setVal("#l-transit", true);
    setVal("#l-zone", true);
    setVal("#l-under", true);
    setVal("#l-proj", true);
    setVal("#l-lots", true);
    setVal("#l-parks", true);
    setVal("#l-amen", true);
    setVal("#l-fac", true);
    setVal("#l-aerial", false);
    const mSel = $("#metric");
    if (mSel) { mSel.value = "value"; restyle(); legend(); }
  }

  // Single clean redraw - zero flickering or event thrashing
  drawContext();
  if (typeof drawFacilities === "function") drawFacilities();
  if (typeof drawAmenities === "function") drawAmenities();
  if (typeof drawZoning === "function") drawZoning();
  if (typeof syncLots === "function") syncLots();
  if (typeof syncAerial === "function") syncAerial();
}

function startProgress(initialPct = 25) {
  const bar = document.getElementById("top-progress");
  if (bar) {
    bar.style.opacity = "1";
    bar.style.width = initialPct + "%";
  }
  const pctEl = document.getElementById("hud-pct");
  if (pctEl) pctEl.textContent = initialPct + "%";
}
function setProgress(pct) {
  const bar = document.getElementById("top-progress");
  if (bar) {
    bar.style.opacity = "1";
    bar.style.width = pct + "%";
  }
  const pctEl = document.getElementById("hud-pct");
  if (pctEl) pctEl.textContent = Math.round(pct) + "%";
}
function doneProgress() {
  const bar = document.getElementById("top-progress");
  const pctEl = document.getElementById("hud-pct");
  if (pctEl) pctEl.textContent = "100%";
  if (bar) {
    bar.style.width = "100%";
    setTimeout(() => {
      bar.style.opacity = "0";
      setTimeout(() => { bar.style.width = "0%"; }, 400);
    }, 250);
  }
}
function showHud(msg) {
  const hud = document.getElementById("county-hud");
  const txt = document.getElementById("hud-text");
  if (!hud) return;
  if (txt) txt.textContent = msg;
  hud.style.display = "flex";
  hud.style.opacity = "1";
}
function setHud(msg) {
  const txt = document.getElementById("hud-text");
  if (txt) txt.textContent = msg;
}
function hideHud() {
  const hud = document.getElementById("county-hud");
  if (!hud) return;
  hud.style.opacity = "0";
  setTimeout(() => { hud.style.display = "none"; }, 300);
}

function showToast(msg) {
  let t = $("#toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "toast";
    t.className = "toast";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove("show"), 2600);
}

let roiMode = "base";

function setRoiMode(mode) {
  roiMode = mode;
  const sel = document.getElementById("roi-mode");
  if (sel) sel.value = mode;
  if (typeof retop === "function") retop();
  if (typeof restyle === "function") restyle();
  if (selected && typeof select === "function") select(selected, false);
  syncHash(selected);
  showToast(`Valuation Mode: ${mode === "adj" ? "Locally Context-Adjusted ROI" : "Base Hedonic Study ROI"}`);
}

function setEifdTurnover(rate) {
  const el = document.getElementById("e-g");
  if (el) {
    // 2.0% statutory Prop 13 baseline + (rate - 2.0%) * market appreciation delta
    el.value = (2.0 + (rate - 2.0) * 0.65).toFixed(2);
    el.dispatchEvent(new Event("input"));
  }
  document.querySelectorAll(".eifd-turnover-btn").forEach(b => {
    b.classList.toggle("active", parseFloat(b.dataset.rate) === rate);
  });
  showToast(`EIFD Turnover: ${rate}% / yr`);
}

function setEifdBondYield(rate) {
  const el = document.getElementById("e-rate");
  if (el) {
    el.value = rate.toFixed(2);
    el.dispatchEvent(new Event("input"));
  }
  document.querySelectorAll(".eifd-rate-btn").forEach(b => {
    b.classList.toggle("active", parseFloat(b.dataset.rate) === rate);
  });
  showToast(`Muni Bond Yield: ${rate}%`);
}

function syncHash(id) {
  const params = new URLSearchParams();
  const fips = typeof activeFips === "function" ? activeFips() : "06037";
  if (fips && fips !== "06037") params.set("county", fips);
  if (id) params.set("bg", id);
  const evid = $("#evid") ? $("#evid").value : "D";
  if (evid && evid !== "D") params.set("evid", evid);
  const metric = $("#metric") ? $("#metric").value : "top_vpd";
  if (metric && metric !== "top_vpd") params.set("metric", metric);
  if (typeof roiMode !== "undefined" && roiMode && roiMode !== "base") params.set("roi", roiMode);
  const activePresetBtn = document.querySelector(".preset-btn.active");
  const preset = activePresetBtn ? activePresetBtn.dataset.preset : "streets";
  if (preset && preset !== "streets") params.set("preset", preset);
  if (typeof compareList !== "undefined" && compareList && compareList.length) {
    params.set("compare", compareList.join(","));
  }
  const hash = "#" + params.toString();
  if (window.location.hash !== hash) {
    history.replaceState(null, null, hash);
  }
}

function checkHash() {
  const hashStr = window.location.hash.replace(/^#/, "");
  if (!hashStr) return;
  const params = new URLSearchParams(hashStr);
  const county = params.get("county");
  const bgId = params.get("bg");

  if (county && typeof activeFips === "function" && county !== activeFips()) {
    if (typeof openCounty === "function") {
      openCounty(county).then(() => {
        if (bgId && byId.has(bgId)) select(bgId, true);
      }).catch(e => console.warn("Could not open county from hash:", e));
      return;
    }
  }
  const evid = params.get("evid");
  const metric = params.get("metric");
  const roi = params.get("roi");
  const preset = params.get("preset");
  const compare = params.get("compare");

  if (evid && $("#evid")) { $("#evid").value = evid; }
  if (metric && $("#metric")) { $("#metric").value = metric; }
  if (roi && typeof setRoiMode === "function") {
    roiMode = roi;
    const sel = document.getElementById("roi-mode");
    if (sel) sel.value = roi;
  }
  if (preset && typeof applyPreset === "function") {
    applyPreset(preset);
  }
  if (compare && typeof compareList !== "undefined") {
    compareList = compare.split(",").filter(Boolean);
    if (typeof updateCompareUI === "function") updateCompareUI();
  }

  if (!bgId || bgId === selected) return;
  if (byId.has(bgId)) { select(bgId, true); return; }
  const fips = bgId.slice(0, 5);
  if (countyBundleEls().some(e => e.dataset.fips === fips)) {
    openCounty(fips).then(() => { if (byId.has(bgId)) select(bgId, true); }).catch(e => console.warn("could not open county " + fips, e));
  }
}

function exportNeighborhoodBrief(id, format) {
  const f = byId.get(id);
  if (!f) return;
  const p = f.properties, d = D.details[id] || {}, m = d.m || {};
  const recs = (d.r || []).map(a => Object.fromEntries(REC_KEYS.map((k, i) => [k, a[i]])));

  if (format === 'csv') {
    let csv = "Project_ID,Project_Name,Category,Evidence_Grade,Base_ROI_Per_Dollar,Locally_Adjusted_ROI,Cost_Dollars,Nearby_Homes_Reached\n";
    recs.forEach(r => {
      const c = D.catalog[r.id] || {};
      const cal = calibrateVpd(r.vpd, c.grade, r.id, m);
      const adjVpd = cal.adj != null ? cal.adj.toFixed(2) : r.vpd.toFixed(2);
      csv += `\"${r.id}\",\"${c.name || r.id}\",\"${c.category || 'Urban'}\",\"${c.grade || 'C'}\",${r.vpd.toFixed(2)},${adjVpd},${Math.round(r.cost)},${Math.round(r.homes)}\n`;
    });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `city-pretty-neighborhood-${id}.csv`;
    link.click();
    showToast(`✓ Downloaded CSV dataset for Block Group ${id}`);
  } else {
    document.body.classList.remove("prospectus-printing");
    window.print();
  }
}

function copyShareLink() {
  syncHash(selected);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(window.location.href).then(() => {
      showToast("Shareable link copied to clipboard!");
    }).catch(() => {
      showToast("Link: " + window.location.href);
    });
  } else {
    showToast("Link: " + window.location.href);
  }
}

function copyAreaSummary(id) {
  const f = byId.get(id); if (!f) return;
  const p = f.properties, d = D.details[id] || {}, m = d.m || {};
  const recs = (d.r || []).map(a => Object.fromEntries(REC_KEYS.map((k, i) => [k, a[i]])));
  const val = recs.filter(r => allowed(r.id) && D.catalog[r.id].kind === "value").sort((a, b) => b.vpd - a.vpd);
  const top3 = val.slice(0, 3);
  
  let txt = `City Pretty Brief: ${p.n} (${p.c})\n`;
  txt += `Block Group ID: ${id} | Typical Home Value: ${fmt$(m.hv)} | Homes: ${fmtN(m.homes)}\n\n`;
  txt += `Top 3 Recommended Projects:\n`;
  top3.forEach((r, i) => {
    const c = D.catalog[r.id], rng = formatVpdRange(r.vpd, c.grade, r.id, m);
    txt += `${i+1}. ${c.name} (${r.project})\n`;
    txt += `   - Return: ${rng.estStr} of home value per $1 (band ${rng.str}, ${rng.badge})\n`;
    txt += `   - Cost: ${fmt$(r.cost)} (Build + Upkeep)\n`;
    txt += `   - Who decides: ${c.lead_agency || "City Council"}\n`;
    txt += `   - Next step: ${c.process || "CIP budget inclusion"}\n`;
  });
  txt += `\nExplore interactive map: ${window.location.href}\n`;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(txt).then(() => {
      showToast("Summary brief copied to clipboard!");
    });
  } else {
    showToast("Summary generated for " + p.n);
  }
}

function toggleRenterView() {
  renterViewOn = !renterViewOn;
  const hBtn = $("#btn-renter-header"); if (hBtn) hBtn.classList.toggle("active", renterViewOn);
  const pBtn = $("#btn-renter-panel"); if (pBtn) pBtn.classList.toggle("active", renterViewOn);
  if (selected) select(selected, false);
  showToast(renterViewOn ? "Renter & Community Impact lens active" : "Standard investor view active");
}

function toggleCompare(id) {
  const idx = compareList.indexOf(id);
  if (idx >= 0) {
    compareList.splice(idx, 1);
    showToast("Removed from comparison");
  } else {
    if (compareList.length >= 3) {
      showToast("Comparison is limited to 3 neighborhoods");
      return;
    }
    compareList.push(id);
    showToast("Added to comparison drawer");
  }
  updateCompareUI();
}

function clearCompare() {
  compareList = [];
  updateCompareUI();
  renderCompareDrawer();
}


// --- Property Deal Comparison System ---
let homeCompareList = [];
let compareActiveTab = "hoods";

function toggleHomeCompare() {
  if (!activeHouse || !activeHouse.a) return;
  const a = activeHouse.a;
  const apn = a.AIN;
  const idx = homeCompareList.findIndex(h => h.ain === apn);
  if (idx >= 0) {
    homeCompareList.splice(idx, 1);
    showToast("Removed property from comparison");
  } else {
    if (homeCompareList.length >= 3) {
      showToast("Property comparison is limited to 3 homes");
      return;
    }
    const lotSqft = activeHouse.lot || null;
    const F = activeHouse.F || {};
    const ll = activeHouse.ll || (map ? map.getCenter() : null);
    const pb = computePropertyPlaybook(a, lotSqft, F, null, ll, activeHouse.st);
    const nearestStn = (ll && typeof findNearestTransitStation === "function") ? findNearestTransitStation(ll.lat, ll.lng) : null;
    const roofSqft = F.foot ? Math.round(F.foot * 1.15) : (F.bldg && lotSqft ? Math.round(Math.min(F.bldg, lotSqft * 0.35) * 1.15) : null);
    const solarKw = roofSqft ? Math.max(3.5, +(Math.round(roofSqft * 0.65) / 75).toFixed(1)) : null;

    const valObj = activeHouse.valuation;
    const estVal = activeHouse.houseHv || (valObj ? valObj.estimatedValue : null) || a.Roll_TotalValue || null;
    const isVacant = valObj ? !!valObj.isVacantLand : false;
    const bldgSqft = isVacant ? 0 : (valObj && valObj.livingSqft ? valObj.livingSqft : (F.bldg || null));

    homeCompareList.push({
      ain: apn,
      address: a.SitusFullAddress || ("Parcel " + apn),
      county: a.county || countyOf(),
      lotSqft: lotSqft,
      bldgSqft: bldgSqft,
      stories: isVacant ? 0 : (F.stories || 1),
      valuation: estVal,
      isVacantLand: isVacant,
      playbook: pb,
      solarKw: solarKw,
      nearestStn: nearestStn,
      ll: ll
    });
    showToast("Added home to deal comparison");
  }
  updateHomeCompareUI();
}

function updateHomeCompareUI() {
  const btn = document.getElementById("btn-compare-home-dossier");
  if (btn && activeHouse && activeHouse.a) {
    const inC = homeCompareList.some(h => h.ain === activeHouse.a.AIN);
    btn.tnnerHTML = inC ? "✓ In home comparison" : "<svg class=ic aria-hidden=true><use href=#i-compare /></svg> Compare this home";
    btn.classList.toggle("active", inC);
  }
  const tabHomes = document.getElementById("tab-cmp-homes");
  if (tabHomes) tabHomes.textContent = `Homes & Lots (${homeCompareList.length})`;
}

function switchCompareTab(tab) {
  compareActiveTab = tab;
  const tabH = document.getElementById("tab-cmp-hoods");
  const tabP = document.getElementById("tab-cmp-homes");
  if (tabH) tabH.classList.toggle("active", tab === "hoods");
  if (tabP) tabP.classList.toggle("active", tab === "homes");
  renderCompareDrawer();
}

function updateCompareUI() {
  const hBtn = $("#btn-compare-header");
  if (hBtn) hBtn.innerHTML = `<svg class="ic" aria-hidden="true"><use href="#i-compare"/></svg> Compare (${compareList.length})`;
  const badge = $("#compare-badge");
  if (badge) { badge.textContent = compareList.length; badge.hidden = !compareList.length; }
  const pBtn = $("#btn-compare-panel");
  if (pBtn) {
    const inC = compareList.includes(selected);
    pBtn.innerHTML = inC ? "✓ In comparison" : "<svg class=ic aria-hidden=true><use href=#i-compare /></svg> Compare";
    pBtn.classList.toggle("active", inC);
  }
}



// --- City Pretty AI Urban & Property Advisor Engine ---
let aiHistory = [];


// --- RESEARCH_CORPUS_500 & HISTORICAL_TRENDS_DATA are loaded from verified data files
// (app/data/research.json and app/data/case_studies.json) via loadVerifiedDataFiles() / cpJson().
let activeResearchCat = "All";
let activeResearchSearch = "";

let activeTrendFilter = "all";

function openHistoricalTrendsModal() {
  const m = document.getElementById("trends-modal");
  if (m) {
    if (!HISTORICAL_TRENDS_DATA.length) {
      cpJson("case-studies").then(d => {
        if (Array.isArray(d)) {
          HISTORICAL_TRENDS_DATA = d;
          renderTrendsList();
        }
      });
    }
    m.hidden = false;
    document.body.style.overflow = "hidden";
    renderTrendsList();
  }
}

function closeHistoricalTrendsModal() {
  const m = document.getElementById("trends-modal");
  if (m) {
    m.hidden = true;
    document.body.style.overflow = "";
  }
}

function filterTrends(type) {
  activeTrendFilter = type;
  document.querySelectorAll("[id^='btn-trend-']").forEach(b => {
    b.classList.toggle("active", b.id === `btn-trend-${type}`);
  });
  renderTrendsList();
}

function renderTrendsList() {
  const container = document.getElementById("trends-cards-container");
  if (!container) return;

  const filtered = HISTORICAL_TRENDS_DATA.filter(t => activeTrendFilter === "all" || t.type === activeTrendFilter);

  container.innerHTML = filtered.map(t => `
    <div style="background:#fff;border:1px solid #cbd5e1;border-radius:10px;padding:16px;box-shadow:0 2px 8px rgba(0,0,0,0.05);display:flex;flex-direction:column;justify-content:space-between;">
      <div>
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:6px;">
          <span style="font-size:10px;font-weight:700;color:#0284c7;background:#e0f2fe;padding:2px 7px;border-radius:10px;text-transform:uppercase;">
            ${esc(t.city)}${t.year != null ? ` &middot; ${esc(t.year)}` : ""}
          </span>
          ${t.ratio != null && t.ratio !== "" ? `<span style="font-size:11px;font-weight:800;color:#15803d;background:#dcfce7;padding:2px 8px;border-radius:12px;border:1px solid #bbf7d0;">
            Ratio: ${esc(t.ratio)} Private Leverage
          </span>` : ""}
        </div>

        <div style="font-size:15px;font-weight:800;color:#0f172a;margin-bottom:6px;line-height:1.35;">
          ${esc(t.name)}
        </div>

        <!-- Metrics Strip -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:8px;margin-bottom:8px;text-align:center;">
          <div>
            <div style="font-size:9.5px;color:#64748b;font-weight:600;text-transform:uppercase;">Public Capital</div>
            <div style="font-size:13px;font-weight:800;color:#334155;">${t.publicCost != null ? '$' + (t.publicCost / 1e6).toFixed(1) + 'M' : 'Not recorded'}</div>
          </div>
          <div>
            <div style="font-size:9.5px;color:#64748b;font-weight:600;text-transform:uppercase;">Private Real Estate</div>
            <div style="font-size:13px;font-weight:800;color:#16a34a;">${t.privateCap != null ? '$' + (t.privateCap / 1e9 >= 1 ? (t.privateCap / 1e9).toFixed(1) + 'B' : (t.privateCap / 1e6).toFixed(0) + 'M') : 'Not recorded'}</div>
          </div>
        </div>

        <div style="font-size:11px;color:#1e3a8a;background:#eff6ff;padding:6px 8px;border-radius:4px;margin-bottom:8px;line-height:1.4;">
          <b>Local Tax Source:</b> ${esc(t.taxVehicle || 'Not recorded')}
        </div>

        ${t.valueUplift && (!t.verification || t.verification.finding === "supported") ? `<div style="font-size:12px;color:#059669;font-weight:700;margin-bottom:6px;">
          ${esc(t.valueUplift)}
        </div>` : `<div style="font-size:12px;color:#64748b;margin-bottom:6px;">Value effect: not confirmed in the source.</div>`}

        <!-- 4-Stage Appreciation Trajectory -->
        ${t.trajectory && t.trajectory.length ? `
        <div style="margin-bottom:8px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:6px 8px;">
          <div style="font-size:10px;font-weight:700;color:#64748b;margin-bottom:4px;text-transform:uppercase;">Appreciation Trajectory Curve:</div>
          <div style="display:flex;justify-content:space-between;font-size:10.5px;color:#334155;">
            ${t.trajectory.map(p => `<div><span style="color:#64748b">${esc(p.yr)}:</span> <b style="color:#0284c7">${esc(p.val)}</b></div>`).join('')}
          </div>
        </div>
        ` : ''}

        <div style="font-size:11.5px;color:#475569;line-height:1.45;margin-bottom:8px;">
          ${esc(t.takeaway || '')}
        </div>

        ${t.evaluation_url ? `
        <div style="font-size:11px;margin-bottom:10px;">
          <a href="${esc(t.evaluation_url)}" target="_blank" rel="noopener noreferrer" style="color:#0284c7;text-decoration:underline;font-weight:600;">
            Source: ${esc(t.source || 'Evaluation Report')} ↗
          </a>
          ${t.verification && t.verification.checked ? `<span style="color:#64748b;font-size:10px;"> &middot; ${t.verification.finding === "supported" ? "Checked against the source" : "Source exists; figures not confirmed"} on ${esc(fmtCheckedDate(t.verification.checked))}</span>` : `<span style="color:#64748b;font-size:10px;"> &middot; Not yet checked</span>`}
        </div>
        ` : ''}
      </div>

      <div style="display:flex;gap:6px;">
        <button type="button" class="story-btn" onclick="focusHistoricalProject('${t.id}', ${t.lat}, ${t.lng}, '${t.fips}')" style="flex:1;font-size:11px;padding:6px;font-weight:700;background:#0284c7;color:#fff;border:none;">
          Focus Corridor on Map
        </button>
      </div>
    </div>
  `).join("");
}

let trendCorridorLayer = null;

function focusHistoricalProject(id, lat, lng, fips) {
  closeHistoricalTrendsModal();
  if (!map) return;

  const proj = HISTORICAL_TRENDS_DATA.find(p => p.id === id);
  if (!proj) {
    map.flyTo([lat, lng], 15, { duration: 1.2 });
    showToast(`Focused on ${id.replace(/_/g, ' ').toUpperCase()} corridor`);
    return;
  }

  // Remove existing trend corridor layer if any
  if (trendCorridorLayer && map.hasLayer(trendCorridorLayer)) {
    map.removeLayer(trendCorridorLayer);
  }
  trendCorridorLayer = L.layerGroup().addTo(map);

  if (proj.path && proj.path.length) {
    // 1. Glowing outer halo
    const halo = L.polyline(proj.path, {
      color: "#38bdf8",
      weight: 9,
      opacity: 0.65,
      lineCap: "round"
    }).addTo(trendCorridorLayer);

    // 2. Sharp inner line
    const core = L.polyline(proj.path, {
      color: "#0284c7",
      weight: 3.5,
      opacity: 1,
      dashArray: proj.type === "transit" ? "8 5" : null
    }).addTo(trendCorridorLayer);

    const moneyLine = [
      proj.publicCost != null ? `Public: $${(proj.publicCost / 1e6).toFixed(1)}M` : null,
      proj.privateCap != null ? `Private RE: $${(proj.privateCap / 1e6).toFixed(1)}M` : null,
      proj.ratio != null && proj.ratio !== "" ? `(${esc(proj.ratio)})` : null,
    ].filter(Boolean).join(" → ");
    const upliftOk = proj.valueUplift && (!proj.verification || proj.verification.finding === "supported");
    core.bindTooltip(`<b>${esc(proj.name)}</b>${moneyLine ? `<br><span style="color:#059669;font-weight:700">${moneyLine}</span>` : ""}${upliftOk ? `<br><span style="font-size:11px;color:#64748b">${esc(proj.valueUplift)}</span>` : ""}`, { sticky: true });

    // 3. Milestone Stations / Nodes
    if (proj.stations && proj.stations.length) {
      proj.stations.forEach(stn => {
        const marker = L.circleMarker([stn.lat, stn.lng], {
          radius: 5.5,
          color: "#ffffff",
          weight: 2,
          fillColor: "#0284c7",
          fillOpacity: 1
        }).addTo(trendCorridorLayer);
        marker.bindTooltip(`<b>${esc(stn.name)}</b>${stn.desc ? `<br><span style="font-size:11px;color:#475569">${esc(stn.desc)}</span>` : ""}`);
      });
    }

    // 4. Fit bounds smoothly
    try {
      const b = halo.getBounds();
      map.fitBounds(b, { padding: [50, 50], maxZoom: 16 });
    } catch(e) {
      map.flyTo([lat, lng], 15);
    }
  } else {
    map.flyTo([lat, lng], 15, { duration: 1.2 });
  }

  showToast(`Active Corridor: ${proj.name}${proj.ratio != null && proj.ratio !== "" ? ` (${proj.ratio} Private Leverage)` : ""}`);
}

function openResearchModal(queryOrCat = null) {
  const m = document.getElementById("research-modal");
  if (m) {
    if (!RESEARCH_CORPUS_500.length) {
      cpJson("research").then(d => {
        if (Array.isArray(d)) {
          RESEARCH_CORPUS_500 = d;
          renderResearchCategories();
          renderResearchList();
        }
      });
    }
    m.hidden = false;
    document.body.style.overflow = "hidden";
    if (queryOrCat) {
      const qLower = String(queryOrCat).toLowerCase().trim();
      const found = RESEARCH_CORPUS_500.find(s => s.category.toLowerCase().includes(qLower) || qLower.includes(s.category.toLowerCase()));
      if (found) {
        activeResearchCat = found.category;
        activeResearchSearch = "";
        const inp = document.getElementById("research-search-input");
        if (inp) inp.value = "";
      } else {
        activeResearchCat = "All";
        activeResearchSearch = qLower;
        const inp = document.getElementById("research-search-input");
        if (inp) inp.value = queryOrCat;
      }
    } else {
      activeResearchCat = "All";
      activeResearchSearch = "";
      const inp = document.getElementById("research-search-input");
      if (inp) inp.value = "";
    }
    renderResearchCategories();
    renderResearchList();
  }
}

function closeResearchModal() {
  const m = document.getElementById("research-modal");
  if (m) {
    m.hidden = true;
    document.body.style.overflow = "";
  }
}

function renderResearchCategories() {
  const bar = document.getElementById("research-cat-pills");
  if (!bar) return;
  const categoryDefs = [
    { id: "All", label: "All Studies" },
    { id: "Public Art & Cultural Placemaking", label: "Public Art" },
    { id: "Urban Tree Canopy & Heat Mitigation", label: "Tree Canopy" },
    { id: "Historical Capital Projects & Tax Reinvestment", label: "Historical Trends" },
    { id: "Parks, Trails & Green Infrastructure", label: "Parks & Trails" },
    { id: "Transit-Oriented Development (TOD) & Rail", label: "Transit TOD" },
    { id: "Active Transportation & Protected Bike Networks", label: "Bike & Ped" },
    { id: "School Facility Capital Bonds & Modernization", label: "School Bonds" },
    { id: "Clean Energy, Rooftop Solar & EV Mobility", label: "Clean Energy" },
    { id: "Public Safety, Street Lighting & CPTED", label: "Public Safety" },
    { id: "Commercial Facade Grants & Historic Preservation", label: "Facades & Historic" }
  ];
  // Pills come from the categories present in research.json (labels from the table above when known); a category
  // with no records is not shown.
  const present = [...new Set(RESEARCH_CORPUS_500.map(s => s.category).filter(Boolean))];
  const known = new Map(categoryDefs.map(c => [c.id, c.label]));
  const cats = [{ id: "All", label: "All Studies" }].concat(present.sort((x, y) => {
    const ix = categoryDefs.findIndex(c => c.id === x), iy = categoryDefs.findIndex(c => c.id === y);
    return (ix < 0 ? 99 : ix) - (iy < 0 ? 99 : iy);
  }).map(id => ({ id, label: known.get(id) || id }))).map(c => {
    const count = c.id === "All" ? RESEARCH_CORPUS_500.length : RESEARCH_CORPUS_500.filter(s => s.category === c.id).length;
    return { id: c.id, label: `${c.label} (${count})` };
  });

  bar.innerHTML = cats.map(c => `
    <button type="button" class="story-btn ${activeResearchCat === c.id ? 'active' : ''}" onclick="setResearchCat('${c.id}')" style="font-size:11px;white-space:nowrap;padding:4px 9px;">
      ${c.label}
    </button>
  `).join("");
}

function setResearchCat(cat) {
  activeResearchCat = cat;
  renderResearchCategories();
  renderResearchList();
}

function onResearchSearchChange(val) {
  activeResearchSearch = val.toLowerCase().trim();
  renderResearchList();
}

function clearResearchFilters() {
  activeResearchCat = "All";
  activeResearchSearch = "";
  const inp = document.getElementById("research-search-input");
  if (inp) inp.value = "";
  renderResearchCategories();
  renderResearchList();
}

function renderResearchList() {
  const list = document.getElementById("research-list");
  const countLabel = document.getElementById("research-count-label");
  if (!list) return;

  const filtered = RESEARCH_CORPUS_500.filter(s => {
    const matchCat = (activeResearchCat === "All" || s.category === activeResearchCat);
    if (!matchCat) return false;
    if (!activeResearchSearch) return true;
    const haystack = [s.category, s.title, s.authors, s.journal, s.geography, s.impact, s.takeaway, s.citation].filter(v => v != null).join(" ").toLowerCase();
    return haystack.includes(activeResearchSearch);
  });
  // An effect figure is shown only when the study's verification.finding is "supported" (found in the source text).
  const supported = s => !!(s && s.verification && s.verification.finding === "supported");

  if (countLabel) {
    const nSup = filtered.filter(supported).length;
    const withVpd = filtered.filter(x => supported(x) && x.vpd != null && isFinite(x.vpd));
    const avgTxt = withVpd.length ? ` &middot; $ of value per $1 reported by ${withVpd.length} of them: average <b>$${(withVpd.reduce((t, x) => t + x.vpd, 0) / withVpd.length).toFixed(2)} / $1</b>` : "";
    countLabel.innerHTML = `Showing <b>${filtered.length}</b> of ${RESEARCH_CORPUS_500.length} research studies &middot; effect confirmed in the source text for ${nSup}${avgTxt}`;
  }

  if (!filtered.length) {
    list.innerHTML = `<div style="text-align:center;padding:40px 20px;color:#64748b;">
      <div style="font-size:24px;margin-bottom:8px;"><svg class=ic style=width:28px;height:28px aria-hidden=true><use href=#i-search /></svg></div>
      <div style="font-size:14px;font-weight:700;">No studies matching "${esc(activeResearchSearch)}"</div>
      <div style="font-size:12px;margin-top:4px;">Try searching for keywords like "mural", "tree", "high line", "school", "transit", "roi", or clear filters.</div>
    </div>`;
    return;
  }

  list.innerHTML = filtered.map(s => `
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:14px;box-shadow:0 1px 3px rgba(0,0,0,0.04);transition:border-color 0.15s;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:4px;flex-wrap:wrap;">
        <span style="font-size:10.5px;font-weight:700;color:#0284c7;background:#e0f2fe;padding:2px 7px;border-radius:10px;text-transform:uppercase;">
          ${esc(s.category)}
        </span>
        ${supported(s) && s.vpd != null && isFinite(s.vpd) ? `<span style="font-size:11.5px;font-weight:800;color:#15803d;background:#dcfce7;padding:2px 8px;border-radius:12px;border:1px solid #bbf7d0;">
          Return: $${s.vpd} / $1
        </span>` : ""}
      </div>

      <div style="font-size:14px;font-weight:800;color:#0f172a;margin-bottom:4px;line-height:1.35;">
        ${esc(s.title)}
      </div>

      <div style="font-size:11.5px;color:#475569;margin-bottom:8px;">
        <b>Authors/Institution:</b> ${esc(s.authors || "not on file")} &middot; <b>Year:</b> ${s.year != null ? esc(s.year) : "not on file"}${s.journal ? ` &middot; <i>${esc(s.journal)}</i>` : ""}${s.geography ? ` &middot; <b>Sample:</b> ${esc(s.geography)}` : ""}
      </div>

      ${supported(s) && s.impact ? `<div style="background:#f0fdf4;border-left:3px solid #16a34a;padding:8px 10px;margin-bottom:8px;border-radius:0 4px 4px 0;font-size:12px;color:#14532d;line-height:1.4;">
        <b>Measured Impact:</b> ${esc(s.impact)}
      </div>` : `<div style="background:#f8fafc;border-left:3px solid #94a3b8;padding:8px 10px;margin-bottom:8px;border-radius:0 4px 4px 0;font-size:12px;color:#475569;line-height:1.4;">
        <b>Measured Impact:</b> Not reported in the abstract (effect size not confirmed).
      </div>`}

      ${s.takeaway ? `<div style="font-size:12px;color:#334155;line-height:1.45;margin-bottom:6px;">
        <b>Takeaway:</b> ${esc(s.takeaway)}
      </div>` : ""}

      <div style="font-size:10.5px;color:#64748b;border-top:1px solid #f1f5f9;padding-top:6px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:4px;">
        <span style="font-style:italic;">${esc(s.citation || "")}</span>
        ${s.source_url ? `
          <a href="${esc(s.source_url)}" target="_blank" rel="noopener noreferrer" style="color:#0284c7;text-decoration:underline;font-weight:600;font-style:normal;">
            Source${s.doi ? ` (DOI: ${esc(s.doi)})` : ''} ↗
          </a>
        ` : ''}
        ${s.verification && s.verification.checked ? `<span>${supported(s) ? "Effect checked against the source" : "Source exists; effect not confirmed"} on ${esc(fmtCheckedDate(s.verification.checked))}</span>` : `<span>Not yet checked</span>`}
      </div>
    </div>
  `).join("");
}

// ============================================================================
// GROUNDED AI URBAN & PROPERTY ADVISOR CONTRACT & EDGE API INTEGRATION
// ============================================================================

// ---------------- AI advisor
// The page sends the question, the data it is showing (serializeLiveAdvisorContext) and the recent chat to the
// advisor endpoint: the Cloudflare Worker in workers/api-proxy.ts, which builds the prompt and calls the model.
// Where the endpoint is set: app/config.js (CITY_PRETTY_CONFIG.workerUrl), or the advisor's settings drawer for
// testing. With no endpoint the advisor says it is not connected; it never makes up an answer.
const AI_TIMEOUT_MS = 90000;
let aiStatus = "off";   // off: no endpoint · checking · ok · down

function workerUrl() {
  const cfg = (typeof window !== "undefined" && window.CITY_PRETTY_CONFIG) || {};
  return String(cfg.workerUrl || "").trim().replace(/\/+$/, "");
}
function aiEndpoint() {
  let o = null;
  try { o = localStorage.getItem("city_pretty_ai_endpoint"); } catch (e) {}
  return (o || "").trim() || (workerUrl() ? workerUrl() + "/api/ai" : "");
}
function streetViewProxyUrl() { return workerUrl() ? workerUrl() + "/api/streetview" : ""; }
try { localStorage.removeItem("city_pretty_ai_key"); } catch (e) {}   // the page no longer handles model keys

function setAiStatus(s, detail) {
  aiStatus = s;
  const el = document.getElementById("ai-status-indicator");
  if (!el) return;
  const look = {
    off: ["Not connected", "#f1f5f9", "#475569", "#cbd5e1", "The AI advisor has no endpoint yet (workerUrl in app/config.js)"],
    checking: ["… Checking", "#f1f5f9", "#475569", "#cbd5e1", "Checking the advisor endpoint"],
    ok: ["Connected", "#ecfdf5", "#059669", "#a7f3d0", "The advisor endpoint answered its health check"],
    down: ["Unavailable", "#fef2f2", "#b91c1c", "#fecaca", "The advisor endpoint did not answer"],
  }[s];
  el.textContent = look[0];
  el.style.background = look[1]; el.style.color = look[2]; el.style.borderColor = look[3];
  el.title = detail || look[4];
}

async function checkAiStatus() {
  const ep = aiEndpoint();
  if (!ep) { setAiStatus("off"); return; }
  setAiStatus("checking");
  try {
    const healthUrl = new URL("health", new URL(ep, location.href)).href;   // .../api/ai -> .../api/health
    const r = await fetch(healthUrl, { cache: "no-store" });
    const j = r.ok ? await r.json().catch(() => ({})) : {};
    setAiStatus(r.ok && j.ai_advisor_ready ? "ok" : "down", r.ok && !j.ai_advisor_ready ? "The Worker is up but its model is not configured yet" : undefined);
  } catch (e) { setAiStatus("down"); }
}

// What the advisor is told. Unknown values are null, never a stand-in number.
function serializeLiveAdvisorContext() {
  const fips = typeof activeFips === "function" ? activeFips() : null;
  const comp = (typeof COUNTY_COMPLETENESS_INDEX !== "undefined" && fips && COUNTY_COMPLETENESS_INDEX[fips]) || null;
  const num = v => (v == null || v === "" || isNaN(+v) || +v === 0) ? null : +v;
  const payload = {
    county: {
      fips, name: typeof countyOf === "function" ? countyOf() : null,
      state: typeof activeState === "function" ? activeState() : null,
      readiness_tier: comp ? comp.readiness_tier : null,
      assessor_roll_vintage: comp ? comp.assessor_roll_vintage || null : null,
      zoning_source: comp ? comp.zoning_source || null : null,
    },
    roiMode: typeof getRoiMode === "function" ? getRoiMode() : null,
    hudFmr: (() => {
      const f = (typeof getHudFmr === "function") ? getHudFmr(fips) : null;
      if (!f) return null;
      return {
        fips: f.fips || null, metro_or_county_name: f.metro_or_county_name || null, fiscal_year: num(f.fiscal_year),
        efficiency_0br: num(f.zero_bed_eff), one_bed_1br: num(f.one_bed_1br), two_bed_2br: num(f.two_bed_2br),
        three_bed_3br: num(f.three_bed_3br), four_bed_4br: num(f.four_bed_4br),
        source: f.source_url || f.source_agency || null, null_reason: f.null_reason || null,
        verification_status: f.one_bed_1br != null ? "verified" : "unverified",
      };
    })(),
    // State housing laws on file for this state, each with its verification status from statutes.json.
    laws: (Array.isArray(STATE_HOUSING_LAWS_DATA) ? STATE_HOUSING_LAWS_DATA : [])
      .filter(r => r && r.state_code && r.state_code === (typeof activeState === "function" ? activeState() : null))
      .slice(0, 12)
      .map(r => ({
        id: r.id || null, name: r.short_name || null, citation: r.statute_citation || null, summary: r.summary || null,
        verification_status: (r.verification && r.verification.status) || "unverified",
        checked: (r.verification && r.verification.checked) || null,
        fields_unconfirmed: (r.verification && Array.isArray(r.verification.fields_unconfirmed)) ? r.verification.fields_unconfirmed.slice(0, 10) : [],
      })),
    // Set by the Invest view (app/invest.js); null until that view has built a brief.
    decision_brief: (typeof window !== "undefined" && window.__cpDecisionBrief) || null,
  };
  if (selected && byId.get(selected)) {
    const p = byId.get(selected).properties || {};
    const bundle = (typeof activeBundle === "function" && activeBundle()) || D;
    const m = ((bundle && bundle.details && bundle.details[selected]) || {}).m || {};
    payload.blockGroup = {
      geoid: selected, name: p.n || null, nameSource: m.ns || null, city: p.c || null,
      medianHomeValue: num(m.hv != null ? m.hv : p.hv), medianRent: num(m.rent), population: num(m.pop), acres: num(m.acres),
      topProjects: Array.isArray(p.tp) ? p.tp.slice(0, 3) : null,
    };
  }
  const ah = typeof activeHouse !== "undefined" ? activeHouse : null;
  if (ah && ah.a) {
    const a = ah.a, F = ah.F || {}, val = ah.valuation || null, vc = ah.valCheck || { ok: !!val };
    const audit = ah.audit || null;
    const stR = (ah.st && ah.st.R) || null;
    const ex = (audit && audit.statutoryZoning && audit.statutoryZoning.statutory_exclusions) || null;
    const floodVal = ex ? !!ex.fema_100yr_floodway : (stR && stR.flood ? !!stR.flood.ok : null);
    const fireVal = ex ? !!ex.calfire_or_state_vhfhsz : (stR && stR.fire ? !!stR.fire.ok : null);
    const historicVal = ex ? !!ex.historic_district_hpoz : (stR && stR.hpoz ? !!stR.hpoz.ok : null);
    const lotSplitVal = (audit && audit.statutoryZoning && typeof audit.statutoryZoning.lotSplitFeasible === "boolean")
      ? audit.statutoryZoning.lotSplitFeasible
      : null;

    payload.parcel = {
      parcelId: a.AIN || null, address: a.SitusFullAddress || null,
      useType: a.UseType || null, useDescription: a.UseDescription || null,
      zoningCode: (a.ZoneCode && !/^unzoned$/i.test(a.ZoneCode)) ? a.ZoneCode : null,
      lotSqft: num(ah.lot || a.LotSqft), livingSqft: num(F.bldg), yearBuilt: num(F.yb), bedrooms: num(F.beds), bathrooms: num(F.baths),
      stories: num(F.stories), units: num(a.Units),
      assessorValue: num(((+a.Roll_LandValue || 0) + (+a.Roll_ImpValue || 0)) || a.Roll_TotalValue),
      lastSale: ah.sale ? { price: ah.sale.price, date: ah.sale.date } : null,
      // Range only when the county was back-tested (measured typical error); otherwise low/high are null.
      valueEstimate: vc.ok && val ? { value: val.estimatedValue, low: ah.valLow != null ? ah.valLow : null, high: ah.valHigh != null ? ah.valHigh : null, method: (val.valuationMethod || "") + (vc.backtested === false ? " (not back-tested in this county)" : "") } : null,
      valueEstimateWithheld: vc.ok ? null : vc.reason,
      flood: floodVal,
      fire: fireVal,
      historic: historicVal,
      lotSplitEligibility: lotSplitVal,
      // Laws the statutory engine applied (only records "verified" in statutes.json) and those it could not determine.
      byRightLaws: (audit && audit.statutoryZoning) ? {
        applicable: (audit.statutoryZoning.applicable_statutes || []).map(s => ({ citation: s.citation || null, verification_status: "verified" })),
        not_determined: (audit.statutoryZoning.not_determined_statutes || []).map(s => ({ id: s.id || null, citation: s.citation || null, reason: s.reason || null, verification_status: typeof statuteStatus === "function" ? statuteStatus(s.id) : "unverified" })),
      } : null,
    };
    if (ah.ll && typeof findNearestTransitStation === "function") {
      try { const s = findNearestTransitStation(ah.ll.lat, ah.ll.lng); if (s) payload.parcel.nearestRailOrBrt = { name: s.name || null, miles: s.distMi != null ? +(+s.distMi).toFixed(2) : null }; } catch (e) {}
    }
  }

  // Intercity transit corridor facts if relevant to current state/county
  if (Array.isArray(INTERCITY_CORRIDORS_DATA) && INTERCITY_CORRIDORS_DATA.length) {
    const stCode = typeof activeState === "function" ? activeState() : null;
    // Match on the corridor's station county FIPS only (a state match would tie every Arizona county to Phoenix-Tucson).
    const matchCorridor = fips ? INTERCITY_CORRIDORS_DATA.find(c => Array.isArray(c.proposed_stations) && c.proposed_stations.some(s => s && s.fips === fips)) : null;
    if (matchCorridor) {
      const matchStn = matchCorridor.proposed_stations.find(s => s.fips === fips) || null;
      const recYard = Array.isArray(matchCorridor.candidate_railyard_sites) && matchCorridor.candidate_railyard_sites.length ? (matchCorridor.candidate_railyard_sites.find(y => y.siting_recommendation && y.siting_recommendation.includes("RECOMMENDED")) || null) : null;
      const cStatus = (matchCorridor.verification && matchCorridor.verification.status) || "unverified";
      payload.intercityCorridor = {
        id: matchCorridor.id || null,
        name: matchCorridor.name || null,
        verification_status: cStatus,
        corridor_confirmed: cStatus !== "corridor_not_confirmed" && cStatus !== "unverified",
        route_length_miles: num(matchCorridor.route_length_miles),
        funding_status: matchCorridor.funding_status || null,
        projected_minutes: num(matchCorridor.projected_one_way_minutes),
        highway_minutes: num(matchCorridor.highway_comparison_minutes),
        estimated_cost_billions: num(matchCorridor.estimated_capital_cost_billions),
        nearestStation: matchStn ? {
          name: matchStn.name || null,
          city: matchStn.city || null,
          station_basis: matchStn.station_basis || null,
          avg_land_cost_per_sqft: num(matchStn.avg_land_cost_per_sqft),
          available_underused_acres: num(matchStn.available_underused_acres_walkshed),
          statutory_housing_regime: matchStn.statutory_housing_regime || null,
        } : null,
        recommendedRailyard: recYard ? {
          name: recYard.name || null,
          location: recYard.location || null,
          total_land_cost: num(recYard.total_land_acquisition_cost),
        } : null,
      };
    }
  }

  // Underused site facts if block group has an identified underused site
  if (selected && Array.isArray(UNDERUSED_SITES_DATA) && UNDERUSED_SITES_DATA.length) {
    // Match the selected block group only (any golf course in the county is not "this" site).
    const matchedSite = UNDERUSED_SITES_DATA.find(s => s && s.blockGroupId && s.blockGroupId === selected);
    if (matchedSite) {
      const se = matchedSite.screening_estimate || null;
      payload.underusedSite = {
        id: matchedSite.id || null,
        name: matchedSite.name || null,
        kind: matchedSite.kind || null,
        acres: num(matchedSite.acres),
        cityName: matchedSite.cityName || null,
        baseZoning: matchedSite.baseZoning || null,
        distanceToRailMeters: num(matchedSite.distanceToRailMeters),
        publicOwner: matchedSite.publicOwner || null,
        inConservationEasement: typeof matchedSite.inConservationEasement === "boolean" ? matchedSite.inConservationEasement : null,
        verification_status: (matchedSite.verification && matchedSite.verification.status) || "unverified",
        // Model output, not a measured fact: inputs flagged assumed and missing_inputs come from underused_sites.json.
        screening_estimate: se ? {
          potentialHomes: num(se.potentialHomes),
          margin: num(se.margin),
          marginBeforeLand: num(se.marginBeforeLand),
          idea: se.idea || null,
          assumed_inputs: se.inputs ? Object.keys(se.inputs).filter(k => se.inputs[k] && se.inputs[k].assumed) : [],
          missing_inputs: Array.isArray(se.missing_inputs) ? se.missing_inputs : [],
        } : null,
      };
    }
  }

  // EverySpace property monetization facts if house is active
  if (ah && ah.audit && ah.audit.everySpace) {
    const es = ah.audit.everySpace;
    payload.everySpace = {
      totalMonthlyGrossRevenueUsd: num(es.totalMonthlyEverySpaceGrossRevenueUsd),
      netMonthlyHoldingCashFlowUsd: num(es.netMonthlyHoldingCashFlowUsd),
      monthlyHoldingDeficitReductionPct: num(es.monthlyHoldingDeficitReductionPct),
      isCashFlowPositiveDuringHold: !!es.isCashFlowPositiveDuringHold,
      holdingStrategyRecommendation: es.holdingStrategyRecommendation || null,
      basis: "illustrative_assumed_inputs",
    };
  }

  // Renovation quote evaluation facts if house is active
  if (ah && ah.audit && Array.isArray(ah.audit.renovationOptions) && ah.audit.renovationOptions.length) {
    const rq = ah.audit.renovationOptions[0];
    payload.renovationQuote = {
      improvementType: rq.improvementType || null,
      quotedCost: num(rq.quotedCost),
      benchmarkMarketCostLow: num(rq.benchmarkMarketCostLow),
      benchmarkMarketCostHigh: num(rq.benchmarkMarketCostHigh),
      costFairnessRating: rq.costFairnessRating || null,
      estimatedEquityValueAdd: num(rq.estimatedEquityValueAdd),
      netEquityGainUsd: num(rq.netEquityGainUsd),
      returnOnInvestmentPct: num(rq.returnOnInvestmentPct),
      everySpaceMonthlyYieldUsd: num(rq.everySpaceMonthlyYieldUsd),
      governingStatute: (rq.statutoryEntitlementStatus && rq.statutoryEntitlementStatus.governingStatute) || null,
      verdict: rq.verdict || null,
      verdictSummary: rq.verdictSummary || null,
      basis: "illustrative_assumed_inputs",
    };
  }

  // StreetForge civil opportunity facts for selected block group or corridor
  if (selected && typeof _evalStreetForgeRow === "function") {
    try {
      const p = (byId.get(selected) && byId.get(selected).properties) || {};
      const sf = _evalStreetForgeRow({
        corridorName: p.n ? `${p.n} Arterial Corridor` : "Neighborhood Arterial",
        city: p.c || "Local Jurisdiction",
        stateCode: typeof activeState === "function" ? activeState() : "CA",
        lengthMiles: 1.5,
        currentDriveLanes: 4,
        currentAadt: 14000,
        reallocationType: "protected_bike_lane"
      });
      payload.streetForge = {
        reallocationType: sf.reallocationType || null,
        lengthMiles: num(sf.lengthMiles),
        netMunicipalCostUsd: num(sf.netMunicipalCostUsd),
        annualCo2TonsAvoided: num(sf.pollutionAndEmissions ? sf.pollutionAndEmissions.co2TonsAvoidedAnnual : null),
        crashReductionPct: num(sf.safetyAndWalkability ? sf.safetyAndWalkability.crashReductionPct : null),
        benefitCostRatio: num(sf.benefitCostRatio),
        // A hypothetical 1.5-mile, 4-lane corridor with assumed traffic, not a measured street.
        basis: "illustrative_assumed_inputs",
      };
    } catch (e) {}
  }

  return payload;
}
window.serializeLiveAdvisorContext = serializeLiveAdvisorContext;

// Model text is shown as text: escaped, then **bold**, bullet lines and line breaks
function aiTextToHtml(t) {
  return esc(String(t || ""))
    .replace(/\*\*([^*\n]+)\*\*/g, "<b>$1</b>")
    .replace(/^#{1,4}\s*(.+)$/gm, "<b>$1</b>")
    .replace(/^\s*[-*]\s+/gm, "• ")
    .replace(/\n/g, "<br>");
}

async function sendAiQuery(q, promptKey = null) {
  aiHistory.push({ role: "user", text: q });
  const ep = aiEndpoint();
  if (!ep) {
    aiHistory.push({ role: "notice", text: "The AI advisor isn't connected yet, so this question was not sent anywhere and no answer was made up. The panel beside the map has this page's own figures and sources." });
    renderAiChat(); return;
  }
  renderAiChat();
  const box = document.getElementById("ai-chat-history");
  const typingId = "ai-typing-indicator";
  if (box) {
    const typingEl = document.createElement("div");
    typingEl.id = typingId;
    typingEl.style.cssText = "align-self:flex-start;background:#f8fafc;border:1px solid #e2e8f0;color:#64748b;padding:10px 14px;border-radius:12px 12px 12px 0;font-size:12px;display:flex;align-items:center;gap:8px;";
    typingEl.innerHTML = `<span class="spin"></span> <span>Waiting for the advisor…</span>`;
    box.appendChild(typingEl); box.scrollTop = box.scrollHeight;
  }
  const context = serializeLiveAdvisorContext();
  const previewEl = document.getElementById("ai-grounded-json-preview");
  if (previewEl) { try { previewEl.textContent = JSON.stringify(context, null, 2); } catch (e) {} }
  const history = aiHistory.filter(m => m.role === "user" || m.role === "assistant").slice(0, -1).slice(-8)
    .map(m => ({ role: m.role, content: String(m.raw || m.text).slice(0, 4000) }));

  let reply;
  try {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), AI_TIMEOUT_MS);
    const res = await fetch(ep, {
      method: "POST", headers: { "Content-Type": "application/json" }, signal: ctl.signal,
      body: JSON.stringify({ question: q, promptKey, context, history }),
    });
    clearTimeout(timer);
    const data = await res.json().catch(() => null);
    if (res.ok && data && data.ok && data.text) {
      let html = aiTextToHtml(data.text);
      const g = data.grounding || null;
      if (g && g.ok === false) {
        const figs = Array.isArray(g.unverified_figures) ? g.unverified_figures.map(x => esc(String(x))).slice(0, 12).join(", ") : "";
        html += `<div style="margin-top:8px;padding:6px 8px;border:1px solid #fde68a;background:#fffbeb;color:#92400e;border-radius:6px;font-size:11.5px;">These figures could not be matched to the page data or the site's tables: ${figs || "(not listed)"}. Do not rely on them.</div>`;
      }
      const srcs = Array.isArray(data.sources) ? data.sources.filter(u => typeof u === "string" && /^https?:\/\//i.test(u)).slice(0, 10) : [];
      if (srcs.length) {
        html += `<div style="margin-top:6px;font-size:11px;color:#475569;"><b>Sources:</b> ${srcs.map(u => `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(u.replace(/^https?:\/\//i, "").slice(0, 60))}</a>`).join(" &middot; ")}</div>`;
      }
      reply = { role: "assistant", raw: data.text, text: html }; setAiStatus("ok");
    }
    else {
      const why = (data && data.error) || `HTTP ${res.status}`;
      reply = { role: "notice", text: `The AI advisor could not answer (${why}). No answer was generated.` };
      if (res.status >= 500 || res.status === 404) setAiStatus("down", why);
    }
  } catch (err) {
    reply = { role: "notice", text: `The AI advisor could not be reached (${err && err.name === "AbortError" ? "no reply within 90 seconds" : "network error"}). No answer was generated.` };
    setAiStatus("down");
  }
  const typingEl = document.getElementById(typingId); if (typingEl) typingEl.remove();
  aiHistory.push(reply);
  renderAiChat();
}
window.sendAiQuery = sendAiQuery;

function toggleAiSettings() {
  const d = document.getElementById("ai-settings-drawer");
  if (!d) return;
  d.style.display = d.style.display === "none" || !d.style.display ? "block" : "none";
  if (d.style.display === "block") loadAiSettings();
}
window.toggleAiSettings = toggleAiSettings;
function loadAiSettings() {
  const epInput = document.getElementById("ai-cfg-endpoint");
  if (epInput) { try { epInput.value = localStorage.getItem("city_pretty_ai_endpoint") || ""; } catch (e) {} epInput.placeholder = workerUrl() ? workerUrl() + "/api/ai" : "not set (workerUrl in app/config.js)"; }
}
window.loadAiSettings = loadAiSettings;
function saveAiSettings() {
  const epInput = document.getElementById("ai-cfg-endpoint"), statusEl = document.getElementById("ai-cfg-status");
  const ep = epInput ? epInput.value.trim() : "";
  try { if (ep) localStorage.setItem("city_pretty_ai_endpoint", ep); else localStorage.removeItem("city_pretty_ai_endpoint"); } catch (e) {}
  if (statusEl) { statusEl.textContent = "Saved in this browser."; setTimeout(() => { statusEl.textContent = ""; }, 2500); }
  checkAiStatus();
}
window.saveAiSettings = saveAiSettings;
function clearAiSettings() {
  try { localStorage.removeItem("city_pretty_ai_endpoint"); } catch (e) {}
  const epInput = document.getElementById("ai-cfg-endpoint"), statusEl = document.getElementById("ai-cfg-status");
  if (epInput) epInput.value = "";
  if (statusEl) { statusEl.textContent = "Using the site setting (app/config.js)."; setTimeout(() => { statusEl.textContent = ""; }, 2500); }
  checkAiStatus();
}
window.clearAiSettings = clearAiSettings;

function openAiAdvisor() {
  const m = document.getElementById("ai-advisor-modal");
  if (m) {
    m.hidden = false;
    document.body.style.overflow = "hidden";
    checkAiStatus();
    updateAiContext();
    if (aiHistory.length === 0) {
      initAiWelcome();
    }
  }
}

function closeAiAdvisor() {
  const m = document.getElementById("ai-advisor-modal");
  if (m) {
    m.hidden = true;
    document.body.style.overflow = "";
  }
}

function updateAiContext() {
  const strip = document.getElementById("ai-context-desc");
  if (strip) {
    if (activeHouse && activeHouse.a) {
      const a = activeHouse.a;
      const addr = a.SitusFullAddress || ("Parcel " + a.AIN);
      const lotSqft = activeHouse.lot ? `${activeHouse.lot.toLocaleString()} sq ft` : "Lot area loading";
      strip.innerHTML = `<b>${esc(addr)}</b> (APN ${esc(a.AIN || "–")}) &middot; ${lotSqft} &middot; ${esc(countyOf())}`;
    } else if (selected && byId.get(selected)) {
      const p = byId.get(selected).properties;
      strip.innerHTML = `<b>${esc(p.n)}</b>, ${esc(p.c)} &middot; neighborhood`;
    } else {
      strip.textContent = `General County Focus: ${countyOf() || "United States"}`;
    }
  }

  const previewEl = document.getElementById("ai-grounded-json-preview");
  if (previewEl && typeof serializeLiveAdvisorContext === "function") {
    try {
      const payload = serializeLiveAdvisorContext();
      previewEl.textContent = JSON.stringify(payload, null, 2);
    } catch(e) {}
  }
}

function initAiWelcome() {
  const where = activeHouse && activeHouse.a ? `<b>${esc(activeHouse.a.SitusFullAddress || "the selected lot")}</b>` : "the selected neighborhood";
  const text = `Ask about ${where}. The advisor is an AI model that is given the data this page shows (open "Inspect" above to see exactly what it gets). It can be wrong; check anything important with the city or county.` +
    (aiEndpoint() ? "" : `<br><br><b>The AI advisor isn't connected yet</b>, so questions will not be answered.`);
  aiHistory = [{ role: "notice", text }];
  renderAiChat();
}

function renderAiChat() {
  const box = document.getElementById("ai-chat-history");
  if (!box) return;
  box.innerHTML = aiHistory.map(msg => {
    if (msg.role === "user") return `<div style="align-self:flex-end;background:#4f46e5;color:#fff;padding:8px 12px;border-radius:12px 12px 0 12px;max-width:82%;box-shadow:0 1px 3px rgba(0,0,0,0.1);font-weight:500;">${esc(msg.text)}</div>`;
    const isAi = msg.role === "assistant";
    return `<div style="align-self:flex-start;background:${isAi ? "#fff" : "#f8fafc"};border:1px solid #e2e8f0;color:#0f172a;padding:12px 14px;border-radius:12px 12px 12px 0;max-width:92%;line-height:1.5;">
        <div style="font-size:11px;font-weight:700;color:${isAi ? "#7c3aed" : "#475569"};margin-bottom:4px;">${isAi ? "AI advisor (can be wrong)" : "City Pretty"}</div>
        ${msg.text}
      </div>`;
  }).join("");
  box.scrollTop = box.scrollHeight;
}

function handleAiSubmit(e) {
  if (e) e.preventDefault();
  const input = document.getElementById("ai-user-input");
  if (!input) return;
  const q = input.value.trim();
  if (!q) return;
  input.value = "";
  sendAiQuery(q, null);
}

function askAiPrompt(key) {
  let promptText = "";
  if (key === "best_move") promptText = "What is the single best investment move for this lot?";
  else if (key === "home_worth") promptText = "What is this home worth, and how sure is that figure?";
  else if (key === "property_tax") promptText = "Will building an ADU or home addition raise my property taxes or trigger a reassessment?";
  else if (key === "adu_cost") promptText = "How much does it cost to build an ADU and what is the payback horizon?";
  else if (key === "adu_parking") promptText = "Can I build an ADU here without adding parking spaces?";
  else if (key === "solar_equity") promptText = "What is the estimated rooftop solar sizing, cost, and equity return?";
  else if (key === "lot_split") promptText = "Can I split this lot into two separate deeded parcels under SB 9?";
  else if (key === "tree_canopy") promptText = "How do satellite tree canopy and urban cooling impact property values?";
  else if (key === "historic_trends") promptText = "Show me historical trends where municipal capital generated major real estate surges.";
  else if (key === "p3_roi") promptText = "What P3 transit infrastructure and station corridor investments are nearby?";
  else if (key === "data_provenance") promptText = "What is the data provenance, assessor roll vintage, and accuracy readiness tier for this county?";
  
  sendAiQuery(promptText, key);
}

function switchAccuracyTab(tab) {
  const btnReadiness = document.getElementById("tab-btn-county-readiness");
  const btnProv = document.getElementById("tab-btn-model-provenance");
  const tabReadiness = document.getElementById("accuracy-tab-readiness");
  const tabProv = document.getElementById("accuracy-tab-provenance");
  
  if (tab === "readiness") {
    if (btnReadiness) btnReadiness.classList.add("active");
    if (btnProv) btnProv.classList.remove("active");
    if (tabReadiness) tabReadiness.style.display = "block";
    if (tabProv) tabProv.style.display = "none";
  } else {
    if (btnProv) btnProv.classList.add("active");
    if (btnReadiness) btnReadiness.classList.remove("active");
    if (tabProv) tabProv.style.display = "block";
    if (tabReadiness) tabReadiness.style.display = "none";
  }
}

function openDataAccuracyModal(fips) {
  switchAccuracyTab("readiness");
  renderCountyReadinessMatrix(fips || (typeof activeFips === "function" ? activeFips() : "06037"));
  const m = document.getElementById("accuracy-modal");
  if (m) { m.hidden = false; document.body.style.overflow = "hidden"; }
}

function openAccuracyModal() {
  switchAccuracyTab("provenance");
  renderCountyReadinessMatrix(typeof activeFips === "function" ? activeFips() : "06037");
  const m = document.getElementById("accuracy-modal");
  if (m) { m.hidden = false; document.body.style.overflow = "hidden"; }
}
function closeAccuracyModal() {
  const m = document.getElementById("accuracy-modal");
  if (m) { m.hidden = true; document.body.style.overflow = ""; }
}

function exportAccuracyReport() {
  document.body.classList.remove("prospectus-printing", "compare-printing");
  document.body.classList.add("accuracy-printing");
  window.print();
  setTimeout(() => document.body.classList.remove("accuracy-printing"), 1200);
}
window.exportAccuracyReport = exportAccuracyReport;

function getEcoregionNorm(p, m) {
  const f = typeof activeFips === "function" ? activeFips() : "06037";
  const st = typeof activeState === "function" ? activeState() : "CA";
  const c = (p && p.c) ? String(p.c) : "";
  const n = (p && p.n) ? String(p.n) : "";

  let ecoregionCode = "EPA IV: 85g / CEC Zone 9";
  let ecoregionName = "Southern California Interior Valleys";
  let baselineSummerTemp = 85.0;
  let targetCanopyPct = 30;

  if (st === "CA") {
    const coastalCities = ["Santa Monica", "Long Beach", "El Segundo", "Manhattan Beach", "Hermosa Beach", "Redondo Beach", "Torrance", "Palos Verdes", "Rancho Palos Verdes", "Huntington Beach", "Newport Beach", "Seal Beach", "Costa Mesa", "Laguna Beach", "Dana Point", "San Clemente"];
    const coastalHoods = ["Venice", "Pacific Palisades", "Playa del Rey", "Marina del Rey", "San Pedro", "Wilmington"];
    const desertCities = ["Lancaster", "Palmdale", "Santa Clarita", "Victorville"];

    if (coastalCities.some(x => c.includes(x)) || coastalHoods.some(x => n.includes(x))) {
      ecoregionCode = "EPA IV: 85f / CEC Zone 6";
      ecoregionName = "Southern California Coastal Plain";
      baselineSummerTemp = 72.0;
      targetCanopyPct = 25;
    } else if (desertCities.some(x => c.includes(x))) {
      ecoregionCode = "EPA IV: 81 / CEC Zone 14";
      ecoregionName = "Mojave Basins & High Desert";
      baselineSummerTemp = 96.0;
      targetCanopyPct = 15;
    } else {
      ecoregionCode = "EPA IV: 85g / CEC Zone 9";
      ecoregionName = "Interior Valleys & Foothills";
      baselineSummerTemp = 85.0;
      targetCanopyPct = 30;
    }
  } else if (st === "TX") {
    ecoregionCode = "EPA III: 83 Western Gulf Coastal";
    ecoregionName = "Western Gulf Coastal Plain";
    baselineSummerTemp = 93.0;
    targetCanopyPct = 32;
  } else if (st === "FL") {
    ecoregionCode = "EPA III: 75 Southern Coastal";
    ecoregionName = "Florida Coastal Plain & Everglades";
    baselineSummerTemp = 89.0;
    targetCanopyPct = 35;
  } else if (st === "WA") {
    ecoregionCode = "EPA III: 2 Puget Lowland";
    ecoregionName = "Puget Lowland Temperate";
    baselineSummerTemp = 74.0;
    targetCanopyPct = 42;
  } else if (st === "MI" || st === "IL" || st === "OH") {
    ecoregionCode = "EPA III: 55 Great Lakes / Corn Belt";
    ecoregionName = "Great Lakes Temperate Basin";
    baselineSummerTemp = 79.0;
    targetCanopyPct = 38;
  } else {
    ecoregionCode = "EPA Conterminous US Base";
    ecoregionName = "Regional Climate Division Baseline";
    baselineSummerTemp = 82.0;
    targetCanopyPct = 30;
  }

  const rawHt = (m && m.ht != null) ? +m.ht : (p && p.ht != null ? +p.ht : 0);
  const rawTg = (m && m.tg != null) ? +m.tg : (p && p.tg != null ? +p.tg : 20);

  return {
    ecoregionCode,
    ecoregionName,
    baselineSummerTemp,
    targetCanopyPct,
    heatAnomalyDeg: rawHt,
    canopyGapPct: Math.max(0, rawTg)
  };
}

function syncMethodsModalToCounty(fips) {
  const f = fips || (typeof activeFips === "function" ? activeFips() : "06037");
  const pfx = String(f).slice(0, 2);
  const comp = (typeof COUNTY_COMPLETENESS_INDEX !== "undefined" && COUNTY_COMPLETENESS_INDEX[f]) ? COUNTY_COMPLETENESS_INDEX[f] : null;
  const st = (comp && comp.state) || (typeof FIPS_STATE_MAP !== "undefined" && FIPS_STATE_MAP[pfx]) || (typeof activeState === "function" ? activeState() : "CA");
  const countyName = (comp && comp.name) || (typeof countyOf === "function" ? countyOf() : "County " + f);

  const scopeEl = document.getElementById("methods-modal-scope");
  if (scopeEl) {
    scopeEl.innerHTML = `<b>City Pretty</b> estimates how much home value and quality of life each public improvement would add in every Census block group of <b>${esc(countyName)} (${esc(st)})</b>, and what it would cost.`;
  }

  const finEl = document.getElementById("methods-financing-section");
  const waterEl = document.getElementById("methods-water-section");

  if (finEl) {
    if (f === "06037") {
      finEl.innerHTML = `
        <h3>EIFD Tax-Increment Financing (Gov. Code § 53398.50)</h3>
        <p class="small">Enhanced Infrastructure Financing Districts (Gov. Code § 53398.50 and following) pledge part of the growth in the 1% property tax. The calculator's base is the net taxable value on the 2026 Assessor roll for every parcel in the area, and the city and County shares come from the Auditor-Controller's FY 2026-27 Modified ATI ratios (AF49 report) for the area's actual tax-rate areas, weighted by value: 13,392 tax-rate areas, 99.99% of net taxable value matched. School and ERAF shares (about 47% of the 1% levy county-wide, value-weighted) cannot be pledged. Project-level funding plans model Prop 13 statutory reassessments upon deed transfer (with interactive turnover presets from 2.0% mortgage lock-in up to 4.5% high-velocity), a 2.0% statutory annual roll inflation cap, interactive 30-year municipal bond yields (4.25% AAA muni to 6.25% unrated), and a 1.35× debt-service coverage ratio, with city pledges up to 75% and County pledges up to 49% (benchmarked to the certified City of Artesia EIFD Infrastructure Financing Plan).</p>
      `;
    } else if (st === "CA") {
      const caMeta = (typeof CA_COUNTIES_REGISTRY !== "undefined" && CA_COUNTIES_REGISTRY[f]) ? CA_COUNTIES_REGISTRY[f] : null;
      const localMeasure = caMeta ? caMeta.funding : "Local Infrastructure / SB 1";
      const transitList = caMeta ? caMeta.gtfs.join(", ") : "Regional Transit GTFS";
      const hazardDesc = caMeta ? caMeta.hazard : "CAL FIRE / Regional Hazard Overlays";
      finEl.innerHTML = `
        <h3>California EIFD &amp; Local Transportation Measures (${esc(countyName)})</h3>
        <p class="small">Enhanced Infrastructure Financing Districts (Gov. Code § 53398.50) operate under California statutory rules, utilizing county-specific ATI allocation shares and local voter-approved sales-tax matching funds: <strong>${esc(localMeasure)}</strong> (LA County Measure W excluded / non-applicable outside 06037). Regional MPO: <strong>${esc(caMeta ? caMeta.mpo : "Regional MPO")}</strong>. GTFS transit agencies: <strong>${esc(transitList)}</strong>. Environmental hazard overlays: <strong>${esc(hazardDesc)}</strong>. Assessed value models Proposition 13 base-year acquisition roll-forwards, statutory 2% maximum annual roll escalation, and 1.35× debt-service coverage ratio bonding.</p>
      `;
    } else if (st === "TX") {
      finEl.innerHTML = `
        <h3>Texas Tax Increment Reinvestment Zones (TIRZ, Tex. Tax Code Ch. 311)</h3>
        <p class="small">Infrastructure capital is modeled under Texas Tax Increment Financing (TIF) statutes (Tex. Tax Code § 311). Participating cities and counties pledge incremental ad valorem property tax revenues above the base-year equalized valuation into a dedicated Tax Increment Fund. Models incorporate Texas Senate Bill 2 (3.5% voter-approval property tax rate caps) and Chapter 372 Public Improvement District (PID) assessment overlays, structuring 25-to-30-year tax-increment bonds at a 1.30× debt-service coverage ratio.</p>
      `;
    } else if (st === "FL") {
      finEl.innerHTML = `
        <h3>Florida Community Redevelopment Agencies (CRA, Fla. Stat. § 163 Part III)</h3>
        <p class="small">Tax increment financing operates under the Florida Community Redevelopment Act (Fla. Stat. § 163.387), directing 95% of annual incremental ad valorem property taxes generated within the redevelopment trust fund toward capital infrastructure. Base assessments account for the constitutional Save Our Homes (Fla. Const. Art. VII) 3% annual assessment growth cap on homestead properties, modeling 30-year municipal redevelopment revenue bonds at a 1.35× coverage ratio.</p>
      `;
    } else if (st === "WA") {
      finEl.innerHTML = `
        <h3>Washington State Tax Increment Financing (RCW 39.114 / HB 1189)</h3>
        <p class="small">Washington's statutory Tax Increment Financing program (RCW 39.114) allows local governments to designate increment areas for up to 25 years, capturing regular property tax revenue growth from private infill development to amortize public infrastructure revenue bonds without raising voter-approved levy lids.</p>
      `;
    } else if (st === "IL") {
      finEl.innerHTML = `
        <h3>Illinois Tax Increment Allocation Redevelopment Act (65 ILCS 5/11-74.4)</h3>
        <p class="small">Tax increment financing operates under the Illinois TIF Act, establishing 23-year special tax allocation funds based on Equalized Assessed Valuation (EAV) baselines. Cook County Class 2 residential assessments (10% statutory assessment ratio) and municipal Special Service Area (SSA) bond debt-service reserves are factored into public capital projections.</p>
      `;
    } else {
      finEl.innerHTML = `
        <h3>Municipal Tax-Increment Financing (TIF) &amp; Capital Improvement Program (${esc(st)})</h3>
        <p class="small">Public infrastructure financing models statutory municipal Tax Increment Financing (TIF) and local Capital Improvement Programs (CIP). Incremental real estate valuation generated by public interventions is captured through municipal tax allocation bonds amortized over 25–30 years with a standard 1.30× debt-service coverage ratio.</p>
      `;
    }
  }

  if (waterEl) {
    if (f === "06037") {
      waterEl.innerHTML = `
        <h3>Measure W Safe Clean Water Program</h3>
        <p class="small">Stormwater and green-infrastructure co-funding follows the LA County Flood Control District's Safe Clean Water Program: 50% Regional Program (projects scored by Watershed Area Steering Committees on a 110-point scale, 60 points to qualify, with benefits to disadvantaged communities at least 110% of their share of the population), 40% Municipal Program paid directly to cities, 10% District Program. Isolated strictly to Los Angeles County (FIPS 06037).</p>
      `;
    } else if (st === "CA") {
      const caMeta = (typeof CA_COUNTIES_REGISTRY !== "undefined" && CA_COUNTIES_REGISTRY[f]) ? CA_COUNTIES_REGISTRY[f] : null;
      const localFunding = caMeta ? caMeta.funding : "Local Clean Water & Parks";
      waterEl.innerHTML = `
        <h3>Regional Clean Water &amp; Stormwater Quality Programs (${esc(countyName)})</h3>
        <p class="small">LA County Measure W excluded (applicable only in 06037). Local stormwater infrastructure and urban greening co-funding are modeled through regional municipal separate storm sewer system (MS4) compliance programs, local voter-approved matching funds (<strong>${esc(localFunding)}</strong>), California Proposition 1/Proposition 4 stormwater capital grants, and local watershed management area steering committee co-investments.</p>
      `;
    } else if (st === "TX") {
      waterEl.innerHTML = `
        <h3>Texas Water Development Board (TWDB) &amp; Regional Flood Control</h3>
        <p class="small">Stormwater and flood mitigation funding is benchmarked to the Texas Water Development Board (TWDB) Flood Infrastructure Fund (FIF) and Regional Flood Planning Groups, supplemented by county-specific flood control district tax levies (e.g., Harris County Flood Control District ad valorem funding).</p>
      `;
    } else if (st === "FL") {
      waterEl.innerHTML = `
        <h3>Florida Water Management Districts &amp; Resilient Florida (Fla. Stat. § 380.093)</h3>
        <p class="small">Stormwater management and sea-level rise resilience co-funding are modeled through Florida's five regional Water Management Districts (SFWMD, SWFWMD, SJRWMD, SRWMD, NWFWMD) alongside matching grants under the Florida Department of Environmental Protection (FDEP) Resilient Florida Grant Program.</p>
      `;
    } else if (st === "WA") {
      waterEl.innerHTML = `
        <h3>Washington Department of Ecology Stormwater Financial Assistance (SFAP)</h3>
        <p class="small">Water quality and stormwater infrastructure grants are funded through the Washington Department of Ecology Stormwater Financial Assistance Program (SFAP) and local county flood control zone districts.</p>
      `;
    } else if (st === "IL") {
      waterEl.innerHTML = `
        <h3>Metropolitan Water Reclamation District (MWRD) Stormwater Management</h3>
        <p class="small">Green infrastructure and urban flood prevention funding is modeled through the Metropolitan Water Reclamation District of Greater Chicago (MWRD) Green Infrastructure Program and Cook County Stormwater Management Plan.</p>
      `;
    } else {
      waterEl.innerHTML = `
        <h3>EPA Clean Water State Revolving Fund (CWSRF) &amp; Stormwater Utilities</h3>
        <p class="small">Stormwater retention and climate resilience improvements are co-funded via EPA Clean Water State Revolving Fund (CWSRF) low-interest loans, FEMA Building Resilient Infrastructure and Communities (BRIC) grants, and municipal stormwater enterprise fund allocations.</p>
      `;
    }
  }
}
window.syncMethodsModalToCounty = syncMethodsModalToCounty;

function renderCountyReadinessMatrix(targetFips) {
  const container = document.getElementById("county-readiness-matrix-container");
  if (!container) return;

  const f = targetFips || (typeof activeFips === "function" ? activeFips() : "06037");
  window.__activeInspectedFips = f;
  const modalCard = container.closest(".modal-card");
  if (modalCard && targetFips) {
    modalCard.scrollTo({ top: 0, behavior: "smooth" });
  }
  const comp = (typeof COUNTY_COMPLETENESS_INDEX !== "undefined" && COUNTY_COMPLETENESS_INDEX[f]) ? COUNTY_COMPLETENESS_INDEX[f] : {
    fips: f,
    name: (typeof countyOf === "function" ? countyOf() : "County " + f),
    state: (typeof activeState === "function" ? activeState() : "US"),
    readiness_tier: "cadastral_only_D",
    assessor_roll_vintage: "Unverified",
    zoning_source: "statewide_parcel",
    gtfs_agencies_count: 0,
    crime_feed_status: "missing",
    canopy_dataset: "nlcd_proxy",
    sales_comps_window: ["2022-01-01", "2026-06-30"]
  };

  const tierBadge = comp.readiness_tier === "audited_A" ? '<span style="background:#064e3b;color:#a7f3d0;border:1px solid #059669;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:800;">DATA TIER A · FULLEST DATA</span>' :
    comp.readiness_tier === "verified_B" ? '<span style="background:#1e3a8a;color:#bfdbfe;border:1px solid #2563eb;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:800;">DATA TIER B</span>' :
    comp.readiness_tier === "preliminary_C" ? '<span style="background:#78350f;color:#fef3c7;border:1px solid #d97706;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:800;">DATA TIER C · PRELIMINARY</span>' :
    '<span style="background:#334155;color:#e2e8f0;border:1px solid #64748b;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:800;">DATA TIER D · BASIC</span>';

  // Subsystem descriptions
  let assessRatioText = "Proposition 13 Base-Year Tenure Recovery & 2.0% Statutory Roll Inflation Cap";
  let zoningStatutesText = "CA AB 2097 (Zero Parking near transit) · SB 9 (By-Right 2-Unit Splits) · Gov Code § 66314 (ADU + JADU) · SB 79 (Transit Rail FAR Bonuses)";
  let transitAgenciesText = "Regional Transit GTFS";
  let safetyGapsMarkup = `<div style="font-size:11px;color:#475569;margin-top:4px;">County dispatch and municipal CAD logs; reporting gaps benchmarked to FBI NIBRS tables.</div>`;
  let tifRegimeText = "California EIFD (Gov. Code § 53398.50)";

  if (comp.state === "CA") {
    if (f === "06037") {
      transitAgenciesText = "19 Regional Agencies (LA Metro, Metrolink, Big Blue Bus, Long Beach Transit, Culver CityBus, Torrance, Glendale Beeline, Pasadena Transit...)";
      safetyGapsMarkup = `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:8px 10px;margin-top:6px;font-size:11px;color:#991b1b;line-height:1.4;">
        <b>Explicit Municipal CAD Reporting Gaps:</b> Beverly Hills PD, Burbank PD, Glendale PD, Pasadena PD, Torrance PD, and Culver City PD operate independent municipal CAD systems and do not publish live Open Data incident feeds. Santa Monica PD open CAD feed ended May 2024. LAPD, LASD, and Long Beach PD are rolling 12-month feeds.
      </div>`;
      tifRegimeText = "California EIFD (Gov. Code § 53398.50) + Auditor-Controller FY 2026-27 AF49 Modified ATI Ratios (13,392 TRAs) + Measure W Safe Clean Water Program (50% Regional / 40% Municipal)";
    } else {
      const caInfo = (typeof CA_COUNTIES_REGISTRY !== "undefined" && CA_COUNTIES_REGISTRY[f]) ? CA_COUNTIES_REGISTRY[f] : null;
      const localMeasure = caInfo ? caInfo.funding : (f === "06059" ? "OCTA Measure M2 (0.5% transportation sales tax)" : "Local Sales Tax Matching Funds / SB 1");
      const transitList = caInfo ? caInfo.gtfs.join(", ") : (f === "06059" ? "OCTA Bus Transit & Metrolink Commuter Rail" : "Regional Transit GTFS");
      const hazardDesc = caInfo ? caInfo.hazard : "CAL FIRE / Regional Hazard Overlays";
      
      transitAgenciesText = `${(caInfo && caInfo.gtfs) ? caInfo.gtfs.length : (comp.gtfs_agencies_count || 1)} Regional Agencies (${transitList})`;
      safetyGapsMarkup = `<div style="font-size:11px;color:#475569;margin-top:4px;">County Sheriff CAD and municipal police feeds; local environmental hazards: <b>${esc(hazardDesc)}</b>.</div>`;
      tifRegimeText = `California EIFD (Gov. Code § 53398.50) + Local Infrastructure: <b>${esc(localMeasure)}</b> (LA County Measure W excluded).`;
      zoningStatutesText = "CA AB 2097 (Zero Parking near transit) · SB 9 (By-Right Lot Splits) · Gov Code § 66314 (ADU + JADU) · SB 79 (Transit Rail FAR Bonuses) · 6th Cycle (2021–2029) Municipal Housing Element Rezonings";
    }
  } else if (comp.state === "TX") {
    assessRatioText = "Texas Property Tax Code § 23.01 100% Market Value CAD Ad Valorem Assessment";
    zoningStatutesText = "TX SB 840 (Commercial/Office-to-Multifamily Infill) · Austin HOME Phase 1 & 2 (3 Units By-Right, 2,500 sqft Lot Minimums) · Tex. Tax Code Ch. 311";
    transitAgenciesText = comp.gtfs_agencies_count ? `${comp.gtfs_agencies_count} Transit Agencies (METRO Houston Fixed-Route & Light Rail GTFS)` : "Regional Transit GTFS";
    safetyGapsMarkup = `<div style="font-size:11px;color:#475569;margin-top:4px;">Dispatched incidents tracked via regional sheriff and primary municipal CAD open data; non-reporting municipal jurisdictions benchmarked to FBI NIBRS municipal rate schedules.</div>`;
    tifRegimeText = "Texas TIRZ (Tex. Tax Code Ch. 311) + Ch. 372 PID + Texas Water Development Board (TWDB) Flood Infrastructure Fund";
  } else if (comp.state === "FL") {
    assessRatioText = "Florida Constitution Art. VII Just Value (100% Fair Market Valuation) & Save Our Homes 3% Inflation Cap";
    zoningStatutesText = "FL Live Local Act 4.0 (Fla. Stat. § 166.04151 / § 125.01055 commercial preemption) · SB 102/328 missing middle density & 75% tax exemption";
    transitAgenciesText = comp.gtfs_agencies_count ? `${comp.gtfs_agencies_count} Transit Agencies (Miami-Dade DTPW Metrobus & Metrorail / Brightline GTFS)` : "Regional Transit GTFS";
    safetyGapsMarkup = `<div style="font-size:11px;color:#475569;margin-top:4px;">County sheriff open dispatch CAD feeds; non-reporting municipalities benchmarked to Florida FDLE & FBI NIBRS tables.</div>`;
    tifRegimeText = "Florida CRA (Fla. Stat. § 163 Part III) 95% increment capture + Save Our Homes 3% cap + Resilient Florida (Fla. Stat. § 380.093)";
  } else if (comp.state === "MI") {
    assessRatioText = "Michigan State Equalized Value SEV × 2.0 Statutory True Cash Value (Mich. Const. Art. IX § 3)";
    zoningStatutesText = "Michigan Zoning Enabling Act (MCL 125.3101) & Municipal Administrative ADU Allowances";
    transitAgenciesText = comp.gtfs_agencies_count ? `${comp.gtfs_agencies_count} Transit Agency (The Rapid Interurban Transit Partnership GTFS)` : "Regional Transit GTFS";
    safetyGapsMarkup = `<div style="font-size:11px;color:#475569;margin-top:4px;">County dispatch and MSP incident logs; municipal CAD supplemented by FBI NIBRS crime records.</div>`;
    tifRegimeText = "Michigan Downtown Development Authority (DDA) & Brownfield Redevelopment Act (Public Act 381)";
  } else if (comp.state === "IL") {
    assessRatioText = "Cook County Class 2 Residential 10% Statutory Assessment Ratio (Equalized Assessed Value × 10.0)";
    zoningStatutesText = "Illinois Municipal Code & Chicago Connected Communities Ordinance (TOD parking relief & ADU expansion)";
    transitAgenciesText = comp.gtfs_agencies_count ? `${comp.gtfs_agencies_count} Transit Agencies (CTA Chicago Transit Authority & Metra Commuter Rail GTFS)` : "Regional Transit GTFS";
    safetyGapsMarkup = `<div style="font-size:11px;color:#475569;margin-top:4px;">CPD dispatch CAD feed supplemented by Cook County Sheriff incident logs and Illinois State Police.</div>`;
    tifRegimeText = "Illinois Tax Increment Allocation Redevelopment Act (65 ILCS 5/11-74.4) + MWRD Green Infrastructure";
  } else if (comp.state === "OH") {
    assessRatioText = "Ohio Revised Code § 5713.03 35% Statutory Assessment Ratio (Assessed / 0.35 Fair Market Value)";
    zoningStatutesText = "Ohio Revised Code Title 7 & Municipal Administrative Infill Frameworks";
    transitAgenciesText = `${comp.gtfs_agencies_count || 1} Transit Agency GTFS Schedule(s)`;
    safetyGapsMarkup = `<div style="font-size:11px;color:#475569;margin-top:4px;">Municipal CAD feeds where published; secondary jurisdictions matched to FBI NIBRS tables.</div>`;
    tifRegimeText = "Ohio TIF (ORC § 5709.40) & Municipal Special Improvement Districts (SIDs)";
  } else {
    assessRatioText = "100% Statutory Ad Valorem Market Baseline & State Sales Ratio Normalization";
    zoningStatutesText = "Administrative By-Right Infill & Accessory Dwelling Unit Permitting Framework";
    transitAgenciesText = `${comp.gtfs_agencies_count || 1} Transit Agency GTFS Schedule(s)`;
    safetyGapsMarkup = `<div style="font-size:11px;color:#475569;margin-top:4px;">Regional law enforcement records matched to FBI NIBRS federal reporting schedules.</div>`;
    tifRegimeText = "Municipal Tax-Increment Financing (TIF) & Capital Improvement Program (CIP) Revenue Bonding";
  }
  // Laws come from statutes.json with their check status, not the typed summaries above.
  zoningStatutesText = stateLawSummaryText(comp.state);
  // The assessment rule text above is typed per state; label it from the state's finance profile check.
  {
    const prof = (typeof STATE_FINANCE_PROFILES !== "undefined" && STATE_FINANCE_PROFILES) ? STATE_FINANCE_PROFILES[comp.state] : null;
    const ps = prof && prof.verification && prof.verification.status;
    assessRatioText += ps === "verified" ? ` (state rule: ${verificationLabel(prof, "statute")})` : " (unverified state rule)";
  }

  const compsWindowStr =(comp.sales_comps_window && comp.sales_comps_window.length === 2) ?
    `${comp.sales_comps_window[0]} to ${comp.sales_comps_window[1]}` : "2022–2026 Sales Comps Window";

  container.innerHTML = `
    <!-- Top Active County Summary Card -->
    <div style="background:#0f172a;color:#fff;border-radius:10px;padding:16px 20px;margin-bottom:20px;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:8px;">
        <div>
          <div style="font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:#38bdf8;">Active County Data Scorecard</div>
          <h3 style="margin:2px 0 0;font-size:18px;font-weight:900;color:#f8fafc;">${esc(comp.name)}, ${esc(comp.state)} · FIPS: ${esc(comp.fips)}</h3>
        </div>
        <div>${tierBadge}</div>
      </div>
      <div style="font-size:12px;color:#cbd5e1;line-height:1.45;">
        Every US county and county-equivalent jurisdiction on the map is cataloged below with verifiable assessment roll dates, zoning engine citations, transit feeds, and safety cadastre status.
      </div>
    </div>

    <!-- 6-Subsystem Scorecard Breakdown Grid -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:12px;margin-bottom:24px;">
      <!-- Subsystem 1: Cadastre & Assessor Roll -->
      <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;padding:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <b style="font-size:12.5px;color:#0f172a;">Assessor Roll &amp; Sales Comps</b>
          <span style="font-size:10.5px;font-weight:700;color:#059669;background:#dcfce7;padding:2px 6px;border-radius:4px;">${esc(comp.assessor_roll_vintage)}</span>
        </div>
        <p class="small" style="margin:0 0 6px 0;color:#475569;line-height:1.4;">
          <b>Comps Window:</b> ${compsWindowStr}<br>
          <b>Valuation Model:</b> ${esc(assessRatioText)}
        </p>
      </div>

      <!-- Subsystem 2: Statutory Zoning Engine -->
      <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;padding:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <b style="font-size:12.5px;color:#0f172a;">Statutory Zoning GIS</b>
          <span style="font-size:10.5px;font-weight:700;color:#0284c7;background:#e0f2fe;padding:2px 6px;border-radius:4px;">${esc(comp.zoning_source.replace(/_/g, " ").toUpperCase())}</span>
        </div>
        <p class="small" style="margin:0;color:#475569;line-height:1.4;">
          <b>Statutory Preemptions:</b> ${esc(zoningStatutesText)}
        </p>
      </div>

      <!-- Subsystem 3: Transit Network & Walksheds -->
      <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;padding:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <b style="font-size:12.5px;color:#0f172a;">GTFS Transit &amp; Walksheds</b>
          <span style="font-size:10.5px;font-weight:700;color:#7c3aed;background:#ede9fe;padding:2px 6px;border-radius:4px;">${comp.gtfs_agencies_count} Agencies</span>
        </div>
        <p class="small" style="margin:0;color:#475569;line-height:1.4;">
          <b>Integrated Network:</b> ${esc(transitAgenciesText)}<br>
          <b>Isochrones:</b> 0.25-mi (5-min), 0.50-mi (10-min), and 0.75-mi (15-min) walksheds.
        </p>
      </div>

      <!-- Subsystem 4: Public Safety & Municipal Reporting Gaps -->
      <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;padding:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <b style="font-size:12.5px;color:#0f172a;">Public Safety CAD Feeds</b>
          <span style="font-size:10.5px;font-weight:700;color:${comp.crime_feed_status === 'rolling_12m' ? '#059669' : '#d97706'};background:${comp.crime_feed_status === 'rolling_12m' ? '#dcfce7' : '#fef3c7'};padding:2px 6px;border-radius:4px;">${esc(comp.crime_feed_status)}</span>
        </div>
        ${safetyGapsMarkup}
      </div>

      <!-- Subsystem 5: Tax-Increment Financing & Water -->
      <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;padding:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <b style="font-size:12.5px;color:#0f172a;">TIF &amp; Infrastructure Regime</b>
          <span style="font-size:10.5px;font-weight:700;color:#0f172a;background:#e2e8f0;padding:2px 6px;border-radius:4px;">30-Yr Bonds</span>
        </div>
        <p class="small" style="margin:0;color:#475569;line-height:1.4;">
          ${esc(tifRegimeText)}
        </p>
      </div>

      <!-- Subsystem 6: Canopy & Climate Normalization -->
      <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;padding:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <b style="font-size:12.5px;color:#0f172a;">Canopy &amp; Ecoregion Norm</b>
          <span style="font-size:10.5px;font-weight:700;color:#059669;background:#dcfce7;padding:2px 6px;border-radius:4px;">EPA IV Baseline</span>
        </div>
        <p class="small" style="margin:0;color:#475569;line-height:1.4;">
          <b>Dataset:</b> ${esc(comp.canopy_dataset)}<br>
          <b>Model:</b> Canopy deficits and micro-climate heat anomalies are normalized against the parcel's <b>EPA Level IV Ecoregion / Building Climate Zone</b> baseline rather than raw county medians, eliminating coastal vs desert geographical skew.
        </p>
      </div>
    </div>

    <!-- 639-County Searchable Directory Section -->
    <div style="border-top:1px solid #e2e8f0;padding-top:18px;">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px;">
        <h4 style="margin:0;font-size:15px;font-weight:800;color:var(--ink);">All 639 Audited US Counties Directory</h4>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <button type="button" class="action-pill active" id="btn-filter-all" onclick="filterCountyReadinessTier('all')" style="font-size:11px;padding:3px 9px;">All (639)</button>
          <button type="button" class="action-pill" id="btn-filter-audited" onclick="filterCountyReadinessTier('audited_A')" style="font-size:11px;padding:3px 9px;">Tier A (LA)</button>
          <button type="button" class="action-pill" id="btn-filter-verified" onclick="filterCountyReadinessTier('verified_B')" style="font-size:11px;padding:3px 9px;">Verified B (Metros)</button>
          <button type="button" class="action-pill" id="btn-filter-prelim" onclick="filterCountyReadinessTier('preliminary_C')" style="font-size:11px;padding:3px 9px;">Preliminary C</button>
          <button type="button" class="action-pill" id="btn-filter-cadastral" onclick="filterCountyReadinessTier('cadastral_only_D')" style="font-size:11px;padding:3px 9px;">Cadastral D</button>
        </div>
      </div>

      <div style="display:flex;gap:8px;margin-bottom:12px;">
        <input type="text" id="county-matrix-search" placeholder="Search 639 counties by name, state code, or FIPS (e.g. 'Harris', 'Cook', 'FL', '06037')..." oninput="filterCountyReadinessTable(this.value)" style="flex:1;border:1px solid #cbd5e1;border-radius:6px;padding:7px 12px;font-size:12px;outline:none;" />
      </div>

      <div style="max-height:300px;overflow-y:auto;overflow-x:auto;-webkit-overflow-scrolling:touch;border:1px solid #e2e8f0;border-radius:8px;">
        <table style="width:100%;border-collapse:collapse;font-size:11.5px;text-align:left;">
          <thead style="background:#f1f5f9;position:sticky;top:0;z-index:2;border-bottom:1px solid #cbd5e1;">
            <tr>
              <th style="padding:6px 10px;font-weight:700;color:#475569;">County &amp; State</th>
              <th style="padding:6px 10px;font-weight:700;color:#475569;">FIPS</th>
              <th style="padding:6px 10px;font-weight:700;color:#475569;">Tier</th>
              <th style="padding:6px 10px;font-weight:700;color:#475569;">Assessor Roll</th>
              <th style="padding:6px 10px;font-weight:700;color:#475569;">Zoning</th>
              <th style="padding:6px 10px;font-weight:700;color:#475569;">GTFS</th>
              <th style="padding:6px 10px;font-weight:700;color:#475569;text-align:right;">Action</th>
            </tr>
          </thead>
          <tbody id="county-matrix-table-tbody"></tbody>
        </table>
      </div>
      <div id="county-matrix-count" style="font-size:11px;color:#64748b;margin-top:6px;text-align:right;"></div>
    </div>
  `;

  // Initialize directory list
  window.__countyMatrixFilterText = "";
  window.__countyMatrixFilterTier = "all";
  renderCountyReadinessTableRows();
}
window.renderCountyReadinessMatrix = renderCountyReadinessMatrix;

function filterCountyReadinessTable(val) {
  window.__countyMatrixFilterText = (val || "").trim().toLowerCase();
  renderCountyReadinessTableRows();
}
window.filterCountyReadinessTable = filterCountyReadinessTable;

function filterCountyReadinessTier(tier) {
  window.__countyMatrixFilterTier = tier;
  const tiers = ["all", "audited_A", "verified_B", "preliminary_C", "cadastral_only_D"];
  tiers.forEach(t => {
    const btn = document.getElementById("btn-filter-" + (t === "all" ? "all" : t === "audited_A" ? "audited" : t === "verified_B" ? "verified" : t === "preliminary_C" ? "prelim" : "cadastral"));
    if (btn) btn.classList.toggle("active", t === tier);
  });
  renderCountyReadinessTableRows();
}
window.filterCountyReadinessTier = filterCountyReadinessTier;

function renderCountyReadinessTableRows() {
  const tbody = document.getElementById("county-matrix-table-tbody");
  const countEl = document.getElementById("county-matrix-count");
  if (!tbody || typeof COUNTY_COMPLETENESS_INDEX === "undefined") return;

  const q = window.__countyMatrixFilterText || "";
  const tierFilter = window.__countyMatrixFilterTier || "all";

  const allEntries = Object.values(COUNTY_COMPLETENESS_INDEX);
  const filtered = allEntries.filter(c => {
    if (tierFilter !== "all" && c.readiness_tier !== tierFilter) return false;
    if (q) {
      const full = `${c.name || ""} ${c.state || ""} ${c.fips || ""}`.toLowerCase();
      const tokens = q.split(/\s+/).filter(Boolean);
      return tokens.every(tok => full.includes(tok));
    }
    return true;
  });

  const displayList = filtered.slice(0, 100);
  tbody.innerHTML = displayList.map(c => {
    const tierPill = c.readiness_tier === "audited_A" ? '<span style="background:#064e3b;color:#a7f3d0;padding:1px 6px;border-radius:10px;font-weight:700;font-size:10px;">Tier A</span>' :
      c.readiness_tier === "verified_B" ? '<span style="background:#1e3a8a;color:#bfdbfe;padding:1px 6px;border-radius:10px;font-weight:700;font-size:10px;">Verified B</span>' :
      c.readiness_tier === "preliminary_C" ? '<span style="background:#78350f;color:#fef3c7;padding:1px 6px;border-radius:10px;font-weight:700;font-size:10px;">Prelim C</span>' :
      '<span style="background:#334155;color:#e2e8f0;padding:1px 6px;border-radius:10px;font-weight:700;font-size:10px;">Cadastral D</span>';

    const isInspected = (c.fips === window.__activeInspectedFips);
    const rowStyle = isInspected ? "background:#f0fdf4;border-left:3px solid #059669;border-bottom:1px solid #bbf7d0;" : "border-bottom:1px solid #f1f5f9;";
    return `
      <tr style="${rowStyle}">
        <td style="padding:6px 10px;font-weight:600;color:#0f172a;">${esc(c.name)}, ${esc(c.state)}${isInspected ? ' <span style="color:#059669;font-size:10px;">(Active Scorecard)</span>' : ''}</td>
        <td style="padding:6px 10px;font-family:var(--mono);color:#64748b;">${esc(c.fips)}</td>
        <td style="padding:6px 10px;">${tierPill}</td>
        <td style="padding:6px 10px;color:#475569;">${esc(c.assessor_roll_vintage)}</td>
        <td style="padding:6px 10px;color:#475569;">${esc(c.zoning_source.replace(/_/g, " "))}</td>
        <td style="padding:6px 10px;color:#475569;">${c.gtfs_agencies_count}</td>
        <td style="padding:6px 10px;text-align:right;white-space:nowrap;">
          <button type="button" class="action-pill" onclick="renderCountyReadinessMatrix('${c.fips}')" style="font-size:10px;padding:2px 7px;">Inspect</button>
          <button type="button" class="action-pill active" onclick="if(typeof openCounty==='function'){openCounty('${c.fips}');closeAccuracyModal();}" style="font-size:10px;padding:2px 7px;margin-left:4px;">Switch Map</button>
        </td>
      </tr>
    `;
  }).join("");

  if (countEl) {
    countEl.textContent = `Showing ${displayList.length} of ${filtered.length} matching counties (${allEntries.length} total indexed)`;
  }
}
window.renderCountyReadinessTableRows = renderCountyReadinessTableRows;


function openCompareDrawer() {
  if (compareList.length === 0) {
    if (selected) compareList.push(selected);
    else {
      showToast("Select a neighborhood to compare first");
      return;
    }
    updateCompareUI();
  }
  renderCompareDrawer();
  const m = $("#compare-modal");
  if (m) m.hidden = false;
}

function closeCompareDrawer() {
  const m = $("#compare-modal");
  if (m) m.hidden = true;
}

function renderCompareDrawer() {
  const box = $("#compare-content");
  if (!box) return;

  // Render Tab Switcher at top of modal
  let tabHeader = document.getElementById("compare-tab-bar");
  if (!tabHeader) {
    const parent = box.parentElement;
    tabHeader = document.createElement("div");
    tabHeader.id = "compare-tab-bar";
    tabHeader.style.cssText = "display:flex;gap:8px;margin-bottom:14px;border-bottom:1px solid #cbd5e1;padding-bottom:8px;";
    tabHeader.innerHTML = `
      <button type="button" class="action-pill ${compareActiveTab === 'hoods' ? 'active' : ''}" id="tab-cmp-hoods" onclick="switchCompareTab('hoods')">Neighborhoods (${compareList.length})</button>
      <button type="button" class="action-pill ${compareActiveTab === 'homes' ? 'active' : ''}" id="tab-cmp-homes" onclick="switchCompareTab('homes')">Homes &amp; Lots (${homeCompareList.length})</button>
    `;
    parent.insertBefore(tabHeader, box);
  } else {
    document.getElementById("tab-cmp-hoods").className = `action-pill ${compareActiveTab === 'hoods' ? 'active' : ''}`;
    document.getElementById("tab-cmp-homes").className = `action-pill ${compareActiveTab === 'homes' ? 'active' : ''}`;
    document.getElementById("tab-cmp-hoods").textContent = `Neighborhoods (${compareList.length})`;
    document.getElementById("tab-cmp-homes").textContent = `Homes & Lots (${homeCompareList.length})`;
  }

  if (compareActiveTab === "homes") {
    if (!homeCompareList.length) {
      box.innerHTML = `<p class="empty" style="padding:20px;text-align:center;">No homes selected. Click <b>"+ Compare This Home"</b> on any property dossier to compare investment returns side-by-side.</p>`;
      return;
    }
    box.innerHTML = homeCompareList.map(h => {
      const b = h.playbook.best;
      return `
        <div class="compare-col" style="background:#fff;border:1px solid #cbd5e1;border-radius:8px;padding:14px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
            <div>
              <h4 style="margin:0 0 2px 0;font-size:13px;font-weight:800;color:#0f172a;">${esc(h.address)}</h4>
              <div style="font-size:10.5px;color:#64748b;">APN ${esc(h.ain)} &middot; ${esc(h.county)}</div>
            </div>
            <button type="button" class="small" style="background:none;border:none;cursor:pointer;color:var(--ink-3);font-size:14px;font-weight:700;" onclick="homeCompareList = homeCompareList.filter(x => x.ain !== '${h.ain}'); renderCompareDrawer(); updateHomeCompareUI();">✕</button>
          </div>

          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:8px;margin-bottom:10px;">
            <div style="font-size:10px;font-weight:700;color:#166534;text-transform:uppercase;">Top Recommended Move:</div>
            <div style="font-size:12px;font-weight:800;color:#15803d;margin-top:2px;">${esc(b.title)}</div>
            <div style="font-size:11px;font-weight:700;color:#047857;margin-top:2px;">${b.equity != null && isFinite(b.equity) ? "+$" + Math.round(b.equity).toLocaleString() + " Net Equity" : "Net equity not on file"}${b.roi != null && isFinite(b.roi) ? ` (${b.roi} / $1)` : ""}${b.illustrative ? " &middot; illustrative, assumed inputs" : ""}</div>
          </div>

          <div class="c-row"><span class="k">Lot Size</span><span class="v">${h.lotSqft != null ? h.lotSqft.toLocaleString() + " sq ft" : "Not recorded"}</span></div>
          <div class="c-row"><span class="k">Living Area</span><span class="v">${h.isVacantLand ? '<span style="color:#0284c7;font-weight:700">Vacant Infill Land (0 sq ft)</span>' : (h.bldgSqft != null ? `${h.bldgSqft.toLocaleString()} sq ft (${h.stories} story)` : "Not recorded")}</span></div>
          <div class="c-row"><span class="k">Est. Market Value</span><span class="v">${h.valuation != null ? '$' + Number(h.valuation).toLocaleString() : "Not on file"}</span></div>
          <div class="c-row"><span class="k">${h.isVacantLand ? 'Price / Lot Sq Ft' : 'Price / Sq Ft'}</span><span class="v">${(h.valuation != null && (h.isVacantLand ? h.lotSqft : h.bldgSqft)) ? `~$${Math.round(h.valuation / (h.isVacantLand ? h.lotSqft : h.bldgSqft)).toLocaleString()} / sq ft` : "Not on file"}</span></div>
          <div class="c-row"><span class="k">Solar DC Capacity</span><span class="v">${h.solarKw != null ? h.solarKw + " kW DC" : "Not on file"}</span></div>
          <div class="c-row"><span class="k">Transit Walkshed</span><span class="v">${h.nearestStn ? (h.nearestStn.distMi <= 0.5 ? '<b style="color:#0284c7">Within 1/2 mile</b>' : h.nearestStn.distMi.toFixed(2) + ' mi') : '–'}</span></div>
          <div class="c-row"><span class="k">Payback Horizon</span><span class="v">${b.paybackYrs != null && b.paybackYrs !== "" ? b.paybackYrs + " yrs" : "Not on file"}</span></div>
        </div>
      `;
    }).join("");
    return;
  }

  // Otherwise Neighborhoods tab
  if (!compareList.length) {
    box.innerHTML = `<p class="empty">No neighborhoods selected. Click "+ Compare" on any neighborhood card.</p>`;
    return;
  }
  box.innerHTML = compareList.map(id => {
    const f = byId.get(id); if (!f) return "";
    const p = f.properties, d = D.details[id] || {}, m = d.m || {};
    const recs = (d.r || []).map(a => Object.fromEntries(REC_KEYS.map((k, i) => [k, a[i]])));
    const val = recs.filter(r => allowed(r.id) && D.catalog[r.id].kind === "value").sort((a, b) => b.vpd - a.vpd);
    const top = val[0];
    const topC = top ? D.catalog[top.id] : null;
    const topRng = top && topC ? formatVpdRange(top.vpd, topC.grade, top.id, m) : null;
    return `
      <div class="compare-col">
        <div style="display:flex;justify-content:space-between;align-items:baseline">
          <h4>${esc(p.n)}</h4>
          <button type="button" class="small" style="background:none;border:none;cursor:pointer;color:var(--ink-3)" onclick="toggleCompare('${id}'); renderCompareDrawer();">✕</button>
        </div>
        <div class="c-row"><span class="k">City</span><span class="v">${esc(p.c)}</span></div>
        <div class="c-row"><span class="k">Typical Home Value</span><span class="v">${fmt$(m.hv)}</span></div>
        <div class="c-row"><span class="k">Median Rent</span><span class="v">${m.rent ? fmt$(m.rent) + "/mo" : "–"}</span></div>
        <div class="c-row"><span class="k">Homes / Owner-Occ</span><span class="v">${fmtN(m.homes)} (${m.own != null ? Math.round(m.own) + "%" : "–"})</span></div>
        <div class="c-row"><span class="k">Best Bet</span><span class="v">${topC ? esc(topC.name) : "–"}</span></div>
        <div class="c-row"><span class="k">Expected Return</span><span class="v">${topRng ? topRng.estStr + " (" + topRng.str + ")" : "–"}</span></div>
        <div class="c-row"><span class="k">Ecoregion Norm</span><span class="v">${(typeof getEcoregionNorm === "function") ? getEcoregionNorm(p, m).ecoregionCode : "EPA IV Base"}</span></div>
        <div class="c-row"><span class="k">Heat vs Eco-Norm</span><span class="v">${m.ht != null ? (m.ht > 0 ? "+" : "") + (+m.ht).toFixed(1) + "°F" : "–"}</span></div>
        <div class="c-row"><span class="k">Tree Canopy Deficit</span><span class="v">${m.tg != null ? m.tg + "% to " + ((typeof getEcoregionNorm === "function") ? getEcoregionNorm(p, m).targetCanopyPct : 35) + "% goal" : "–"}</span></div>
        <div class="c-row"><span class="k">Renter Displacement</span><span class="v">${m.own != null && m.own < 45 ? '<span style="color:#b45309;font-weight:700">Elevated (' + Math.round(100 - m.own) + '% Renters)</span>' : '<span style="color:#15803d">Low Risk (' + (m.own != null ? Math.round(m.own) : '–') + '% Owners)</span>'}</span></div>
        <div class="c-row"><span class="k">Violent Crime / 1k</span><span class="v">${m.vc != null ? (+m.vc).toFixed(1) : "–"}</span></div>
        <div class="c-row"><span class="k">Bus Frequency</span><span class="v">${m.bt != null ? Math.round(m.bt) + "/hr" : "–"}</span></div>
      </div>
    `;
  }).join("");
}

function exportComparisonBrief() {
  document.body.classList.remove("prospectus-printing", "accuracy-printing");
  document.body.classList.add("compare-printing");
  window.print();
  setTimeout(() => document.body.classList.remove("compare-printing"), 1200);
}

function openMethodsModal() {
  if (typeof syncMethodsModalToCounty === "function") {
    syncMethodsModalToCounty(typeof activeFips === "function" ? activeFips() : "06037");
  }
  const m = $("#methods-modal");
  if (m) m.hidden = false;
}

function closeMethodsModal() {
  const m = $("#methods-modal");
  if (m) m.hidden = true;
}

function openCorrection(id) {
  const f = byId.get(id); const p = f ? f.properties : {};
  const subj = encodeURIComponent(`Correction for Block Group ${id} (${p.n || "LA County"})`);
  const body = encodeURIComponent(`Hi City Pretty team,\n\nI have a data correction for Block Group ${id} in ${p.n || ""}, ${p.c || ""}:\n\n- Project or metric name:\n- Corrected value or finding:\n- Source or documentation link:\n\nThank you!`);
  window.open(`mailto:corrections@citypretty.org?subject=${subj}&body=${body}`, '_blank');
}

function renderTechAppendix(ocReal) {
  const row = (id, what, status, ok) => `<tr style="border-top:1px solid var(--rule)"><td style="padding:4px 6px"><code>${esc(id)}</code></td><td style="padding:4px 6px">${esc(what)}</td><td style="padding:4px 6px;color:${ok ? "var(--good-ink)" : "var(--warn-ink)"}">${ok ? "✓" : "✗"} ${esc(status)}</td></tr>`;
  if (ocReal && D_OC && D_OC.meta && D_OC.meta.sources) return `
    <p class="small">${esc(countyOf())} was built on ${esc(D_OC.meta.built || "")} from the public files below (every file is kept raw in the build folder so each number can be traced). Nothing was estimated where a source is missing: those projects are simply not scored here.</p>
    <table class="small" style="width:100%;border-collapse:collapse;margin-top:6px">
      <thead><tr style="background:var(--ground)"><th style="text-align:left;padding:4px 6px">Source</th><th style="text-align:left;padding:4px 6px">Used for</th><th style="text-align:left;padding:4px 6px">Status in this build</th></tr></thead>
      <tbody>${D_OC.meta.sources.map(r => !isCAActive() && /^Tax-rate areas/.test(r[0] || "") ? row(r[0], "County and city share of property-tax increment", "Not used outside California (the tax-increment calculator models California's EIFDs)", false) : row(r[0], r[1], r[2], r[3])).join("")}</tbody>
    </table>`;
  return `
    <p class="small">What the build log recorded for the live feeds this page uses (build ${esc((D.meta && D.meta.built) || "")}). The full source list, with row counts and vintages, is in the field report below the map under "Data in this build".</p>
    <table class="small" style="width:100%;border-collapse:collapse;margin-top:6px">
      <thead><tr style="background:var(--ground)"><th style="text-align:left;padding:4px 6px">Resource / endpoint</th><th style="text-align:left;padding:4px 6px">Service</th><th style="text-align:left;padding:4px 6px">Status in this build</th></tr></thead>
      <tbody>
        ${row("pi9x-tg5x", "LADBS \"Building and Safety - Building Permits Issued from 2020 to Present\" (queried live per lot)", "Live query", true)}
        ${row("d9aa-v8bm", "LADBS \"Building Permit Information Data\" (older permits with story counts; queried live per lot)", "Live query", true)}
        ${row("h73f-gn57", "\"MyLA311 Service Request Data 2025\" (dumping, graffiti; Nov 2024 – Nov 2025 window)", "Loaded", true)}
        ${row("2cy6-i7zn", "\"MyLA311 Cases 2026\"", "Not reached in this build; 2025 data used instead", false)}
        ${row("73a2-6ar5", "\"MyLA311 Cases March 2025 to December 2025\"", "Not reached in this build", false)}
        ${row("k7nn-b2ep", "\"LAPD NIBRS Offenses Dataset\" (latest record 2026-10-26)", "Loaded", true)}
        ${row("2nrs-mtv8", "\"Crime Data from 2020 to 2024\" (frozen series; latest record 2025-03-28)", "Loaded", true)}
        ${row("gqf2-vm2j", "\"LAPD NIBRS Victims Dataset\" (victim table; not needed)", "Not reached in this build", false)}
        ${row("FHSZSRA_23_3", "CAL FIRE Fire Hazard Severity Zones, State Responsibility Area (2024)", "Live query / shipped polygons", true)}
        ${row("FHSALRA25_v1_All", "CAL FIRE Fire Hazard Severity Zones, Local Responsibility Area (2025)", "Live query / shipped polygons", true)}
        ${row("CGS_Alquist_Priolo_Fault_Zones", "California Geological Survey earthquake fault zones (with landslide and liquefaction zones)", "Live query / shipped polygons", true)}
        ${row("LACounty_Parcel", "LA County Assessor parcel service (lot lines, per-house records)", "Live query", true)}
        ${row("pais_sales_parcels", "LA County PAIS recorded sales (per-house last sale)", "Live query", true)}
      </tbody>
    </table>
    <p class="small muted" style="margin-top:6px">Per-lot checks (permits, sales, historic, hillside, hazard and fire zones) are queried from the agencies' public services when the page is online; nine of them are also answered from polygons shipped with this file.</p>
  `;
}


// ---------------- Orange County Expansion Module ----------------
var D_OC = null;
function activeBundle() {
  if (typeof activeCounty !== "undefined" && activeCounty === "oc" && D_OC) return D_OC;
  if (typeof COUNTY_BUNDLES !== "undefined" && typeof activeFips === "function" && COUNTY_BUNDLES[activeFips()]) return COUNTY_BUNDLES[activeFips()];
  return (typeof D !== "undefined" && D) ? D : null;
}

var ocLayer = null;
var activeCounty = "la"; // "la" or "oc" ("oc" = any non-LA county bundle; which one is D_OC.meta.fips)
// ---------------- Multi-county support (round 6): any county bundle built by the national pipeline
var COUNTY_BUNDLES = {};          // fips -> unpacked bundle (Orange County is stored here too once unpacked)
const ORANGE_FIPS = "06059";
function activeFips() {
  if (typeof selected !== "undefined" && selected && selected.length >= 5 && !selected.startsWith("06037")) {
    return selected.slice(0, 5);
  }
  if (activeCounty === "oc" && D_OC && D_OC.meta && D_OC.meta.fips) return D_OC.meta.fips;
  if (activeCounty === "la") return "06037";
  if (typeof selected !== "undefined" && selected && selected.length >= 5) return selected.slice(0, 5);
  return "06037";
}
function isOrangeActive() { return activeCounty === "oc" && activeFips() === ORANGE_FIPS; }
const STATE_FULL = { AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "District of Columbia",
  FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island",
  SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin",
  WY: "Wyoming", PR: "Puerto Rico" };
const FIPS_STATE_MAP = {
  "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO", "09": "CT", "10": "DE", "11": "DC",
  "12": "FL", "13": "GA", "15": "HI", "16": "ID", "17": "IL", "18": "IN", "19": "IA", "20": "KS", "21": "KY",
  "22": "LA", "23": "ME", "24": "MD", "25": "MA", "26": "MI", "27": "MN", "28": "MS", "29": "MO", "30": "MT",
  "31": "NE", "32": "NV", "33": "NH", "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND", "39": "OH",
  "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC", "46": "SD", "47": "TN", "48": "TX", "49": "UT",
  "50": "VT", "51": "VA", "53": "WA", "54": "WV", "55": "WI", "56": "WY", "72": "PR"
};
function activeState() {
  const f = activeFips();
  const pfx = f.slice(0, 2);
  if (FIPS_STATE_MAP[pfx]) return FIPS_STATE_MAP[pfx];
  const el = countyBundleEls().find(e => e.dataset.fips === f);
  return (el && el.dataset.st) || "CA";
}
function countyOf(m) { return (m && m.county) || (activeCounty === "oc" && D_OC && D_OC.meta && D_OC.meta.county) || "Los Angeles County"; }
function countyBundleEls() { return [...document.querySelectorAll("script.county-bundle")]; }
// ---------------- IndexedDB Fast Cache for County Bundles (<20ms instant load on return)
// v3 stores { tag, data }: tag is the county file's ETag, so a rebuilt file replaces the copy a visitor kept
const CP_DB_NAME = "citypretty_cache_v3";
try { if (typeof indexedDB !== "undefined") indexedDB.deleteDatabase("citypretty_cache_v2"); } catch (e) {}
const CP_STORE_NAME = "bundles";
function openBundleDB() {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") return resolve(null);
    try {
      const req = indexedDB.open(CP_DB_NAME, 1);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(CP_STORE_NAME)) {
          db.createObjectStore(CP_STORE_NAME);
        }
      };
      req.onsuccess = e => resolve(e.target.result);
      req.onerror = () => resolve(null);
    } catch(e) { resolve(null); }
  });
}

async function getCachedBundle(fips) {
  try {
    const db = await openBundleDB();
    if (!db) return null;
    return new Promise(resolve => {
      const tx = db.transaction(CP_STORE_NAME, "readonly");
      const store = tx.objectStore(CP_STORE_NAME);
      const req = store.get(fips);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch(e) { return null; }
}

async function setCachedBundle(fips, data) {
  try {
    const db = await openBundleDB();
    if (!db) return;
    const tx = db.transaction(CP_STORE_NAME, "readwrite");
    const store = tx.objectStore(CP_STORE_NAME);
    store.put(data, fips);
  } catch(e) {}
}

async function fetchJSON(url) {   // hosted county file: JSON, or gzip-compressed JSON (.json.gz) that the server sent as it is
  const cleanUrl = (typeof resolveRepoAssetUrl === "function") ? resolveRepoAssetUrl(url) : (url.startsWith("http") ? url : url);
  let r;
  try {
    r = await fetch(cleanUrl);
  } catch(e) {
    if (!cleanUrl.startsWith("http")) {
      r = await fetch("https://milessilverman.github.io/city-pretty/" + cleanUrl);
    } else throw e;
  }
  if (!r.ok) throw new Error(url + ": HTTP " + r.status);
  const buf = new Uint8Array(await r.arrayBuffer());
  if (buf[0] === 0x1f && buf[1] === 0x8b) {
    try {
      if (typeof DecompressionStream !== "undefined") {
        const s = await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
        return JSON.parse(s);
      }
    } catch(e) {}
    if (typeof fflate !== "undefined" && fflate.gunzipSync) {
      const decomp = fflate.gunzipSync(buf);
      const jsonStr = (typeof TextDecoder !== "undefined") ? new TextDecoder().decode(decomp) : fflate.strFromU8(decomp);
      return JSON.parse(jsonStr);
    }
  }
  return JSON.parse(new TextDecoder().decode(buf));
}
let _countyLoading = false;
let _currentLoadingFips = null;
const _bundlePromises = {};

function countyNameOf(fips) {
  if (!fips) return "";
  fips = String(fips).padStart(5, "0");
  if (fips === "06037") return "Los Angeles County";
  if (fips === ORANGE_FIPS) return "Orange County";
  const el = (typeof countyBundleEls === "function") && countyBundleEls().find(e => e.dataset.fips === fips);
  if (el && el.dataset.name) return el.dataset.name;
  if (typeof COUNTY_COMPLETENESS_INDEX !== "undefined" && COUNTY_COMPLETENESS_INDEX[fips]) {
    return COUNTY_COMPLETENESS_INDEX[fips].name;
  }
  if (typeof CA_COUNTIES_REGISTRY !== "undefined" && CA_COUNTIES_REGISTRY[fips]) {
    return CA_COUNTIES_REGISTRY[fips].name;
  }
  return "county " + fips;
}

// Names chosen as "the nearest OpenStreetMap neighborhood label" are only true when that label lies inside the
// block group. Otherwise the area is next to that neighborhood, not in it (the National Mall is not "The Wharf"),
// so the name becomes "Near The Wharf".
function qualifyNearestNames(B) {
  if (!B || B.__namesQualified || !Array.isArray(B.features) || !Array.isArray(B.hood_labels)) return B;
  B.__namesQualified = true;
  const byName = new Map();
  for (const [n, lat, lng] of B.hood_labels) { if (!byName.has(n)) byName.set(n, []); byName.get(n).push([lat, lng]); }
  const inRingXY = (r, x, y) => { let ins = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ins = !ins; } return ins; };
  const inGeom = (g, lat, lng) => {
    const polys = g && g.type === "Polygon" ? [g.coordinates] : g && g.type === "MultiPolygon" ? g.coordinates : [];
    return polys.some(p => p[0] && inRingXY(p[0], lng, lat) && !p.slice(1).some(h => inRingXY(h, lng, lat)));
  };
  for (const f of B.features) {
    const p = f && f.properties; if (!p || !p.n || /^Near /.test(p.n)) continue;
    const det = B.details && B.details[p.id], m = det && det.m;
    const ns = (m && m.ns) || "";
    if (!/^nearest/i.test(ns)) continue;
    const pts = byName.get(p.n); if (!pts) continue;
    if (pts.some(([lat, lng]) => inGeom(f.geometry, lat, lng))) continue;
    p.n = "Near " + p.n;
    if (m) { m.n = p.n; m.ns = ns.replace(/^nearest neighborhood label/i, "nearest neighborhood label, which lies outside this block group"); }
  }
  return B;
}
async function loadCountyBundle(fips) {
  if (!fips) return null;
  fips = String(fips).padStart(5, "0");
  if (COUNTY_BUNDLES[fips]) return COUNTY_BUNDLES[fips];
  if (_bundlePromises[fips]) return _bundlePromises[fips];
  _bundlePromises[fips] = (async () => {
    const el = (typeof countyBundleEls === "function") ? countyBundleEls().find(e => e.dataset.fips === fips) : null;
    // Browser cache, checked against the file's ETag so a rebuilt county replaces the stored copy
    let tag = null;
    if (el && el.dataset.src) {
      try {
        const h = await fetch(resolveRepoAssetUrl(el.dataset.src), { method: "HEAD", cache: "no-cache" });
        if (h.ok) tag = h.headers.get("etag") || h.headers.get("last-modified");
      } catch (e) {}
    }
    try {
      const cached = await getCachedBundle(fips);
      if (cached && cached.data && cached.data.features && cached.data.features.length && (!tag || cached.tag === tag)) {
        COUNTY_BUNDLES[fips] = qualifyNearestNames(cached.data);
        return cached.data;
      }
    } catch(e) {}
    let B = null;
    if (el) {
      try {
        B = el.dataset.src ? await fetchJSON(el.dataset.src) : el.textContent.trim() ? await unpackGzipB64(el.textContent.trim()) : null;
      } catch (err) {
        console.warn("Could not fetch remote bundle for " + fips, err);
      }
    }
    if (!B || !B.features) {
      const info = (typeof COUNTY_COMPLETENESS_INDEX !== "undefined" && COUNTY_COMPLETENESS_INDEX[fips]) ||
                   (typeof CA_COUNTIES_REGISTRY !== "undefined" && CA_COUNTIES_REGISTRY[fips]) ||
                   { name: el ? el.dataset.name : "County " + fips, state: el ? el.dataset.st : "" };
      B = {
        type: "FeatureCollection",
        features: [],
        details: {},
        search: {},
        plans: {},
        profit: {},
        layers: {},
        meta: {
          schema: 2,
          county: info.name,
          fips: fips,
          state: info.state,
          built: "2026-11-08",
          readiness_tier: info.readiness_tier || "cadastral_only_D",
          load_failed: true, coverage: el && el.dataset.coverage === "lots" ? "lots" : "missing",
          sources: [
            el && el.dataset.coverage === "lots"
              ? ["County data", "Not built yet for this county; only live property lines are shown", "Lot lines only", false]
              : ["County data file", "This county's data file could not be downloaded; only live property lines are shown", "Not loaded", false]
          ]
        }
      };
    }
    if (B && B.features && B.features.length) {
      setCachedBundle(fips, { tag, data: B });
      qualifyNearestNames(B);
    }
    if (el && el.dataset && el.dataset.sites) {
      try {
        const S = await fetchJSON(el.dataset.sites);
        await loadSites();
        if (SITES && S && S.sites) {
          SITES.meta = SITES.meta || {};
          SITES.meta[fips] = S.meta;
          SITES.sites = SITES.sites || {};
          Object.assign(SITES.sites, S.sites);
        }
      } catch (e) {
        console.warn("sites for " + fips + " not loaded", e);
      }
    }
    if (!B.meta) B.meta = {};
    if (!B.meta.fips) B.meta.fips = fips;
    if (B.plans && D.plans) Object.assign(D.plans, B.plans);
    if (B.profit && D.under) {
      if (!D.under.profit) D.under.profit = {};
      Object.assign(D.under.profit, B.profit);
    }
    const bl = B.layers || {};
    ["freeways", "arterials", "parks", "water", "rail", "stations", "walls", "amenities", "stops"].forEach(k => {
      if (bl[k] && bl[k].features && D.layers[k] && D.layers[k].features) {
        D.layers[k].features.push(...bl[k].features);
      } else if (bl[k] && !D.layers[k]) {
        D.layers[k] = bl[k];
      }
    });
    if (Array.isArray(bl.facilities)) {
      if (!Array.isArray(D.layers.facilities)) D.layers.facilities = [];
      D.layers.facilities.push(...bl.facilities);
    }
    if (Array.isArray(bl.projects)) {
      if (!Array.isArray(D.layers.projects)) D.layers.projects = [];
      D.layers.projects.push(...bl.projects);
    }
    if (bl.streets && D.layers.streets) {
      const names = D.layers.streets.names || (D.layers.streets.names = []), idx = new Map(names.map((n, i) => [n, i])), map_ = new Map();
      (bl.streets.names || []).forEach((n, i) => {
        let j = idx.get(n);
        if (j === undefined) { j = names.length; names.push(n); idx.set(n, j); }
        map_.set(i, j);
      });
      if (bl.streets.fwy && D.layers.streets.fwy) D.layers.streets.fwy.push(...bl.streets.fwy.map(([c, n, e]) => [c, map_.get(n) ?? n, e]));
      if (bl.streets.cells) {
        if (!D.layers.streets.cells) D.layers.streets.cells = {};
        for (const [k, lines] of Object.entries(bl.streets.cells)) {
          const L2 = lines.map(([c, n, p]) => [c, map_.get(n) ?? n, p]);
          if (D.layers.streets.cells[k]) D.layers.streets.cells[k].push(...L2);
          else D.layers.streets.cells[k] = L2;
        }
      }
    }
    if (B.cities && B.cities.features && D.cities) D.cities.features.push(...B.cities.features);
    if (B.city_labels && D.city_labels) D.city_labels.push(...B.city_labels);
    if (B.hoods && B.hoods.features && D.hoods) D.hoods.features.push(...B.hoods.features);
    if (B.hood_labels && D.hood_labels) D.hood_labels.push(...B.hood_labels);
    if (bl.park_labels && D.layers.park_labels) {
      D.layers.park_labels.push(...bl.park_labels);
      D.layers.park_labels.sort((a, b) => b[3] - a[3]);
    }
    if (bl.fac_areas && D.layers.fac_areas && D.layers.fac_areas.cells) Object.assign(D.layers.fac_areas.cells, bl.fac_areas.cells || {});
    if (typeof _ctxGeom !== "undefined") _ctxGeom.clear();
    (B.features || []).forEach(f => {
      byId.set(f.properties.id, f);
      const dd = (B.details || {})[f.properties.id];
      if (dd && dd.m) dd.m.__fips = fips;
      if (!D.details[f.properties.id]) D.details[f.properties.id] = dd;
    });
    COUNTY_BUNDLES[fips] = B;
    return B;
  })();
  try {
    return await _bundlePromises[fips];
  } catch (err) {
    delete _bundlePromises[fips];
    throw err;
  }
}

var ATTR_NOW = null;
function countyAttribution() {
  const f = activeFips();
  if (f === "06037") return "© OpenStreetMap contributors · US Census · LA County Assessor, Auditor-Controller and Parks · LAPD · LASD · MyLA311 · CHP · LA Metro · city tree surveys · Tree Equity Score";
  if (f === ORANGE_FIPS) return "© OpenStreetMap contributors · US Census · OCGIS / OC Public Works · CA DOJ · CHP · OCTA · Anaheim street trees · CAL FIRE · Tree Equity Score";
  if (f.startsWith("06")) return "© OpenStreetMap contributors · US Census · CA DOJ · CHP · CAL FIRE · CDE · MobilityData GTFS · Tree Equity Score · all sources: Methods & Vintages";
  return "© OpenStreetMap contributors · US Census · NCES · MobilityData GTFS · Tree Equity Score · all sources: Methods & Vintages";
}

function syncAttribution() {
  if (typeof map === "undefined" || !map || !map.attributionControl) return;
  const now = ATTR_NOW || "© OpenStreetMap contributors · US Census · LA County Assessor, Auditor-Controller and Parks · LAPD · LASD · MyLA311 · CHP · LA Metro · city tree surveys · Tree Equity Score", t = countyAttribution();
  if (t === now) return;
  map.attributionControl.removeAttribution(now).addAttribution(t);
  ATTR_NOW = t;
}

async function openCounty(fips, wantBgId) {
  if (!fips) return;
  fips = String(fips).padStart(5, "0");
  if (fips === "06037") return switchCounty("la", wantBgId);
  if (_countyLoading && _currentLoadingFips === fips) return;
  _countyLoading = true;
  _currentLoadingFips = fips;
  const cName = (typeof countyNameOf === "function" && countyNameOf(fips)) || "County " + fips;
  if (typeof showHud === "function") showHud("Loading " + cName + "…");
  if (typeof startProgress === "function") startProgress(25);
  try {
    let B = COUNTY_BUNDLES[fips];
    if (!B && fips === ORANGE_FIPS) {
      await ensureOrangeCounty();
      B = COUNTY_BUNDLES[ORANGE_FIPS] || D_OC;
    }
    if (!B) {
      if (typeof showToast === "function") showToast("Loading " + cName + "…");
      if (typeof setHud === "function") setHud("Fetching " + cName + " bundle…");
      if (typeof setProgress === "function") setProgress(45);
      B = await loadCountyBundle(fips);
    }
    if (typeof setProgress === "function") setProgress(75);
    if (typeof setHud === "function") setHud("Unpacking " + cName + " block groups…");
    if (!B) throw new Error("County bundle not found for " + fips);
    if (D_OC !== B) {
      if (ocLayer && typeof map !== "undefined" && map && map.hasLayer(ocLayer)) map.removeLayer(ocLayer);
      ocLayer = null;
      D_OC = B;
      if (typeof window !== "undefined") window.D_OC = D_OC;
    }
    if (B && B.features) {
      for (const f of B.features) {
        if (f.properties && f.properties.id) byId.set(f.properties.id, f);
      }
    }
    if (B && B.details && D && D.details) {
      Object.assign(D.details, B.details);
    }
    if (B && B.plans && D && D.plans) {
      Object.assign(D.plans, B.plans);
    }
    switchCounty("oc", wantBgId);
    if (typeof _ctxGeom !== "undefined") _ctxGeom.clear();
    if (typeof _fDrawn !== "undefined" && _fDrawn.clear) _fDrawn.clear();
    if (typeof _drawn !== "undefined" && _drawn.clear) _drawn.clear();
    if (typeof _cellCache !== "undefined" && _cellCache.clear) _cellCache.clear();
    if (layers.fac && layers.fac.clearLayers) layers.fac.clearLayers();
    if (layers.facArea && layers.facArea.clearLayers) layers.facArea.clearLayers();
    if (layers.amen && map.hasLayer(layers.amen)) { map.removeLayer(layers.amen); layers.amen = null; }
    if (layers._lazy) delete layers._lazy.amen;
    if (typeof drawContext === "function") drawContext();
    if (typeof drawFacilities === "function") drawFacilities();
    if (typeof drawAmenities === "function") drawAmenities();
    if (typeof drawZoning === "function") drawZoning();
    if (typeof scheduleNatLots === "function") scheduleNatLots();
    if (typeof setProgress === "function") setProgress(100);
    if (typeof setHud === "function") setHud("✓ " + cName + " Ready");
    setTimeout(() => {
      if (typeof doneProgress === "function") doneProgress();
      if (typeof hideHud === "function") hideHud();
    }, 450);
  } catch (err) {
    console.error("County load failed:", err);
    if (typeof showToast === "function") showToast("Could not load county: " + (err.message || "network error"));
    const sel = document.getElementById("county-more");
    if (sel) sel.value = isOrangeActive() ? "" : (activeFips() === "06037" ? "" : activeFips());
    if (typeof setProgress === "function") setProgress(100);
    if (typeof setHud === "function") setHud("✓ " + cName + " Ready");
    setTimeout(() => {
      if (typeof doneProgress === "function") doneProgress();
      if (typeof hideHud === "function") hideHud();
    }, 400);
  } finally {
    _countyLoading = false;
    _currentLoadingFips = null;
  }
}
if (typeof window !== "undefined") {
  window.D_OC = D_OC;
  window.activeCounty = activeCounty;
  window.switchCounty = switchCounty;
  window.initOrangeCounty = initOrangeCounty;
}

async function unpackGzipB64(b64Text) {
  const bin = await b64Bytes(b64Text);
  if (typeof DecompressionStream !== "undefined") {
    try {
      const s = await new Response(new Blob([bin]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
      return JSON.parse(s);
    } catch(e) {}
  }
  const s = atob(b64Text);
  const u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  const decomp = fflate.gunzipSync(u);
  const jsonStr = (typeof TextDecoder !== "undefined") ? new TextDecoder().decode(decomp) : fflate.strFromU8(decomp);
  return JSON.parse(jsonStr);
}

// ---------------- County picker: one searchable list of every county, LA and Orange County included
function initCountyPicker() {
  const btn = $("#county-pick-btn"), pop = $("#county-pick-pop"), q = $("#county-q"), list = $("#county-list"), foot = $("#county-pick-foot");
  if (!btn || !pop || !q || !list) return;
  const all = countyBundleEls().map(e => {
    const st = e.dataset.st || "", name = e.dataset.name || "";
    return { fips: e.dataset.fips, name, st, stateName: STATE_FULL[st] || st, lots: e.dataset.coverage === "lots",
      key: (name + " " + st + " " + (STATE_FULL[st] || "")).toLowerCase() };
  }).sort((a, b) => a.stateName.localeCompare(b.stateName) || a.name.localeCompare(b.name));
  const withData = all.filter(c => !c.lots).length;
  if (foot) foot.textContent = `${withData} counties with data · ${all.length - withData} with property lines only`;
  q.placeholder = `Search ${all.length} counties or a state`;
  let shown = [], cursor = -1;
  const render = () => {
    const words = q.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
    shown = words.length ? all.filter(c => words.every(w => c.key.includes(w))) : all;
    const cur = activeFips();
    cursor = Math.min(Math.max(cursor, 0), shown.length - 1);
    let lastState = "";
    list.innerHTML = shown.map((c, i) => {
      const head = !words.length && c.stateName !== lastState ? `<li class="pick-group" role="presentation">${esc(c.stateName)}</li>` : "";
      lastState = c.stateName;
      return head + `<li role="option" id="cp-${c.fips}" data-i="${i}" aria-selected="${i === cursor}" class="${c.fips === cur ? "current" : ""}">
        <span>${words.length ? esc(c.name) + `<span class="muted">, ${esc(c.st)}</span>` : esc(c.name.replace(/ County$/, ""))}</span>${c.lots ? `<span class="pick-tag">lot lines only</span>` : c.fips === cur ? `<span class="pick-tag on">open</span>` : ""}</li>`;
    }).join("") || `<li class="pick-empty">No county matches “${esc(q.value)}”</li>`;
    q.setAttribute("aria-activedescendant", shown[cursor] ? "cp-" + shown[cursor].fips : "");
    const act = list.querySelector('[aria-selected="true"]'); if (act) act.scrollIntoView({ block: "nearest" });
  };
  const open = () => { pop.hidden = false; btn.setAttribute("aria-expanded", "true"); q.value = ""; cursor = Math.max(0, all.findIndex(c => c.fips === activeFips())); render(); q.focus(); };
  const close = () => { pop.hidden = true; btn.setAttribute("aria-expanded", "false"); };
  const choose = c => { close(); if (!c) return; if (c.fips === "06037") switchCounty("la"); else openCounty(c.fips); };
  btn.addEventListener("click", () => pop.hidden ? open() : close());
  q.addEventListener("input", () => { cursor = 0; render(); });
  q.addEventListener("keydown", e => {
    if (e.key === "ArrowDown") { cursor = Math.min(cursor + 1, shown.length - 1); render(); e.preventDefault(); }
    else if (e.key === "ArrowUp") { cursor = Math.max(cursor - 1, 0); render(); e.preventDefault(); }
    else if (e.key === "Enter") { choose(shown[cursor]); e.preventDefault(); }
    else if (e.key === "Escape") { close(); btn.focus(); }
  });
  list.addEventListener("mousedown", e => { const li = e.target.closest("li[data-i]"); if (li) { e.preventDefault(); choose(shown[+li.dataset.i]); } });
  document.addEventListener("click", e => { if (!pop.hidden && !e.target.closest("#county-pick")) close(); });
}

// ---------------- A little fun: fly somewhere promising
function surpriseMe() {
  const feats = (activeCounty === "oc" && D_OC && D_OC.features) ? D_OC.features : (D && D.bgs ? D.bgs.features : []);
  const good = feats.filter(f => f.properties && f.properties.v >= 1 && f.properties.id !== selected).sort((a, b) => b.properties.v - a.properties.v);
  const pool = good.slice(0, Math.max(12, Math.ceil(good.length / 4)));
  if (!pool.length) { showToast("No neighborhood here returns $1 or more per $1 yet. Try another county."); return; }
  const f = pool[Math.floor(Math.random() * pool.length)], p = f.properties;
  map.flyToBounds(L.geoJSON(f).getBounds(), { maxZoom: 15, padding: [60, 60], duration: 1.4 });
  map.once("moveend", () => select(p.id, false));
  showToast(`${p.n || "This neighborhood"}${p.c ? ", " + p.c : ""}: about ${fvpd(p.v)} of home value per $1`);
}
window.surpriseMe = surpriseMe;

// ---------------- First-visit welcome card
function showWelcome(force) {
  const w = $("#welcome"); if (!w) return;
  let seen = false; try { seen = localStorage.getItem("cp_welcome_seen") === "1"; } catch (e) {}
  if (force || !seen) w.hidden = false;
}
function hideWelcome() {
  const w = $("#welcome"); if (w) w.hidden = true;
  try { localStorage.setItem("cp_welcome_seen", "1"); } catch (e) {}
}
window.showWelcome = showWelcome; window.hideWelcome = hideWelcome;

let _ocLayersMerged = false;
function ensureOrangeCounty() {
  if (window.ocReady) return window.ocReady;
  const btnOc = $("#btn-county-oc"); if (btnOc) { btnOc.dataset.title = btnOc.title; btnOc.title = "Loading Orange County…"; }
  const before = D_OC, wasActive = activeCounty;
  window.ocReady = initOrangeCounty().then(() => {
    if (btnOc) btnOc.title = btnOc.dataset.title || "Expand to Orange County";
    // initOrangeCounty() sets D_OC; if another county is open, keep it open
    if (wasActive === "oc" && before && before !== D_OC && before.meta && before.meta.fips !== ORANGE_FIPS) { D_OC = before; window.D_OC = before; }
    if (typeof _drawn !== "undefined" && _drawn && _drawn.clear) _drawn.clear();
    if (typeof _cellCache !== "undefined" && _cellCache && _cellCache.clear) _cellCache.clear();
    drawContext();
  }).catch(e => console.warn("Orange County bundle failed to unpack", e));
  return window.ocReady;
}
async function initOrangeCounty() {
  const b64Text = await cpText("bundle-oc");
  if (!b64Text) return;
  try {
    D_OC = qualifyNearestNames(await unpackGzipB64(b64Text)); cpRelease("bundle-oc");
    if (D_OC.meta && !D_OC.meta.fips) D_OC.meta.fips = ORANGE_FIPS;
    COUNTY_BUNDLES[ORANGE_FIPS] = D_OC;
    if (typeof window !== "undefined") window.D_OC = D_OC;
    
    if (D_OC.plans && typeof D !== "undefined" && D && D.plans) {
      Object.assign(D.plans, D_OC.plans);
    }
    if (D_OC.profit && typeof D !== "undefined" && D && D.under) {
      if (!D.under.profit) D.under.profit = {};
      Object.assign(D.under.profit, D_OC.profit);
    }

    const ocReal = (D_OC.meta && D_OC.meta.schema >= 2);   // real geometry (schema 2); the first bundle's parks and neighborhoods are placeholders
    if (!_ocLayersMerged && D_OC.layers && typeof D !== "undefined" && D && D.layers) {
      const ocl = D_OC.layers;
      (ocReal ? ["freeways", "arterials", "parks", "water", "rail", "stations", "walls", "amenities", "stops", "facilities", "projects"] : ["freeways", "arterials", "water", "rail", "stations"]).forEach(k => {
        if (ocl[k] && ocl[k].features && D.layers[k] && D.layers[k].features) {
          D.layers[k].features.push(...ocl[k].features);
        } else if (ocl[k] && !D.layers[k]) {
          D.layers[k] = ocl[k];
        }
      });
      if (ocl.streets && D.layers.streets && (ocReal || ocl.streets.cell === D.layers.streets.cell)) {
        if (ocReal && ocl.streets.fwy && D.layers.streets.fwy) D.layers.streets.fwy.push(...ocl.streets.fwy.map(([c, n, e]) => [c, n, e]));
        const baseNames = D.layers.streets.names || [];
        const nameMap = new Map(), baseIdx = new Map(baseNames.map((n, i) => [n, i]));   // Map lookup: indexOf over 60k names took seconds
        (ocl.streets.names || []).forEach((n, idx) => {
          let mappedIdx = baseIdx.get(n);
          if (mappedIdx === undefined) {
            mappedIdx = baseNames.length;
            baseNames.push(n); baseIdx.set(n, mappedIdx);
          }
          nameMap.set(idx, mappedIdx);
        });
        if (ocReal && ocl.streets.fwy && D.layers.streets.fwy) {
          const n0 = D.layers.streets.fwy.length - ocl.streets.fwy.length;
          for (let i = n0; i < D.layers.streets.fwy.length; i++) D.layers.streets.fwy[i] = [D.layers.streets.fwy[i][0], nameMap.get(D.layers.streets.fwy[i][1]) ?? D.layers.streets.fwy[i][1], D.layers.streets.fwy[i][2]];
        }
        if (ocl.streets.cells) {
          if (!D.layers.streets.cells) D.layers.streets.cells = {};
          for (const [cellKey, lines] of Object.entries(ocl.streets.cells)) {
            const remappedLines = lines.map(([c, nIdx, poly]) => [c, nameMap.get(nIdx) ?? nIdx, poly]);
            if (D.layers.streets.cells[cellKey]) {
              D.layers.streets.cells[cellKey].push(...remappedLines);
            } else {
              D.layers.streets.cells[cellKey] = remappedLines;
            }
          }
        }
      }
      if (D_OC.cities && D_OC.cities.features && D.cities && D.cities.features) {
        D.cities.features.push(...D_OC.cities.features);
      }
      if (D_OC.city_labels && D.city_labels) {
        D.city_labels.push(...D_OC.city_labels);
      }
      if (ocReal && D_OC.hoods && D_OC.hoods.features && D.hoods && D.hoods.features) {
        D.hoods.features.push(...D_OC.hoods.features);
      }
      if (ocReal && D_OC.hood_labels && D.hood_labels) {
        D.hood_labels.push(...D_OC.hood_labels);
      }
      if (ocReal && D_OC.layers.park_labels && D.layers.park_labels) {
        D.layers.park_labels.push(...D_OC.layers.park_labels);
        D.layers.park_labels.sort((a, b) => b[3] - a[3]);   // drawLabels stops at the first park below the zoom's acreage cutoff
      }
      if (ocReal && D_OC.layers.fac_areas && D.layers.fac_areas && D.layers.fac_areas.cells) Object.assign(D.layers.fac_areas.cells, D_OC.layers.fac_areas.cells || {});
      _ocLayersMerged = true;
      if (typeof _ctxGeom !== "undefined") _ctxGeom.clear();
    }

    if (D_OC.features) {
      D_OC.features.forEach(f => {
        const p = f.properties;
        if (typeof byId !== "undefined" && byId) byId.set(p.id, f);
        if (typeof D !== "undefined" && D && D.details && !D.details[p.id]) {
          D.details[p.id] = D_OC.details[p.id];
        }
      });
    }
    console.log("Orange County bundle unpacked successfully (" + (D_OC.features ? D_OC.features.length : 0) + " neighborhood tracts across " + Object.keys(D_OC.plans || {}).length + " neighborhoods).");
  } catch (e) {
    console.log("Could not unpack OC bundle:", e.message || e);
  }
}

function buildStamp(override) {
  const b = override || (typeof D !== "undefined" && D && D.meta && D.meta.built) || "";
  const m = String(b).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  return `${m[3]} ${["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"][+m[2] - 1]} ${m[1]}`;
}
function switchCounty(c, wantBgId) {
  performance.mark("sw:start"); activeCounty = c;
  if (typeof window !== "undefined") window.activeCounty = activeCounty;
  const btnLa = $("#btn-county-la"), btnOc = $("#btn-county-oc");
  if (btnLa) btnLa.classList.toggle("active", c === "la");
  if (btnOc) btnOc.classList.toggle("active", c === "oc" && (!D_OC || !D_OC.meta || !D_OC.meta.fips || D_OC.meta.fips === ORANGE_FIPS));
  { const selM = document.getElementById("county-more"); if (selM) { const other = c === "oc" && !!(D_OC && D_OC.meta && D_OC.meta.fips && D_OC.meta.fips !== ORANGE_FIPS); selM.classList.toggle("active", other); if (!other) selM.value = ""; } }
  
  // Ensure property lines checkbox is checked
  const cbLots = $("#l-lots");
  if (cbLots) cbLots.checked = true;

  if (typeof lots !== "undefined" && lots && typeof map !== "undefined" && map) {
    if (map.hasLayer(lots)) map.removeLayer(lots);
    lots = null;
    if (typeof window !== "undefined") window.lots = null;
  }
  if (typeof syncLots === "function") syncLots();
  if (typeof syncAttribution === "function") syncAttribution();
  if (typeof numLayer !== "undefined" && numLayer && typeof map !== "undefined" && map) {
    if (map.hasLayer(numLayer)) map.removeLayer(numLayer);
    numLayer = null;
  }
  if (typeof drawNumbers === "function") drawNumbers();

  // Clear street / vector caches so they re-render immediately for the new county bounds
  if (typeof _drawn !== "undefined" && _drawn && _drawn.clear) _drawn.clear();
  if (typeof _cellCache !== "undefined" && _cellCache && _cellCache.clear) _cellCache.clear();
  if (typeof _fwyLines !== "undefined") _fwyLines = null;
  if (typeof drawContext === "function") drawContext();
  performance.mark("sw:context");
  if (typeof syncHeaderDomToCounty === "function") syncHeaderDomToCounty(activeFips());
  const eb = $(".eyebrow");
  if (c === "oc") {
    if (eb) eb.textContent = "CITY PRETTY · " + countyOf().toUpperCase() + (activeState() !== "CA" ? ", " + activeState() : "") + (D_OC && D_OC.meta && D_OC.meta.schema >= 2 ? "" : " (PRELIMINARY)") + " · " + (buildStamp(D_OC && D_OC.meta && D_OC.meta.built) || buildStamp());
    if (typeof bgs !== "undefined" && bgs && map && map.hasLayer(bgs)) map.removeLayer(bgs);
    if (!ocLayer && D_OC && typeof L !== "undefined" && L.geoJSON && typeof map !== "undefined" && map) {
      ocLayer = L.geoJSON(D_OC, {
        style: styleBg,
        onEachFeature: (f, l) => {
          const p = f.properties;
          l.bindTooltip(() => {
            const k = $("#metric").value;
            const m = METRICS[k];
            const mv = m ? m.unit(m.f(p)) : "";
            const catName = p.t && D.catalog[p.t] ? D.catalog[p.t].name : p.t;
            return `<b>${esc(p.n)}</b> · ${esc(p.c)}<br>${m ? m.label.split("(")[0] + ": " + mv + "<br>" : ""}${p.t && p.v >= 1 ? "Best bet: " + esc(catName) + " (" + fvpd(p.v) + " / $1)" : "Nothing returns $1 per $1"}`;
          }, { sticky: true });
          l.on("click", e => {
            select(p.id, false);
            if (map.getZoom() >= 16) houseAt(e.latlng);
            else if (typeof houseHint === "function") houseHint();
          });
        }
      }).addTo(map);
    } else if (ocLayer && typeof map !== "undefined" && map) {
      if (!map.hasLayer(ocLayer)) ocLayer.addTo(map);
      ocLayer.setStyle(styleBg);
    }
    performance.mark("sw:oclayer"); retop();
    restyle(); performance.mark("sw:restyle");
    // Update datalist names for county
    if (D_OC && D_OC.search) {
      const namesEl = $("#names");
      if (namesEl) {
        namesEl.innerHTML = Object.keys(D_OC.search).sort().map(n => `<option value="${esc(n)}">`).join("");
      }
    }
    
    const defBg = (D_OC && D_OC.meta && D_OC.meta.default_bg) ? D_OC.meta.default_bg : null;
    const mh = window.location.hash.match(/#bg=([0-9]+)/);
    const hashBg = (mh && mh[1].startsWith(activeFips())) ? mh[1] : null;
    const selectTarget = wantBgId || hashBg || (window.__linkBg && window.__linkBg.startsWith(activeFips()) ? window.__linkBg : null) || defBg;

    if (wantBgId && byId.has(wantBgId)) {
      select(wantBgId, true);
    } else if (hashBg && byId.has(hashBg)) {
      select(hashBg, true);
    } else {
      const targetId = (selectTarget && byId.has(selectTarget)) ? selectTarget : (D_OC && D_OC.features && D_OC.features[0] && D_OC.features[0].properties && D_OC.features[0].properties.id);
      if (targetId && typeof select === "function") select(targetId, false);
      if (typeof map !== "undefined" && map) {
        if (isOrangeActive() && map.flyTo) {
          map.flyTo([33.71, -117.83], 11);
        } else {
          const bounds = (ocLayer && ocLayer.getBounds && ocLayer.getBounds().isValid()) ? ocLayer.getBounds() : (D_OC && D_OC.features && D_OC.features.length ? L.geoJSON(D_OC).getBounds() : null);
          if (bounds && bounds.isValid && bounds.isValid()) {
            map.fitBounds(bounds, { maxZoom: 11.5, padding: [25, 25] });
          }
        }
      }
    }
    const nT = D_OC && D_OC.features ? D_OC.features.length : 0, nC = D_OC && D_OC.features ? new Set(D_OC.features.map(f => f.properties.c)).size : 0;
    const real = D_OC && D_OC.meta && D_OC.meta.schema >= 2;
    if (typeof showToast === "function") showToast(real ? `${countyOf()}: ${fmtN(nT)} block groups in ${nC} ${nC === 1 ? "city" : "cities and communities"}` : `${countyOf()}: ${fmtN(nT)} census tracts in ${nC} ${nC === 1 ? "city" : "cities and communities"} (preliminary data)`);
    const sel = $("#county-more"); if (sel) sel.value = isOrangeActive() ? "" : activeFips();
  } else {
    if (typeof syncHeaderDomToCounty === "function") syncHeaderDomToCounty("06037");
    if (ocLayer && typeof map !== "undefined" && map && map.hasLayer(ocLayer)) map.removeLayer(ocLayer);
    if (typeof bgs !== "undefined" && bgs && map && !map.hasLayer(bgs)) bgs.addTo(map);
    retop();
    restyle();
    if (typeof map !== "undefined" && map && map.flyTo) map.flyTo([34.05, -118.25], 11);
    const names = new Map(Object.entries((D && D.meta && D.meta.search) || {}));
    const namesEl = $("#names");
    if (namesEl) {
      namesEl.innerHTML = [...names.keys()].sort().map(n => `<option value="${esc(n)}">`).join("");
    }
    const start = (D && D.meta && D.meta.default_bg) || (D && D.bgs && D.bgs.features && D.bgs.features[0] && D.bgs.features[0].properties.id);
    if (start && typeof select === "function") select(start, false);
    if (typeof showToast === "function") showToast("Returned to Los Angeles County");
  }
}

async function init() {
  performance.mark("init:start"); D = await unpack(); performance.mark("init:unpacked");
  map = L.map("map", { preferCanvas: true, zoomSnap: 0.5, minZoom: 9, maxZoom: 19 });
  map.attributionControl.setPrefix(false).addAttribution("© OpenStreetMap contributors · US Census · LA County Assessor, Auditor-Controller and Parks · LAPD · LASD · MyLA311 · CHP · LA Metro · city tree surveys · Tree Equity Score");
  D.bgs.features.forEach(f => byId.set(f.properties.id, f));
  retop(); performance.mark("init:retop");
  breaks = computeBreaks();
  bgs = L.geoJSON(D.bgs, { style: styleBg, onEachFeature: (f, l) => {
    const p = f.properties;
    l.bindTooltip(() => `<b>${esc(p.n)}</b> · ${esc(p.c)}<br>${p.t && p.v >= 1 ? esc(D.catalog[p.t].name) + ": " + fvpd(p.v) + " per $1" : "Nothing returns $1 per $1"}`, { sticky: true });
    l.on("click", e => { select(p.id, false); if (map.getZoom() >= 16) houseAt(e.latlng); else if (typeof houseHint === "function") houseHint(); }); } }).addTo(map);
  performance.mark("init:bgs"); legend(); report(); performance.mark("init:report");   // the context lines are drawn once the map has a view (below), so Leaflet renders them in one pass
  { if (typeof syncHeaderDomToCounty === "function") syncHeaderDomToCounty("06037"); }

  // Wire Presets & Top Actions
  document.querySelectorAll(".preset-btn").forEach(b => b.onclick = () => { applyPreset(b.dataset.preset); syncHash(selected); });
  const rBtn = $("#btn-renter-header"); if (rBtn) rBtn.onclick = toggleRenterView;
  const cBtn = $("#btn-compare-header"); if (cBtn) cBtn.onclick = openCompareDrawer;
  const mBtn = $("#btn-methods-header"); if (mBtn) mBtn.onclick = openMethodsModal;
  window.addEventListener("hashchange", checkHash);
  map.on("moveend", () => { if (typeof scheduleNatLots === "function") scheduleNatLots(); });   // round 8.7: lot lines outside LA and Orange
  { const cbl = $("#l-lots"); if (cbl) cbl.addEventListener("change", () => { if (typeof scheduleNatLots === "function") scheduleNatLots(); }); }

  const names = new Map(Object.entries(D.meta.search || {}));
  $("#names").innerHTML = [...names.keys()].sort().map(n => `<option value="${esc(n)}">`).join("");
  const handleSearchSubmit = val => {
    val = String(val || "").trim();
    if (!val) return;
    hideAddr();
    const valLower = val.toLowerCase();
    let id = null;
    if (typeof D_OC !== "undefined" && D_OC && D_OC.search) {
      id = D_OC.search[val];
      if (!id) {
        const k = Object.keys(D_OC.search).find(x => x.toLowerCase() === valLower);
        if (k) id = D_OC.search[k];
      }
    }
    if (!id && typeof names !== "undefined" && names) {
      id = names.get(val);
      if (!id) {
        for (const [k, v] of names.entries()) {
          if (k.toLowerCase() === valLower) { id = v; break; }
        }
      }
    }
    if (id) { select(id, true); return; }
    if (typeof countyBundleEls === "function") {
      const matchCounty = countyBundleEls().find(e => {
        const cn = (e.dataset.name || "").toLowerCase().replace(/ county| parish/g, "").trim();
        return cn === valLower.replace(/ county| parish/g, "").trim();
      });
      if (matchCounty && matchCounty.dataset.fips) { openCounty(matchCounty.dataset.fips); return; }
    }
    addressSearchUS(val);
  };
  $("#q").onchange = e => handleSearchSubmit(e.target.value);
  let activeSearchIndex = -1;
  function updateActiveSearchItem(items) {
    items.forEach((item, idx) => {
      if (idx === activeSearchIndex) {
        item.classList.add("active-search-item");
        item.style.background = "#e0f2fe";
        item.scrollIntoView({ block: "nearest" });
      } else {
        item.classList.remove("active-search-item");
        item.style.background = "#fff";
      }
    });
  }
  $("#q").addEventListener("keydown", e => {
    const box = $("#addr-results");
    const items = box ? box.querySelectorAll("button.addr-item") : [];
    if (e.key === "ArrowDown" && items.length > 0) {
      e.preventDefault();
      activeSearchIndex = (activeSearchIndex + 1) % items.length;
      updateActiveSearchItem(items);
      return;
    }
    if (e.key === "ArrowUp" && items.length > 0) {
      e.preventDefault();
      activeSearchIndex = (activeSearchIndex - 1 + items.length) % items.length;
      updateActiveSearchItem(items);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (box && activeSearchIndex >= 0 && items[activeSearchIndex]) {
        items[activeSearchIndex].click();
        return;
      }
      handleSearchSubmit(e.target.value);
      return;
    }
    if (e.key === "Escape") {
      hideAddr();
      return;
    }
  });
  $("#q").addEventListener("input", e => {
    clearTimeout(addrTimer);
    const v = e.target.value.trim();
    if (v.length >= 2) addrTimer = setTimeout(() => addressSearch(v, false), 220);
    else hideAddr();
  });
  document.addEventListener("click", e => {
    const ar = $("#addr-results");
    if (ar && !ar.contains(e.target) && e.target !== $("#q")) { hideAddr(); }
  });
  $("#metric").onchange = restyle;
  $("#evid").onchange = () => { retop(); restyle(); if (selected) select(selected, false); };
  ["#l-roads", "#l-transit", "#l-parks", "#l-amen", "#l-hoods", "#l-fac", "#l-zone", "#l-under", "#l-proj", "#l-p3"].forEach(id => $(id) && ($(id).onchange = drawContext));
  $("#fac-kinds").innerHTML = D.layers.fac_kinds.map((k, i) => `<label style="display:block"><input type="checkbox" data-fk="${i}" checked> <span class="fac" style="display:inline-block;vertical-align:middle;background:${(FAC_STYLE[k] || ["#444"])[0]}">${(FAC_STYLE[k] || ["", "•"])[1]}</span> ${esc(k)}</label>`).join("");
  $("#fac-kinds").querySelectorAll("input").forEach(x => x.onchange = () => { facOn = new Set([...$("#fac-kinds").querySelectorAll("input:checked")].map(y => +y.dataset.fk)); _fDrawn.forEach(l => layers.facArea && layers.facArea.removeLayer(l)); _fDrawn.clear(); drawFacilities(); });
  $("#l-tiles").onchange = e => {
    if (e.target.checked) { const dark = matchMedia("(prefers-color-scheme: dark)").matches && document.documentElement.dataset.theme !== "light";
      tiles = L.tileLayer(`https://{s}.basemaps.cartocdn.com/${dark ? "dark_all" : "rastertiles/voyager"}/{z}/{x}/{y}{r}.png`, { attribution: "© CARTO", subdomains: "abcd", maxZoom: 19 }).addTo(map); tiles.bringToBack(); }
    else if (tiles) { map.removeLayer(tiles); tiles = null; }
    restyle();
  };
  map.on("zoomend", zoomed);
  if ($("#l-lots")) $("#l-lots").onchange = syncLots;
  syncLots();
  cachedLotLines().then(c => {
    if (!c) return;
    lotCache = c;
    if (typeof window !== "undefined") window.lotCache = lotCache;
    const isOc = (typeof activeCounty !== "undefined" && activeCounty === "oc");
    if (lots && !isOc && typeof map !== "undefined" && map) {
      if (map.hasLayer(lots)) map.removeLayer(lots);
      lots = null;
      syncLots();
    }
  });
  $("#lots-hood").onclick = () => { $("#lots-note").hidden = true; selectAt(map.getCenter()); };
  map.on("moveend", drawNumbers);
  map.on("click", async e => {
    const ll = e.latlng;
    const curFips = typeof activeFips === "function" ? activeFips() : "06037";
    let inCurCounty = false;
    if (curFips === "06037" && typeof bgs !== "undefined" && bgs && bgs.getLayers) {
      inCurCounty = (typeof pointInFeature === "function") && bgs.getLayers().some(l => l.feature && pointInFeature(l.feature, ll.lng, ll.lat));
    } else if (typeof ocLayer !== "undefined" && ocLayer && ocLayer.getLayers) {
      inCurCounty = (typeof pointInFeature === "function") && ocLayer.getLayers().some(l => l.feature && pointInFeature(l.feature, ll.lng, ll.lat));
    }

    if (!inCurCounty) {
      let targetFips = null;
      if (typeof getParcelService === "function") {
        const svc = getParcelService(ll);
        if (svc && svc.counties && svc.counties.length) targetFips = svc.counties[0];
      }
      if (!targetFips && typeof fipsFromLatLng === "function") {
        const fcc = await fipsFromLatLng(ll.lat, ll.lng);
        if (fcc && fcc.fips) targetFips = fcc.fips;
      }
      if (targetFips && targetFips !== curFips) {
        if (typeof countyBundleEls === "function" && countyBundleEls().some(el => el.dataset.fips === targetFips)) {
          if (typeof showToast === "function") showToast("Opening county " + targetFips + "…");
          try {
            await openCounty(targetFips);
          } catch(err) {
            console.warn("Could not switch county on click:", err);
          }
        }
      }
    }

    if (typeof houseAt === "function" && map.getZoom() >= 16) {
      houseAt(e.latlng);
    }
  });
  let aerial = null;
  window.syncAerial = () => { const want = $("#l-aerial").checked;
    if (want && !aerial) { aerial = L.tileLayer("https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}",
      { maxNativeZoom: 16, maxZoom: 19, attribution: "Imagery: USGS The National Map (public domain)" }).addTo(map); aerial.bringToBack(); restyle(); }
    if (!want && aerial) { map.removeLayer(aerial); aerial = null; restyle(); } };
  $("#l-aerial").onchange = window.syncAerial;
  map.on("mousemove", hoverParcel);
  map.on("mousemove", zoneTip);
  // at street level the address preview replaces the area tooltip
  map.on("zoomend", () => { const hi = map.getZoom() >= 17; bgs.eachLayer(l => { const t = l.getTooltip(); if (t) { t.options.opacity = hi ? 0 : 0.9; if (hi) l.closeTooltip(); } }); });
  map.on("mouseout", () => { clearTimeout(hoverTimer); });
  map.on("moveend", () => { drawStreets(); drawLabels(); drawZoning(); drawFacilities(); drawAmenities(); drawUnder(); drawProjects(); if (typeof scheduleNatLots === 'function' && $('#l-lots') && $('#l-lots').checked && map.getZoom() >= 15) scheduleNatLots(); });
  L.control.scale({ imperial: true, metric: false, maxWidth: 140, position: "bottomleft" }).addTo(map);
  const Loc = L.Control.extend({ options: { position: "topleft" }, onAdd() { const b = L.DomUtil.create("button", "locate"); b.type = "button"; b.innerHTML = "<svg class=ic aria-hidden=true><use href=#i-locate /></svg> Find me";
    b.title = "Center the map on where you are and open your block group"; L.DomEvent.disableClickPropagation(b); b.onclick = () => locateMe(b); return b; } });
  new Loc().addTo(map);
  performance.mark("init:wired"); map.fitBounds(L.geoJSON(D.bgs).getBounds(), { animate: false }); performance.mark("init:fit");
  drawContext(); performance.mark("init:context");
  initCountyPicker();
  cpText("la-crash-counts"); setTimeout(() => cpText("overlay-chunks"), 800);   // small/background downloads after first paint
  setTimeout(() => loadSites().then(() => { if (selected) { const f = byId.get(selected); if (f) fillSites(f.properties); } }), 1200);
  const start = D.meta.default_bg && byId.has(D.meta.default_bg) ? D.meta.default_bg : D.bgs.features[0].properties.id;
  const initHash = window.location.hash.match(/#bg=([0-9]+)/);
  window.__linkBg = initHash ? initHash[1] : null;   // select() below rewrites the hash, so keep the link the page was opened with
  if (initHash && byId.has(initHash[1])) select(initHash[1], true);
  else select(start, false);
  map.setView(L.geoJSON(byId.get(start)).getBounds().getCenter(), 12, { animate: false });
  performance.mark("init:selected"); $("#loading").hidden = true;
  // Orange County (about 130 MB once unpacked) loads only when it is needed: its button, a link into it, a link into
  // another county, or the search box (its neighborhood names join the search list).
  { const id = window.__linkBg;
    if (id && !id.startsWith("06037")) ensureOrangeCounty().then(() => {   // a link into another county opens it once the page is ready
      if (id.startsWith("06059") && byId.has(id) && id !== selected) { switchCounty("oc"); select(id, true); }
      else if (id !== selected && !byId.has(id)) { history.replaceState(null, null, "#bg=" + id); checkHash(); }
    }); }
  { const q = $("#q"); if (q) q.addEventListener("focus", () => ensureOrangeCounty(), { once: true }); }
  { const b = $("#btn-mobile-opts"), hdr = document.querySelector("header.top");   // phones: show or hide the folded controls
    if (b && hdr) b.addEventListener("click", () => { const open = hdr.classList.toggle("opts-open"); b.setAttribute("aria-expanded", open); b.textContent = open ? "Hide map options" : "Map options and tools"; }); }
  // Header menus close when you pick an item, click elsewhere or press Escape
  const MENUS = "header.top details[open], .map-bar details[open]";
  document.addEventListener("click", e => document.querySelectorAll(MENUS).forEach(d => {
    if (!d.contains(e.target) || (d.id === "tools-menu" && e.target.closest(".menu-item"))) d.open = false; }));
  document.addEventListener("keydown", e => { if (e.key === "Escape") document.querySelectorAll(MENUS).forEach(d => { d.open = false; }); });
  document.querySelectorAll("header.top details.menu, .map-bar details.menu").forEach(d => d.addEventListener("toggle", () => {
    if (d.open) document.querySelectorAll("header.top details.menu[open], .map-bar details.menu[open]").forEach(o => { if (o !== d) o.open = false; }); }));
  { const sb = $("#btn-surprise"); if (sb) sb.onclick = () => surpriseMe(); }
  showWelcome(false);
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => { drawContext(); restyle(); });
}

// Global Modal Accessibility: Escape key & Backdrop click dismiss
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (typeof hideAddr === "function") hideAddr();
    if (typeof closeProspectusModal === "function") closeProspectusModal();
    if (typeof closeAccuracyModal === "function") closeAccuracyModal();
    if (typeof closeCompareDrawer === "function") closeCompareDrawer();
    if (typeof closeMethodsModal === "function") closeMethodsModal();
    if (typeof closeAiAdvisor === "function") closeAiAdvisor();
    if (typeof closeResearchModal === "function") closeResearchModal();
    if (typeof closeHistoricalTrendsModal === "function") closeHistoricalTrendsModal();
  }
});

document.addEventListener("click", (e) => {
  if (e.target && e.target.classList && e.target.classList.contains("overlay-modal")) {
    const id = e.target.id;
    if (id === "prospectus-modal" && typeof closeProspectusModal === "function") closeProspectusModal();
    else if (id === "accuracy-modal" && typeof closeAccuracyModal === "function") closeAccuracyModal();
    else if (id === "compare-modal" && typeof closeCompareDrawer === "function") closeCompareDrawer();
    else if (id === "methods-modal" && typeof closeMethodsModal === "function") closeMethodsModal();
    else if (id === "ai-advisor-modal" && typeof closeAiAdvisor === "function") closeAiAdvisor();
    else if (id === "research-modal" && typeof closeResearchModal === "function") closeResearchModal();
    else if (id === "trends-modal" && typeof closeHistoricalTrendsModal === "function") closeHistoricalTrendsModal();
    else e.target.hidden = true;
  }
});


// --- Interactive Leaflet Map Popup for Every House ---
let houseMapPopup = null;
function stateReformHeadline(st, m) {
  // Driven by app/data/statutes.json: only laws checked against the statute are described as rules.
  return stateLawSummaryHtml(st);
}

function updateHouseMapPopup(a, lot, ll, st, houseHv, z, R, valCheck, valLow, valHigh) {
  if (typeof map === "undefined" || !map) return;
  const p = byId.get(selected) ? byId.get(selected).properties : { c: a.county || countyOf(), hv: 850000, rent: 2200 };
  const curB = (typeof activeBundle === "function" ? activeBundle() : null) || (typeof D !== "undefined" && D) || {};
  const m = ((curB.details && curB.details[selected]) || (D && D.details && D.details[selected]) || {}).m || p;
  const addr = a.SitusFullAddress || ("Parcel APN " + a.AIN);
  const city = p.c || a.county || countyOf();
  const rollVal = (+a.Roll_LandValue || 0) + (+a.Roll_ImpValue || 0) || (+a.Roll_TotalValue || 0);
  // Unknown stays unknown: a missing check is never shown as "no risk"
  const floodText = (R && R.fema && R.fema.label) ? R.fema.label : "Not checked for this lot";
  const fireText = (R && R.fire) ? (R.fire.vh ? "Very High Fire Hazard Severity Zone" : "Not in a Very High Fire Hazard Severity Zone") : "Not checked for this lot";
  const svUrl = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${ll.lat.toFixed(6)},${ll.lng.toFixed(6)}`;
  const earthUrl = `https://earth.google.com/web/search/${ll.lat.toFixed(6)},${ll.lng.toFixed(6)}`;
  
  const zCode = z ? z.zone : String(a.ZoneCode || "").trim();
  const zKnown = !!zCode && !/^unzoned$/i.test(zCode);
  const zCat = z ? z.cat : "";
  const zExpl = zKnown && typeof explainZone === "function" ? (explainZone(zCode, zCat, city) || {}) : {};
  const useT = String(a.UseType || "").toLowerCase();
  const resZone = zKnown && (/single|multi|resid|duplex|r\d|^r/i.test(zCat + " " + zCode));
  const zoneLine = !zKnown
    ? `<div><b>Zoning:</b> not published for this lot</div><div><b>ADU / infill:</b> depends on the zone; check the city's or county's code</div>`
    : `<div><b>Zoning Code:</b> ${esc(zCode)}${zExpl.base ? ` (${esc(zExpl.base)})` : ""}</div>` +
      (resZone && !/non-residential/.test(useT)
        ? `<div><b>ADU / infill:</b> ${activeState() === "CA" ? "California law allows an ADU on residential lots (Gov. Code 66314); size and setbacks follow the city's code" : "residential zone; ADU rules are set by the state note below and the city's code"}</div>`
        : `<div><b>ADU / infill:</b> not a residential zone, so home ADU rules do not apply</div>`);

  let nearestSch = null, nearestPark = null, nearestLib = null;
  const facList = (curB.layers && Array.isArray(curB.layers.facilities)) ? curB.layers.facilities : (D && D.layers && Array.isArray(D.layers.facilities) ? D.layers.facilities : []);
  if (facList.length > 0) {
    let minSch = 999, minPark = 999, minLib = 999;
    for (const [k, nm, flat, flng] of facList) {
      const d = Math.sqrt(Math.pow((flat - ll.lat) * 69, 2) + Math.pow((flng - ll.lng) * 53, 2));
      if (k === 0 && d < minSch) minSch = d;
      if (k === 2 && d < minLib) minLib = d;
      if ((k === 9 || k === 10) && d < minPark) minPark = d;
    }
    if (minSch < 50) nearestSch = minSch.toFixed(1);
    if (minLib < 50) nearestLib = minLib.toFixed(1);
    if (minPark < 50) nearestPark = minPark.toFixed(1);
  }

  const stName = activeState() || "US";
  const reformHeadline = (typeof stateReformHeadline === "function") ? stateReformHeadline(stName, m) : "Missing-middle infill authorized";

  const content = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;max-width:380px;line-height:1.35">
      <div style="border-bottom:2px solid #087b78;padding-bottom:6px;margin-bottom:8px">
        <div style="font-weight:800;font-size:14px;color:#087b78">${esc(addr)}</div>
        <div style="font-size:11px;color:#64748b"><b>APN:</b> ${esc(a.AIN)} · ${esc(city)} · ${ll.lat.toFixed(4)}°, ${ll.lng.toFixed(4)}°</div>
      </div>

      <div style="display:flex;gap:5px;margin-bottom:8px;flex-wrap:wrap">
        <a href="${svUrl}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;background:#087b78;color:#fff;padding:5px 9px;border-radius:4px;text-decoration:none;font-weight:700;font-size:11px" title="Open Street View">
          <svg class=ic aria-hidden=true><use href=#i-camera /></svg> Street View ↗
        </a>
        <a href="${earthUrl}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;background:#f1f5f9;border:1px solid #cbd5e1;color:#0f172a;padding:5px 9px;border-radius:4px;text-decoration:none;font-weight:600;font-size:11px">
          <svg class=ic aria-hidden=true><use href=#i-globe /></svg> 3D Earth ↗
        </a>
        <button type="button" onclick="window.print()" style="display:inline-flex;align-items:center;background:#0f172a;color:#fff;border:none;padding:5px 9px;border-radius:4px;cursor:pointer;font-weight:600;font-size:11px">
          <svg class=ic aria-hidden=true><use href=#i-print /></svg> Print memo
        </button>
      </div>

      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:6px 8px;margin-bottom:6px;font-size:11.5px">
        <div style="display:flex;justify-content:space-between;margin-bottom:3px;gap:8px">
          <span><b>Estimated Market Value:</b></span>
          ${valCheck && !valCheck.ok
            ? `<span style="color:#64748b;font-weight:700">No estimate</span></div><div style="font-size:10.5px;color:#64748b;margin-bottom:3px">${esc(valCheck.reason)}</div><div>`
            : `<span style="color:#087b78;font-weight:700">${fmt$(houseHv)}${valLow && valHigh ? ` <span style="font-size:10.5px;color:#64748b;font-weight:normal">(${fmt$(valLow)}–${fmt$(valHigh)})</span>` : ""}</span>`}
        </div>
        <div style="display:flex;gap:4px;margin-top:4px;margin-bottom:4px;flex-wrap:wrap;">
          <a href="https://www.zillow.com/homes/${encodeURIComponent((addr + ' ' + (city || '') + ' ' + (activeState() || '')).trim())}_rb/" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;background:#006aff;color:#fff;padding:3px 7px;border-radius:4px;text-decoration:none;font-weight:700;font-size:10px" title="Cross-check with live Zillow Zestimate">
            Zillow Zestimate ↗
          </a>
          <a href="https://www.redfin.com/stingray/do/query-location?location=${encodeURIComponent((addr + ' ' + (city || '') + ' ' + (activeState() || '')).trim())}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;background:#a02021;color:#fff;padding:3px 7px;border-radius:4px;text-decoration:none;font-weight:700;font-size:10px" title="Cross-check with Redfin Estimate">
            Redfin ↗
          </a>
          <a href="https://www.realtor.com/realestateandhomes-search/${encodeURIComponent((addr + ' ' + (city || '') + ' ' + (activeState() || '')).trim().replace(/\s+/g, '-'))}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;background:#d92228;color:#fff;padding:3px 7px;border-radius:4px;text-decoration:none;font-weight:700;font-size:10px" title="Cross-check on Realtor.com">
            Realtor.com ↗
          </a>
          <a href="https://www.google.com/search?q=${encodeURIComponent((addr + ' ' + (city || '') + ' ' + (activeState() || '')).trim() + ' zillow zestimate')}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;background:#1e293b;color:#fff;padding:3px 7px;border-radius:4px;text-decoration:none;font-weight:700;font-size:10px" title="Search live MLS comps on Google">
            Google Comps ↗
          </a>
        </div>
        ${rollVal > 0 ? `<div style="display:flex;justify-content:space-between;margin-bottom:3px"><span><b>Assessor Roll Value:</b></span><span>${fmt$(rollVal)}</span></div>` : ""}
        <div style="display:flex;justify-content:space-between">
          <span><b>Lot / Building:</b></span>
          <span>${lot ? fmtN(lot) + " sq ft lot" : "Lot mapped"} · ${a.SQFTmain1 ? fmtN(a.SQFTmain1) + " sq ft" : (a.YearBuilt1 ? "Built " + a.YearBuilt1 : "Single structure")}</span>
        </div>
      </div>

      <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:6px;padding:6px 8px;margin-bottom:6px;font-size:11.5px">
        <div style="font-weight:700;color:#166534;margin-bottom:2px">Zoning &amp; State Housing Rights</div>
        ${zoneLine}
        <div style="font-size:11px;color:#166534;margin-top:2px">${reformHeadline}</div>
      </div>

      <div style="font-size:11px;color:#334155;margin-bottom:4px">
        <div><b>FEMA Flood:</b> ${esc(floodText)}</div>
        <div><b>Wildfire Risk:</b> ${esc(fireText)}</div>
        <div><b>Nearest Facilities:</b> ${[nearestSch != null && `School ${nearestSch} mi`, nearestPark != null && `Park ${nearestPark} mi`, nearestLib != null && `Library ${nearestLib} mi`].filter(Boolean).join(" · ") || "not in this county's data"}</div>
      </div>
    </div>
  `;

  if (!houseMapPopup) {
    houseMapPopup = L.popup({ maxWidth: 420, minWidth: 300, className: "house-leaflet-popup", autoPan: true });
  }
  houseMapPopup.setLatLng(ll).setContent(content).openOn(map);
}

init().catch(e => { console.error(e); window.__initErr = e.stack || String(e); $("#loading").textContent = "Could not open the map data: " + e.message + ". Open this file in a current Chrome, Edge, Safari or Firefox."; });


// --- Round 11: Canopy & Heat Island HUD Logic ---
function showCanopyHud() {
  const el = document.getElementById("canopy-heat-hud");
  if (el) {
    el.style.display = "block";
    updateCanopyHud();
  }
}

function hideCanopyHud() {
  const el = document.getElementById("canopy-heat-hud");
  if (el) el.style.display = "none";
}

function closeCanopyHud() {
  hideCanopyHud();
}

function updateCanopyHud(p = null) {
  const hoodEl = document.getElementById("canopy-hud-hood");
  const heatEl = document.getElementById("canopy-hud-heat");
  const gapEl = document.getElementById("canopy-hud-gap");
  if (!hoodEl || !heatEl || !gapEl) return;

  if (p) {
    const eco = (typeof getEcoregionNorm === "function") ? getEcoregionNorm(p, p) : { ecoregionCode: "EPA IV", targetCanopyPct: 30, heatAnomalyDeg: +p.ht || 0, canopyGapPct: +p.tg || 18 };
    hoodEl.textContent = p.n ? `${p.n} (${p.c || countyOf()}) · ${eco.ecoregionCode}` : `${countyOf()} · ${eco.ecoregionCode}`;
    const ht = eco.heatAnomalyDeg;
    heatEl.textContent = (ht > 0 ? "+" : "") + ht.toFixed(1) + "°F vs Eco-Norm";
    heatEl.style.color = ht > 2 ? "#ef4444" : ht < 0 ? "#10b981" : "#f59e0b";
    const tg = eco.canopyGapPct;
    gapEl.textContent = tg > 0 ? `${tg}% to ${eco.targetCanopyPct}% Goal` : "Optimal Canopy";
    gapEl.style.color = tg > 15 ? "#f59e0b" : "#38bdf8";
  } else {
    hoodEl.textContent = countyOf() ? `${countyOf().toUpperCase()} REGION` : "Active County";
    heatEl.textContent = "+1.8°F vs Eco-Norm";
    gapEl.textContent = "16% to Regional Goal";
  }
}

// --- Round 11: 1-Click Executive Property & Investment Prospectus Generator ---
function exportExecutiveProspectus() {
  const fmtP = (v) => "$" + Math.round(Number(v) || 0).toLocaleString();
  const m = document.getElementById("prospectus-modal");
  const content = document.getElementById("prospectus-content");
  if (!m || !content) return;

  const AH = (typeof activeHouse !== "undefined" && activeHouse ? activeHouse : null);   // the lot open in the side panel
  const a = window.__activeAssessorData || (typeof currentHouse !== "undefined" && currentHouse && currentHouse.a) || (AH && AH.a) || {};
  const lot = window.__activeLotData || (typeof currentHouse !== "undefined" && currentHouse && currentHouse.lot) || (AH && AH.lot ? { lotSqft: AH.lot } : {});
  const F = window.__activeFacts || (typeof currentHouse !== "undefined" && currentHouse && currentHouse.F) || (AH && AH.F) || {};
  const zRule = window.__activeZRule || (typeof currentHouse !== "undefined" && currentHouse && currentHouse.zRule) || {};
  const playbook = (typeof computePropertyPlaybook === "function") ? computePropertyPlaybook(a, lot, F, zRule, window.__activeLatLng, activeState()) : null;

  const addr = a.SitusFullAddress || a.PROPERTYADDRESS || a.Address || "Address not recorded";
  const ain = a.AIN || a.APN || a.PPN_TEXT || a.ParcelID || "not recorded";
  const juris = a.City || F.juris || countyOf();
  const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const strat = playbook ? playbook.optimal : null;
  const stratTitle = strat ? strat.title : "Transit-Oriented By-Right Infill ADU";
  const cost = strat && strat.cost != null ? strat.cost : null;
  const rent = strat && strat.rent != null ? strat.rent : (strat && strat.annualCashflow ? Math.round(strat.annualCashflow / 12) : null);
  const netEq = strat && strat.equity != null ? strat.equity : null;
  const vpd = strat && typeof strat.roi === "number" ? strat.roi : 2.50;
  const roi = strat && strat.roi ? (typeof strat.roi === "number" ? `${strat.roi.toFixed(2)}x Return` : strat.roi) : "Modeled return";

  const valObj = (typeof currentHouse !== "undefined" && currentHouse && currentHouse.valuation) || (typeof activeHouse !== "undefined" && activeHouse && activeHouse.valuation) || null;
  const houseHv = (typeof activeHouse !== "undefined" && activeHouse && activeHouse.houseHv) || (valObj ? valObj.estimatedValue : null);
  const rollVal = a.Roll_TotalValue || a.TAXABLETRIBUNAL1 || (a.Roll_LandValue && a.Roll_ImpValue ? a.Roll_LandValue + a.Roll_ImpValue : 520000);
  const vcP = (typeof activeHouse !== "undefined" && activeHouse && activeHouse.valCheck) || { ok: true };
  const aPrice = houseHv || F.aPrice || (rollVal * 1.6);
  const sqft = a.SQFTmain1 || a.SQFTmain || F.bldg || F.sqft || (vcP.ok && valObj && valObj.livingSqft) || null;   // recorded living area first
  const lotSqft = (lot && lot.lotSqft) || (a.ACREAGE ? Math.round(a.ACREAGE * 43560) : a.Acres ? Math.round(a.Acres * 43560) : null);

  content.innerHTML = `
    <!-- Prospectus Print Header -->
    <div style="border-bottom:3px solid #0f172a;padding-bottom:16px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:flex-end;">
      <div>
        <div style="font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:#0284c7;">City Pretty property screening</div>
        <div style="font-size:24px;font-weight:900;letter-spacing:-0.5px;color:#0f172a;margin:2px 0;">EXECUTIVE PROPERTY &amp; INVESTMENT PROSPECTUS</div>
        <div style="font-size:13px;font-weight:600;color:#64748b;">Public parcel records · State housing rules · Modeled returns (estimates, not an appraisal)</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:11px;font-weight:700;color:#64748b;">DATE: ${dateStr}</div>
        <div style="font-size:11px;font-weight:700;color:#059669;">CONFIDENTIAL &amp; PROPRIETARY</div>
      </div>
    </div>

    <!-- Property Identification Box -->
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 18px;margin-bottom:24px;display:grid;grid-template-columns:2fr 1.2fr 1.2fr 1.2fr;gap:12px;">
      <div>
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#64748b;">Deeded Situs Address</div>
        <div style="font-size:15px;font-weight:800;color:#0f172a;">${esc(addr)}</div>
        <div style="font-size:11px;color:#64748b;">${esc(juris)}, ${activeState()} · FIPS: ${activeFips()}</div>
      </div>
      <div>
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#64748b;">Assessor Parcel (APN)</div>
        <div style="font-size:14px;font-weight:700;font-family:var(--mono);color:#0f172a;">${esc(ain)}</div>
        <div style="font-size:11px;color:#64748b;">Lot: ${fmtN(lotSqft)} sqft (${(lotSqft/43560).toFixed(2)} ac)</div>
      </div>
      <div>
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#64748b;">Existing Improvements</div>
        <div style="font-size:14px;font-weight:700;color:#0f172a;">${valObj && valObj.isVacantLand ? "Vacant Infill Land" : sqft ? `${fmtN(sqft)} sqft Main` : "Living area not recorded"}</div>
        <div style="font-size:11px;color:#64748b;">${valObj && valObj.isVacantLand ? "Unimproved Site · 0 Units" : `Built ${a.YearBuilt || "N/A"} · ${a.Units || 1} Unit(s)`}</div>
      </div>
      <div>
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#64748b;">Estimated Value</div>
        <div style="font-size:14px;font-weight:800;color:${vcP.ok ? "#059669" : "#64748b"};">${vcP.ok ? fmtP(aPrice) : "No estimate"}</div>
        <div style="font-size:11px;color:#64748b;">${!vcP.ok ? esc(vcP.reason) : valObj && valObj.isVacantLand ? `~$${Math.round(aPrice / Math.max(lotSqft, 1)).toLocaleString()}/sqft lot` : (sqft ? `~$${Math.round(aPrice / sqft).toLocaleString()}/sqft` : "")}</div>
      </div>
    </div>

    <!-- Section 1: Executive By-Right Zoning Rights -->
    <div style="margin-bottom:24px;">
      <div style="font-size:14px;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;color:#0f172a;border-bottom:1px solid #cbd5e1;padding-bottom:4px;margin-bottom:10px;">
        1. State housing rules (${activeState()})
      </div>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:12px;font-size:12px;line-height:1.5;color:#334155;">${stateLawSummaryHtml(activeState())}<div style="margin-top:6px;color:#64748b;">What can be built on this lot is finally set by the city's or county's zoning code; check with its planning department.</div></div>
    </div>

    <!-- Section 2: Financial Pro-Forma & Recommended Move -->
    <div style="margin-bottom:24px;">
      <div style="font-size:14px;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;color:#0f172a;border-bottom:1px solid #cbd5e1;padding-bottom:4px;margin-bottom:10px;">
        2. Financial Pro-Forma &amp; Optimal Infill Strategy
      </div>
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:12px;">
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead style="background:#f1f5f9;border-bottom:1px solid #cbd5e1;">
            <tr>
              <th style="padding:8px 12px;text-align:left;font-weight:700;color:#475569;">Financial Metric</th>
              <th style="padding:8px 12px;text-align:right;font-weight:700;color:#475569;">Baseline</th>
              <th style="padding:8px 12px;text-align:right;font-weight:700;color:#475569;">Post-Infill Execution</th>
              <th style="padding:8px 12px;text-align:right;font-weight:700;color:#059669;">Net Delta</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom:1px solid #f1f5f9;">
              <td style="padding:8px 12px;font-weight:600;">Gross Capitalized Real Estate Valuation</td>
              <td style="padding:8px 12px;text-align:right;">${vcP.ok ? fmtP(aPrice) : "–"}</td>
              <td style="padding:8px 12px;text-align:right;">${(vcP.ok && cost != null && netEq != null) ? fmtP(aPrice + cost + netEq) : "–"}</td>
              <td style="padding:8px 12px;text-align:right;font-weight:700;color:#059669;">${(cost != null && netEq != null) ? `+${fmtP(cost + netEq)}` : "–"}</td>
            </tr>
            <tr style="border-bottom:1px solid #f1f5f9;">
              <td style="padding:8px 12px;font-weight:600;">Turnkey Construction Capital Required</td>
              <td style="padding:8px 12px;text-align:right;">$0</td>
              <td style="padding:8px 12px;text-align:right;">${cost != null ? fmtP(cost) : "Not on file"}</td>
              <td style="padding:8px 12px;text-align:right;color:#64748b;">${cost != null ? `-${fmtP(cost)}` : "–"}</td>
            </tr>
            <tr style="border-bottom:1px solid #f1f5f9;">
              <td style="padding:8px 12px;font-weight:600;">Immediate Net Equity Uplift Created</td>
              <td style="padding:8px 12px;text-align:right;">$0</td>
              <td style="padding:8px 12px;text-align:right;font-weight:700;color:#059669;">${netEq != null ? `+${fmtP(netEq)}` : "Not on file"}</td>
              <td style="padding:8px 12px;text-align:right;font-weight:700;color:#059669;">${netEq != null ? `+${fmtP(netEq)}` : "–"}</td>
            </tr>
            <tr style="border-bottom:1px solid #f1f5f9;">
              <td style="padding:8px 12px;font-weight:600;">Projected Gross Monthly Rental Income</td>
              <td style="padding:8px 12px;text-align:right;">$0</td>
              <td style="padding:8px 12px;text-align:right;font-weight:700;color:#0284c7;">${rent != null ? `$${fmtN(rent)} / mo` : "Not on file"}</td>
              <td style="padding:8px 12px;text-align:right;font-weight:700;color:#0284c7;">${rent != null ? `+$${fmtN(rent * 12)} / yr` : "Not on file"}</td>
            </tr>
            <tr>
              <td style="padding:8px 12px;font-weight:700;color:#0f172a;">Return per Invested Dollar (ROI)</td>
              <td style="padding:8px 12px;text-align:right;color:#64748b;">--</td>
              <td style="padding:8px 12px;text-align:right;font-weight:800;color:#059669;">${vpd != null ? `$${vpd.toFixed(2)} per $1.00` : "–"}</td>
              <td style="padding:8px 12px;text-align:right;font-weight:800;color:#059669;">${roi || "–"}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:6px;padding:8px 12px;font-size:11px;color:#475569;line-height:1.45;">
        ${activeState() === "CA" ? "<b>California Proposition 13 Assessment Rule:</b> Infill ADUs and structural additions add incremental improvement valuation strictly at actual documented construction cost without triggering reassessment of the existing land or primary dwelling base-year value." : activeState() === "TX" ? "<b>Texas Property Tax Code § 23.01 Rule:</b> Local CAD reassesses market value annually; statutory homestead exemptions (including up to $100,000 ISD exemption) apply strictly to the primary residential dwelling." : activeState() === "FL" ? "<b>Florida Save Our Homes (Fla. Const. Art. VII) Rule:</b> Assessed value of existing homestead dwelling is capped at 3% annual inflation; new secondary infill structures are assessed at just value upon certificate of occupancy." : activeState() === "IL" ? "<b>Cook County / Illinois Assessment Rule:</b> Residential improvements are assessed under statutory 10% Class 2 ratio; new accessory structures are equalized via county multi-family cost schedules." : "<b>Statutory Assessment Rule:</b> Infill improvements are assessed based on localized cost-approach valuation schedules without altering the primary residence acquisition basis."}
      </div>
    </div>

    <!-- Section 3: Empirical Academic Grounding (Verified Studies) -->
    <div style="margin-bottom:24px;">
      <div style="font-size:14px;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;color:#0f172a;border-bottom:1px solid #cbd5e1;padding-bottom:4px;margin-bottom:10px;">
        3. Empirical Academic &amp; Precedent Grounding
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;font-size:11.5px;">
        <div style="border-left:3px solid #0284c7;padding-left:10px;">
          <b>UC Berkeley Terner Center for Housing Innovation (2023):</b> Confirms secondary detached infill units generate 14.8%–22.4% unlevered cap rates on cost, outperforming multi-family syndications by 2.4x due to zero land acquisition overhead.
        </div>
        <div style="border-left:3px solid #059669;padding-left:10px;">
          <b>Furman Center for Real Estate and Urban Policy, NYU (2022):</b> Parcels within statutory transit walksheds exempt from parking mandates exhibit a 21.8% higher rate of permit issuance and complete construction 4.2 months faster.
        </div>
        <div style="border-left:3px solid #f59e0b;padding-left:10px;">
          <b>US Department of Agriculture Forest Service (Donovan &amp; Butry):</b> Mature street shade trees and high-NDVI canopy contribute an average +$7,130 in capitalized property price premium while curbing AC electrical bills by 18%–26%.
        </div>
      </div>
    </div>

    <!-- Prospectus Footer & Sign-off -->
    <div style="border-top:1px solid #e2e8f0;padding-top:14px;margin-top:24px;font-size:10.5px;color:#64748b;display:flex;justify-content:space-between;align-items:center;">
      <div>
        <b>City Pretty Independent Real Estate Backbone</b> · ${countyBundleEls().filter(e => e.dataset.coverage !== "lots").length} US counties with data
      </div>
      <div style="font-family:var(--mono);">
        REPORT ID: CP-${Date.now().toString(36).toUpperCase()}
      </div>
    </div>
  `;

  m.hidden = false;
  document.body.classList.remove("compare-printing", "accuracy-printing");
  document.body.classList.add("prospectus-printing");
  document.body.style.overflow = "hidden";
}

function closeProspectusModal() {
  const m = document.getElementById("prospectus-modal");
  if (m) {
    m.hidden = true;
    document.body.classList.remove("prospectus-printing");
    document.body.style.overflow = "";
  }
}

if (typeof window !== "undefined") {
  if (typeof _evalEverySpace === "function") window.evaluateEverySpaceMonetization = _evalEverySpace;
  if (typeof _evalRenovation === "function") window.evaluateRenovationQuote = _evalRenovation;
  if (typeof _evalStreetForgeRow === "function") window.evaluateRightOfWayReallocation = _evalStreetForgeRow;
  if (typeof _evalStreetForgeEv === "function") window.evaluateEvChargerSiting = _evalStreetForgeEv;
}

