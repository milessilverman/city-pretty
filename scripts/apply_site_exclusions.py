#!/usr/bin/env python3
"""Write each law's checked site conditions into app/data/statutes.json (and its identical copy,
app/data/state-housing-laws.json) from the evidence files in docs/audit/site_exclusions/*.json.

Why: until 20 Nov 2026 the statute engine screened no law at all on a lot in a FEMA flood hazard area, a very high
fire hazard zone, an agricultural preserve or public / tribal land, in every state. No record said that. The engine
now decides law by law from `site_conditions` on each record:
  excluded true  -> the law's text rules such a lot out (quote and URL kept on the record)
  excluded false -> the operative text was read in full and has no such exclusion
  excluded "conditional" -> excluded only on a condition the page cannot see (reported as not confirmed, with it)
  excluded null  -> the text does not settle it (the engine then reports the law as not confirmed on such a lot)

Every yes / no comes from an evidence file, which holds the verbatim quote and the URL fetched. A `true` without a
quote, or a `true` / `false` without a URL, is refused. The CONDITIONAL and EXCEPTION lines below are this project's
short restatements of the evidence files' notes (the words shown on the page); the quotes stay on the record. Run: python3 scripts/apply_site_exclusions.py
"""
import glob
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TARGETS = [os.path.join(ROOT, "app/data/statutes.json"), os.path.join(ROOT, "app/data/state-housing-laws.json")]
KEYS = ["fema_100yr_floodway", "calfire_or_state_vhfhsz", "williamson_or_ag_preserve", "public_or_tribal_land", "historic_district_hpoz"]


# Readings of the evidence that are not a plain yes / no. Each line restates the evidence file's own note for that
# record and condition (docs/audit/site_exclusions/*.json); the quote and URL stay on the record.
#   "conditional": the text excludes such land only on a condition this page cannot see (a local ordinance or
#       determination, part of the law only, or land the page's check does not measure). The engine then reports the
#       law as not confirmed on such a lot, with the condition, instead of ruling it out.
#   "exception": the text excludes such land and states an exception; the law is ruled out and the exception is shown.
#   False: the evidence file left it open (null) only because of a separate approval path; the standards the page
#       shows have no such exclusion (its path_specific.allowed_use_standards_65912_157 is false).
SB79 = ["ca_sb79_tier1", "ca_sb79_tier2", "ca_sb79_tier2_light_rail_quarter", "ca_sb79_tier2_light_rail_half"]
FARMLAND = "only as mapped prime farmland or farmland of statewide importance, or agricultural zoning, which this check does not measure"
CONDITIONAL = {
    ("me_ld2003", "fema_100yr_floodway"): "only where the municipality has exempted the lot by ordinance",
    ("vt_act47", "fema_100yr_floodway"): "only where the municipality has left flood hazard areas out of its sewer-and-water service area, and only for the four-unit and five-units-per-acre parts of the law",
    ("wa_hb1110", "fema_100yr_floodway"): "only for the parts of a lot the city has designated as critical areas or their buffers (a local designation, not the FEMA map)",
    ("wa_hb1337_adu", "fema_100yr_floodway"): "only for lots the city has designated with critical areas or their buffers (a local designation, not the FEMA map)",
    ("or_commercial_197a460", "fema_100yr_floodway"): "only where the local government determines the property is within a 100-year floodplain",
    ("or_commercial_197a460", "calfire_or_state_vhfhsz"): "only where the local government determines development is constrained by land use rules based on the statewide natural-hazards goal",
    ("co_hb24_1313", "fema_100yr_floodway"): "only from the city's housing goal calculation (the act sets a citywide goal)",
    ("co_hb24_1313", "williamson_or_ag_preserve"): "only from the city's housing goal calculation (the act sets a citywide goal)",
    ("co_hb24_1313", "public_or_tribal_land"): "only from the city's housing goal calculation (the act sets a citywide goal)",
    ("id_adu_67_6541", "historic_district_hpoz"): "only from the standards in the law's subsection (2)",
    ("az_hb2720_2721", "public_or_tribal_land"): "only for tribal land, and only for the accessory dwelling part of the law",
    ("az_adaptive_reuse_9_462_10", "public_or_tribal_land"): "only for tribal land",
    ("ca_sb9_lot_split", "williamson_or_ag_preserve"): FARMLAND,
    ("ca_ab2011_affordable", "williamson_or_ag_preserve"): FARMLAND,
    ("or_hb2001", "williamson_or_ag_preserve"): "only by zoning: land not zoned for residential use is outside the law",
    ("nc_raleigh_missing_middle", "williamson_or_ag_preserve"): "only by zoning: land zoned Agriculture Productive",
}
for _id in SB79:
    CONDITIONAL[(_id, "calfire_or_state_vhfhsz")] = "only from the optional streamlined ministerial approval, and where the city has excluded such sites by ordinance for now"
