import { StatutoryZoningResult } from "../types";

export interface ParcelContext {
  parcel_id: string;
  state_code: string;
  county_fips: string;
  municipality_pop: number | null;
  municipality_name?: string | null;
  county_pop: number | null;
  lot_sqft?: number | null;
  base_zoning_code: string | null;
  is_commercial_or_mixed_use: boolean;
  is_single_family_residential: boolean;
  dist_to_heavy_rail_mi: number | null;
  dist_to_light_rail_mi?: number | null;
  dist_to_frequent_bus_or_brt_mi: number | null;
  exclusions: Partial<StatutoryZoningResult["statutory_exclusions"]> & Record<string, boolean | undefined>;
}

// One record of app/data/statutes.json.
export type StatuteRecord = Record<string, any> & {
  id: string;
  state_code: string;
  verification?: { status?: string; unverified_fields?: string[] };
};

/**
 * Statutory Zoning Engine (browser & Node).
 *
 * Reads state housing laws from app/data/statutes.json. It does not carry its own copy of any law: an earlier
 * hardcoded version stated several rules wrongly (e.g. a 120-unit SB 79 "cap", a 30 ft Arizona height limit, a
 * 0.5-space Florida parking minimum) and was replaced 2026-11-16.
 *
 * Rules:
 *  - Only records whose verification.status is "verified" or "partially_verified" can apply. Others are listed in
 *    `not_confirmed` with the reason.
 *  - Any field named in a record's verification.unverified_fields is returned as null and listed in
 *    `unconfirmed_fields`, so it is never shown as a fact.
 *  - A law applies only when every condition it needs is known for the parcel (zoning, population, transit
 *    distance...). A condition that cannot be checked is reported, not assumed.
 *  - Recorded zoning is required. Missing zoning never implies residential use.
 */

export const STATUTE_USABLE_STATUSES = new Set<string>(["verified", "partially_verified"]);

// Laws that set a jurisdiction-wide obligation (a zoning target or a planning duty) rather than a parcel-level
// right. They are never reported as applying to a single parcel.
const STATUTE_NOT_PARCEL_LEVEL = new Set<string>(["co_hb24_1313", "ma_mbta_communities"]);

