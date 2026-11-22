#!/usr/bin/env python3
"""Add the rules the site cards use to app/data/housing_funding_rules.json, each with a quote matched in a fetched copy.

  - 26 U.S.C. 42(d)(5)(B)(i): the 130 percent basis in a QCT or DDA (the statute's own words, full clause)
  - 26 U.S.C. 42(d)(5)(B)(v): a state agency may treat any building as in a DDA
  - 26 U.S.C. 42(g)(2)(C): the imputed income limitation: 1 person for a unit with no separate bedroom, 1.5 per bedroom
  - HUD's LIHTC maximum rent formula, in HUD's own column heading of its 2027 DDA workbook

Idempotent: rows with source_key "site_cards_2026_11_22" are replaced on every run. Run after
scripts/costs/build_housing_funding_rules.py, which rewrites the file without them.
Inputs in <dl>: usc26_42.html (https://www.law.cornell.edu/uscode/text/26/42), 2027-DDAs-Data-Used-to-Designate.xlsx.
Usage: python3 -I scripts/costs/add_site_card_rules.py <dl>
"""
import hashlib
import html
import json
import os
import re
import sys
from datetime import date

import openpyxl

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "app", "data", "housing_funding_rules.json")
USC = "https://www.law.cornell.edu/uscode/text/26/42"
DDA = "https://www.huduser.gov/portal/datasets/qct/2027-DDAs-Data-Used-to-Designate.xlsx"
KEY = "site_cards_2026_11_22"


def norm(t):
    """Page text with tags removed, whitespace collapsed, and the spaces Cornell's term links leave before punctuation removed."""
    t = re.sub(r"<script.*?</script>|<style.*?</style>", "", t, flags=re.S)
    t = html.unescape(re.sub(r"<[^>]+>", " ", t))
    t = re.sub(r"\s+", " ", t)
    t = re.sub(r"\s+([,.;:)])", r"\1", t)
    t = re.sub(r"“\s+", "“", t)
    return re.sub(r"\s+”", "”", t)


def main():
    dl = sys.argv[1]
    today = date.today().isoformat()
    up = os.path.join(dl, "usc26_42.html")
    usc = norm(open(up, encoding="utf-8").read())
    usc_sha = hashlib.sha256(open(up, "rb").read()).hexdigest()
    xp = os.path.join(dl, "2027-DDAs-Data-Used-to-Designate.xlsx")
    hdr = [str(h) for h in next(openpyxl.load_workbook(xp, read_only=True)["2027 MDDA"].iter_rows(values_only=True))]
    x_sha = hashlib.sha256(open(xp, "rb").read()).hexdigest()
    base = {"programme": "Low-Income Housing Tax Credit (federal)", "jurisdiction": "United States", "year": "current", "source_url": USC,
            "publisher": "U.S. Code, Title 26 section 42 (text as shown by Cornell Legal Information Institute; includes Pub. L. 119-21 amendments)",
            "edition": f"26 U.S.C. 42 as fetched {today}", "display_allowed": True,
            "display_terms": "Federal statute. Page copy is Cornell LII's; LII's own reuse terms were not fetched.", "source_key": KEY}
    rules = [
        dict(base, section="lihtc_basis_boost", what_it_funds_or_limits="26 U.S.C. 42(d)(5)(B)(i): a new building in a QCT or DDA counts 130 percent of its eligible basis",
             measure="basis_boost_clause", value=1.3, unit="x eligible basis (new building)", citation="26 U.S.C. 42(d)(5)(B)(i)(I)",
             quote="In the case of any building located in a qualified census tract or difficult development area which is designated for purposes of this subparagraph— (I) in the case of a new building, the eligible basis of such building shall be 130 percent of such basis"),
        dict(base, section="lihtc_basis_boost", what_it_funds_or_limits="26 U.S.C. 42(d)(5)(B)(v): the state housing credit agency may designate any building as needing the increase",
             measure="state_designated_boost", value="a building the state agency designates is treated as in a DDA", unit="text", citation="26 U.S.C. 42(d)(5)(B)(v)",
             quote="designated by the State housing credit agency as requiring the increase in credit under this subparagraph in order for such building to be financially feasible"),
        dict(base, section="lihtc_set_aside", what_it_funds_or_limits="26 U.S.C. 42(g)(2)(C): household size used for a unit's rent limit: 1 person with no separate bedroom, 1.5 per bedroom",
             measure="imputed_household_size", value={"no_bedroom": 1, "per_bedroom": 1.5}, unit="persons", citation="26 U.S.C. 42(g)(2)(C)",
             quote="(i) In the case of a unit which does not have a separate bedroom, 1 individual. (ii) In the case of a unit which has 1 or more separate bedrooms, 1.5 individuals for each separate bedroom."),
    ]
    for r in rules:
        if r["quote"] not in usc:
            sys.exit("quote not in the fetched statute: " + r["quote"][:80])
        r["verification"] = {"status": "quote_matched_in_fetched_text", "method": "scripts/costs/add_site_card_rules.py: tags removed, whitespace collapsed, spaces before punctuation removed, then the quote must occur", "checked_on": today, "source_file_sha256": usc_sha}
    head = "LIHTC Maximum Rent (1/12 of 30% of 120% of VLIL)"
    if head not in hdr:
        sys.exit("HUD workbook heading not found")
    rules.append({"section": "lihtc_set_aside", "programme": "Low-Income Housing Tax Credit (federal)", "jurisdiction": "United States",
                  "what_it_funds_or_limits": "HUD's LIHTC maximum rent formula: 1/12 of 30 percent of 120 percent of the very low-income (50 percent) limit, i.e. a rent at the 60 percent limit",
                  "measure": "hud_lihtc_rent_formula", "value": {"months": 12, "rent_share": 0.3, "vlil_multiple": 1.2}, "unit": "monthly rent = VLIL x 1.2 x 0.30 / 12",
                  "year": 2027, "source_url": DDA, "publisher": "HUD Office of Policy Development and Research (HUD User)", "edition": "2027 Difficult Development Areas - Data Used to Designate, sheet '2027 MDDA', column heading",
                  "quote": head, "verification": {"status": "quote_matched_in_fetched_text", "method": "column heading read from the fetched workbook", "checked_on": today, "source_file_sha256": x_sha},
                  "display_allowed": True, "display_terms": "U.S. federal government publication; no reuse restriction appears in the fetched file. Separate licence text not fetched.", "source_key": KEY})
    d = json.load(open(OUT))
    d["rows"] = [r for r in d["rows"] if r.get("source_key") != KEY] + rules
    d["_source"][KEY] = {"added_by": "scripts/costs/add_site_card_rules.py (run after build_housing_funding_rules.py)", "added": today, "rows": len(rules)}
    rc = d["_source"].get("row_counts", {})
    rc["total"] = len(d["rows"])
    rc[KEY] = len(rules)
    json.dump(d, open(OUT, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    print(f"{len(rules)} rules added", file=sys.stderr)


if __name__ == "__main__":
    main()