EXCEPTION = {
    ("ca_sb9_lot_split", "fema_100yr_floodway"): "a FEMA Letter of Map Revision, or meeting the flood program's minimum floodplain management criteria (a floodway needs a no-rise certification)",
    ("ca_sb9_lot_split", "calfire_or_state_vhfhsz"): "sites the local agency excluded from the hazard zone, or sites with adopted fire hazard mitigation measures",
    ("ca_sb9_lot_split", "historic_district_hpoz"): "for a lot split inside a historic district, only a split that demolishes or alters a contributing structure is barred; landmark parcels are barred outright",
    ("ca_ab2011_affordable", "fema_100yr_floodway"): "a FEMA Letter of Map Revision, or meeting the flood program's minimum floodplain management criteria (a floodway needs a no-rise certification)",
    ("ca_ab2011_affordable", "calfire_or_state_vhfhsz"): "sites with adopted fire hazard mitigation measures; a vacant site has no such exception",
}
STANDARDS_NOT_EXCLUDED = {(i, k) for i in SB79 for k in ("fema_100yr_floodway", "williamson_or_ag_preserve")}


def main():
    evidence = {}
    for path in sorted(glob.glob(os.path.join(ROOT, "docs/audit/site_exclusions/*.json"))):
        data = json.load(open(path, encoding="utf-8"))
        rel = os.path.relpath(path, ROOT)
        for rid, rec in (data.get("records") or {}).items():
            assert rid not in evidence, f"{rid} appears in two evidence files"
            evidence[rid] = (rel, data.get("fetched_on"), rec)

    laws = json.load(open(TARGETS[0], encoding="utf-8"))
    ids = {r["id"] for r in laws}
    unknown = sorted(set(evidence) - ids)
    assert not unknown, f"evidence for ids not in statutes.json: {unknown}"

    counts = {"true": 0, "false": 0, "null": 0, "conditional": 0}
    for r in laws:
        if r["id"] not in evidence:
            continue
        rel, fetched_on, ev = evidence[r["id"]]
        conditions = {}
        for k in KEYS:
            c = (ev.get("conditions") or {}).get(k) or {}
            excluded = c.get("excluded")
            assert excluded in (True, False, None), (r["id"], k, excluded)
            if excluded is True:
                assert c.get("quote") and c.get("url"), f"{r['id']} {k}: excluded=true needs a quote and a URL"
            if excluded is False:
                assert c.get("url") or (ev.get("sections_read") or []), f"{r['id']} {k}: excluded=false needs the text that was read"
            key = (r["id"], k)
            if key in CONDITIONAL:
                assert excluded is not False, f"{key}: the evidence says no exclusion; a condition cannot be added"
                excluded = "conditional"
            elif key in STANDARDS_NOT_EXCLUDED:
                assert excluded is None and (c.get("path_specific") or {}).get("allowed_use_standards_65912_157") is False, key
                excluded = False
            entry = {"excluded": excluded}
            if key in CONDITIONAL:
                entry["condition"] = CONDITIONAL[key]
            if key in EXCEPTION:
                assert excluded is True, f"{key}: an exception needs an exclusion"
                entry["exception"] = EXCEPTION[key]
            for f in ("quote", "exception_quote", "url", "note"):
                if c.get(f):
                    entry[f] = c[f]
            conditions[k] = entry
            counts[json.dumps(excluded).strip('"')] += 1
        if all(conditions[k]["excluded"] is None for k in KEYS):
            continue   # nothing was established (e.g. the code could not be fetched): the record stays unchecked
        conditions["_checked"] = {"on": fetched_on, "evidence_file": rel,
                                  "sections_read": [s.get("citation") for s in (ev.get("sections_read") or []) if s.get("citation")]}
        r["site_conditions"] = conditions

    out = json.dumps(laws, indent=2, ensure_ascii=False) + "\n"
    for t in TARGETS:
        open(t, "w", encoding="utf-8").write(out)
    missing = sorted(r["id"] for r in laws if r.get("parcel_level") is not False and r["id"] not in evidence)
    print(f"records with evidence: {len(evidence)}; conditions excluded={counts['true']}, checked-not-excluded={counts['false']}, conditional={counts['conditional']}, not settled={counts['null']}")
    print("parcel-level records with no evidence file entry (stay not confirmed on hazard lots):", missing or "none")


if __name__ == "__main__":
    sys.exit(main())
