#!/usr/bin/env python3
"""Catalog round 4 (16 Nov 2026): apply the evidence found for the next ten improvements.
Every quote below was fetched on 2026-11-16 from the URL recorded with it. Run once; it refuses to run twice."""
import json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IV = os.path.join(ROOT, "app", "data", "intervention_verification.json")
RS = os.path.join(ROOT, "app", "data", "research.json")
RS_COPY = os.path.join(ROOT, "data", "research_corpus_500.json")
UC = os.path.join(ROOT, "app", "data", "unit_costs.json")
DAY = "2026-11-16"

iv = json.load(open(IV))
if (iv.get("school_bond") or {}).get("sourced_effect"):
    sys.exit("round 4 already applied")

LIANG_Q = ("The average price premium for houses with EVCSs within 1 km is about 3.3% (or US$17,212) compared with homes "
           "without proximate EVCSs.")
GANDURI_Q = "We find that house prices around a rehabilitated property increase between 2.3 and 4.0 percentage points following the rehabilitation."
CELLINI_Q = "implying a willingness to pay on the part of marginal homebuyers of $1.50 or more for each $1 of capital spending"
CTC_Q = ("Eight DC Fast Chargers (DCFC) will be installed at this location. ... Total Project Cost $1,777,000 Outputs 8 DC charging ports")
CTC_URL = "https://catc.ca.gov/-/media/ctc-media/documents/programs/baseline-agreements/2026-01/5-sbcag-ba-sb-us-101.pdf"


def note(k, text):
    iv[k]["notes"] = (iv[k].get("notes") or "") + " | Round 4 (16 Nov): " + text


# --- blight_rehab: magnitude matches the study's low end ---
iv["blight_rehab"].update({
    "status": "partially_verified", "effect": "checked",
    "evidence": f"Ganduri & Maturana (2024), Journal of Urban Economics, doi:10.1016/j.jue.2024.103694 (SSRN 3794796; abstract fetched via Semantic Scholar {DAY}): \"{GANDURI_Q}\" Engine uses 2.3% (the low end).",
})
note("blight_rehab", "Effect magnitude matches the low end of Ganduri & Maturana (2.3-4.0 points); the distance band of 'around' is in the paper body, not checked. The same abstract estimates an aggregate welfare benefit 3.8 times the amount invested. Cost ($110,000 per rehab) not checked.")

# --- school_bond: value per dollar from the study ---
iv["school_bond"].update({
    "status": "partially_verified", "effect": "checked",
    "evidence": f"Cellini, Ferreira & Rothstein (2010), QJE 125(1):215, doi:10.1162/qjec.2010.125.1.215 (Crossref abstract fetched {DAY}): \"...{CELLINI_Q}\".",
    "sourced_effect": {
        "value_per_dollar": 1.5, "replaces_pct": 3.0,
        "basis": "Home values rise $1.50 or more per $1 of school capital spending (California bond referenda, regression discontinuity); the low end is used. Measured in California; applied elsewhere as an assumption.",
        "citations": [{"cite": "Cellini, Ferreira & Rothstein (2010), The Value of School Facility Investments, QJE, doi:10.1162/qjec.2010.125.1.215",
                       "url": "https://doi.org/10.1162/qjec.2010.125.1.215", "quote": CELLINI_Q}],
        "checked_on": DAY,
    },
})
note("school_bond", "The engine's +3% on every home (and the catalog's '+6%') is replaced by the study's own measure: $1.50 of home value per $1 of capital spending, so the return is $1.50 per $1. The cost (this area's share of ~$40M) is not checked, so the dollar amount inherits that.")

