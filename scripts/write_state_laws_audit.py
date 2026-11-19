#!/usr/bin/env python3
"""Write docs/audit/state-laws-50.json: what was searched for each of the 50 states + DC, and what was found.

'none_found' means no qualifying law was identified by the searches recorded here; it does not prove none exists.
"""
import collections
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "docs/audit/state-laws-50.json")
NONE = "no qualifying statewide law found as of 2026-11-16"
SECONDARY = [
    "https://en.wikipedia.org/wiki/Single-family_zoning",
    "https://en.wikipedia.org/wiki/Missing_middle_housing",
    "https://en.wikipedia.org/wiki/YIMBY_movement",
    "https://en.wikipedia.org/wiki/Accessory_dwelling_unit",
]
BASE_SEARCH = ("Candidates came from the secondary pages in _source.secondary_sources (fetched 2026-11-16) and the auditor's own "
               "list of known state reforms; none was identified for this state. The state code was not full-text searched, so an "
               "unlisted law could exist.")

EXISTING = {
    "CA": ["ca_sb79_tier1", "ca_sb79_tier2", "ca_sb79_tier2_light_rail_quarter", "ca_sb79_tier2_light_rail_half", "ca_sb9_lot_split", "ca_ab2097"],
    "FL": ["fl_live_local"], "TX": ["tx_sb840", "tx_austin_home (local ordinance)"], "WA": ["wa_hb1110"], "OR": ["or_hb2001"],
    "AZ": ["az_hb2720_2721"], "CO": ["co_hb24_1313", "co_hb24_1152"], "MN": ["mn_minneapolis_2040 (local, unverified)"],
    "MT": ["mt_sb323"], "ME": ["me_ld2003"], "VT": ["vt_act47"], "MA": ["ma_mbta_communities"],
    "NC": ["nc_raleigh_missing_middle (local, could not check)"], "UT": ["ut_hb82_iadu"],
}
ADDED = {
    "WA": ["wa_hb1337_adu", "wa_sb5184_parking", "wa_hb1042_existing_buildings"], "OR": ["or_adu_197a425", "or_commercial_197a460"],
    "MT": ["mt_adu_76_2_345", "mt_commercial_76_2_304_4"], "MA": ["ma_adu_40a3"], "RI": ["ri_adu_large_lot", "ri_adu_existing_footprint"],
    "CA": ["ca_adu_66323"], "AZ": ["az_adaptive_reuse_9_462_10"], "TX": ["tx_sb15_small_lots"],
}
SPECIAL = {
    "NH": {"status": "could_not_check",
           "notes": "Candidate: RSA 674:71-73 (ADUs; reported to be allowed by right, conditional use permit or special exception, which would not be strictly by right) and any 2025 amendments. gc.nh.gov and gencourt.state.nh.us did not answer from the audit machine; FindLaw returned 503.",
           "tried": ["https://gc.nh.gov/rsa/html/LXIV/674/674-72.htm", "https://www.gencourt.state.nh.us/rsa/html/LXIV/674/674-72.htm",
                     "https://codes.findlaw.com/nh/title-lxiv-planning-and-zoning/nh-rev-stat-sect-674-72/"]},
    "CT": {"status": "could_not_check",
           "notes": "Candidate: Public Act 21-29 / C.G.S. § 8-2o (ADUs as of right, with a local opt-out that may make it local-option in practice). cga.ct.gov did not answer; FindLaw returned 404.",
           "tried": ["https://www.cga.ct.gov/current/pub/chap_124.htm"]},
    "DC": {"status": "could_not_check",
           "notes": "Candidate: DC Zoning Regulations (11 DCMR) allowing ADUs by right in residential zones; dcregs.dc.gov is script-driven and returned no regulation text.",
           "tried": ["https://www.dcregs.dc.gov/"]},
    "HI": {"status": "passed_not_yet_in_effect",
           "notes": "SB 3202 (2024) requires each county to adopt ordinances allowing at least two ADUs (or the equivalent) on residentially zoned lots; a county that has not done so by December 31, 2026 may not deny permits for exceeding the unit count (subsection (g)). Not a parcel-level right before 2027, so no statutes.json record.",
           "checked": ["https://www.capitol.hawaii.gov/sessions/session2024/bills/SB3202_CD1_.HTM"], "act_number": "not found (bill status page unreadable)"},
    "FL": {"status": "laws_on_file",
           "notes": "ADUs are local option only: Fla. Stat. § 163.31771(3), 'A local government may adopt an ordinance to allow accessory dwelling units'. Live Local Act already in the table.",
           "checked": ["https://www.flsenate.gov/Laws/Statutes/2025/163.31771"]},
    "MD": {"status": "not_checked",
           "notes": "Candidate: HB 538 (2024, Housing Expansion and Affordability Act: density bonuses near rail and for affordable housing; manufactured housing where single-family homes are allowed). These are bonuses rather than by-right rules in the five categories; text not fetched."},
    "IA": {"status": "none_found", "notes": NONE + ". Iowa Code ch. 414 (city zoning) fetched and searched for 'accessory dwelling': no hits.",
           "checked": ["https://www.legis.iowa.gov/docs/code/414.pdf"]},
    "MN": {"status": "none_found", "notes": NONE + " (statewide). Minn. Stat. § 462.357 fetched and searched for 'accessory dwelling' and 'shall allow': no hits. Minneapolis 2040 is a local plan, already in the table as unverified.",
           "checked": ["https://www.revisor.mn.gov/statutes/cite/462.357"]},
    "VA": {"status": "none_found", "notes": NONE + ". Va. Code § 15.2-2292 fetched (manufactured housing on residential lots); no statewide ADU or middle-housing mandate found.",
           "checked": ["https://law.lis.virginia.gov/vacode/title15.2/chapter22/section15.2-2292/"]},
}
GAPS = {
    "CO": "HB 24-1304 (minimum parking near transit) became law 2024-05-10 per leg.colorado.gov, but its operative text was not fetched (signed-bill PDF 404), so no record was added.",
    "CA": "AB 2011 (Gov. Code §§ 65912.100-65912.140, housing on commercial land): § 65912.114 (ministerial review) was fetched, but the eligibility section § 65912.111 returned 403, so no record was added.",
    "TX": "2025 ADU bills were not checked; SB 1412 (2023) failed and was removed in the first audit.",
    "MT": "A 2023 court challenge to Montana's housing laws was reported; its outcome was not confirmed from a court source.",
}
STATES = ("AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI "
          "SC SD TN TX UT VT VA WA WV WI WY").split()


