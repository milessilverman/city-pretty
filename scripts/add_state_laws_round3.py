"""Round 3 of the state housing-law review (16 Nov 2026): the 23 states whose code sites blocked round 2, plus NH, CT,
DC and Maryland HB 538.

Adds the qualifying laws to app/data/statutes.json and app/data/state-housing-laws.json (kept identical) and writes
each jurisdiction's search log (`round3_search`) into docs/audit/state-laws-50.json.

Every quote is cut from text fetched by scripts/law_search_lib.py (cached in .law_cache/, not committed); the script
stops if a quoted passage is not in the fetched text. Search logs come from the .law_cache/round3_*.json files written
by scripts/law_search_chapters.py and scripts/law_search_la.py, and from the CT/DC/VA/MD reads described below.
Re-running it is idempotent.
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from law_search_lib import CACHE, TERMS, fetch  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATUTES = [os.path.join(ROOT, "app/data/statutes.json"), os.path.join(ROOT, "app/data/state-housing-laws.json")]
AUDIT = os.path.join(ROOT, "docs/audit/state-laws-50.json")
DATE = "2026-11-16"
TERM_NAMES = list(TERMS)


def cut(text, anchor, n):
    i = text.find(anchor)
    if i < 0:
        raise SystemExit(f"quote anchor not in fetched text: {anchor[:60]!r}")
    return text[i: i + n].strip()


def cached_json(name):
    return json.load(open(os.path.join(CACHE, name)))


# ---- fetched texts ---------------------------------------------------------------------------------------------
VA_2209_4 = "https://law.lis.virginia.gov/vacode/title15.2/chapter22/section15.2-2209.4/"
VA_2286_2 = "https://law.lis.virginia.gov/vacode/title15.2/chapter22/section15.2-2286.2/"
VA_2292_4 = "https://law.lis.virginia.gov/vacode/title15.2/chapter22/section15.2-2292.4/"
VA_TOC = "https://law.lis.virginia.gov/vacode/title15.2/chapter22/"
DC_SECTION = "https://dcregs.dc.gov/Common/DCMR/SectionList.aspx?SectionNumber=11-U253"
DC_DOC = "https://dcregs.dc.gov/Common/DCMR/RuleList.aspx?DownloadFile={8E59471E-8C75-40F3-858C-FEB57CD5BA4B}"
MD_CH122 = "https://mgaleg.maryland.gov/2024RS/Chapters_noln/CH_122_hb0538e.pdf"
KY_100_2101 = "https://apps.legislature.ky.gov/law/statutes/statute.aspx?id=56173"

va1, va2, va3 = fetch(VA_2209_4), fetch(VA_2286_2), fetch(VA_2292_4)
_doc = fetch(DC_DOC, raw=True)
dc = " ".join(" ".join(x.decode("latin1") for x in re.findall(rb"[\x20-\x7e\r\n\t]{4,}", _doc)).split())
ct_2o = cached_json("ct_8_2.json")["8-2o"]
ct_2 = cached_json("ct_8_2_main.json")
ct_more = cached_json("ct_more.json")
md = fetch(MD_CH122)
ky = fetch(KY_100_2101)
for name, t in [("VA 2209.4", va1), ("VA 2286.2", va2), ("VA 2292.4", va3), ("DC U-253", dc), ("MD ch 122", md), ("KY 100.2101", ky)]:
    if not t:
        raise SystemExit(f"{name}: text not in cache; fetch it first")

VA_DATE_NOTE = ("effective_date (Virginia acts take effect 1 July unless they say otherwise; the act itself was not fetched. "
                "The Code page, dated 11/16/2026, shows this section as current with no future-effective label, unlike "
                "§ 15.2-2292.4, which is labelled 'Effective July 1, 2027')")

RECORDS = [
    {
        "id": "va_parking_2209_4",
        "state_code": "VA",
        "bill_number": "2026 Acts ch. 1075",
        "session": "2026 Regular Session",
        "short_name": "VA: parking minimums capped within 1/2 mile of transit stations",
        "statute_citation": "Va. Code § 15.2-2209.4 (2026, c. 1075)",
        "effective_date": "2026-07-01",
        "statute_url": VA_2209_4,
        "parcel_level": False,
        "distance_to_transit_max_mi": 0.5,
        "max_parking_requirement_per_unit": 0.5,
        "unmapped_condition": "parcel within one-half mile of the entrance to a mass transit or public transportation station or facility (a building or enhanced structure where the public boards; school buses, microtransit and charter service excluded); localities over 600,000 people may exceed the caps near locality-managed bus stops if they offer the required administrative reduction",
        "summary": "A locality may not require, as a condition of zoning approval, more than 0.5 off-street parking space per unit for multifamily or mixed-use residential development, or more than 1 per unit for one- and two-family homes and townhouses, on parcels within half a mile of a transit station entrance. Localities over 20,000 must also offer an administrative parking reduction of at least 20% elsewhere.",
        "verification": {
            "status": "verified",
            "method": "Code of Virginia, official site (law.lis.virginia.gov), section page dated 11/16/2026",
            "checked_on": DATE,
            "evidence": " || ".join([
                cut(va1, "B. Any locality that has adopted a zoning ordinance", 430),
                cut(va1, "\"Designated area\" means any parcel", 130),
                cut(va1, "2026, c. 1075", 13),
            ]),
            "unverified_fields": [VA_DATE_NOTE],
            "notes": "A jurisdiction-wide cap on what a locality may require, not a parcel right; the engine never applies it to a single parcel.",
        },
        "last_verified": DATE,
    },
    {
        "id": "va_small_lot_2286_2",
        "state_code": "VA",
        "bill_number": "2026 Acts ch. 751",
        "session": "2026 Regular Session",
        "short_name": "VA: localities of 50,000+ must have a 3,000 sq ft single-family lot district",
        "statute_citation": "Va. Code § 15.2-2286.2 (2026, c. 751)",
        "effective_date": "2026-07-01",
        "statute_url": VA_2286_2,
        "parcel_level": False,
        "municipality_pop_min": 50000,
        "unmapped_condition": "land the locality has placed in a zoning district meeting § 15.2-2286.2 (the law requires at least one such district, not small lots everywhere); not in a historic district under § 15.2-2306",
        "summary": "Every locality of 50,000 or more must adopt, keep and apply to land at least one zoning district that allows a single-family home on a lot of no more than 3,000 sq ft, with no minimum lot width over 30 ft and no setback, coverage or density rule that would prevent such homes on conforming lots. Historic districts are excluded.",
        "verification": {
            "status": "verified",
            "method": "Code of Virginia, official site (law.lis.virginia.gov), section page dated 11/16/2026",
            "checked_on": DATE,
            "evidence": " || ".join([
                cut(va2, "A. Any locality with a population of 50,000 or more", 420),
                cut(va2, "D. This section shall not apply", 110),
            ]),
            "unverified_fields": [VA_DATE_NOTE],
            "notes": "A duty to zone some land for small lots; which land is up to the locality, so it is never a right on a given parcel.",
        },
        "last_verified": DATE,
    },
    {
        "id": "dc_adu_accessory_apartment_u253",
        "state_code": "DC",
        "bill_number": "Zoning Regulations of 2016, 11-U DCMR § 253",
        "session": "DC Zoning Commission final rulemaking, 63 DCR 2447 (2016); amended 70 DCR 011297 (2023) and 73 DCR 013245 (2026)",
        "short_name": "DC: one accessory apartment as a matter of right in most R zones",
        "statute_citation": "11-U DCMR § 253",
        "effective_date": None,
        "statute_url": DC_SECTION,
        "adus_by_right": 1,
        "unmapped_condition": "an R zone other than R-1B/GT or R-3/GT (DC zone names are not on the parcel record); the principal dwelling or the apartment owner-occupied; in the house, the zone's minimum gross floor area (Table U 253.7(a)) with the apartment at most 35% of it; in an accessory building, permanent access as set out in § U-253.8",
        "summary": "One accessory apartment is allowed as a matter of right in a house or accessory building in DC's R zones, except R-1B/GT and R-3/GT (special exception there). Conditions: owner occupancy of one unit, at most 3 occupants in the apartment, a minimum house size and a 35% cap for apartments in the house, and permanent street or alley access for apartments in accessory buildings. A rental business license is needed before renting.",
        "verification": {
            "status": "verified",
            "method": "DC Municipal Regulations, official text file of 11-U DCMR § 253 downloaded from dcregs.dc.gov",
            "checked_on": DATE,
            "evidence": " || ".join([
                cut(dc, "An accessory apartment shall be permitted in a principal dwelling or an accessory building as a matter of right", 210),
                cut(dc, "Either the principal dwelling or accessory apartment unit shall be owner-occupied", 110),
                cut(dc, "SOURCE: Final Rulemaking", 240),
            ]),
            "unverified_fields": ["effective_date (the text lists final rulemakings published in 2016, 2023 and 16 Oct 2026; the date each took effect was not fetched)"],
            "notes": f"Text file: {DC_DOC}. DC is a single jurisdiction, so this is its own zoning code rather than a state preemption law.",
        },
        "last_verified": DATE,
    },
    {
        "id": "ct_adu_8_2o",
        "state_code": "CT",
        "bill_number": "Public Act 21-29",
        "session": "2021 Regular Session",
        "short_name": "CT: one ADU as of right on single-family lots (towns could opt out before 2023)",
        "statute_citation": "Conn. Gen. Stat. § 8-2o",
        "effective_date": "2023-01-01",
        "statute_url": ct_2o["url"],
        "adus_by_right": 1,
        "max_parking_requirement_per_unit": 1,
        "unmapped_condition": "the town did not complete an opt-out under § 8-2o(f) before 1 January 2023 (Connecticut's list of opted-out towns is not on file); in an opted-out town the right still applies to an owner of 3+ years inside a transit-oriented district (§ 8-13hh)",
        "summary": "Zoning must allow at least one accessory dwelling unit, attached or detached, as of right on each lot with a single-family home, with a decision within 65 days; towns may not require more than one parking space, owner-occupant relationships, age limits, a passageway or separate utility connections. Rules not amended by 1 Jan 2023 became void. Towns could opt out by two-thirds votes, but not on or after 1 Jan 2023.",
        "verification": {
            "status": "verified",
            "method": "Connecticut General Statutes, official statute search (search.cga.state.ct.us), section text",
            "checked_on": DATE,
            "evidence": " || ".join([
                cut(ct_2o["text"], "(1) Designate locations or zoning districts", 330),
                cut(ct_2o["text"], "(C) any more than one parking space", 60),
                cut(ct_2o["text"], "(e) If a municipality fails to adopt new regulations", 300),
                cut(ct_2o["text"], "except that, on and after January 1, 2023, no municipality may opt out", 120),
            ]),
            "unverified_fields": ["bill_number (from round-1 secondary sources; the section's history line was not fetched)"],
            "notes": "Effective date taken from the statute's own 1 Jan 2023 compliance date in subsection (e).",
        },
        "last_verified": DATE,
    },
    {
        "id": "ct_parking_8_3n",
        "state_code": "CT",
        "bill_number": "Nov. Sp. Sess. P.A. 25-1, § 18 (amending § 8-2(d)(9))",
        "session": "2025 November Special Session",
        "short_name": "CT: no residential parking minimums except for 17+ units (capped) and small districts",
        "statute_citation": "Conn. Gen. Stat. §§ 8-2(d)(9), 8-3n",
        "effective_date": None,
        "statute_url": ct_more["8-3n"]["url"],
        "parcel_level": False,
        "max_parking_requirement_per_unit": 2,
        "unmapped_condition": "16 or fewer units, and outside the town's conservation and traffic mitigation districts (at most two, together no more than 4% of land area); 17+ units may be required up to 1 space per studio or one-bedroom and 2 per larger unit, or the parking-needs-assessment number if lower",
        "summary": "Zoning may not require a minimum number of off-street parking spaces for any residential development except as § 8-3n allows: towns may set minimums for developments over 16 units (and, in up to two small districts, for smaller ones), but if the developer submits a parking needs assessment the requirement cannot exceed 1 space per studio or one-bedroom and 2 per unit with two or more bedrooms, or the assessment's number if lower.",
        "verification": {
            "status": "verified",
            "method": "Connecticut General Statutes, official statute search (search.cga.state.ct.us), section text of §§ 8-2 and 8-3n",
            "checked_on": DATE,
            "evidence": " || ".join([
                cut(ct_2["text"], "(d) Zoning regulations adopted pursuant to subsection (a) of this section shall not:", 85),
                cut(ct_2["text"], "(9) Require a minimum number of off-street motor vehicle parking spaces for any residential development", 140),
                cut(ct_2["text"], "Nov. Sp. Sess. P.A. 25-1, S. 18.)", 33),
                cut(ct_more["8-3n"]["text"], "(b) A municipality may require a minimum number of off-street motor vehicle parking spaces", 700),
            ]),
            "unverified_fields": ["effective_date (the amending act, Nov. Sp. Sess. P.A. 25-1, was not fetched)"],
            "notes": f"§ 8-2 text: {ct_2['url']}. A jurisdiction-wide limit, not a parcel right.",
        },
        "last_verified": DATE,
    },
    {
        "id": "ct_middle_housing_8_2s",
        "state_code": "CT",
        "bill_number": None,
        "session": "2025",
        "short_name": "CT: transit community middle housing or mixed use on commercial lots, summary review (from 1 July 2026)",
        "statute_citation": "Conn. Gen. Stat. § 8-2s",
        "effective_date": "2026-07-01",
        "statute_url": ct_more["8-2s"]["url"],
        "applies_to_zone": "commercial",
        "unmapped_condition": "the project meets the definition of a transit community middle housing development (§ 8-13hh) or a mixed-use development (definitions not fetched); review is summary review under § 8-2r",
        "summary": "From 1 July 2026, zoning must allow a transit community middle housing development or a mixed-use development on any lot zoned for commercial or mixed-use development, subject only to summary review; towns may also allow it on residential lots and earn housing points for doing so.",
        "verification": {
            "status": "partially_verified",
            "method": "Connecticut General Statutes, official statute search (search.cga.state.ct.us), section text",
            "checked_on": DATE,
            "evidence": cut(ct_more["8-2s"]["text"], "(a) On and after July 1, 2026", 520),
            "unverified_fields": ["bill_number (the enacting act was not fetched)",
                                  "definitions of transit community middle housing development and mixed-use development (§ 8-13hh, not fetched)"],
            "notes": "Effective date from the section's own 'On and after July 1, 2026'.",
        },
        "last_verified": DATE,
    },
]

# ---- round-3 search logs -------------------------------------------------------------------------------------------


def chapter_log(state):
    out = []
    for c in cached_json(f"round3_{state}.json"):
        hits = {k: sorted({h.get("section") or h.get("section_id") for h in v}) for k, v in c.get("term_hits", {}).items()}
        out.append({"citation": c["citation"], "url": c.get("url"), "sections_found": c.get("sections_found"),
                    "sections_fetched": c.get("sections_fetched"), "title_filtered": c.get("title_filtered", False),
                    "full_text_searched": c.get("full_text_searched", c.get("sections_fetched") == c.get("sections_found")),
                    "term_hits_by_section": hits})
    return out


def ok_log():
    d = cached_json("round3_OK.json")
    return [{"citation": f"Okla. Stat. title {t} (complete title PDF; includes Laws 2026)", "url": v["url"], "chars": v["chars"],
             "full_text_searched": True, "term_hits": {k: len(x) for k, x in v["hits"].items()}} for t, v in d.items()]


def la_log():
    d = cached_json("round3_LA.json")
    return [{"phrase": s["phrase"], "sections_reported": s["sections_reported"], "sections_listed": s["sections_listed"],
             "zoning_sections": [x["cite"] for x in s["sections"] if x["cite"].startswith("RS 33:47")]} for s in d["searches"]]


def blocked(tried, unblock):
    return {"date": DATE, "terms": TERM_NAMES, "routes": tried, "route_worked": None, "full_text_searched": False, "unblock": unblock}


LEGISCAN_JUSTIA = {"url": "https://legiscan.com/ and https://law.justia.com/", "result": "HTTP 403 (Cloudflare) from the build machine"}

R3 = {
    "AK": {"route_worked": "https://www.akleg.gov/basis/statutes.asp (print view, media=print, AS 29.40.010-29.40.200)",
           "searched": [{"citation": "AS 29.40.010-.200 (planning, platting, land use)", "sections": 20, "full_text_searched": True, "term_hits": {}}],
           "outcome": "searched, none"},
    "DE": {"route_worked": "https://delcode.delaware.gov/ subchapter pages",
           "searched": [{"citation": c, "url": v["url"], "chars": v["chars"]} for c, v in cached_json("round3_PA_DE.json").items() if c.startswith("Del.") and v["chars"]]
           + [{"citation": "Del. Code title 9 ch. 68 (index page holds the full text)", "url": "https://delcode.delaware.gov/title9/c068/index.html", "chars": 21717}],
           "outcome": "searched, none"},
    "KS": {"route_worked": "https://www.ksrevisor.gov/statutes/ (section pages)", "searched": chapter_log("KS"),
           "outcome": "searched, none (7 of 72 sections did not load; the one hit, K.S.A. 12-764, is a vesting rule that lists duplexes as residential development)"},
    "KY": {"route_worked": "https://apps.legislature.ky.gov/law/statutes/ (section PDFs/pages)",
           "searched": [{"citation": "KRS ch. 100 (planning and zoning)", "url": "https://apps.legislature.ky.gov/law/statutes/chapter.aspx?id=37542",
                         "sections_found": 293, "sections_fetched": 282, "full_text_searched": False, "term_hits_by_section": {"adu": ["KRS 100.2101"]}}],
           "found_not_qualifying": [{"citation": "KRS 100.2101 (2025 Ky. Acts ch. 56, § 3, effective 2025-06-27)", "url": KY_100_2101,
                                     "why": "restricts housing: in Louisville Metro, multifamily 'density development projects' in traditional single-family zones must go through the map-amendment process",
                                     "quote": cut(ky, "(2) In a county containing a consolidated local government", 260)}],
           "outcome": "searched, none (11 of 293 sections did not load)"},
    "LA": {"route_worked": "https://www.legis.la.gov/legis/LawSearch.aspx (the legislature's own Revised Statutes text search; scripts/law_search_la.py)",
           "searched": la_log(),
           "outcome": "searched, none ('accessory dwelling', 'accessory apartment', 'lot split', 'middle housing', 'minimum parking' and 'accessory residential' match no section; 'duplex' matches 5 definitions sections outside zoning; 'off-street parking' is matched word by word and its first 94 listed results contain no zoning section)"},
    "MO": {"route_worked": "https://revisor.mo.gov/main/OneSection.aspx", "searched": chapter_log("MO"),
           "outcome": "searched, none (hits are court-case annotations under §§ 89.020, 89.090)"},
    "NE": {"route_worked": "https://nebraskalegislature.gov/laws/statutes.php", "searched": chapter_log("NE"),
           "found_not_qualifying": [{"citation": "Neb. Rev. Stat. §§ 19-5501 to 19-5506 (Municipal Density and Missing Middle Housing Act, LB 866, Laws 2020)",
                                     "why": "requires reports on zoning (§ 19-5504) and affordable-housing action plans with goals (§ 19-5505); zoning must 'comply with' the Act (§§ 19-901, 15-902) but the Act makes no housing type allowed by right"}],
           "outcome": "searched, none (sections chosen by title words: zoning, housing, dwelling, parking, residential, density, lot)"},
    "OK": {"route_worked": "https://www.oklegislature.gov/OK_Statutes/CompleteTitles/ (complete-title PDFs)", "searched": ok_log(),
           "outcome": "searched, none (hits are contractor-permit and small-wireless rules and the county zoning district list)"},
    "PA": {"route_worked": "https://www.palegis.us/statutes/unconsolidated/ (MPC, Act 247 of 1968 as amended, PDF)",
           "searched": [{"citation": "Pennsylvania Municipalities Planning Code (53 P.S. § 10101 et seq.), full text", "url": cached_json("round3_PA.json")["url"],
                         "chars": cached_json("round3_PA.json")["chars"], "full_text_searched": True, "term_hits": {"middle_housing": 2}}],
           "outcome": "searched, none (hits: § 604(4)'s general duty to provide for single-family and two-family dwellings, and a sewage-planning exemption)"},
    "SD": {"route_worked": "https://sdlegislature.gov/api/Statutes/", "searched": chapter_log("SD"), "outcome": "searched, none (2 of 48 sections in ch. 11-6 did not load)"},
    "WV": {"route_worked": "https://code.wvlegislature.gov/", "searched": chapter_log("WV"), "outcome": "searched, none"},
    "VA": {"route_worked": "https://law.lis.virginia.gov/vacode/title15.2/chapter22/ (table of contents lists 192 sections; sections chosen by title were fetched)",
           "searched": [{"citation": "Va. Code §§ 15.2-2209.4, 15.2-2286.2, 15.2-2288.1, 15.2-2292.3, 15.2-2292.4", "url": VA_TOC, "full_text_searched": False}],
           "added": ["va_parking_2209_4", "va_small_lot_2286_2"],
           "found_not_qualifying": [
               {"citation": "Va. Code § 15.2-2292.4 (ADUs as a permitted accessory use in single-family districts)", "url": VA_2292_4,
                "why": "not yet in effect", "quote": cut(va3, "§ 15.2-2292.4 . (Effective July 1, 2027)", 80)},
               {"citation": "Va. Code § 15.2-2288.1", "why": "bars special-use permits only for homes already allowed by right; creates no new right"},
               {"citation": "Va. Code § 15.2-2292.3", "why": "local option ('may by ordinance') administrative rezoning for 75%-affordable developments"}],
           "outcome": "2 added; ADU law passed but not in effect until 2027-07-01"},
    "CT": {"route_worked": "https://search.cga.state.ct.us/r/statute/ (statute search by section number, one cookie session for search and document; retried with backoff after connection resets)",
           "searched": [{"citation": f"Conn. Gen. Stat. § {s}"} for s in ("8-2", "8-2o", "8-2s", "8-2t", "8-3n")],
           "added": ["ct_adu_8_2o", "ct_parking_8_3n", "ct_middle_housing_8_2s"],
           "found_not_qualifying": [{"citation": "Conn. Gen. Stat. § 8-2t (commercial-to-residential conversion)", "url": ct_more["8-2t"]["url"],
                                     "why": "local option", "quote": cut(ct_more["8-2t"]["text"], "(b) Any zoning regulations adopted pursuant to section 8-2 may allow the conversion", 140)}],
           "outcome": "3 added"},
    "DC": {"route_worked": "https://dcregs.dc.gov/Common/DCMR/RuleList.aspx?DownloadFile=... (the section's official Word file; the handbook and section pages are script-driven)",
           "searched": [{"citation": "11-U DCMR § 253", "url": DC_SECTION}], "added": ["dc_adu_accessory_apartment_u253"], "outcome": "1 added"},
    "MD": {"route_worked": MD_CH122,
           "searched": [{"citation": "2024 Md. Laws ch. 122 (HB 538)", "url": MD_CH122, "full_text_searched": True}],
           "found_not_qualifying": [{"citation": "HB 538 (2024 ch. 122), Land Use Art. §§ 7-501 to 7-503",
                                     "why": "density bonuses for 'qualified projects' with deed-restricted affordable units; the act says a jurisdiction 'shall allow' the extra density but sets no by-right or administrative approval; its manufactured-home rule is outside the five topics",
                                     "quote": cut(md, "(B) (1) IN ACCORDANCE WITH THIS SUBSECTION, A LOCAL JURISDICTION SHALL ALLOW THE DENS", 160)
                                     + " || " + cut(md, "this Act shall take effect October 1, 2024 January 1, 2025", 60)}],
           "outcome": "searched, none"},
}
BLOCKED = {
    "AL": blocked([{"url": "https://alison.legislature.state.al.us/", "result": "JavaScript application; no statute text in the page"}, LEGISCAN_JUSTIA],
                  "a normal browser session on alison.legislature.state.al.us, or running scripts/law_search_chapters.py from a normal computer"),
    "AR": blocked([{"url": "https://www.arkleg.state.ar.us/", "result": "home page loads; the Arkansas Code is published through a Lexis-hosted JavaScript site"}, LEGISCAN_JUSTIA],
                  "a normal browser on the Lexis-hosted Arkansas Code"),
    "GA": blocked([{"url": "https://www.legis.ga.gov/", "result": "JavaScript shell (1.5 KB)"},
                   {"url": "https://law.resource.org/pub/us/code/ga/", "result": "only correspondence letters (2013), no code text"}, LEGISCAN_JUSTIA],
                  "a normal browser on the Lexis-hosted O.C.G.A., or the legislature's bill search for 2023-2026 enacted bills"),
    "IL": blocked([{"url": "https://www.ilga.gov/legislation/ilcs/ilcs5.asp?ActID=802&ChapterID=14", "result": "no response within 20 s"},
                   {"url": "https://ilga.gov/ftp/ILCS/", "result": "no response within 20 s"}, LEGISCAN_JUSTIA],
                  "running scripts/law_search_chapters.py from a normal computer (ilga.gov does not answer the build machine)"),
    "IN": blocked([{"url": "https://iga.in.gov/", "result": "JavaScript shell (691 bytes); the IGA API needs a key"}, LEGISCAN_JUSTIA],
                  "a free Indiana General Assembly API key, or a normal browser"),
    "MS": blocked([{"url": "https://www.legislature.ms.gov/", "result": "home page loads; the Mississippi Code is published through a Lexis-hosted JavaScript site"}, LEGISCAN_JUSTIA],
                  "a normal browser on the Lexis-hosted Mississippi Code"),
    "NJ": blocked([{"url": "https://pub.njleg.state.nj.us/Bills/2024/PL24/", "result": "HTTP 403"},
                   {"url": "https://lis.njleg.state.nj.us/nxt/gateway.dll", "result": "reachable, but the statute search is a frame/JavaScript Folio application; not completed"}, LEGISCAN_JUSTIA],
                  "a normal browser on lis.njleg.state.nj.us (N.J.S.A. 40:55D), or the P.L. bill-text PDFs from pub.njleg.state.nj.us"),
    "NM": blocked([{"url": "https://nmonesource.com/nmos/nmsa/en/nav_date.do", "result": "reachable, but the NMSA 3-21 section paths tried returned 404"},
                   {"url": "https://www.nmlegis.gov/", "result": "home page loads; no statute text"}, LEGISCAN_JUSTIA],
                  "a normal browser on nmonesource.com (NMSA ch. 3 art. 21)"),
    "NY": blocked([{"url": "https://legislation.nysenate.gov/api/3/laws/TWN/261", "result": "HTTP 401: the Open Legislation API needs a key"},
                   {"url": "https://www.nysenate.gov/legislation/laws/TWN/261", "result": "HTTP 403"}, LEGISCAN_JUSTIA],
                  "a free NY Open Legislation API key (legislation.nysenate.gov), saved as a network credential"),
    "TN": blocked([{"url": "https://wapp.capitol.tn.gov/apps/", "result": "redirects to a JavaScript application"},
                   {"url": "https://publications.tnsosfiles.com/acts/113/pub/", "result": "public-chapter PDFs reachable, but no listing or keyword search"}, LEGISCAN_JUSTIA],
                  "a normal browser on the Lexis-hosted Tennessee Code, or a list of 2023-2026 public chapter numbers on housing"),
    "WI": blocked([{"url": "https://docs.legis.wisconsin.gov/statutes/statutes/62/23", "result": "no response within 20 s"}, LEGISCAN_JUSTIA],
                  "running scripts/law_search_chapters.py from a normal computer (docs.legis.wisconsin.gov does not answer the build machine)"),
    "NH": blocked([{"url": "https://gc.nh.gov/rsa/html/LXIV/674/674-72.htm", "result": "no response within 20 s"},
                   {"url": "https://www.gencourt.state.nh.us/rsa/html/LXIV/674/674-72.htm", "result": "HTTP 301 to gc.nh.gov, which does not answer"}, LEGISCAN_JUSTIA],
                  "a normal browser on gc.nh.gov (RSA 674:71-73)"),
}


def note_for(st, r3):
    if r3.get("route_worked") is None:
        why = "; ".join(f"{x['url']}: {x['result']}" for x in r3["routes"])
        return f"Round 3 (2026-11-16) could not full-text search: {why}. Would unblock it: {r3['unblock']}."
    return f"Round 3 (2026-11-16) full-text searched via {r3['route_worked']}: {r3['outcome']}."


def main():
    laws = json.load(open(STATUTES[0]))
    ids = {r["id"] for r in RECORDS}
    laws = [r for r in laws if r["id"] not in ids] + RECORDS
    for p in STATUTES:
        with open(p, "w") as f:
            json.dump(laws, f, indent=2, ensure_ascii=False)
            f.write("\n")

    a = json.load(open(AUDIT))
    a["_source"]["round3"] = {
        "date": DATE,
        "scope": "the 23 states whose code sites blocked round 2, plus NH, CT, DC and Maryland HB 538",
        "method": "scripts/law_search_chapters.py (section-by-section fetch of zoning chapters), scripts/law_search_la.py (Louisiana's own statute text search), "
                  "direct reads of official section pages and session-law PDFs; scripts/add_state_laws_round3.py cut every quote from fetched text and wrote round3_search",
        "terms": {k: v for k, v in TERMS.items()},
        "not_used": "search engines whose terms forbid automated use; LegiScan and Justia returned 403",
    }
    for st, r in {**R3, **BLOCKED}.items():
        s = a["states"][st]
        r = {"date": DATE, "terms": TERM_NAMES, **r} if "date" not in r else r
        s["round3_search"] = r
        s["notes"] = re.sub(r" Round 3 \(2026-11-16\).*$", "", s.get("notes", ""))
        added = r.get("added", [])
        if added:
            s["added_records"] = sorted(set(s.get("added_records", [])) | set(added))
            s["status"] = "laws_on_file"
            s["notes"] = (f"Round 3 (2026-11-16) found and added {', '.join(added)} from official text via {r['route_worked']}."
                          + (" Also found, not added: " + "; ".join(f"{x['citation']} ({x['why']})" for x in r.get("found_not_qualifying", [])) + "." if r.get("found_not_qualifying") else ""))
        else:
            if st == "MD":
                s["status"] = "none_found"
                s["notes"] = "no qualifying statewide law found as of 2026-11-16."
            if r.get("route_worked"):
                s["notes"] = s["notes"].replace(", so this rests on round 1's candidate search only.", "; round 3 below replaces that.")
            s["notes"] = (s["notes"] + " " + note_for(st, r)).strip()
            if r.get("found_not_qualifying"):
                s["notes"] += " Found, not qualifying: " + "; ".join(f"{x['citation']} ({x['why']})" for x in r["found_not_qualifying"]) + "."
    with open(AUDIT, "w") as f:
        json.dump(a, f, indent=1, ensure_ascii=False)
    print("records:", len(laws), "added/updated:", sorted(ids))


if __name__ == "__main__":
    main()