function statuteFieldUnconfirmed(rec: StatuteRecord, field: string): boolean {
  const uf = (rec.verification && rec.verification.unverified_fields) || [];
  return uf.some((u: string) => String(u).trim().split(/[\s(]/)[0] === field);
}

function statuteField(rec: StatuteRecord, field: string, unconfirmed: string[]): any {
  if (rec[field] === undefined || rec[field] === null) return null;
  if (statuteFieldUnconfirmed(rec, field)) {
    unconfirmed.push(field);
    return null;
  }
  return rec[field];
}

// Returns { applies: boolean, missing: string[] } for one law record and one parcel.
export function statuteAppliesTo(rec: StatuteRecord, parcel: ParcelContext): { applies: boolean; missing: string[]; rule?: any } {
  const missing: string[] = [];
  const sfr = !!parcel.is_single_family_residential;
  const comm = !!parcel.is_commercial_or_mixed_use;
  const pop = parcel.municipality_pop;
  const heavy = parcel.dist_to_heavy_rail_mi;
  const bus = parcel.dist_to_frequent_bus_or_brt_mi;
  const light = parcel.dist_to_light_rail_mi;
  const ex: any = parcel.exclusions || {};
  const popAtLeast = (min: number | null | undefined) => {
    if (min == null) return true;
    if (pop == null) { missing.push("municipality population"); return false; }
    return pop >= min;
  };
  const excludedBy = (rec.statutory_exclusions || []).some((e: string) => ex[String(e).split(/[\s(]/)[0]]);
  if (excludedBy) return { applies: false, missing };

  switch (rec.id) {
    case "ca_sb79_tier1":
    case "ca_sb79_tier2": {
      if (!(rec.eligible_counties || []).includes(parcel.county_fips)) return { applies: false, missing };
      if (heavy == null) { missing.push("distance to heavy rail"); return { applies: false, missing }; }
      const minD = rec.distance_to_transit_min_mi || 0;
      if (heavy > rec.distance_to_transit_max_mi || (minD > 0 && heavy <= minD)) return { applies: false, missing };
      return { applies: popAtLeast(rec.city_population_min), missing };
    }
    case "ca_sb79_tier2_light_rail_quarter":
    case "ca_sb79_tier2_light_rail_half": {
      if (!(rec.eligible_counties || []).includes(parcel.county_fips)) return { applies: false, missing };
      if (light == null) { missing.push("distance to light rail / qualifying BRT"); return { applies: false, missing }; }
      const minD = rec.distance_to_transit_min_mi || 0;
      if (light > rec.distance_to_transit_max_mi || (minD > 0 && light <= minD)) return { applies: false, missing };
      return { applies: popAtLeast(rec.city_population_min), missing };
    }
    case "ca_sb9_lot_split":
      return { applies: sfr, missing };
    case "ca_ab2097": {
      const d = [heavy, bus].filter(x => x != null);
      if (!d.length) { missing.push("distance to major transit stop"); return { applies: false, missing }; }
      return { applies: Math.min(...d) <= rec.distance_to_transit_max_mi, missing };
    }
    case "fl_live_local":
      return { applies: comm, missing };
    case "tx_sb840": {
      if (!comm) return { applies: false, missing };
      if (pop == null) missing.push("municipality population");
      if (parcel.county_pop == null) missing.push("county population");
      if (missing.length) return { applies: false, missing };
      return { applies: (pop as number) >= rec.municipality_pop_min && (parcel.county_pop as number) >= rec.county_pop_min, missing };
    }
    case "tx_austin_home": {
      if (!sfr) return { applies: false, missing };
      if (!parcel.municipality_name) { missing.push("city name"); return { applies: false, missing }; }
      if (!/^austin\b/i.test(String(parcel.municipality_name))) return { applies: false, missing };
      if (parcel.lot_sqft == null) { missing.push("lot size"); return { applies: false, missing }; }
      return { applies: parcel.lot_sqft >= (rec.min_lot_size_sqft || 0), missing };
    }
    case "wa_hb1110":
    case "or_hb2001": {
      if (!sfr) return { applies: false, missing };
      if (pop == null) { missing.push("municipality population"); return { applies: false, missing }; }
      // Only population bands with no extra unmapped condition (e.g. WA's growth-area rule under 25,000).
      const rule = (rec.rules || []).find((r: any) => pop >= (r.pop_min || 0) && (r.pop_max_exclusive == null || pop < r.pop_max_exclusive));
      if (!rule) return { applies: false, missing };
      if (rule.condition) { missing.push("growth-area condition: " + rule.condition); return { applies: false, missing }; }
      return { applies: true, missing, rule };
    }
    default: {
      // Generic law: state match; residential zoning, or commercial zoning when applies_to_zone is "commercial";
      // optional population and lot-size floors; any condition the parcel record can't express (unmapped_condition) is
      // reported as missing, never assumed.
      if (rec.applies_to_zone === "commercial") { if (!comm) return { applies: false, missing }; }
      else if (!sfr) return { applies: false, missing };
      if (!popAtLeast(rec.municipality_pop_min)) return { applies: false, missing };
      if (rec.min_lot_size_sqft != null) {
        if (parcel.lot_sqft == null) { missing.push("lot size"); return { applies: false, missing }; }
        if (parcel.lot_sqft < rec.min_lot_size_sqft) return { applies: false, missing };
      }
      if (rec.unmapped_condition) { missing.push(String(rec.unmapped_condition)); return { applies: false, missing }; }
      return { applies: true, missing };
    }
  }
}

export function evaluateByRightHousing(parcel: ParcelContext, laws?: StatuteRecord[]): StatutoryZoningResult {
  const ex: any = Object.assign({}, parcel.exclusions);
  const lawList: StatuteRecord[] = Array.isArray(laws) ? laws : [];
  const base: any = {
    parcel_id: parcel.parcel_id,
    state_code: parcel.state_code,
    applicable_statutes: [],
    not_confirmed: [],
    statutory_exclusions: ex,
    net_by_right_feasible: false,
    laws_loaded: lawList.length > 0,
  };

  if (!parcel.base_zoning_code || /^(unzoned|unknown|missing|none|n\/a)$/i.test(String(parcel.base_zoning_code).trim())) {
    return Object.assign(base, { base_zoning_code: null });
  }
  base.base_zoning_code = parcel.base_zoning_code;

  const hasHardPhysicalExclusion =
    ex.fema_100yr_floodway || ex.calfire_or_state_vhfhsz || ex.williamson_or_ag_preserve ||
    ex.public_or_tribal_land || ex.everglades_or_wekiva_or_trpa;
  if (hasHardPhysicalExclusion) return base;

  for (const rec of lawList) {
    if (!rec || rec.state_code !== parcel.state_code) continue;
    if (STATUTE_NOT_PARCEL_LEVEL.has(rec.id)) continue;
    if (rec.parcel_level === false) continue;   // jurisdiction-wide rule (e.g. a parking cap), not a parcel right
    const status = rec.verification && rec.verification.status;
    const label = rec.short_name || rec.bill_number || rec.id;
    if (!STATUTE_USABLE_STATUSES.has(status || "")) {
      base.not_confirmed.push({ id: rec.id, name: label, reason: "The law's text could not be checked (" + (status || "no status") + ")." });
      continue;
    }
    const check = statuteAppliesTo(rec, parcel);
    if (rec.id === "tx_sb840" && !check.applies && !check.missing.length && parcel.is_commercial_or_mixed_use) {
      ex.population_threshold_ineligible = true;
    }
    if (!check.applies) {
      if (check.missing.length) base.not_confirmed.push({ id: rec.id, name: label, reason: "Not on file for this parcel: " + check.missing.join(", ") + "." });
      continue;
    }
    const unconfirmed: string[] = [];
    let units = statuteField(rec, "max_units_by_right", unconfirmed);
    if (check.rule && check.rule.base_units != null) {
      const near = [parcel.dist_to_heavy_rail_mi, parcel.dist_to_frequent_bus_or_brt_mi].filter(x => x != null);
      units = (near.length && Math.min(...near) <= 0.25) ? check.rule.near_transit_or_affordable_units : check.rule.base_units;
    }
    base.applicable_statutes.push({
      id: rec.id,
      citation: label + " — " + (rec.statute_citation || ""),
      short_name: label,
      statute_url: rec.statute_url || null,
      summary: rec.summary || null,
      verification_status: status,
      max_units_by_right: units,
      max_height_ft: statuteField(rec, "max_height_ft", unconfirmed),
      max_far: statuteField(rec, "max_far", unconfirmed),
      min_allowed_density_du_per_acre: statuteField(rec, "min_allowed_density_du_per_acre", unconfirmed),
      min_parking_spaces_per_unit: statuteField(rec, "min_parking_spaces_per_unit", unconfirmed),
      max_parking_requirement_per_unit: statuteField(rec, "max_parking_requirement_per_unit", unconfirmed),
      affordability_mandate_pct: statuteField(rec, "affordability_mandate_pct", unconfirmed),
      tax_exemption_pct: statuteField(rec, "tax_exemption_pct", unconfirmed),
      unconfirmed_fields: unconfirmed.concat(((rec.verification && rec.verification.unverified_fields) || []).map(String).filter((u: string) => !unconfirmed.includes(u.split(/[\s(]/)[0]))),
    });
  }
  base.net_by_right_feasible = base.applicable_statutes.length > 0;
  return base;
}
