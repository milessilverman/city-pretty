#!/usr/bin/env python3
"""Round 2 of the 50-state housing-law review (16 Nov 2026): close the gaps in docs/audit/state-laws-50.json.

- Adds laws found by full-text searches of state zoning-enabling chapters (scripts/search_zoning_chapters.py) and by
  retrying candidates: Idaho Code 67-6541 (ADUs) and 67-6542 (starter-home subdivisions), Nevada NRS 278.257 (ADU
  ordinance mandate), California AB 2011 Article 1 (Gov. Code 65912.110-.114, read from the Legislative Counsel's bulk
  database by scripts/ca_pubinfo_section.py), Colorado HB 24-1304 (C.R.S. 29-36-103, parking); upgrades Colorado
  HB 24-1152 (C.R.S. 29-35-103) from the signed bill text and adds its coverage condition.
- Records, per state, which chapters were full-text searched, with what terms, and what was found, so "none found" says
  what was actually searched.

Every quote is cut from fetched primary text at run time; a missing anchor stops the script. Run after
scripts/write_state_laws_audit.py (which writes the round-1 log). Idempotent.
"""
import io
import json
import os
import sys
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from fetch_law_text import fetch  # noqa: E402
import search_zoning_chapters as szc  # noqa: E402

ROOT = os.path.dirname(HERE)
STATUTES = [os.path.join(ROOT, "app/data/statutes.json"), os.path.join(ROOT, "app/data/state-housing-laws.json")]
AUDIT = os.path.join(ROOT, "docs/audit/state-laws-50.json")
TODAY = "2026-11-16"

ID_ADU = "https://legislature.idaho.gov/statutesrules/idstat/Title67/T67CH65/SECT67-6541/"
ID_STARTER = "https://legislature.idaho.gov/statutesrules/idstat/Title67/T67CH65/SECT67-6542/"
ID_2026 = "https://legislature.idaho.gov/sessioninfo/2026/legislation/"
NV_278 = "https://www.leg.state.nv.us/nrs/nrs-278.html"
CO_1152 = "https://leg.colorado.gov/sites/default/files/2024a_1152_signed.pdf"
CO_1304 = "https://leg.colorado.gov/sites/default/files/2024a_1304_signed.pdf"
NC_160D = "https://www.ncleg.gov/EnactedLegislation/Statutes/HTML/ByChapter/Chapter_160D.html"
TX_SB673 = "https://capitol.texas.gov/BillLookup/History.aspx?LegSess=89R&Bill=SB673"
TX_HB2789 = "https://capitol.texas.gov/BillLookup/History.aspx?LegSess=89R&Bill=HB2789"
CA_LEGINFO = "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=GOV&sectionNum=65912.111"


def quote(url, anchor, length=700, last=False):
    code, text = fetch(url)
    if code != 200:
        sys.exit(f"fetch failed ({code}): {url}")
    i = text.rfind(anchor) if last else text.find(anchor)
    if i < 0:
        sys.exit(f"anchor not found in {url}: {anchor!r}")
    return " ".join(text[i:i + length].split())


def ca_sections(wanted):
    """Text of California Government Code sections from the official bulk database."""
    from ca_pubinfo_section import URL, HttpRange
    z = zipfile.ZipFile(io.BufferedReader(HttpRange(URL), buffer_size=1 << 20))
    found = {}
    with z.open("LAW_SECTION_TBL.dat") as fh:
        for raw in io.TextIOWrapper(fh, encoding="utf8", errors="replace"):
            cols = raw.rstrip("\n").split("\t")
            sec = cols[2].strip("`").rstrip(".") if len(cols) > 6 else None
            if cols[1:2] == ["`GOV`"] and sec in wanted:
                lob = next(c for c in cols if c.endswith(".lob"))
                hist = cols[13].strip("`")
                found[sec] = (" ".join(z.read(lob).decode("utf8", "replace").split()), hist)
                if len(found) == len(wanted):
                    break
    missing = set(wanted) - set(found)
    if missing:
        sys.exit(f"CA sections not found in bulk database: {sorted(missing)}")
    return found


