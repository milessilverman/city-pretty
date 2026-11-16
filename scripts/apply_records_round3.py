#!/usr/bin/env python3
"""Round 3 re-check of records marked could_not_check (16 Nov 2026).

Each update below comes from a page fetched during the round (quotes copied verbatim). Records whose sources still
could not be reached keep could_not_check, with the URLs tried and what they returned. The Internet Archive was
blocked by the build machine's network policy during this round. See docs/audit/records-round3.md.
Idempotent.
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DAY = "2026-11-16"


def load(f):
    return json.load(open(os.path.join(ROOT, "app", "data", f)))


def save(f, d):
    json.dump(d, open(os.path.join(ROOT, "app", "data", f), "w"), indent=2)
    open(os.path.join(ROOT, "app", "data", f), "a").write("\n")


def ver(rec, status, method, evidence, unverified, notes):
    v = rec.setdefault("verification", {})
    keep = {k: v[k] for k in ("removed_unverified_claims", "original_claimed_citation") if k in v}
    rec["verification"] = {"status": status, "method": method, "checked_on": DAY, "evidence": evidence,
                           "unverified_fields": unverified, "notes": notes, **keep}


ITDP_PDF = "https://www.itdp.org/wp-content/uploads/2013/11/More-Development-For-Your-Transit-Dollar_ITDP.pdf"
INDY = "https://indyculturaltrail.org/economic-impact/"

# ---------------------------------------------------------------------------------------------------- research
research = load("research.json")
R = {r["id"]: r for r in research}

r = R["hist_003"]
r.update(title="Assessment of the Impact of the Indianapolis Cultural Trail: A Legacy of Gene and Marilyn Glick",
         authors="Indiana University Public Policy Institute", year=2015, journal="IU Public Policy Institute report",
         source_url=INDY, citation="IU Public Policy Institute (2015). Assessment of the Impact of the Indianapolis Cultural Trail: A Legacy of Gene and Marilyn Glick.",
         impact="Property assessments within approximately one block of the eight mile Trail have increased 148% since 2008, an increase of $1 billion in assessed property value (before-after change; not a causal estimate).")
ver(r, "partially_verified", "Fetched the Indianapolis Cultural Trail's release announcing the report (23 Jul 2015).",
    "\"The report found that property assessments within approximately one block of the eight mile Trail have increased 148% since 2008, an increase of $1 billion in assessed property value.\"",
    ["authors (individual names)", "impact (causal share)"],
    "The report itself was not fetched; the figure is quoted from the publisher's announcement. It measures change near the trail, not the change caused by it. The earlier claims ('+1,600% ROI', '11,000+ jobs', '48% retail foot traffic growth') appear nowhere in the source and stay removed.")

r = R["park_002"]
r.update(year=2009, journal="The Trust for Public Land, Center for City Park Excellence",
         impact="Method report: values a park system by seven attributes (property value, tourism, direct use, health, community cohesion, clean water, clean air); no single effect size.")
ver(r, "partially_verified", "Fetched the publisher's page (tpl.org).",
    "\"Measuring the Economic Value of a City Park System Published: April 2nd, 2009 ... determining dollar value by way of seven attributes: Property value Tourism Direct use Health Community cohesion Clean water Clean air\"",
    ["authors"], "Title, publisher and date confirmed; authors are not named on the page. It is a method, not a measured effect.")

r = R["hist_010"]
r.update(title="More Development For Your Transit Dollar: An Analysis of 21 North American Transit Corridors",
         authors="Walter Hook, Stephanie Lotshaw, Annie Weinstock (ITDP)", year=2013, journal="Institute for Transportation and Development Policy",
         source_url=ITDP_PDF,
         citation="Hook, W., Lotshaw, S. & Weinstock, A. (2013). More Development For Your Transit Dollar: An Analysis of 21 North American Transit Corridors. ITDP, New York.",
         impact="Cleveland HealthLine: \"Cleveland managed to transform a modest $50 million investment in bus rapid transit into $5.8 billion in new transit-oriented development\"; \"Over $200 million in overall public funds were invested ... only $50 million of which were for the transit system.\" (Investment along the corridor, not development caused by the line.)")
ver(r, "verified", "Fetched and text-searched the report PDF (itdp.org).",
    "\"Cleveland managed to leverage $114.54 dollars of new transit-oriented investment for every dollar it invested into the BRT system\"",
    [], "Corrected: the earlier record claimed $9.5B private investment, $200M capital cost and a 47.5:1 ratio; the report says $5.8B of TOD investment, $200M+ total public funds of which $50M was transit. The report attributes investment along the corridor; it does not isolate what the BRT caused.")

dead = {  # URLs re-tried this round; all failed (status in brackets)
    "art_008": ("could_not_check", "Cited URL returns 404; FRBSF alternate path also 404."),
    "tree_006": ("could_not_check", "cnt.org: TLS hostname mismatch from the build machine (https and http)."),
    "hist_001": ("could_not_check", "uli.org returns 403."),
    "hist_004": ("could_not_check", "dura-denver.org: proxy 502."),
    "hist_006": ("could_not_check", "Cited portland.gov URL returns 404; prosperportland.us alternate also 404."),
    "hist_008": ("could_not_check", "Cited URL returns 404; waterloogreenway.org home page reachable but shows no economic-impact figures."),
    "hist_009": ("could_not_check", "okc.gov returns 403 (cited and alternate paths)."),
    "transit_002": ("could_not_check", "transit.dot.gov 403; ctod.org alternate 404; reconnectingamerica.org unreachable."),
    "bike_001": ("could_not_check", "Cited nyc.gov URL returns 404, as do /assets/ and www1 alternates."),
    "bike_004": ("could_not_check", "Cited smartgrowthamerica.org URL returns 404; alternate resource path 404."),
}
for i, (st, note) in dead.items():
    v = R[i]["verification"]
    v["checked_on"] = DAY
    v["notes"] = (v.get("notes", "") + f" Round 3: {note}").strip()
save("research.json", research)

# ---------------------------------------------------------------------------------------------------- case studies
cases = load("case_studies.json")
C = {c["id"]: c for c in cases}

c = C["healthline_cle"]
c.update(publicCost=200000000, privateCap=5800000000, ratio="$114.54 of TOD investment per $1 of BRT spending ($50M); about 29:1 against all public funds ($200M+)",
         taxVehicle=None, valueUplift=None, taxGrowth=None, takeaway=None, year=2008,
         evaluation_url=ITDP_PDF, source="ITDP (2013), More Development For Your Transit Dollar", last_verified=DAY)
c.pop("trajectory", None)
ver(c, "partially_verified", "Fetched and text-searched the ITDP report PDF.",
    "\"Cleveland's HealthLine BRT has helped leverage $5.8 billion dollars of TOD investment since its opening in 2008\"; \"Over $200 million in overall public funds were invested in Cleveland, only $50 million of which were for the transit system.\"",
    ["valueUplift", "taxGrowth", "taxVehicle", "stations", "lat", "lng"],
    "Money figures now from ITDP. Investment along the corridor is not the same as value created by the line. The earlier $9.5B / +112% claims were not in the source.")

c = C["cultural_trail_indy"]
c.update(valueUplift="+148% assessed value within about one block since 2008 (+$1 billion)", source="IU Public Policy Institute (2015), via the Trail's announcement", year=2008)
ver(c, "partially_verified", "Fetched the Indianapolis Cultural Trail's release announcing the IU Public Policy Institute report.",
    "\"property assessments within approximately one block of the eight mile Trail have increased 148% since 2008, an increase of $1 billion in assessed property value\"",
    ["publicCost", "privateCap", "ratio", "taxGrowth", "taxVehicle", "stations", "lat", "lng"],
    "Before-after change near the trail, not a causal estimate. Cost figures are not in the fetched source.")

for cid, url, quote, note in [
    ("beltline_atl", "https://beltline.org/the-project/", "\"This network of public parks, multi-use trails, transit, and affordable housing along a historic 22-mile railroad corridor\"",
     "Project and its 22-mile length confirmed; no money figure on the page. The cited URL returned 404; the project page used instead."),
    ("highline_nyc", "https://www.thehighline.org/about/", "The High Line's own Overview page (thehighline.org/about)",
     "Existence confirmed on the park's own site; no economic figures fetched (uli.org case study returns 403)."),
    ("falls_park_greenville", "https://www.greenvillesc.gov/167/Falls-Park", "\"Falls Park ... Liberty Bridge\" (City of Greenville page)",
     "Park and Liberty Bridge confirmed on the city's page; no cost or value figures on it."),
]:
    c = C[cid]
    c["evaluation_url"] = url
    ver(c, "partially_verified", "Fetched the project's own page.", quote,
        ["year", "publicCost", "privateCap", "ratio", "valueUplift", "taxGrowth", "taxVehicle", "stations", "lat", "lng"], note)
for cid, note in [("union_station_denver", "dura-denver.org: proxy 502."), ("okc_maps", "okc.gov 403 (cited and alternate)."),
                  ("waller_creek_austin", "Cited URL 404; home page has no figures.")]:
    v = C[cid]["verification"]
    v["checked_on"] = DAY
    v["notes"] = (v.get("notes", "") + f" Round 3: {note}").strip()
save("case_studies.json", cases)

# ---------------------------------------------------------------------------------------------------- funding
funding = load("funding_programs.json")
F = {f["id"]: f for f in funding}

f = F["ca_urban_greening"]
f.update(program_name="California Urban Greening Grant Program (Proposition 4 Climate Bond)",
         administering_agency="California Natural Resources Agency (CNRA)",
         funding_share_pct=None,
         funding_share_description="Proposition 4 allocates approximately $100 million in two competitive cycles; $46,125,000 available in Round 1 (2026). Grant share of project cost not stated on the program page.",
         eligible_improvements=["Planting trees that provide strategic shade",
                                "Expanding green spaces that serve as places of refuge during heat waves",
                                "Green streets and alleyways that capture and clean stormwater"],
         cycle_dates="2026 Round 1: full proposals were due 4 Sep 2026 (window closed); awards expected December 2026. Round 2 expected late 2027 or early 2028.",
         how_to_apply="Concept and full proposals through CNRA's RAPTR system during an open round",
         source_url="https://resources.ca.gov/grants/urban-greening/", last_verified=DAY)
ver(f, "partially_verified", "Fetched the program page (resources.ca.gov).",
    "\"The voter-approved Climate Bond (Proposition 4) allocates approximately $100 million for Urban Greening grants. Funding will be awarded in two competitive cycles, with $46,125,000.00 available in the first round.\"",
    ["funding_share_pct", "statutory_citation"],
    "Corrected: the record said Cap-and-Trade funding, an annual window and SOAR applications; the program page says Proposition 4, two cycles (next late 2027/early 2028) and RAPTR.")

f = F["co_ura_tif"]
f.update(funding_share_pct=None,
         funding_share_description="An urban renewal plan may divide property taxes and/or municipal sales taxes in the area for a period not to exceed 25 years; the increment over the base goes to a special fund for the project.",
         source_url="https://colorado.public.law/statutes/crs_31-25-107")
ver(f, "partially_verified", "Fetched C.R.S. 31-25-107 (colorado.public.law mirror).",
    "\"property taxes ... or that municipal sales taxes collected within said area, or both such taxes ... must be divided for a period not to exceed twenty-five years after the effective date of adoption of such a provision\"",
    ["funding_share_pct", "eligible_improvements"],
    "Mechanism and 25-year limit confirmed. The '100% of increment' share and the listed eligible projects (incl. the HB 24-1313 density link) are not in the statute; share depends on agreements with taxing bodies.")

for fid, note in [("la_measure_w", "safecleanwaterla.org 403; dpw.lacounty.gov alternate 403."), ("la_prop_k", "eng.lacity.gov: proxy 502."),
                  ("il_transit_tif", "Cited chicago.gov URL 404; ilga.gov statute page unreachable.")]:
    v = F[fid]["verification"]
    v["checked_on"] = DAY
    v["notes"] = (v.get("notes", "") + f" Round 3: {note}").strip()
save("funding_programs.json", funding)

# ---------------------------------------------------------------------------------------------------- statutes
for name in ("statutes.json", "state-housing-laws.json"):
    st = load(name)
    S = {s["id"]: s for s in st}
    s = S["mn_minneapolis_2040"]
    ver(s, "unverified", "Fetched minneapolis2040.com housing page and the Minnesota Revisor's pages for Minn. Stat. 473.858 and Laws 2024 c. 115.",
        "minneapolis2040.com/topics/housing has background text but no triplex or parking rule; Minn. Stat. 473.858 version history lists no 2024 amendment ('Subd. 1 Amended 2014 c 271'); Laws 2024 c. 115 contains no comprehensive-plan language.",
        ["max_units_by_right", "summary", "bill_number", "statute_citation", "effective_date"],
        "The triplex-by-right and parking claims, and the cited 2024 law, could not be confirmed; the cited 2024 chapter does not appear to concern this plan. Do not present as by-right.")
    v = S["nc_raleigh_missing_middle"]["verification"]
    v["checked_on"] = DAY
    v["notes"] = (v.get("notes", "") + " Round 3: raleighnc.gov returns 403.").strip()
    save(name, st)

print("applied")