# --- ev_hub: study found (correction), cost from a public project report ---
iv["ev_hub"].update({
    "status": "partially_verified", "effect": "checked", "cost": "checked",
    "evidence": (f"Effect: Liang, Qiu, Liu, He & Mauzerall (2023), Nature Sustainability, doi:10.1038/s41893-022-01058-5 (abstract on nature.com fetched {DAY}): \"{LIANG_Q}\" "
                 f"Cost: California Transportation Commission baseline agreement, SBCAG / City of Santa Barbara ZEV Charging Infrastructure project report (Nov 2025), p. 171: \"{CTC_Q}\" ({CTC_URL})."),
    "sourced_effect": {
        "pct": 3.3, "replaces_pct": 1.0,
        "capex": 1777000, "replaces_capex": 800000,
        "basis": "Homes with a public EV charging station within 1 km sold for about 3.3% more (hedonic association, 14 million California sales, 1993-2021; not a causal estimate). Cost: one planned 8-port DC fast site, Santa Barbara, $1,777,000 total project cost (Nov 2025 report; includes design and site work).",
        "citations": [
            {"cite": "Liang, Qiu, Liu, He & Mauzerall (2023), Effects of expanding electric vehicle charging stations in California on the housing market, Nature Sustainability, doi:10.1038/s41893-022-01058-5",
             "url": "https://www.nature.com/articles/s41893-022-01058-5", "quote": LIANG_Q},
            {"cite": "California Transportation Commission, SB1 Cycle 4 baseline agreement: Santa Barbara ZEV Charging Infrastructure (PPNO 3273), project report Nov 2025, p. 171",
             "url": CTC_URL, "quote": CTC_Q},
        ],
        "checked_on": DAY,
    },
})
note("ev_hub", "Correction to the round-1 audit, which said 'Liang et al. 2023' could not be found: it is Liang et al., Nature Sustainability (2023), and its abstract states the +3.3% within 1 km the catalog cited. The engine used 1.0% and $800,000 for an 8-port site; a public project report budgets $1,777,000, so returns were overstated about 2.2x on cost. Both are replaced by the sourced figures. Remains partly verified: the effect is an association, and the cost is one planned project.")

# --- searched, nothing usable ---
note("farmers_market", "Collins (2020), Applied Geography, doi:10.1016/j.apgeog.2020.102272 (abstract fetched via Semantic Scholar): an 'inverse association between housing prices and distance to the closest farmers' market' in five Central Maryland counties, stronger in poor food environments, but no effect size in the abstract; full text not reachable. Effect stays unconfirmed.")
note("community_garden", "Voicu & Been (2008), Real Estate Economics, doi:10.1111/j.1540-6229.2008.00213.x: abstract confirms 'significant positive effects, especially in the poorest neighborhoods' but states no number; the paper body (SSRN 889113/913356, NELLCO) was unreachable. The engine's +1.5% / +0.5% stays unconfirmed.")
for k in ("corner_store", "slow_streets", "wayfinding", "night_market"):
    note(k, "Crossref searches (property values with corner stores / mixed-use retail, bike boulevards and slow streets, wayfinding signage, night markets) found no study with a property-value effect; OpenAlex was rate-limited. Effect stays unconfirmed.")

iv["ev_hub"]["partial_reason"] = "effect is an association, cost is one planned project"
iv["ev_hub"]["caveat_override"] = ("Association, not a causal estimate: California homes with a public charging station within 1 km "
                                   "sold for about 3.3% more (Liang et al. 2023); the cost is one planned 8-port site in Santa Barbara.")

# Both studies sample California only, so the overrides apply only in California (no dollar figure elsewhere).
for k in ("ev_hub", "school_bond"):
    iv[k]["applies_if"] = {"state_fips_in": ["06"]}
    iv[k]["notes"] += " Applied only in California: the study's sample is California-only (applies_if.state_fips_in); elsewhere no dollar figure is shown."

json.dump(iv, open(IV, "w"), indent=1, ensure_ascii=False)

