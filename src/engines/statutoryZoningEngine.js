"use strict";

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
 *  - Site exclusions come from each law's own list (rec.exclusion_sources, one entry per exclusion with the statute's
 *    wording and URL), never from a rule applied to every state. A listed condition that is present blocks that law and
 *    the output quotes the statute. A listed condition the page has not checked (null) or an exclusion list not yet
 *    confirmed against the statute text (rec.exclusions_review.status other than "confirmed") gives "not determined",
 *    never "allowed". A condition the statute does not list has no effect on that law.
 *  - An entry with effect "conditional" is an exclusion the text makes only on terms the page cannot see (a local
 *    ordinance or a local determination, or one part of the law only). Present or not checked, it gives "not
 *    determined" with those terms quoted; it never rules the law out and never lets it apply. An entry with effect
 *    "limits" narrows the law without removing it and is reported with the law. (22 Nov 2026: the two branches'
 *    per-law designs merged on this one; the other branch's per-condition evidence is kept as rec.site_conditions.)
 */

const STATUTE_USABLE_STATUSES = new Set(["verified", "partially_verified"]);

// Laws that set a jurisdiction-wide obligation (a zoning target or a planning duty) rather than a parcel-level
// right. They are never reported as applying to a single parcel.
const STATUTE_NOT_PARCEL_LEVEL = new Set(["co_hb24_1313", "ma_mbta_communities"]);

function statuteFieldUnconfirmed(rec, field) {
  const uf = (rec.verification && rec.verification.unverified_fields) || [];
  return uf.some(u => String(u).trim().split(/[\s(]/)[0] === field);
}

function statuteField(rec, field, unconfirmed) {
  if (rec[field] === undefined || rec[field] === null) return null;
  if (statuteFieldUnconfirmed(rec, field)) {
    unconfirmed.push(field);
    return null;
  }
  return rec[field];
}

// Returns { applies: boolean, missing: string[] } for one law record and one parcel.
function statuteAppliesTo(rec, parcel) {
  const missing = [];
  const sfr = !!parcel.is_single_family_residential;
  const comm = !!parcel.is_commercial_or_mixed_use;
  const pop = parcel.municipality_pop;
  const heavy = parcel.dist_to_heavy_rail_mi;
  const bus = parcel.dist_to_frequent_bus_or_brt_mi;
  const light = parcel.dist_to_light_rail_mi;
  const popAtLeast = (min) => {
    if (min == null) return true;
    if (pop == null) { missing.push("municipality population"); return false; }
    return pop >= min;
  };
  // A city ordinance (local_jurisdiction) applies only inside that city. Before 17 Nov 2026 Raleigh's and Minneapolis's
  // ordinances fell through to the generic state-wide rule below and were applied to residential lots across NC and MN.
  if (rec.local_jurisdiction) {
    if (!parcel.municipality_name) { missing.push("city name"); return { applies: false, missing }; }
    if (!new RegExp(rec.local_jurisdiction.match, "i").test(String(parcel.municipality_name))) return { applies: false, missing };
  }

  switch (rec.id) {
    case "ca_sb79_tier1":
    case "ca_sb79_tier2": {
      // The statute's test is an "urban transit county" (more than 15 passenger rail stations, Gov. Code 65912.156(q)), not a
      // fixed list. A county outside the list on file is reported as not confirmed when a stop is in range, not ruled out.
      if (heavy == null) { missing.push("distance to heavy rail"); return { applies: false, missing }; }
      const minD = rec.distance_to_transit_min_mi || 0;
      if (heavy > rec.distance_to_transit_max_mi || (minD > 0 && heavy <= minD)) return { applies: false, missing };
      if (!(rec.eligible_counties || []).includes(parcel.county_fips)) { missing.push("whether this county is an urban transit county (more than 15 passenger rail stations)"); return { applies: false, missing }; }
      return { applies: popAtLeast(rec.city_population_min), missing };
    }
    case "ca_sb79_tier2_light_rail_quarter":
    case "ca_sb79_tier2_light_rail_half": {
      if (light == null) { missing.push("distance to light rail / qualifying BRT"); return { applies: false, missing }; }
      const minD = rec.distance_to_transit_min_mi || 0;
      if (light > rec.distance_to_transit_max_mi || (minD > 0 && light <= minD)) return { applies: false, missing };
      if (!(rec.eligible_counties || []).includes(parcel.county_fips)) { missing.push("whether this county is an urban transit county (more than 15 passenger rail stations)"); return { applies: false, missing }; }
      return { applies: popAtLeast(rec.city_population_min), missing };
    }
    case "ca_sb9_lot_split":
      return { applies: sfr, missing };
    case "ca_ab2097": {
      const d = [heavy, bus].filter(x => x != null);
      if (!d.length) { missing.push("distance to major transit stop"); return { applies: false, missing }; }
      return { applies: Math.min(...d) <= rec.distance_to_transit_max_mi, missing };
    }
    case "fl_live_local": {
      // Fla. Stat. 166.04151(7)(a)1: areas zoned commercial, industrial or mixed use, and also land owned by a county,
      // municipality or school district and religious-institution land (over 3 acres), regardless of the underlying zoning.
      if (comm) return { applies: true, missing };
      if (parcel.is_public_or_religious_land === true) return { applies: true, missing };
      if (parcel.is_public_or_religious_land == null) missing.push("zoning as commercial, industrial or mixed use, or who owns the parcel (county, city or school district land, or a religious institution's land over 3 acres, qualifies regardless of zoning)");
      return { applies: false, missing };
    }
    case "tx_sb840": {
      if (!comm) return { applies: false, missing };
      if (pop == null) missing.push("municipality population");
      if (parcel.county_pop == null) missing.push("county population");
      if (missing.length) return { applies: false, missing };
      return { applies: pop >= rec.municipality_pop_min && parcel.county_pop >= rec.county_pop_min, missing };
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
      const rule = (rec.rules || []).find(r => pop >= (r.pop_min || 0) && (r.pop_max_exclusive == null || pop < r.pop_max_exclusive));
      if (!rule) return { applies: false, missing };
      if (rule.condition) { missing.push("growth-area condition: " + rule.condition); return { applies: false, missing }; }
      return { applies: true, missing, rule };
    }
    default: {
      // Generic law: state match; residential zoning, or commercial zoning when applies_to_zone is "commercial";
      // optional population and lot-size floors; any condition the parcel record can't express (unmapped_condition) is
      // reported as missing, never assumed.
      if (rec.applies_to_zone === "commercial") { if (!comm) return { applies: false, missing }; }
      else if (rec.applies_to_zone === "residential") { if (!sfr && !parcel.is_multifamily_residential) return { applies: false, missing }; }   // single-family or multifamily zoning
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

// Checks one law's own exclusion list against the parcel's flags. A flag is true (present), false (checked, absent) or
// null/undefined (not checked). Only flags the page really reads are ever true or false: fema_100yr_floodway (FEMA special
// flood hazard area, every state), calfire_or_state_vhfhsz (very high zone, California only), historic_district_hpoz
// (Los Angeles only).
function statuteExclusionCheck(rec, parcel) {
  const ex = parcel.exclusions || {};
  const entries = Array.isArray(rec.exclusion_sources) ? rec.exclusion_sources : [];
  const review = rec.exclusions_review || {};
  const confirmed = review.status === "confirmed" && Array.isArray(rec.exclusion_sources);
  // An entry with effect "limits" does not remove the law from the parcel (it narrows a route or leaves other laws in force);
  // it is reported with the law but never blocks it or makes it "not determined". An entry with effect "conditional"
  // excludes the site only on terms the page cannot see (e.condition): present, it makes the law "not determined" with
  // those terms; not checked, it counts as not checked.
  const present = [], notChecked = [], limitsPresent = [], limitsNotChecked = [], conditionalPresent = [];
  for (const e of entries) {
    const v = ex[e.key], lim = e.effect === "limits", cond = e.effect === "conditional";
    if (v === true) (lim ? limitsPresent : cond ? conditionalPresent : present).push(e);
    else if (v !== false) (lim ? limitsNotChecked : notChecked).push(e);
  }
  const quote = e => "\"" + e.wording + "\"" + (e.citation ? " (" + e.citation + ")" : "") +
    (e.key === "fema_100yr_floodway" ? ". The page's flood flag is FEMA's special flood hazard area (the 100-year floodplain)" + (e.scope_note ? "; " + e.scope_note : "") : (e.scope_note ? ". " + e.scope_note : "")) +
    (e.exception ? ". The text's exception: \"" + e.exception + "\"" : "");
  return { confirmed, present, notChecked, limitsPresent, limitsNotChecked, conditionalPresent, quote, review };
}

function evaluateByRightHousing(parcel, laws) {
  const ex = Object.assign({}, parcel.exclusions);
  const lawList = Array.isArray(laws) ? laws
    : (typeof STATE_HOUSING_LAWS_DATA !== "undefined" && Array.isArray(STATE_HOUSING_LAWS_DATA) ? STATE_HOUSING_LAWS_DATA : []);
  const base = {
    parcel_id: parcel.parcel_id,
    state_code: parcel.state_code,
    applicable_statutes: [],
    not_confirmed: [],
    excluded_by_statute: [],
    statutory_exclusions: ex,
    net_by_right_feasible: false,
    laws_loaded: lawList.length > 0,
  };

  if (!parcel.base_zoning_code || /^(unzoned|unknown|missing|none|n\/a)$/i.test(String(parcel.base_zoning_code).trim())) {
    return Object.assign(base, { base_zoning_code: null });
  }
  base.base_zoning_code = parcel.base_zoning_code;

  for (const rec of lawList) {
    if (!rec || rec.state_code !== parcel.state_code) continue;
    if (STATUTE_NOT_PARCEL_LEVEL.has(rec.id)) continue;
    if (rec.parcel_level === false) continue;   // jurisdiction-wide rule (e.g. a parking cap), not a parcel right
    const status = rec.verification && rec.verification.status;
    const label = rec.short_name || rec.bill_number || rec.id;
    if (!STATUTE_USABLE_STATUSES.has(status)) {
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
    const exc = statuteExclusionCheck(rec, parcel);
    if (exc.confirmed && exc.present.length) {
      base.excluded_by_statute.push({
        id: rec.id, name: label, statute_url: rec.statute_url || null,
        exclusions: exc.present.map(e => ({ key: e.key, wording: e.wording, citation: e.citation || null, url: e.url || null, note: exc.quote(e) })),
        detail: exc.present.map(exc.quote).join("; ") + ".",
        reason: "Excluded by the law's own text: " + exc.present.map(exc.quote).join("; ") + ".",
      });
      continue;
    }
    if (!exc.confirmed) {
      base.not_confirmed.push({ id: rec.id, name: label, reason: "Not determined: the list of sites this law excludes has not been confirmed against the statute text" + (exc.present.length ? " (the page found a condition that may be on it: " + exc.present.map(e => e.label || e.key).join("; ") + ")" : "") + "." });
      continue;
    }
    if (exc.conditionalPresent.length) {
      base.not_confirmed.push({ id: rec.id, name: label, reason: "Not determined: the lot is in " + exc.conditionalPresent.map(e => (e.label || e.key) + ", which the law's text excludes " + (e.condition || "only on terms the page cannot see") + ": " + exc.quote(e)).join("; ") + ". The page cannot see whether that applies to this lot." + (exc.notChecked.length ? " The page has also not checked " + exc.notChecked.map(e => (e.label || e.key) + " (" + (e.citation || "statute text") + ")").join("; ") + "." : "") });
      continue;
    }
    if (exc.notChecked.length) {
      base.not_confirmed.push({ id: rec.id, name: label, reason: "Not determined: the law excludes " + exc.notChecked.map(e => (e.label || e.key) + " (" + (e.citation || "statute text") + ")").join("; ") + ", and the page has not checked " + (exc.notChecked.length > 1 ? "these" : "this") + " for this parcel." });
      continue;
    }
    const unconfirmed = [];
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
      exclusion_limits: exc.limitsPresent.map(exc.quote),
      exclusion_limits_not_checked: exc.limitsNotChecked.map(e => e.label || e.key),
      unconfirmed_fields: unconfirmed.concat(((rec.verification && rec.verification.unverified_fields) || []).map(String).filter(u => !unconfirmed.includes(u.split(/[\s(]/)[0]))),
    });
  }
  base.net_by_right_feasible = base.applicable_statutes.length > 0;
  return base;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { evaluateByRightHousing, statuteAppliesTo, statuteExclusionCheck, STATUTE_USABLE_STATUSES };
}