def main():
    out = {}
    for st in STATES:
        e = {"existing_records": EXISTING.get(st, []), "added_records": ADDED.get(st, [])}
        e.update(SPECIAL.get(st, {}))
        if "status" not in e:
            if e["existing_records"] or e["added_records"]:
                e["status"] = "laws_on_file"
            else:
                e.update({"status": "none_found", "notes": NONE + ". " + BASE_SEARCH})
        if st in GAPS:
            e["known_gap"] = GAPS[st]
        out[st] = e
    doc = {
        "_source": {
            "review": "50-state + DC review of state laws requiring local governments to allow, by right or ministerially: ADUs, middle housing on single-family lots, lot splits, parking-minimum limits, residential use on commercial land",
            "as_of": "2026-11-16",
            "method": "Primary text only as evidence (legislature sites, session laws, official code); quotes cut from fetched pages by scripts/add_state_laws_50.py",
            "secondary_sources": SECONDARY,
            "limits": "Candidate discovery was not exhaustive: secondary pages plus a known-reform list, with full-text code searches only where noted. 'none_found' means no candidate was found, not that none exists.",
        },
        "states": out,
    }
    json.dump(doc, open(OUT, "w"), indent=1, ensure_ascii=False)
    print(dict(collections.Counter(v["status"] for v in out.values())))


if __name__ == "__main__":
    main()