# --- research library ---
rs = json.load(open(RS))
ids = {r["id"] for r in rs}
new = [
    {"id": "ev_liang_2023", "category": "Energy & EV Infrastructure",
     "title": "Effects of expanding electric vehicle charging stations in California on the housing market",
     "authors": "Jing Liang, Yueming Qiu, Pengfei Liu, Pan He, Denise L. Mauzerall", "year": 2023, "journal": "Nature Sustainability",
     "geography": "California (about 14 million transactions, 1993-2021)", "impact": LIANG_Q, "vpd": None, "takeaway": None,
     "citation": "Liang, J., Qiu, Y., Liu, P., He, P. & Mauzerall, D. L. (2023). Effects of expanding electric vehicle charging stations in California on the housing market. Nature Sustainability.",
     "doi": "10.1038/s41893-022-01058-5", "source_url": "https://www.nature.com/articles/s41893-022-01058-5", "last_verified": DAY,
     "verification": {"status": "verified", "method": f"Crossref metadata; abstract read on nature.com {DAY}", "checked_on": DAY, "evidence": LIANG_Q,
                      "unverified_fields": ["vpd", "takeaway"], "notes": "Hedonic association, not a causal design. Added in catalog round 4."}},
    {"id": "rehab_ganduri_maturana_2024", "category": "Housing & Blight",
     "title": "Do property rehabs affect neighboring property prices?", "authors": "Rohan Ganduri, Gonzalo Maturana", "year": 2024,
     "journal": "Journal of Urban Economics", "geography": "United States", "impact": GANDURI_Q, "vpd": None, "takeaway": None,
     "citation": "Ganduri, R. & Maturana, G. (2024). Do property rehabs affect neighboring property prices? Journal of Urban Economics.",
     "doi": "10.1016/j.jue.2024.103694", "source_url": "https://doi.org/10.1016/j.jue.2024.103694", "last_verified": DAY,
     "verification": {"status": "verified", "method": f"Crossref metadata (JUE and SSRN 3794796 versions); abstract via Semantic Scholar {DAY}", "checked_on": DAY, "evidence": GANDURI_Q,
                      "unverified_fields": ["vpd", "takeaway"], "notes": "Added in catalog round 4."}},
]
for r in new:
    if r["id"] not in ids:
        rs.append(r)
for r in rs:
    if r["id"] == "school_001" and r["verification"]["status"] != "verified":
        r["impact"] = "Passing a referendum causes immediate, sizable increases in home prices, " + CELLINI_Q + "."
        r["verification"].update({"status": "verified", "checked_on": DAY, "evidence": CELLINI_Q,
                                  "method": f"Crossref metadata and abstract fetched {DAY}"})
        r["verification"]["unverified_fields"] = [f for f in r["verification"].get("unverified_fields", []) if f not in ("impact",)]
json.dump(rs, open(RS, "w"), indent=1, ensure_ascii=False)
json.dump(rs, open(RS_COPY, "w"), indent=1, ensure_ascii=False)

# --- unit cost ---
uc = json.load(open(UC))
if not any(r.get("item") == "ev_dcfc_site_8port" for r in uc):
    uc.append({"item": "ev_dcfc_site_8port", "state": "CA", "city_or_region": "Santa Barbara (West Cabrillo Pavilion Lot)", "unit_price": 1777000,
               "unit": "site (8 DC fast-charging ports)", "year": "2025",
               "source_agency": "California Transportation Commission / SBCAG / City of Santa Barbara",
               "document": "SB1 Cycle 4 baseline agreement, Santa Barbara ZEV Charging Infrastructure (PPNO 3273), project report Nov 2025, p. 171",
               "source_url": CTC_URL, "quote": CTC_Q, "status": "confirmed",
               "notes": "Planned project budget (total project cost, includes design and support), not a completed-project cost. One site.",
               "retrieved": DAY, "last_verified": DAY,
               "verification": {"status": "verified", "method": f"PDF fetched {DAY}; text read on p. 171 and the funding table on p. 174 ($1,777 thousand total)",
                                "checked_on": DAY, "evidence": CTC_Q, "unverified_fields": [], "notes": "Planned budget, one project."}})
json.dump(uc, open(UC, "w"), indent=2, ensure_ascii=False)
print("round 4 applied")