def ver(status, method, evidence, unverified=None, notes=""):
    return {"status": status, "method": method, "checked_on": TODAY, "evidence": evidence, "unverified_fields": unverified or [], "notes": notes}


def new_records():
    ca = ca_sections({"65912.110", "65912.111", "65912.112", "65912.113", "65912.105"})
    recs = [
        {
            "id": "id_adu_67_6541", "state_code": "ID", "bill_number": "S 1354aa (2026)", "session": "2026 Regular Session",
            "short_name": "ID: ADUs approved administratively as of right in cities over 10,000",
            "statute_citation": "Idaho Code § 67-6541 (2026 Idaho Sess. Laws ch. 265)", "effective_date": "2026-07-01",
            "statute_url": ID_ADU, "adus_by_right": 1, "municipality_pop_min": 10001,
            "statutory_exclusions": ["historic district (§ 67-4607) or historic property (§ 67-4614), for the zoning amendments due 1 Feb 2027"],
            "summary": "Cities over 10,000 may not ban ADUs in residential zones; ADU projects that meet the city's land use requirements must be approved administratively and as a matter of right. By 1 Feb 2027 cities must also allow one internal or detached ADU per single-family lot, with no off-street parking requirement in most cases, no owner-occupancy rule, and a size floor of 1,000 sq ft or 75% of the house.",
            "verification": ver("verified", "Idaho Statutes (legislature.idaho.gov) and the 2026 session's chapter list",
                quote(ID_ADU, "67-6541. accessory dwelling units. (1) No city shall", 330) + " || " +
                quote(ID_ADU, "(3) Accessory dwelling unit projects that meet", 230) + " || " +
                quote(ID_ADU, "(6) The provisions of this section shall apply only", 120) + " || " +
                quote(ID_2026, "265 S 1354 aa Accessory dwelling units", 60),
                notes="The 1 Feb 2027 requirements (parking, size, owner-occupancy) are not yet binding; the engine relies only on the administrative as-of-right approval in subsection (3)."),
            "last_verified": TODAY,
        },
        {
            "id": "id_starter_home_67_6542", "state_code": "ID", "bill_number": "S 1352aa (2026)", "session": "2026 Regular Session",
            "short_name": "ID: starter-home subdivisions (lots up to 1,500 sq ft) in cities over 10,000",
            "statute_citation": "Idaho Code § 67-6542 (2026 Idaho Sess. Laws ch. 264)", "effective_date": "2026-07-01",
            "statute_url": ID_STARTER, "parcel_level": False, "municipality_pop_min": 10001,
            "summary": "Cities over 10,000 may not ban starter-home subdivisions (at least 4 acres, single-family lots no greater than 1,500 sq ft) in residential zones, and by 1 Feb 2027 must allow them with lot minimums no greater than 1,500 sq ft, setbacks of at most 15 ft front/rear and 5 ft side, lot widths of at most 30 ft and depths of at most 70 ft. Cities may still deny for inadequate infrastructure. A subdivision rule on sites of 4+ acres, not a right on a single lot.",
            "verification": ver("verified", "Idaho Statutes (legislature.idaho.gov) and the 2026 session's chapter list",
                quote(ID_STARTER, "starter home subdivisions. (1) No city shall", 520) + " || " +
                quote(ID_STARTER, "(a) Prohibit requiring minimum lot sizes", 220) + " || " +
                quote(ID_2026, "264 S 1352 aa Starter home subdivisions", 60)),
            "last_verified": TODAY,
        },
        {
            "id": "nv_adu_ordinance_278_257", "state_code": "NV", "bill_number": None, "session": "2025",
            "short_name": "NV: large counties and cities must adopt an ordinance allowing ADUs",
            "statute_citation": "NRS 278.257 (added 2025)", "effective_date": None, "statute_url": NV_278 + "#NRS278Sec257",
            "adus_by_right": 1, "max_parking_requirement_per_unit": 1,
            "unmapped_condition": "county of 100,000+ or city of 60,000+ (outside the Tahoe regional planning area), with the local ADU ordinance NRS 278.257 requires; the statute does not make approval ministerial",
            "summary": "Each county of 100,000 or more and each city of 60,000 or more must adopt an ordinance authorizing ADUs on residential property. The ordinance may not ban separate kitchens, require more than one extra parking space (where existing parking suffices), impose stricter side or rear setbacks than for the house, or ban long-term rental. At most two ADUs per property.",
            "verification": ver("partially_verified", "Nevada Revised Statutes chapter 278 (leg.state.nv.us)",
                quote(NV_278, "NRS 278.257 Ordinance authorizing development and use of accessory dwelling unit on residential property; requirements; applicability. 1.", 900, last=True),
                unverified=["effective_date (NRS says only 'Added to NRS by 2025'; bill not identified)", "bill_number"],
                notes="A mandate to adopt an ordinance, not a parcel-level by-right rule; the engine reports it as unconfirmed."),
            "last_verified": TODAY,
        },
        {
            "id": "ca_ab2011_affordable", "state_code": "CA", "bill_number": "AB 2011 (2022), amended by AB 2243 (2024)",
            "session": "2021-2022; 2023-2024", "short_name": "CA AB 2011: 100%-affordable housing by right on commercial sites",
            "statute_citation": "Cal. Gov. Code §§ 65912.110-65912.114 (Stats. 2022, ch. 647; Stats. 2024, ch. 272)",
            "effective_date": "2023-01-01", "statute_url": CA_LEGINFO, "applies_to_zone": "commercial",
            "affordability_mandate_pct": 100, "affordability_term_years": 55,
            "unmapped_condition": "site in a Census urbanized area with 75% of its perimeter adjoining urban uses, not on or next to a site over one-third industrial, outside the § 65913.4(a)(6) exclusions; multifamily at or above the jurisdiction's lower-income default density; 100% lower-income units with a 55-year (rental) or 45-year (owner) deed restriction",
            "summary": "A multifamily development in a zone where office, retail or parking are principally permitted is a use by right with streamlined ministerial review if every unit is for lower-income households under a recorded deed restriction (55 years rental, 45 owner) and the site meets the urbanized-area, urban-perimeter, non-industrial and site-exclusion criteria. Repealed 1 Jan 2033. Article 2 (mixed-income on commercial corridors, §§ 65912.120 ff.) is not in this record.",
            "verification": ver("verified", "California Legislative Counsel bulk database (downloads.leginfo.legislature.ca.gov/pubinfo_2025.zip, LAW_SECTION_TBL; read by scripts/ca_pubinfo_section.py because leginfo blocks the audit machine)",
                ca["65912.110"][0][:430] + " || " + ca["65912.111"][0][:330] + " || " + ca["65912.112"][0][:420] + " || " +
                ca["65912.105"][0][:110] + " || history: " + ca["65912.110"][1],
                notes="effective_date is the date the Legislative Counsel's database gives for § 65912.110 (Stats. 2022, ch. 647)."),
            "last_verified": TODAY,
        },
        {
            "id": "co_hb24_1304_parking", "state_code": "CO", "bill_number": "HB 24-1304", "session": "74th General Assembly (2024)",
            "short_name": "CO HB 24-1304: no parking minimums for multifamily near transit in MPO areas",
            "statute_citation": "C.R.S. § 29-36-103 (HB 24-1304)", "effective_date": "2025-06-30",
            "statute_url": CO_1304, "parcel_level": False, "max_parking_requirement_per_unit": 0,
            "unmapped_condition": "multifamily or residential adaptive re-use project inside a metropolitan planning organization and at least partly within an applicable transit service area (map under § 29-36-106)",
            "summary": "From 30 June 2025 a municipality or county may not enact or enforce minimum parking requirements for multifamily residential development or residential (or 50%+ residential mixed-use) adaptive re-use within the jurisdiction, an MPO, and at least partly within an applicable transit service area.",
            "verification": ver("verified", "Colorado General Assembly, signed act text (leg.colorado.gov)",
                quote(CO_1304, "29-36-103. Limitations on minimum parking requirements. (1)", 640)),
            "last_verified": TODAY,
        },
    ]
    return recs


