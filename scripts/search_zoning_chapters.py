#!/usr/bin/env python3
"""Full-text search of each state's municipal zoning-enabling statutes for by-right housing provisions.

For the states where the 50-state pass found no qualifying law, the zoning-enabling chapter(s) are fetched from the
state's official code site (or a public mirror where the official site needs JavaScript) and searched for: accessory
dwelling units, duplex/two-family/middle housing, lot splits, parking minimums, and residential use in commercial
zones. Hits are printed with context for review; queries, URLs and outcomes go into docs/audit/state-laws-50.json.

Usage: python3 scripts/search_zoning_chapters.py [ST ...] > out.json
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fetch_law_text import fetch  # noqa: E402

CHAPTERS = {
    "AL": [("Code of Ala. §§ 11-52-70 to -85 (zoning)", "https://law.justia.com/codes/alabama/title-11/title-3/chapter-52/article-4/")],
    "AK": [("AS 29.40 (planning, platting, land use)", "https://www.akleg.gov/basis/statutes.asp?title=29#29.40")],
    "AR": [("A.C.A. § 14-56-416 (zoning ordinances)", "https://law.justia.com/codes/arkansas/title-14/subtitle-3/chapter-56/subchapter-4/section-14-56-416/")],
    "DE": [("22 Del. C. ch. 3 (municipal zoning)", "https://delcode.delaware.gov/title22/c003/index.html"),
           ("9 Del. C. ch. 26 (New Castle County zoning)", "https://delcode.delaware.gov/title9/c026/index.html")],
    "GA": [("O.C.G.A. ch. 36-66 (Zoning Procedures Law)", "https://law.justia.com/codes/georgia/title-36/chapter-66/")],
    "ID": [("Idaho Code ch. 67-65 (Local Land Use Planning)", "https://legislature.idaho.gov/statutesrules/idstat/Title67/T67CH65/")],
    "IL": [("65 ILCS 5/11-13 (municipal zoning)", "https://www.ilga.gov/legislation/ilcs/fulltext.asp?DocName=006500050K11-13-1")],
    "IN": [("IC 36-7-4 (local planning and zoning)", "https://law.justia.com/codes/indiana/title-36/article-7/chapter-4/")],
    "IA": [("Iowa Code ch. 414 (city zoning)", "https://www.legis.iowa.gov/docs/code/414.pdf"),
           ("Iowa Code ch. 335 (county zoning)", "https://www.legis.iowa.gov/docs/code/335.pdf")],
    "KS": [("K.S.A. 12-741 et seq. (planning and zoning)", "https://www.ksrevisor.org/statutes/chapters/ch12/012_007_0041.html")],
    "KY": [("KRS ch. 100 (planning and zoning)", "https://apps.legislature.ky.gov/law/statutes/chapter.aspx?id=37542")],
    "LA": [("La. R.S. 33:4721 (municipal zoning)", "https://legis.la.gov/Legis/Law.aspx?d=91364")],
    "MI": [("MCL 125.3101-125.3702 (Michigan Zoning Enabling Act)", "https://www.legislature.mi.gov/documents/mcl/pdf/mcl-Act-110-of-2006.pdf")],
    "MN": [("Minn. Stat. § 462.357 (municipal zoning)", "https://www.revisor.mn.gov/statutes/cite/462.357"),
           ("Minn. Stat. § 462.3593 (temporary family health care dwellings)", "https://www.revisor.mn.gov/statutes/cite/462.3593")],
    "MS": [("Miss. Code §§ 17-1-1 et seq. (zoning)", "https://law.justia.com/codes/mississippi/title-17/chapter-1/")],
    "MO": [("RSMo ch. 89 (zoning and planning)", "https://revisor.mo.gov/main/OneChapter.aspx?chapter=89")],
    "NE": [("Neb. Rev. Stat. ch. 19 (cities: zoning)", "https://nebraskalegislature.gov/laws/browse-chapters.php?chapter=19")],
    "NV": [("NRS ch. 278 (planning and zoning)", "https://www.leg.state.nv.us/nrs/nrs-278.html")],
    "NJ": [("N.J.S.A. 40:55D (Municipal Land Use Law)", "https://law.justia.com/codes/new-jersey/title-40/chapter-40-55d/")],
    "NM": [("NMSA 3-21 (zoning)", "https://law.justia.com/codes/new-mexico/chapter-3/article-21/")],
    "NY": [("Town Law § 261 (zoning)", "https://www.nysenate.gov/legislation/laws/TWN/261"),
           ("Village Law § 7-700", "https://www.nysenate.gov/legislation/laws/VIL/7-700"),
           ("General City Law § 20", "https://www.nysenate.gov/legislation/laws/GCT/20")],
    "NC": [("N.C.G.S. ch. 160D (local planning and development)", "https://www.ncleg.gov/EnactedLegislation/Statutes/HTML/ByChapter/Chapter_160D.html")],
    "ND": [("N.D.C.C. ch. 40-47 (city zoning)", "https://www.ndlegis.gov/cencode/t40c47.pdf")],
    "OH": [("ORC ch. 713 (municipal planning and zoning)", "https://codes.ohio.gov/ohio-revised-code/chapter-713"),
           ("ORC ch. 519 (township zoning)", "https://codes.ohio.gov/ohio-revised-code/chapter-519")],
    "OK": [("11 O.S. §§ 43-101 et seq. (municipal zoning)", "https://law.justia.com/codes/oklahoma/title-11/")],
    "PA": [("53 P.S. § 10601 et seq. (MPC Article VI, zoning)", "https://www.legis.state.pa.us/cfdocs/legis/LI/uconsCheck.cfm?txtType=HTM&yr=1968&sessInd=0&smthLwInd=0&act=247&chpt=6")],
    "SC": [("S.C. Code ch. 6-29 (local planning)", "https://www.scstatehouse.gov/code/t06c029.php")],
    "SD": [("SDCL ch. 11-4 (municipal zoning)", "https://sdlegislature.gov/api/Statutes/11-4.html"),
           ("SDCL ch. 11-2 (county planning and zoning)", "https://sdlegislature.gov/api/Statutes/11-2.html")],
    "TN": [("Tenn. Code § 13-7-201 et seq. (municipal zoning)", "https://law.justia.com/codes/tennessee/title-13/chapter-7/part-2/")],
    "VA": [("Va. Code ch. 15.2-22 art. 7 (zoning)", "https://law.lis.virginia.gov/vacode/title15.2/chapter22/article7/")],
    "WV": [("W. Va. Code ch. 8A-7 (zoning ordinance)", "https://code.wvlegislature.gov/8A-7/")],
    "WI": [("Wis. Stat. § 62.23 (city planning and zoning)", "https://docs.legis.wisconsin.gov/statutes/statutes/62/23"),
           ("Wis. Stat. § 66.10015 (development approvals)", "https://docs.legis.wisconsin.gov/statutes/statutes/66/x/10015"),
           ("Wis. Stat. § 66.1001 (comprehensive planning)", "https://docs.legis.wisconsin.gov/statutes/statutes/66/x/1001")],
    "WY": [("W.S. title 15 (cities and towns; 15-1-601 zoning)", "https://wyoleg.gov/statutes/compress/title15.pdf")],
}
TERMS = {
    "adu": r"accessory dwelling|accessory apartment|accessory unit|granny flat|ancillary dwelling",
    "middle_housing": r"middle housing|duplex|two-family|two family|triplex|fourplex|townhouse",
    "lot_split": r"lot split|split a lot|urban lot split|subdivide (?:a|the) (?:residential )?lot",
    "parking": r"minimum parking|parking minimum|parking requirement|off-street parking",
    "commercial_residential": r"residential use[s]? (?:in|on|within) (?:a |an |any )?(?:commercial|mixed)|commercial (?:zone|district)s? .{0,40}residential",
}
BLOCKED = ("Enable JavaScript and cookies", "Just a moment...")


def main():
    want = [a.upper() for a in sys.argv[1:]] or sorted(CHAPTERS)
    out = {}
    for st in want:
        out[st] = []
        for cite, url in CHAPTERS.get(st, []):
            code, text = fetch(url)
            rec = {"citation": cite, "url": url, "http": code, "chars": len(text), "hits": {}}
            if code == 200 and len(text) > 8000 and text.count(" shall ") >= 10 and not any(b in text[:4000] for b in BLOCKED):
                for k, pat in TERMS.items():
                    hs = [m.start() for m in re.finditer(pat, text, re.I)]
                    if hs:
                        rec["hits"][k] = {"count": len(hs), "contexts": [text[max(0, h - 220): h + 260] for h in hs[:4]]}
                rec["searched"] = True
            else:
                rec["searched"] = False
                rec["why_not"] = "blocked (bot check) or empty response" if code == 200 else f"HTTP {code}"
            out[st].append(rec)
            print(st, cite, code, len(text), sorted(rec["hits"]) if rec["searched"] else rec["why_not"], file=sys.stderr)
    json.dump(out, sys.stdout, indent=1)


if __name__ == "__main__":
    main()
