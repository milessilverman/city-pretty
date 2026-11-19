#!/usr/bin/env python3
"""Round 3 broken-link fixes (16 Nov 2026): the 17 cited URLs scripts/check_sources.py found returning 404.

Where the document moved and was fetched at its new address, the URL is replaced with evidence. Where it could
not be found (the Internet Archive was blocked from the build machine), the record says "source link broken as of
2026-11-16" and, if its claim rested only on that link, is downgraded to unverified. Idempotent.
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DAY = "2026-11-16"
BROKEN = f"source link broken as of {DAY}"


def path(f):
    return os.path.join(ROOT, "app", "data", f)


def load(f):
    return json.load(open(path(f)))


def save(f, d):
    json.dump(d, open(path(f), "w"), indent=2)
    open(path(f), "a").write("\n")


def note(v, text):
    if text not in v.get("notes", ""):
        v["notes"] = (v.get("notes", "") + " " + text).strip()


def broken(rec, url_field, downgrade=True):
    v = rec["verification"]
    note(v, f"{BROKEN}: {rec.get(url_field)} returns 404; no new address found.")
    v["checked_on"] = DAY
    if downgrade and v["status"] in ("could_not_check", "partially_verified"):
        v["status"] = "unverified"


# research
research = load("research.json")
R = {r["id"]: r for r in research}
for i in ("art_008", "bike_001", "bike_004", "hist_006", "transit_002", "hist_009", "hist_008"):
    broken(R[i], "source_url")
save("research.json", research)

# case studies
cases = load("case_studies.json")
C = {c["id"]: c for c in cases}
for i in ("waller_creek_austin", "okc_maps"):
    broken(C[i], "evaluation_url")
save("case_studies.json", cases)

# funding
funding = load("funding_programs.json")
F = {f["id"]: f for f in funding}
f = F["federal_fra_intercity_grant"]
old = f["source_url"]
f["source_url"] = "https://www.law.cornell.edu/uscode/text/49/24911"
note(f["verification"], f"Round 3: the FRA program page ({old}) returns 404; source_url now points to 49 U.S.C. 24911, which this record was verified against (fetched {DAY}: 'shall not exceed 80 percent').")
f = F["az_gplet"]
old = f["source_url"]
f["source_url"] = "https://www.azleg.gov/ars/42/06209.htm"
f["verification"]["unverified_fields"] = [u for u in f["verification"]["unverified_fields"] if "phoenix.gov" not in u]
note(f["verification"], f"Round 3: {old} returns 404; source_url now the statute this record was checked against (A.R.S. 42-6209).")
broken(F["il_transit_tif"], "source_url")
save("funding_programs.json", funding)

# unit costs: CDOT 2025 Cost Data Book moved to CDOT's document system; price confirmed there
costs = load("unit_costs.json")
for c in costs:
    if c.get("source_url") == "https://www.codot.gov/business/eema/assets/2025-cost-data-book.pdf":
        c["source_url"] = "https://oitco.hylandcloud.com/cdotrmpop/docpop/docpop.aspx?docid=58703563"
        c["quote"] = "STR025A-054 I-25C NORTH OUT OF WALSENBURG 09/18/25 220.00 115.29 111.22 110.00 (Conc Sidewalk, Sq Yard; quantity, engineer's estimate, average bid, awarded bid)"
        c["status"] = "confirmed"
        c["last_verified"] = DAY
        c["verification"] = {"status": "verified", "method": "Fetched CDOT's 2025 Cost Data Book (linked from codot.gov/business/eema/costdatabook) and read item 608-00000.",
                             "checked_on": DAY, "evidence": "PDF page 417 (book p. 404): awarded bid $110.00 per SY, 220 SY, let 09/18/25.",
                             "unverified_fields": [], "notes": "The old codot.gov PDF path returns 404; the book now lives in CDOT's OnBase document viewer."}
save("unit_costs.json", costs)

# finance profiles
fin = load("state_finance_profiles.json")
mi = fin["MI"]
mi["source_url"] = "https://www.legislature.mi.gov/Laws/MCL?objectName=mcl-211-27a"
note(mi["verification"], "Round 3: old legislature.mi.gov/statutes/ URL returns 404; replaced with the MCL page the field evidence was read from.")
tn = fin["TN"]
old = tn["source_url"]
tn["source_url"] = "https://comptroller.tn.gov/office-functions/pa.html"
note(tn["verification"], f"Round 3: {old} returns 404; replaced with the Comptroller's Property Assessments page (a landing page; no TN value is confirmed from it).")
note(fin["OK"]["verification"], f"{BROKEN}: {fin['OK']['source_url']} returns 404; no new address found.")
save("state_finance_profiles.json", fin)

# intercity corridor
ic = load("intercity_transit_corridors.json")
for c in ic:
    if c["id"] == "corridor_atx_sat":
        broken(c, "official_study_url")
save("intercity_transit_corridors.json", ic)
print("applied")