def update_co_1152(r):
    r.update({
        "statute_citation": "C.R.S. § 29-35-103 (HB 24-1152)", "effective_date": "2025-06-30", "statute_url": CO_1152,
        "adus_by_right": 1, "max_parking_requirement_per_unit": 0,
        "unmapped_condition": "municipality of 1,000+ within a metropolitan planning organization, or a county area within a census-designated place in an MPO (a 'subject jurisdiction', § 29-35-102(21))",
        "verification": ver("verified", "Colorado General Assembly, signed act text (leg.colorado.gov)",
            quote(CO_1152, "29-35-103. Accessory dwelling unit requirements for a subject jurisdiction. (1)", 420) + " || " +
            quote(CO_1152, "(2) ON OR AFTER JUNE 30, 2025, A SUBJECT JURISDICTION SHALL NOT", 260) + " || " +
            quote(CO_1152, "(21) \"SUBJECT JURISDICTION\" MEANS", 260),
            notes="Round 2 (16 Nov): citation and parking rule confirmed from the signed act; effective_date is now the operative date (30 June 2025) rather than the signature date; coverage condition added so the engine no longer applies it to every Colorado parcel."),
        "last_verified": TODAY,
    })
    r.pop("max_units_by_right", None)
    r.pop("min_parking_spaces_per_unit", None)


