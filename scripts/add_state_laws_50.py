#!/usr/bin/env python3
"""Add state housing laws found in the 16 Nov 2026 50-state review to app/data/statutes.json (and its byte-identical
copy app/data/state-housing-laws.json), and write the per-state search log docs/audit/state-laws-50.json.

Every quote is cut from the fetched primary-source page at run time (scripts/fetch_law_text.py): the script finds the
`anchor` phrase in the page and stores the surrounding sentence(s). If an anchor is not found, the script stops, so
no quote can be typed in by hand. Re-running is idempotent (records are replaced by id).

Usage: python3 scripts/add_state_laws_50.py
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fetch_law_text import fetch  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATUTES = [os.path.join(ROOT, "app/data/statutes.json"), os.path.join(ROOT, "app/data/state-housing-laws.json")]
AUDIT = os.path.join(ROOT, "docs/audit/state-laws-50.json")
TODAY = "2026-11-16"


def quote(url, anchor, length=700):
    code, text = fetch(url)
    if code != 200:
        sys.exit(f"fetch failed ({code}): {url}")
    i = text.find(anchor)
    if i < 0:
        sys.exit(f"anchor not found in {url}: {anchor!r}")
    return " ".join(text[i:i + length].split())


WA_ADU = "https://app.leg.wa.gov/RCW/default.aspx?cite=36.70A.681"
WA_5184 = "https://lawfilesext.leg.wa.gov/biennium/2025-26/Pdf/Bills/Session%20Laws/Senate/5184-S.SL.pdf"
WA_5184_STATUS = "https://app.leg.wa.gov/billsummary?BillNumber=5184&Year=2025"
WA_1042 = "https://lawfilesext.leg.wa.gov/biennium/2023-24/Pdf/Bills/Session%20Laws/House/1042-S.SL.pdf"
WA_1042_STATUS = "https://app.leg.wa.gov/billsummary?BillNumber=1042&Year=2023"
OR_ORS = "https://www.oregonlegislature.gov/bills_laws/ors/ors197a.html"
OR_2017 = "https://www.oregonlegislature.gov/bills_laws/lawsstatutes/2017orLaw0745.pdf"
OR_2023 = "https://www.oregonlegislature.gov/bills_laws/lawsstatutes/2023orLaw0223.pdf"
MT_ADU = "https://leg.mt.gov/bills/mca/title_0760/chapter_0020/part_0030/section_0450/0760-0020-0030-0450.html"
MT_304 = "https://leg.mt.gov/bills/mca/title_0760/chapter_0020/part_0030/section_0040/0760-0020-0030-0040.html"
MA_40A3 = "https://malegislature.gov/Laws/GeneralLaws/PartI/TitleVII/Chapter40A/Section3"
MA_150 = "https://malegislature.gov/Laws/SessionLaws/Acts/2024/Chapter150"
RI_37 = "https://webserver.rilegislature.gov/Statutes/TITLE45/45-24/45-24-37.htm"
RI_73 = "https://webserver.rilegislature.gov/Statutes/TITLE45/45-24/45-24-73.htm"
CA_66317 = "https://codes.findlaw.com/ca/government-code/gov-sect-66317/"
CA_66323 = "https://codes.findlaw.com/ca/government-code/gov-sect-66323/"
AZ_46210 = "https://www.azleg.gov/ars/9/00462-10.htm"
TX_SB15 = "https://capitol.texas.gov/tlodocs/89R/billtext/html/SB00015F.htm"
TX_SB15_STATUS = "https://capitol.texas.gov/BillLookup/History.aspx?LegSess=89R&Bill=SB15"


def ver(status, method, evidence, unverified=None, notes=""):
    return {"status": status, "method": method, "checked_on": TODAY, "evidence": evidence,
            "unverified_fields": unverified or [], "notes": notes}


def records():
    return [
        {
            "id": "wa_hb1337_adu", "state_code": "WA", "bill_number": "HB 1337 (2023)", "session": "2023 Regular Session",
            "short_name": "WA HB 1337: two ADUs on single-family lots in urban growth areas",
            "statute_citation": "RCW 36.70A.681 (2023 c 334 s 4)", "effective_date": "2023-07-23", "statute_url": WA_ADU,
            "max_units_by_right": None, "adus_by_right": 2, "max_parking_requirement_per_unit": 2,
            "unmapped_condition": "lot inside an urban growth area of a city or county planning under RCW 36.70A.040 (and past its local compliance deadline)",
            "statutory_exclusions": ["critical_areas_or_buffers (RCW 36.70A.060)", "impaired_reservoir_watershed"],
            "summary": "Cities and counties planning under the Growth Management Act must allow at least two accessory dwelling units on every lot in zones within an urban growth area that allow single-family homes; no owner-occupancy rule; ADU floor-area cap no smaller than 1,000 sq ft; no off-street parking within 1/2 mile walk of a major transit stop, at most one space per ADU on lots under 6,000 sq ft and two on larger lots (exceptions by approved study).",
            "verification": ver("verified", "Official RCW text (app.leg.wa.gov)", quote(WA_ADU, "(c) The city or county must allow at least two accessory dwelling units"),
                                ["local compliance deadline (set in RCW 36.70A.680, not fetched)"],
                                "Effective date is the session law's (the section's exclusion clause refers to 'as of July 23, 2023'); each jurisdiction's obligation begins six months after its periodic plan update under RCW 36.70A.680, which was not fetched."),
        },
        {
            "id": "wa_sb5184_parking", "state_code": "WA", "bill_number": "ESSB 5184 (2025)", "session": "2025 Regular Session",
            "short_name": "WA SB 5184: statewide caps on minimum parking", "statute_citation": "Laws of 2025, ch. 204 (new sections in RCW 35.21, 35A.21, 36.01)",
            "effective_date": "2025-07-27", "statute_url": WA_5184, "parcel_level": False, "municipality_pop_min": 30001,
            "max_parking_requirement_per_unit": 0.5,
            "summary": "Cities and counties over 30,000 people may not require more than 0.5 parking space per multifamily unit or 1 per single-family home, or 2 per 1,000 sq ft of commercial space, and may require none for homes under 1,200 sq ft, affordable or senior housing, small commercial spaces and changes of use to residential. Cities of 50,000+ must comply within 18 months of the effective date, 30,000-50,000 within three years; exceptions by approved empirical study.",
            "verification": ver("verified", "Session law PDF (lawfilesext.leg.wa.gov) and bill status page (app.leg.wa.gov)",
                                quote(WA_5184, "(1) A city may not require more than 0.5 parking space per") + " || " + quote(WA_5184_STATUS, "May 7 Governor signed.", 120),
                                [], "Jurisdiction-wide parking caps, not a parcel-level housing right (parcel_level false). Compliance deadlines: about 2027-01-27 (50,000+) and 2028-07-27 (30,000-50,000), computed from the effective date."),
        },
        {
            "id": "wa_hb1042_existing_buildings", "state_code": "WA", "bill_number": "ESHB 1042 (2023)", "session": "2023 Regular Session",
            "short_name": "WA HB 1042: +50% homes inside existing commercial and mixed-use buildings",
            "statute_citation": "Laws of 2023, ch. 285 (new sections in RCW 35.21 and 35A.21)", "effective_date": "2023-07-23",
            "statute_url": WA_1042, "applies_to_zone": "commercial",
            "unmapped_condition": "an existing building in a zone that permits multifamily housing, in a city past its compliance deadline (six months after its next periodic plan update)",
            "summary": "In buildings zoned commercial or mixed use, cities may not stop new homes inside an existing building envelope at up to 50% more density than the zone allows, may not require parking for the added units, and may not impose permitting beyond what applies to other residential development. Self-executing in cities that miss the deadline.",
            "verification": ver("verified", "Session law PDF (lawfilesext.leg.wa.gov) and bill status page",
                                quote(WA_1042, "(1)(a) Code cities must adopt or amend by ordinance") + " || " + quote(WA_1042, "(a) Impose a restriction on housing unit density that prevents", 500) + " || " + quote(WA_1042_STATUS, "Effective date 7/23/2023", 40)),
        },
        {
            "id": "or_adu_197a425", "state_code": "OR", "bill_number": "SB 1051 (2017)", "session": "2017 Regular Session",
            "short_name": "OR ADU law: one ADU per detached home inside urban growth boundaries", "statute_citation": "ORS 197A.425 (formerly ORS 197.312(5); Oregon Laws 2017, ch. 745)",
            "effective_date": "2018-07-01", "statute_url": OR_ORS, "adus_by_right": 1, "municipality_pop_min": 2501, "max_parking_requirement_per_unit": 0,
            "unmapped_condition": "inside an urban growth boundary, in an area zoned for detached single-unit dwellings (counties over 15,000 people are also covered; unincorporated areas are not modeled)",
            "summary": "Cities over 2,500 people and counties over 15,000 must allow at least one accessory dwelling unit per detached single-unit home inside the urban growth boundary, subject to reasonable siting and design rules, which may not include owner-occupancy or additional off-street parking requirements.",
            "verification": ver("verified", "Official ORS chapter 197A (oregonlegislature.gov) and Oregon Laws 2017 ch. 745",
                                quote(OR_ORS, "197A.425 Accessory dwelling units. (1)(a)", 900) + " || " + quote(OR_2017, "SECTION 12. The amendments to ORS 197.312", 200)),
        },
        {
            "id": "or_commercial_197a460", "state_code": "OR", "bill_number": "HB 3395 (2023)", "session": "2023 Regular Session",
            "short_name": "OR: affordable housing allowed on commercial-only land", "statute_citation": "ORS 197A.460 (Oregon Laws 2023, ch. 223, s. 2)",
            "effective_date": "2024-01-01", "statute_url": OR_ORS, "applies_to_zone": "commercial", "affordability_mandate_pct": None,
            "unmapped_condition": "affordable-housing covenant (each unit at or below 60% of area median income, or mixed use for moderate income), inside an urban growth boundary, land not vacant and not added to the boundary in the last 15 years, no slope of 25%+ or 100-year floodplain",
            "summary": "Inside urban growth boundaries, local governments must allow covenant-restricted affordable housing (60% AMI) or mixed-use buildings with ground-floor commercial and moderate-income homes on land zoned only for commercial (not industrial) use, under the standards of the most comparable residential zone.",
            "verification": ver("verified", "Official ORS chapter 197A and Oregon Laws 2023 ch. 223",
                                quote(OR_ORS, "197A.460 Residential use of commercial lands for affordable housing. (1)", 900) + " || " + quote(OR_2023, "Sections 2, 17, 29 and 30 of this 2023 Act", 160),
                                ["bill_number HB 3395 (the chapter text was fetched; the bill number was not read from it)"]),
        },
        {
            "id": "mt_adu_76_2_345", "state_code": "MT", "bill_number": "SB 528 (2023)", "session": "68th Legislature (2023)",
            "short_name": "MT: one ADU by right on single-family lots", "statute_citation": "Mont. Code Ann. § 76-2-345 (Ch. 502, L. 2023)",
            "effective_date": None, "statute_url": MT_ADU, "adus_by_right": 1, "max_parking_requirement_per_unit": 0,
            "summary": "Municipalities must allow at least one accessory dwelling unit by right on a lot with a single-family dwelling (attached, detached or internal; detached/attached at most 75% of the house or 1,000 sq ft), with no added parking, design-matching or owner-occupancy requirement.",
            "verification": ver("partially_verified", "Montana Code Annotated 2025 (leg.mt.gov)", quote(MT_ADU, "(1) (a) A municipality shall adopt regulations under this chapter that allow a minimum of one accessory dwelling unit by right"),
                                ["bill_number SB 528 (code history says Ch. 502, L. 2023; bill number not read from a fetched source)", "effective_date (session law not reachable)", "in_effect (a 2023 court challenge to Montana's housing laws was reported; outcome not confirmed from a court source)"]),
        },
        {
            "id": "mt_commercial_76_2_304_4", "state_code": "MT", "bill_number": "SB 245 (2023)", "session": "68th Legislature (2023)",
            "short_name": "MT: multifamily allowed in commercial zones; parking caps", "statute_citation": "Mont. Code Ann. § 76-2-304(4)-(5)",
            "effective_date": None, "statute_url": MT_304, "applies_to_zone": "commercial", "municipality_pop_min": 5001, "max_parking_requirement_per_unit": 1,
            "unmapped_condition": "municipality designated an urban area by the Census Bureau, and a will-serve letter from both the municipal water and sewer systems",
            "summary": "In Census-designated urban municipalities over 5,000 people, multiple-unit dwellings and mixed-use developments with them are a permitted use in commercial zones when municipal water and sewer will serve the lot; zoning may not require more than one parking space per unit (or the shared-parking equivalent), or set height limits under 60 ft in downtown commercial, heavy commercial or industrial zones.",
            "verification": ver("partially_verified", "Montana Code Annotated 2025 (leg.mt.gov)", quote(MT_304, "(4) (a) In a municipality that is designated as an urban area", 900),
                                ["bill_number SB 245 (not read from a fetched source)", "effective_date (session law not reachable)", "current version (the code page shows two versions of subsection (4), likely a contingent amendment from Ch. 591 or 68, L. 2025)"]),
        },
        {
            "id": "ma_adu_40a3", "state_code": "MA", "bill_number": "Affordable Homes Act (St. 2024, c. 150, s. 8)", "session": "2023-2024 (193rd General Court)",
            "short_name": "MA: one ADU by right in single-family zones", "statute_citation": "M.G.L. c. 40A, § 3 (added by St. 2024, c. 150, § 8)",
            "effective_date": "2025-02-02", "statute_url": MA_40A3, "adus_by_right": 1, "max_parking_requirement_per_unit": 1,
            "summary": "No zoning ordinance or bylaw may prohibit, unreasonably restrict or require a special permit for a single accessory dwelling unit (or its rental) in a single-family residential zoning district; reasonable regulations allowed; no owner-occupancy requirement; at most one added parking space, none within 0.5 mile of a commuter rail, subway, ferry or bus station.",
            "verification": ver("verified", "General Laws c. 40A § 3 and Session Laws 2024 c. 150 (malegislature.gov)",
                                quote(MA_40A3, "No zoning ordinance or by-law shall prohibit, unreasonably restrict or require a special permit or other discretionary zoning approval for the use of land or structures for a single accessory dwelling unit") + " || " + quote(MA_150, "SECTION 143. Sections 8, 46, 48 and 49 shall take effect 180 days", 120) + " || " + quote(MA_150, "therefore it is hereby declared to be an emergency law", 120) + " || " + quote(MA_150, "Approved, August 6, 2024", 30),
                                [], "Effective date computed: the act is an emergency law approved 2024-08-06, and section 8 takes effect 180 days after the act's effective date."),
        },
        {
            "id": "ri_adu_large_lot", "state_code": "RI", "bill_number": "P.L. 2024, ch. 284/285", "session": "2024",
            "short_name": "RI: one ADU by right on residential lots of 20,000 sq ft or more", "statute_citation": "R.I. Gen. Laws §§ 45-24-37(e), 45-24-73(a)(2)",
            "effective_date": "2024-06-25", "statute_url": RI_73, "adus_by_right": 1, "min_lot_size_sqft": 20000,
            "summary": "One accessory dwelling unit per lot is allowed by right, through an administrative building permit, on lots of 20,000 sq ft or more whose primary use is residential, if it meets the design standards of §§ 45-24-31 and 45-24-73.",
            "verification": ver("verified", "Rhode Island General Laws (webserver.rilegislature.gov)",
                                quote(RI_73, "(a) Pursuant to § 45-24-37, one accessory dwelling unit (ADU) per lot shall be allowed by right", 600) + " || " + quote(RI_37, "(e) Notwithstanding any other provision of this chapter, an accessory dwelling unit", 360) + " || " + quote(RI_73, "P.L. 2024, ch. 284, § 1, effective June 25, 2024", 50)),
        },
        {
            "id": "ri_adu_existing_footprint", "state_code": "RI", "bill_number": "P.L. 2024, ch. 284/285", "session": "2024",
            "short_name": "RI: one ADU by right inside an existing structure's footprint", "statute_citation": "R.I. Gen. Laws § 45-24-73(a)(3)",
            "effective_date": "2024-06-25", "statute_url": RI_73, "adus_by_right": 1,
            "unmapped_condition": "the ADU fits within the existing footprint of the primary structure or an existing accessory structure",
            "summary": "One accessory dwelling unit per lot is allowed by right where it is located within the existing footprint of the primary structure or an existing attached or detached accessory structure and does not expand it.",
            "verification": ver("verified", "Rhode Island General Laws (webserver.rilegislature.gov)", quote(RI_73, "(3) Where the proposed ADU is located within the existing footprint", 220)),
        },
        {
            "id": "ca_adu_66323", "state_code": "CA", "bill_number": "ADU law (Gov. Code §§ 66314-66342)", "session": "recodified 2024",
            "short_name": "CA: ADU and junior ADU approved ministerially on single-family lots", "statute_citation": "Cal. Gov. Code §§ 66317(a)(1), 66323(a)",
            "effective_date": None, "statute_url": CA_66323, "adus_by_right": 2,
            "summary": "A local agency must ministerially approve, in residential or mixed-use zones, one ADU and one junior ADU per lot with a proposed or existing single-family dwelling (among other combinations in § 66323); ADU permit applications are approved ministerially without discretionary review or a hearing (§ 66317).",
            "verification": ver("partially_verified", "FindLaw copy of the California Government Code, 'current as of January 01, 2026' (leginfo.legislature.ca.gov blocks the audit machine)",
                                quote(CA_66323, "(a) Notwithstanding Sections 66314 to 66322", 420) + " || " + quote(CA_66317, "(a) (1) A permit application for an accessory dwelling unit shall be considered and approved ministerially", 300),
                                ["effective_date (section history not on the fetched page; the ADU statute was renumbered into §§ 66314 et seq. in 2024)", "adus_by_right (other unit combinations in § 66323 not modeled)"],
                                "Secondary copy (FindLaw) of the official code; re-check against leginfo when reachable."),
        },
        {
            "id": "az_adaptive_reuse_9_462_10", "state_code": "AZ", "bill_number": "A.R.S. § 9-462.10 (as amended)", "session": "unconfirmed",
            "short_name": "AZ: multifamily / adaptive reuse on commercial, office and mixed-use parcels in cities of 150,000+",
            "statute_citation": "A.R.S. § 9-462.10", "effective_date": None, "statute_url": AZ_46210, "applies_to_zone": "commercial", "municipality_pop_min": 150000,
            "unmapped_condition": "parcel not inside a city-designated commercial or employment hub (cities may exclude up to 10% of such parcels), and within the share of parcels the city must open (at least 10%)",
            "summary": "Cities of 150,000+ must set objective standards allowing multifamily residential development or adaptive reuse of existing commercial, office or mixed-use parcels without a conditional use permit, PUD, rezoning or any hearing, on at least 10% of such parcels; they may exclude designated commercial/employment hubs (up to 10%) and may not exclude parcels averaging under 65 dB.",
            "verification": ver("partially_verified", "Arizona Revised Statutes (azleg.gov)", quote(AZ_46210, "A. Within ninety days after the effective date of this amendment to this section", 900),
                                ["effective_date (the azleg page has no history note; the amending act was not identified)", "bill_number"]),
        },
        {
            "id": "tx_sb15_small_lots", "state_code": "TX", "bill_number": "SB 15 (2025)", "session": "89th Legislature, Regular Session",
            "short_name": "TX SB 15: 3,000 sq ft lots allowed in new subdivisions of large cities", "statute_citation": "Tex. Local Gov't Code §§ 211.051-211.058 (added by SB 15, 89th Leg.)",
            "effective_date": "2025-09-01", "statute_url": TX_SB15, "municipality_pop_min": 150001,
            "unmapped_condition": "an unplatted tract of 5 acres or more in a single-family zone, in a city wholly or partly in a county of more than 300,000 people",
            "summary": "In cities over 150,000 people in counties over 300,000, on unplatted tracts of 5+ acres zoned single-family, a city may not require residential lots larger than 3,000 sq ft, wider than 30 ft or deeper than 75 ft, nor density rules that block a house on a 3,000 sq ft lot; small lots (≤4,000 sq ft) get setback, cover and parking limits.",
            "verification": ver("verified", "Enrolled bill text and bill history (capitol.texas.gov)",
                                quote(TX_SB15, "Sec. 211.054. CERTAIN DWELLING UNIT LOT SIZE REQUIREMENTS PROHIBITED.", 500) + " || " + quote(TX_SB15, "Sec. 211.052. APPLICABILITY. (a) This subchapter applies only to:", 420) + " || " + quote(TX_SB15_STATUS, "E Effective on 9/1/25 06/20/2025 E Signed by the Governor", 70),
                                [], "A lot-size preemption for new subdivisions, not a right to added units on existing lots."),
        },
    ]


def main():
    recs = records()
    for path in STATUTES:
        data = json.load(open(path))
        ids = {r["id"] for r in recs}
        data = [r for r in data if r["id"] not in ids] + [dict(r, last_verified=TODAY if r["verification"]["status"] == "verified" else None) for r in recs]
        with open(path, "w") as f:
            json.dump(data, f, indent=2)
            f.write("\n")
    a, b = (open(p, "rb").read() for p in STATUTES)
    assert a == b, "statutes.json and state-housing-laws.json must stay byte-identical"
    print(f"{len(recs)} records written to both statute files", file=sys.stderr)


if __name__ == "__main__":
    main()