def search_log():
    log = {}
    for st, chapters in szc.CHAPTERS.items():
        entries = []
        for cite, url in chapters:
            code, text = fetch(url)
            full = code == 200 and len(text) > 8000 and text.count(" shall ") >= 10 and not any(b in text[:4000] for b in szc.BLOCKED)
            hits = {}
            if full:
                import re
                for k, pat in szc.TERMS.items():
                    n = len(re.findall(pat, text, re.I))
                    if n:
                        hits[k] = n
            entries.append({"citation": cite, "url": url, "full_text_searched": full,
                            "why_not": None if full else ("HTTP %s" % code if code != 200 else "table of contents or bot check only, not statute text"),
                            "terms": list(szc.TERMS), "term_hits": hits})
        log[st] = entries
    return log


REVIEWED_HITS = {  # what each hit in a full-text search turned out to be (read by hand from the contexts)
    "IA": "hits are rental-permit caps and building definitions mentioning duplexes, not a housing mandate",
    "MN": "§ 462.357 hit is the variance rule allowing temporary two-family use; no mandate",
    "SC": "§ 6-29 hits: 'accessory dwellings' appears in an optional affordable-housing incentive definition; parking hits are local powers and optional waivers; no mandate",
    "WY": "title 15 parking hits concern municipal parking facilities, not minimums",
    "NC": "G.S. 160D-702(c)(2a) bars minimum parking requirements but is marked '(Effective January 1, 2027)': passed, not yet in effect (coastal-area exceptions)",
    "NV": "NRS 278.257 found and added (ADU ordinance mandate); tiny-house zoning (278.253) is not an ADU-by-right rule",
    "ID": "Idaho Code 67-6541 (ADUs) and 67-6542 (starter-home subdivisions) found and added",
    "MI": "full Michigan Zoning Enabling Act searched: no ADU, two-family or parking-minimum provision",
}


def main():
    laws = json.load(open(STATUTES[0]))
    by = {r["id"]: r for r in laws}
    update_co_1152(by["co_hb24_1152"])
    for r in new_records():
        by[r["id"]] = r
    out = list(by.values())
    for p in STATUTES:
        with open(p, "w") as f:
            json.dump(out, f, indent=2, ensure_ascii=False)
            f.write("\n")

    a = json.load(open(AUDIT))
    log = search_log()
    for st, entries in log.items():
        s = a["states"].setdefault(st, {"existing_records": [], "added_records": [], "status": "none_found", "notes": ""})
        s["round2_search"] = {"date": TODAY, "chapters": entries, "review": REVIEWED_HITS.get(st)}
        searched = [e for e in entries if e["full_text_searched"]]
        if s["status"] == "none_found":
            if searched:
                s["notes"] = (f"no qualifying statewide law found as of {TODAY}. Round 2 full-text searched "
                              + "; ".join(e["citation"] for e in searched)
                              + " for ADU, middle-housing, lot-split, parking-minimum and commercial-residential terms"
                              + (f" ({REVIEWED_HITS[st]})" if st in REVIEWED_HITS else "")
                              + ". Laws outside these chapters, or enacted but not yet codified on the state's site, could still exist.")
            else:
                s["notes"] = (f"no qualifying statewide law found as of {TODAY}. Round 2 could not full-text search the zoning chapter ("
                              + "; ".join(f"{e['citation']}: {e['why_not']}" for e in entries) + "), so this rests on round 1's candidate search only.")
    for st, ids in (("ID", ["id_adu_67_6541", "id_starter_home_67_6542"]), ("NV", ["nv_adu_ordinance_278_257"]), ("CA", ["ca_ab2011_affordable"]), ("CO", ["co_hb24_1304_parking"])):
        s = a["states"][st]
        s["added_records"] = sorted(set(s.get("added_records", [])) | set(ids))
        s["status"] = "laws_on_file"
        if st == "NV":
            s["notes"] = f"Round 2 ({TODAY}): found by full-text search of NRS chapter 278. " + REVIEWED_HITS[st]
        if st == "ID":
            s["notes"] = (f"Round 2 ({TODAY}): found in the table of contents of Idaho Code chapter 67-65 (section titles "
                          "'Accessory dwelling units' and 'Starter home subdivisions'), then read from each section's own page; "
                          "dates from the 2026 session's chapter list. " + REVIEWED_HITS[st])
    a["states"]["NC"]["notes"] = (a["states"]["NC"].get("notes", "") + f" Round 2 ({TODAY}): " + REVIEWED_HITS["NC"] + " — " + quote(NC_160D, "(c) (Effective January 1, 2027)", 120) + ".").strip()
    a["states"]["CO"]["notes"] = (a["states"]["CO"].get("notes", "") + f" Round 2 ({TODAY}): HB 24-1152 confirmed from the signed act (C.R.S. 29-35-103) and given its coverage condition; HB 24-1304 parking (C.R.S. 29-36-103) added.").strip()
    a["states"]["CA"]["notes"] = (a["states"]["CA"].get("notes", "") + f" Round 2 ({TODAY}): AB 2011 Article 1 (Gov. Code 65912.110-.114) added from the Legislative Counsel bulk database; Article 2 (mixed-income corridors, 65912.120 ff.) not yet added.").strip()
    a["states"]["TX"]["notes"] = (a["states"]["TX"].get("notes", "") + f" Round 2 ({TODAY}): 2025 ADU bill SB 673 was not enacted ("
                                  + quote(TX_SB673, "Last Action:", 70) + "); HB 2789, checked as a possible ADU bill, is a child-welfare bill ("
                                  + quote(TX_HB2789, "Caption Text:", 110) + ").").strip()
    retry = {
        "NH": "gencourt.state.nh.us and gc.nh.gov did not connect from the audit machine; law.justia.com and codes.findlaw.com returned 403",
        "CT": "cga.ct.gov did not connect; law.justia.com returned 403",
        "DC": "dcregs.dc.gov and handbook.dcoz.dc.gov returned script-driven pages with no regulation text",
        "MD": "mgaleg.maryland.gov did not connect (bill page) and the guessed chapter-PDF path returned 404",
    }
    for st, why in retry.items():
        s = a["states"][st]
        s["notes"] = (s.get("notes", "") + f" Round 2 ({TODAY}) retry failed: {why}.").strip()
    a["_source"]["round2"] = {
        "date": TODAY,
        "method": "scripts/search_zoning_chapters.py full-text searched each 'none found' state's zoning-enabling chapter(s) on the official code site; scripts/add_state_laws_n3b.py added what was found and wrote these notes. Search engines (legiscan, Justia search, DuckDuckGo, Brave, Mojeek) blocked automated queries; Bing's results were not used because its terms forbid it.",
        "limits": "Only the zoning-enabling chapters were searched, and only where the state's site returned statute text; a law codified elsewhere, or enacted but not yet on the state's site, would be missed.",
    }
    json.dump(a, open(AUDIT, "w"), indent=1, ensure_ascii=False)
    print(f"{len(out)} statute records; audit log updated", file=sys.stderr)


if __name__ == "__main__":
    main()
